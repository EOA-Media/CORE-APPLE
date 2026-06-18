import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { WorkoutPlan, Workout } from "@/data/models"
import { updateUserDocument } from "./userService"
import { clearScheduledWorkoutsFromToday, generateScheduledWorkouts } from "./workoutService"
import { addDays, format } from "date-fns"
import { getAppDate } from "@/lib/appDate"

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function savePlan(plan: WorkoutPlan): Promise<void> {
  const ref = doc(db, "workoutPlans", plan.id)
  await setDoc(ref, { ...plan, updatedAt: serverTimestamp() }, { merge: true })
}

export async function getPlan(planId: string): Promise<WorkoutPlan | null> {
  const ref = doc(db, "workoutPlans", planId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as WorkoutPlan
}

export async function getCorePlans(): Promise<WorkoutPlan[]> {
  const q = query(
    collection(db, "workoutPlans"),
    where("createdBy", "==", "core")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as WorkoutPlan)
}

export async function getCustomPlansForUser(userId: string): Promise<WorkoutPlan[]> {
  const q = query(
    collection(db, "workoutPlans"),
    where("createdBy", "==", userId),
    where("type", "==", "custom")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as WorkoutPlan)
}

// ─── Workouts ─────────────────────────────────────────────────────────────────

export async function saveWorkout(workout: Workout): Promise<void> {
  const ref = doc(db, "workouts", workout.id)
  await setDoc(ref, { ...workout, updatedAt: serverTimestamp() }, { merge: true })
}

export async function getWorkout(workoutId: string): Promise<Workout | null> {
  const ref = doc(db, "workouts", workoutId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as Workout
}

export async function getWorkoutsForPlan(planId: string): Promise<Workout[]> {
  const q = query(collection(db, "workouts"), where("planId", "==", planId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as Workout)
}

// ─── Activate plan ────────────────────────────────────────────────────────────

/**
 * Switch a user to a new plan:
 * 1. Saves the plan document.
 * 2. Updates the user's currentPlanId + planType.
 * 3. Generates 8 weeks of scheduled workouts.
 */
export async function activatePlan(
  userId: string,
  plan: WorkoutPlan,
  workoutNameMap?: Record<string, string>
): Promise<void> {
  await savePlan(plan)
  const startedAt = getAppDate()
  const durationDays = plan.durationDays ?? 63
  const endsAt = addDays(startedAt, durationDays - 1)

  await updateUserDocument(userId, {
    currentPlanId: plan.id,
    currentPlanStartedAt: format(startedAt, "yyyy-MM-dd"),
    currentPlanEndsAt: format(endsAt, "yyyy-MM-dd"),
    planType: plan.type,
  })

  console.log("[activatePlan] activating plan:", plan.id, plan.name, "for userId:", userId)

  const scheduleEntries = plan.schedule.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    workoutId: s.workoutId,
    workoutName: s.isRest
      ? "Rest Day"
      : (workoutNameMap?.[s.workoutId ?? ""] ?? plan.name),
    isRest: s.isRest,
    planId: plan.id,
    planName: plan.name,
  }))

  console.log("[activatePlan] schedule entries:", scheduleEntries)

  await clearScheduledWorkoutsFromToday(userId)
  await generateScheduledWorkouts(userId, scheduleEntries, durationDays)

  console.log("[activatePlan] done — plan:", plan.name)
}
