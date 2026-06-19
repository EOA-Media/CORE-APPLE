import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth"
import { auth, firebaseConfigStatus } from "@/lib/firebase"
import { getUserDocument } from "@/services/userService"
import { signOutUser } from "@/services/authService"
import { getDefaultWorkoutReminderSettings, saveWorkoutReminderSettings } from "@/services/pushNotificationService"
import type { User } from "@/data/models"

type AuthMode = "loading" | "authenticated" | "guest" | "unauthenticated" | "onboarding"

const AUTH_STARTUP_TIMEOUT_MS = 5000
const PROFILE_LOAD_TIMEOUT_MS = 10000

interface AuthContextValue {
  firebaseUser: FirebaseUser | null
  userDoc: User | null
  mode: AuthMode
  startupError: string | null
  isGuest: boolean
  setGuestMode: () => void
  signOut: () => Promise<void>
  refreshUserDoc: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [userDoc, setUserDoc] = useState<User | null>(null)
  const [mode, setMode] = useState<AuthMode>("loading")
  const [startupError, setStartupError] = useState<string | null>(null)

  const isGuestRef = useRef(false)

  function finishStartupUnauthenticated(message: string, error?: unknown) {
    console.warn("[Auth] Continuing without Firebase auth:", message, error)
    setFirebaseUser(null)
    setUserDoc(null)
    setStartupError(message)
    setMode("unauthenticated")
  }

  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms`))
      }, ms)

      promise
        .then(resolve, reject)
        .finally(() => window.clearTimeout(timeout))
    })
  }

  async function loadUserDoc(fbUser: FirebaseUser) {
    console.log("[Auth] Loading Firestore profile:", fbUser.uid)
    try {
      const doc = await withTimeout(
        getUserDocument(fbUser.uid),
        PROFILE_LOAD_TIMEOUT_MS,
        "Firestore profile load"
      )

      console.log("[Auth] Firestore profile loaded:", { uid: fbUser.uid, hasProfile: !!doc })
      setStartupError(null)

      if (!doc) {
        setUserDoc(null)
        setMode("onboarding")
        return
      }

      if (doc.workoutReminderHour === undefined) {
        const defaults = getDefaultWorkoutReminderSettings()
        saveWorkoutReminderSettings(fbUser.uid, defaults).catch((error) => {
          console.warn("[Auth] Failed to save default reminder settings:", error)
        })
        setUserDoc({ ...doc, ...defaults })
      } else {
        setUserDoc(doc)
      }

      setMode("authenticated")
    } catch (error) {
      finishStartupUnauthenticated("We couldn't load your CORE profile. Showing login/signup.", error)
    }
  }

  async function refreshUserDoc() {
    if (firebaseUser) {
      console.log("[Auth] Refreshing Firestore profile:", firebaseUser.uid)
      await loadUserDoc(firebaseUser)
    }
  }

  function setGuestMode() {
    console.log("[Auth] Entering guest mode")
    isGuestRef.current = true
    setStartupError(null)
    setMode("guest")
  }

  async function signOut() {
    console.log("[Auth] Signing out")
    isGuestRef.current = false
    try {
      await signOutUser()
    } catch (error) {
      console.warn("[Auth] Firebase sign out failed; clearing local auth state:", error)
    }
    setFirebaseUser(null)
    setUserDoc(null)
    setStartupError(null)
    setMode("unauthenticated")
  }

  useEffect(() => {
    console.log("[Auth] Starting Firebase auth listener")
    console.log("[Auth] firebaseConfigStatus.missingKeys:", firebaseConfigStatus.missingKeys)

    if (!firebaseConfigStatus.isComplete) {
      finishStartupUnauthenticated(
        `Firebase is missing required configuration: ${firebaseConfigStatus.missingKeys.join(", ")}`
      )
      return
    }

    let settled = false
    const startupTimeout = window.setTimeout(() => {
      if (settled) return
      settled = true
      finishStartupUnauthenticated("Firebase Auth did not finish starting within 5 seconds.")
    }, AUTH_STARTUP_TIMEOUT_MS)

    const unsub = onAuthStateChanged(
      auth,
      (fbUser) => {
        if (!settled) {
          settled = true
          window.clearTimeout(startupTimeout)
        }

        console.log("[Auth] Firebase auth state changed:", {
          hasUser: !!fbUser,
          uid: fbUser?.uid,
        })

        setFirebaseUser(fbUser)
        if (fbUser) {
          isGuestRef.current = false
          void loadUserDoc(fbUser)
        } else {
          setUserDoc(null)
          setStartupError(null)
          if (!isGuestRef.current) {
            setMode("unauthenticated")
          }
        }
      },
      (error) => {
        if (!settled) {
          settled = true
          window.clearTimeout(startupTimeout)
        }
        finishStartupUnauthenticated("Firebase Auth failed to start. Showing login/signup.", error)
      }
    )

    return () => {
      window.clearTimeout(startupTimeout)
      unsub()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userDoc,
        mode,
        startupError,
        isGuest: mode === "guest",
        setGuestMode,
        signOut,
        refreshUserDoc,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
