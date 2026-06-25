import {
  doc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  limit,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { User, OnboardingAnswers } from "@/data/models"
import { getRankFromDP } from "@/data/helpers"

function getFirestoreErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: "code" in error ? error.code : undefined,
      customData: "customData" in error ? error.customData : undefined,
      cause: "cause" in error ? error.cause : undefined,
    }
  }

  return {
    message: String(error),
  }
}

function logFirestoreFailure(operation: string, context: Record<string, unknown>, error: unknown) {
  console.error(`[Firestore] ${operation} failed:`, {
    context,
    error: getFirestoreErrorDetails(error),
    rawError: error,
  })
}

// ─── Username availability ────────────────────────────────────────────────────

export async function isDisplayNameTaken(displayName: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, "users"),
      where("displayNameLower", "==", displayName.toLowerCase().trim()),
      limit(1)
    )
    const snap = await getDocs(q)
    return !snap.empty
  } catch (error) {
    logFirestoreFailure("isDisplayNameTaken", { displayName }, error)
    throw error
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createUserProfile(
  userId: string,
  displayName: string,
  email: string,
  onboardingAnswers: OnboardingAnswers
): Promise<void> {
  const userRef = doc(db, "users", userId)

  const userData = {
    id: userId,
    username: email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, ""),
    displayName,
    displayNameLower: displayName.toLowerCase().trim(),
    email,
    photoURL: "",
    currentPlanId: "",
    planType: "core",
    streak: 0,
    longestStreak: 0,
    disciplinePoints: 0,
    rank: "Bronze",
    workoutsCompleted: 0,
    partialWorkouts: 0,
    missedWorkouts: 0,
    consistencyPercent: 0,
    pushNotificationsEnabled: false,
    workoutReminderEnabled: true,
    workoutReminderHour: 9,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    pushTokens: [],
    pushPermissionStatus: "unknown",
    preferredWorkoutTime: (onboardingAnswers.preferredTime?.toLowerCase() ?? "morning") as
      | "morning"
      | "afternoon"
      | "evening",
    onboardingAnswers,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  try {
    console.log("[Firestore] createUserProfile starting:", { userId, email, displayName })
    await setDoc(userRef, userData)
    console.log("[Firestore] createUserProfile succeeded:", { userId })
  } catch (error) {
    logFirestoreFailure("createUserProfile", { userId, email, displayName }, error)
    throw error
  }
}

// Keep legacy name as an alias so OnboardingPage doesn't break
export const createUserDocument = createUserProfile

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getUserDocument(userId: string): Promise<User | null> {
  const userRef = doc(db, "users", userId)
  try {
    console.log("[Firestore] getUserDocument starting:", { userId })
    const snap = await getDoc(userRef)
    if (!snap.exists()) {
      console.log("[Firestore] getUserDocument missing profile:", { userId })
      return null
    }

    const data = snap.data()
    console.log("[Firestore] getUserDocument succeeded:", { userId })
    // Normalize Firestore Timestamps to ISO strings for the UI
    return {
      ...data,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : (data.createdAt ?? ""),
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate().toISOString()
          : (data.updatedAt ?? ""),
    } as User
  } catch (error) {
    logFirestoreFailure("getUserDocument", { userId }, error)
    throw error
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateUserDocument(
  userId: string,
  data: Partial<User>
): Promise<void> {
  const userRef = doc(db, "users", userId)
  try {
    await updateDoc(userRef, { ...data, updatedAt: serverTimestamp() })
  } catch (error) {
    logFirestoreFailure("updateUserDocument", { userId, fields: Object.keys(data) }, error)
    throw error
  }
}

export async function deleteUserDocument(userId: string): Promise<void> {
  const userRef = doc(db, "users", userId)
  try {
    console.log("[Firestore] deleteUserDocument starting:", { userId })
    await deleteDoc(userRef)
    console.log("[Firestore] deleteUserDocument succeeded:", { userId })
  } catch (error) {
    logFirestoreFailure("deleteUserDocument", { userId }, error)
    throw error
  }
}

/**
 * Update user stats after a workout session completes.
 * Recalculates rank, consistency, and longest streak automatically.
 */
export async function updateUserStats(
  userId: string,
  opts: {
    dpDelta: number
    completionPercent: number
    newStreak: number
  }
): Promise<void> {
  const userRef = doc(db, "users", userId)
  const snap = await getDoc(userRef)
  if (!snap.exists()) return

  const current = snap.data() as User
  const isCompleted = opts.completionPercent >= 100
  const isPartial = opts.completionPercent > 0 && opts.completionPercent < 100
  const isMissed = opts.completionPercent <= 0

  const newDP = Math.max(0, (current.disciplinePoints ?? 0) + opts.dpDelta)
  const newRank = getRankFromDP(newDP).name
  const newWorkoutsCompleted =
    (current.workoutsCompleted ?? 0) + (isCompleted ? 1 : 0)
  const newPartialWorkouts =
    (current.partialWorkouts ?? 0) + (isPartial ? 1 : 0)
  const newMissedWorkouts =
    (current.missedWorkouts ?? 0) + (isMissed ? 1 : 0)
  const newLongestStreak = Math.max(
    current.longestStreak ?? 0,
    opts.newStreak
  )
  const totalDecided = newWorkoutsCompleted + newPartialWorkouts + newMissedWorkouts
  const completedEquivalent =
    newWorkoutsCompleted + (current.partialWorkouts ?? 0) + (isPartial ? opts.completionPercent / 100 : 0)
  const consistencyPercent = totalDecided > 0
    ? Math.min(100, Math.round((completedEquivalent / totalDecided) * 100))
    : 0

  await updateDoc(userRef, {
    disciplinePoints: newDP,
    rank: newRank,
    streak: opts.newStreak,
    longestStreak: newLongestStreak,
    workoutsCompleted: newWorkoutsCompleted,
    partialWorkouts: newPartialWorkouts,
    missedWorkouts: newMissedWorkouts,
    consistencyPercent,
    updatedAt: serverTimestamp(),
  })
}
