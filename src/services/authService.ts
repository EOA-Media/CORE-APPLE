import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth"
import { auth } from "@/lib/firebase"

const googleProvider = new GoogleAuthProvider()
const EMAIL_AUTH_TIMEOUT_MS = 15000

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

function withEmailAuthTimeout<T>(promise: Promise<T>, action: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(Object.assign(
        new Error(`${action} timed out after ${EMAIL_AUTH_TIMEOUT_MS / 1000} seconds`),
        { code: "auth/timeout" }
      ))
    }, EMAIL_AUTH_TIMEOUT_MS)

    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeout))
  })
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  try {
    const credential = await withEmailAuthTimeout(
      createUserWithEmailAndPassword(auth, email, password),
      "createUserWithEmailAndPassword"
    )
    await withEmailAuthTimeout(updateProfile(credential.user, { displayName }), "updateProfile")
    return credential.user
  } catch (error) {
    console.error("[AuthService] createUserWithEmailAndPassword failed:", error)
    throw toEmailAuthError(error)
  }
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  try {
    const credential = await withEmailAuthTimeout(
      signInWithEmailAndPassword(auth, email, password),
      "signInWithEmailAndPassword"
    )
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
  await signOut(auth)
}
