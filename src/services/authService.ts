import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth"
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

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}
