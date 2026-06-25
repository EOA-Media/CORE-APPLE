import {
  createUserWithEmailAndPassword,
  deleteUser,
  OAuthProvider,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth"
import { Capacitor } from "@capacitor/core"
import { auth } from "@/lib/firebase"

export interface EmailAuthError extends Error {
  code: string
}

function toEmailAuthError(error: unknown, fallbackCode = "auth/unknown"): EmailAuthError {
  if (error instanceof Error) {
    const maybeCode = "code" in error && typeof error.code === "string" ? error.code : fallbackCode
    return Object.assign(error, { code: maybeCode })
  }

  return Object.assign(new Error(String(error)), { code: fallbackCode })
}

const APPLE_CLIENT_ID = "com.corefitness.app"
const APPLE_REDIRECT_URI = "https://core-6a386.firebaseapp.com/__/auth/handler"

function randomNonce(length = 32) {
  const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._"
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  return Array.from(randomValues, (value) => charset[value % charset.length]).join("")
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function getAppleDisplayName(response: { givenName: string | null; familyName: string | null }) {
  return [response.givenName, response.familyName].filter(Boolean).join(" ").trim()
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  console.log("[AuthService] createUserWithEmailAndPassword starting")
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    console.log("[AuthService] createUserWithEmailAndPassword succeeded:", { uid: credential.user.uid })
    await updateProfile(credential.user, { displayName })
    return credential.user
  } catch (error) {
    console.error("[AuthService] createUserWithEmailAndPassword failed:", error)
    throw toEmailAuthError(error)
  }
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  console.log("[AuthService] signInWithEmailAndPassword starting")
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    console.log("[AuthService] signInWithEmailAndPassword succeeded:", { uid: credential.user.uid })
    return credential.user
  } catch (error) {
    console.error("[AuthService] signInWithEmailAndPassword failed:", error)
    throw toEmailAuthError(error)
  }
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const { browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup } = await import("firebase/auth")
  const credential = await signInWithPopup(auth, new GoogleAuthProvider(), browserPopupRedirectResolver)
  return credential.user
}

export async function signInWithApple(): Promise<FirebaseUser> {
  console.log("[AuthService] Sign in with Apple starting")

  try {
    if (Capacitor.getPlatform() === "ios") {
      const { SignInWithApple } = await import("@capacitor-community/apple-sign-in")
      const rawNonce = randomNonce()
      const hashedNonce = await sha256(rawNonce)
      const result = await SignInWithApple.authorize({
        clientId: APPLE_CLIENT_ID,
        redirectURI: APPLE_REDIRECT_URI,
        scopes: "email name",
        nonce: hashedNonce,
      })
      const identityToken = result.response.identityToken
      if (!identityToken) {
        throw Object.assign(new Error("Apple did not return an identity token."), { code: "auth/apple-no-identity-token" })
      }

      const provider = new OAuthProvider("apple.com")
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce,
      })
      const firebaseCredential = await signInWithCredential(auth, credential)
      const appleDisplayName = getAppleDisplayName(result.response)
      if (appleDisplayName && !firebaseCredential.user.displayName) {
        await updateProfile(firebaseCredential.user, { displayName: appleDisplayName })
      }
      console.log("[AuthService] Sign in with Apple succeeded:", { uid: firebaseCredential.user.uid })
      return firebaseCredential.user
    }

    const { browserPopupRedirectResolver, signInWithPopup } = await import("firebase/auth")
    const provider = new OAuthProvider("apple.com")
    provider.addScope("email")
    provider.addScope("name")
    const credential = await signInWithPopup(auth, provider, browserPopupRedirectResolver)
    console.log("[AuthService] Sign in with Apple web popup succeeded:", { uid: credential.user.uid })
    return credential.user
  } catch (error) {
    console.error("[AuthService] Sign in with Apple failed:", error)
    throw toEmailAuthError(error, "auth/apple-sign-in-failed")
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

export async function deleteAuthAccount(user: FirebaseUser): Promise<void> {
  console.log("[AuthService] deleteUser starting:", { uid: user.uid })
  try {
    await deleteUser(user)
    console.log("[AuthService] deleteUser succeeded:", { uid: user.uid })
  } catch (error) {
    console.error("[AuthService] deleteUser failed:", error)
    throw toEmailAuthError(error, "auth/delete-account-failed")
  }
}
