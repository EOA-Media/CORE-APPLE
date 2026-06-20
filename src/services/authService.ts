import {
  Capacitor,
} from "@capacitor/core"
import {
  FirebaseAuthentication,
  type User as NativeFirebaseUser,
} from "@capacitor-firebase/authentication"
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

export interface CoreAuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL?: string | null
}

export interface EmailAuthError extends Error {
  code: string
}

function shouldUseNativeAuth() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"
}

function toEmailAuthError(error: unknown, fallbackCode = "auth/unknown"): EmailAuthError {
  if (error instanceof Error) {
    const maybeCode = "code" in error && typeof error.code === "string" ? error.code : fallbackCode
    return Object.assign(error, { code: maybeCode })
  }

  return Object.assign(new Error(String(error)), { code: fallbackCode })
}

function normalizeWebUser(user: FirebaseUser): CoreAuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  }
}

export function normalizeNativeUser(user: NativeFirebaseUser | null, displayNameFallback?: string): CoreAuthUser {
  if (!user) {
    throw Object.assign(new Error("Native Firebase Auth returned no user."), { code: "auth/no-user" })
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName ?? displayNameFallback ?? null,
    photoURL: user.photoUrl,
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<CoreAuthUser> {
  const useNativeAuth = shouldUseNativeAuth()
  console.log("[AuthService] createUserWithEmailAndPassword starting", {
    provider: useNativeAuth ? "capacitor-native" : "firebase-web",
    platform: Capacitor.getPlatform(),
  })
  try {
    if (useNativeAuth) {
      const result = await FirebaseAuthentication.createUserWithEmailAndPassword({ email, password })
      console.log("[AuthService] native createUserWithEmailAndPassword succeeded:", { uid: result.user?.uid })
      await FirebaseAuthentication.updateProfile({ displayName })
      return normalizeNativeUser(result.user, displayName)
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password)
    console.log("[AuthService] createUserWithEmailAndPassword succeeded:", { uid: credential.user.uid })
    await updateProfile(credential.user, { displayName })
    return normalizeWebUser(credential.user)
  } catch (error) {
    console.error("[AuthService] createUserWithEmailAndPassword failed:", error)
    throw toEmailAuthError(error)
  }
}

export async function signInWithEmail(email: string, password: string): Promise<CoreAuthUser> {
  const useNativeAuth = shouldUseNativeAuth()
  console.log("[AuthService] signInWithEmailAndPassword starting", {
    provider: useNativeAuth ? "capacitor-native" : "firebase-web",
    platform: Capacitor.getPlatform(),
  })
  try {
    if (useNativeAuth) {
      const result = await FirebaseAuthentication.signInWithEmailAndPassword({ email, password })
      console.log("[AuthService] native signInWithEmailAndPassword succeeded:", { uid: result.user?.uid })
      return normalizeNativeUser(result.user)
    }

    const credential = await signInWithEmailAndPassword(auth, email, password)
    console.log("[AuthService] signInWithEmailAndPassword succeeded:", { uid: credential.user.uid })
    return normalizeWebUser(credential.user)
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
  if (shouldUseNativeAuth()) {
    await FirebaseAuthentication.signOut()
    return
  }

  await signOut(auth)
}
