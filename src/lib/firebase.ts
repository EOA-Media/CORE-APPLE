import { initializeApp, getApps } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

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

const requiredFirebaseConfig = ["apiKey", "authDomain", "projectId", "appId"] as const
const missingFirebaseConfig = requiredFirebaseConfig.filter((key) => !firebaseConfig[key])

export const firebaseConfigStatus = {
  isComplete: missingFirebaseConfig.length === 0,
  missingKeys: missingFirebaseConfig,
}

if (!firebaseConfigStatus.isComplete) {
  console.error("[Firebase] Missing required configuration:", firebaseConfigStatus.missingKeys)
} else {
  console.log("[Firebase] Configuration loaded for project:", firebaseConfig.projectId)
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export default app
