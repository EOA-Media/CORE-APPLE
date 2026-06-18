import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { getUserDocument } from "@/services/userService"
import { signOutUser } from "@/services/authService"
import { getDefaultWorkoutReminderSettings, saveWorkoutReminderSettings } from "@/services/pushNotificationService"
import type { User } from "@/data/models"

type AuthMode = "loading" | "authenticated" | "guest" | "unauthenticated"

interface AuthContextValue {
  firebaseUser: FirebaseUser | null
  userDoc: User | null
  mode: AuthMode
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

  // Use a ref so the onAuthStateChanged listener always reads the current guest state
  const isGuestRef = useRef(false)

  async function loadUserDoc(fbUser: FirebaseUser) {
    try {
      const doc = await getUserDocument(fbUser.uid)
      if (doc && doc.workoutReminderHour === undefined) {
        const defaults = getDefaultWorkoutReminderSettings()
        await saveWorkoutReminderSettings(fbUser.uid, defaults)
        setUserDoc({ ...doc, ...defaults })
      } else {
        setUserDoc(doc)
      }
      setMode("authenticated")
    } catch {
      setMode("authenticated")
    }
  }

  async function refreshUserDoc() {
    if (firebaseUser) await loadUserDoc(firebaseUser)
  }

  function setGuestMode() {
    isGuestRef.current = true
    setMode("guest")
  }

  async function signOut() {
    isGuestRef.current = false
    try {
      await signOutUser()
    } catch {
      // Ignore errors — clear local state regardless
    }
    setFirebaseUser(null)
    setUserDoc(null)
    setMode("unauthenticated")
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser)
      if (fbUser) {
        isGuestRef.current = false
        loadUserDoc(fbUser)
      } else {
        setUserDoc(null)
        // Only redirect to unauthenticated if not in guest mode
        if (!isGuestRef.current) {
          setMode("unauthenticated")
        }
      }
    })
    return unsub
  }, [])

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userDoc,
        mode,
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
