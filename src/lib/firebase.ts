import { Capacitor } from "@capacitor/core"
import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { browserLocalPersistence, getAuth, inMemoryPersistence, initializeAuth, type Auth } from "firebase/auth"
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"

const env = import.meta.env as Record<string, string | undefined>
const getFirebaseEnv = (viteKey: string, codemagicKey: string) => env[viteKey] ?? env[codemagicKey]

const firebaseConfig = {
  apiKey: getFirebaseEnv("VITE_FIREBASE_API_KEY", "FIREBASE_API_KEY"),
  authDomain: getFirebaseEnv("VITE_FIREBASE_AUTH_DOMAIN", "FIREBASE_AUTH_DOMAIN"),
  projectId: getFirebaseEnv("VITE_FIREBASE_PROJECT_ID", "FIREBASE_PROJECT_ID"),
  storageBucket: getFirebaseEnv("VITE_FIREBASE_STORAGE_BUCKET", "FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getFirebaseEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "FIREBASE_MESSAGING_SENDER_ID"),
  appId: getFirebaseEnv("VITE_FIREBASE_APP_ID", "FIREBASE_APP_ID"),
}

export const firebaseNetworkDiagnosticsConfig = {
  apiKey: firebaseConfig.apiKey ?? "",
  projectId: firebaseConfig.projectId ?? "",
}

export const firebaseEnvPresence = {
  VITE_FIREBASE_API_KEY: !!env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: !!env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: !!env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_APP_ID: !!env.VITE_FIREBASE_APP_ID,
}

console.log("[Firebase] env presence before initializeApp:", firebaseEnvPresence)

const requiredFirebaseConfig = ["apiKey", "authDomain", "projectId", "appId"] as const
const missingFirebaseConfig = requiredFirebaseConfig.filter((key) => !firebaseConfig[key])
const isNativeIos = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"

export const firebaseConfigStatus = {
  isComplete: missingFirebaseConfig.length === 0,
  missingKeys: missingFirebaseConfig,
  envPresence: firebaseEnvPresence,
  initializationError: null as string | null,
}

console.log("[Firebase] firebaseConfigStatus.missingKeys:", firebaseConfigStatus.missingKeys)
console.log("[Firebase] runtime:", {
  platform: Capacitor.getPlatform(),
  isNative: Capacitor.isNativePlatform(),
  isNativeIos,
  origin: typeof window !== "undefined" ? window.location.origin : "unknown",
})

if (!firebaseConfigStatus.isComplete) {
  console.error("[Firebase] Missing required configuration:", firebaseConfigStatus.missingKeys)
} else {
  console.log("[Firebase] Configuration loaded for project:", firebaseConfig.projectId)
}

let app: FirebaseApp | null = null

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
} catch (error) {
  firebaseConfigStatus.initializationError = error instanceof Error ? error.message : String(error)
  console.error("[Firebase] initializeApp failed:", error)
}

function createAuth(firebaseApp: FirebaseApp): Auth {
  try {
    console.log("[Firebase] Initializing Auth persistence:", isNativeIos ? "inMemoryPersistence" : "browserLocalPersistence")
    return initializeAuth(firebaseApp, {
      persistence: isNativeIos ? inMemoryPersistence : browserLocalPersistence,
    })
  } catch (error) {
    console.warn("[Firebase] initializeAuth fell back to getAuth:", error)
    return getAuth(firebaseApp)
  }
}

function createFirestore(firebaseApp: FirebaseApp): Firestore {
  try {
    if (isNativeIos) {
      console.log("[Firebase] Initializing Firestore with iOS long polling")
      return initializeFirestore(firebaseApp, {
        experimentalForceLongPolling: true,
      })
    }
  } catch (error) {
    console.warn("[Firebase] initializeFirestore fell back to getFirestore:", error)
  }

  return getFirestore(firebaseApp)
}

export const auth = app ? createAuth(app) : (null as unknown as Auth)
export const db = app ? createFirestore(app) : (null as unknown as Firestore)
export const storage = app ? getStorage(app) : (null as unknown as FirebaseStorage)

export default app
