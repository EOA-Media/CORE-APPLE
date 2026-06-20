import { Capacitor } from "@capacitor/core"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth"
import { auth, firebaseNetworkDiagnosticsConfig } from "@/lib/firebase"

const googleProvider = new GoogleAuthProvider()
const REST_AUTH_SESSION_KEY = "core.firebaseRestAuthSession"

export interface CoreAuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL?: string | null
}

export interface EmailAuthError extends Error {
  code: string
}

interface IdentityToolkitAuthResponse {
  localId?: string
  email?: string
  displayName?: string
  idToken?: string
  refreshToken?: string
  expiresIn?: string
}

interface RestAuthSession {
  user: CoreAuthUser
  idToken: string
  refreshToken: string
  expiresAt: number
}

export function isCapacitorIos() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"
}

function toEmailAuthError(error: unknown, fallbackCode = "auth/unknown"): EmailAuthError {
  if (error instanceof Error) {
    const maybeCode = "code" in error && typeof error.code === "string" ? error.code : fallbackCode
    return Object.assign(error, { code: maybeCode })
  }

  return Object.assign(new Error(String(error)), { code: fallbackCode })
}

function getRestApiKey() {
  const apiKey = firebaseNetworkDiagnosticsConfig.apiKey
  if (!apiKey) {
    throw Object.assign(new Error("Missing Firebase API key for REST auth."), { code: "auth/missing-api-key" })
  }
  return apiKey
}

function getRestErrorMessage(errorBody: string) {
  try {
    const parsed = JSON.parse(errorBody) as { error?: { message?: string; code?: number; status?: string } }
    if (parsed.error?.message) {
      return parsed.error.message
    }
  } catch {
    // Fall through to the raw response body.
  }
  return errorBody || "Firebase Auth REST request failed"
}

async function postIdentityToolkit(endpoint: "signInWithPassword" | "signUp" | "update", body: Record<string, unknown>) {
  const apiKey = getRestApiKey()
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(apiKey)}`
  console.log(`[AuthService] Firebase Auth REST ${endpoint} starting`)
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const responseText = await response.text()

  if (!response.ok) {
    const message = getRestErrorMessage(responseText)
    console.error(`[AuthService] Firebase Auth REST ${endpoint} failed:`, {
      status: response.status,
      statusText: response.statusText,
      body: responseText,
      message,
    })
    throw Object.assign(new Error(message), { code: `auth/rest-${endpoint}-failed` })
  }

  console.log(`[AuthService] Firebase Auth REST ${endpoint} succeeded:`, { status: response.status })
  return JSON.parse(responseText) as IdentityToolkitAuthResponse
}

function normalizeRestUser(result: IdentityToolkitAuthResponse, displayNameFallback?: string): CoreAuthUser {
  if (!result.localId) {
    throw Object.assign(new Error("Firebase Auth REST response did not include localId."), { code: "auth/rest-missing-local-id" })
  }

  return {
    uid: result.localId,
    email: result.email ?? null,
    displayName: result.displayName ?? displayNameFallback ?? null,
    photoURL: null,
  }
}

function saveRestAuthSession(result: IdentityToolkitAuthResponse, user: CoreAuthUser) {
  if (!result.idToken || !result.refreshToken) {
    throw Object.assign(new Error("Firebase Auth REST response did not include auth tokens."), { code: "auth/rest-missing-tokens" })
  }

  const expiresInSeconds = Number(result.expiresIn ?? 3600)
  const session: RestAuthSession = {
    user,
    idToken: result.idToken,
    refreshToken: result.refreshToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  }
  window.localStorage.setItem(REST_AUTH_SESSION_KEY, JSON.stringify(session))
  window.dispatchEvent(new CustomEvent("core:rest-auth-changed", { detail: session.user }))
}

export function getStoredRestAuthUser(): CoreAuthUser | null {
  try {
    const raw = window.localStorage.getItem(REST_AUTH_SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as RestAuthSession
    if (!session.user?.uid || !session.idToken) return null
    if (session.expiresAt <= Date.now()) {
      window.localStorage.removeItem(REST_AUTH_SESSION_KEY)
      return null
    }
    return session.user
  } catch (error) {
    console.warn("[AuthService] Failed to read REST auth session:", error)
    window.localStorage.removeItem(REST_AUTH_SESSION_KEY)
    return null
  }
}

export function clearStoredRestAuthSession() {
  window.localStorage.removeItem(REST_AUTH_SESSION_KEY)
  window.dispatchEvent(new CustomEvent("core:rest-auth-changed", { detail: null }))
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser | CoreAuthUser> {
  console.log("[AuthService] createUserWithEmailAndPassword starting")
  try {
    if (isCapacitorIos()) {
      const signupResult = await postIdentityToolkit("signUp", {
        email,
        password,
        returnSecureToken: true,
      })
      const updateResult = await postIdentityToolkit("update", {
        idToken: signupResult.idToken,
        displayName,
        returnSecureToken: true,
      })
      const mergedResult = { ...signupResult, ...updateResult, displayName }
      const user = normalizeRestUser(mergedResult, displayName)
      saveRestAuthSession(mergedResult, user)
      console.log("[AuthService] Firebase Auth REST signUp completed:", { uid: user.uid })
      return user
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password)
    console.log("[AuthService] createUserWithEmailAndPassword succeeded:", { uid: credential.user.uid })
    await updateProfile(credential.user, { displayName })
    return credential.user
  } catch (error) {
    console.error("[AuthService] createUserWithEmailAndPassword failed:", error)
    throw toEmailAuthError(error)
  }
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser | CoreAuthUser> {
  console.log("[AuthService] signInWithEmailAndPassword starting")
  try {
    if (isCapacitorIos()) {
      const result = await postIdentityToolkit("signInWithPassword", {
        email,
        password,
        returnSecureToken: true,
      })
      const user = normalizeRestUser(result)
      saveRestAuthSession(result, user)
      console.log("[AuthService] Firebase Auth REST signInWithPassword completed:", { uid: user.uid })
      return user
    }

    const credential = await signInWithEmailAndPassword(auth, email, password)
    console.log("[AuthService] signInWithEmailAndPassword succeeded:", { uid: credential.user.uid })
    return credential.user
  } catch (error) {
    console.error("[AuthService] signInWithEmailAndPassword failed:", error)
    throw toEmailAuthError(error)
  }
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const credential = await signInWithPopup(auth, googleProvider)
  return credential.user
}

export async function signOutUser(): Promise<void> {
  if (isCapacitorIos()) {
    clearStoredRestAuthSession()
    return
  }

  await signOut(auth)
}
