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
import { clearScheduledWorkoutsFromDate, clearScheduledWorkoutsFromToday, generateScheduledWorkouts } from "./workoutService"
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

export async function updatePlanRestDays(
  userId: string,
  plan: WorkoutPlan,
  restDays: number[],
  workoutNameMap?: Record<string, string>,
  durationDays = plan.durationDays ?? 63,
  startDate = addDays(getAppDate(), 1),
  protectedDayOfWeek = getAppDate().getDay()
): Promise<void> {
  const normalizedRestDays = normalizeRestDays(restDays, getRestDayCount(plan), protectedDayOfWeek)
  const scheduleEntries = buildPlanScheduleEntries(plan, workoutNameMap, normalizedRestDays, protectedDayOfWeek)
  const startDateString = format(startDate, "yyyy-MM-dd")

  await updateUserDocument(userId, {
    preferredRestDays: normalizedRestDays,
  })

  console.log("[updatePlanRestDays] updating rest days:", {
    userId,
    planId: plan.id,
    restDays: normalizedRestDays,
    startDate: startDateString,
    durationDays,
  })

  await clearScheduledWorkoutsFromDate(userId, startDateString)
  await generateScheduledWorkouts(userId, scheduleEntries, durationDays, startDate)

  console.log("[updatePlanRestDays] done")
}

const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6]

export interface PlanScheduleEntry {
  dayOfWeek: number
  workoutId: string | null
  workoutName: string
  isRest: boolean
  planId: string
  planName: string
}

function getRestDayCount(plan: WorkoutPlan) {
  return Math.max(0, Math.min(6, 7 - plan.daysPerWeek))
}

function normalizeRestDays(restDays: number[], restDayCount: number, protectedDayOfWeek: number) {
  const unique = Array.from(new Set(restDays))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6 && day !== protectedDayOfWeek)

  for (const day of WEEK_DAYS) {
    if (unique.length >= restDayCount) break
    if (day !== protectedDayOfWeek && !unique.includes(day)) unique.push(day)
  }

  return unique.slice(0, restDayCount).sort((a, b) => a - b)
}

export function getAutoRestDays(plan: WorkoutPlan, protectedDayOfWeek = getAppDate().getDay()) {
  const defaultRestDays = plan.schedule
    .filter((day) => day.isRest)
    .map((day) => day.dayOfWeek)

  return normalizeRestDays(defaultRestDays, getRestDayCount(plan), protectedDayOfWeek)
}

export function buildPlanScheduleEntries(
  plan: WorkoutPlan,
  workoutNameMap?: Record<string, string>,
  restDays?: number[],
  protectedDayOfWeek = getAppDate().getDay()
): PlanScheduleEntry[] {
  const normalizedRestDays = normalizeRestDays(
    restDays ?? getAutoRestDays(plan, protectedDayOfWeek),
    getRestDayCount(plan),
    protectedDayOfWeek
  )
  const restDaySet = new Set(normalizedRestDays)
  const workouts = plan.schedule.filter((day) => !day.isRest && day.workoutId)
  let workoutIndex = 0

  return WEEK_DAYS.map((dayOfWeek) => {
    const isRest = restDaySet.has(dayOfWeek)
    const workout = workouts[workoutIndex % Math.max(1, workouts.length)]
    const workoutId = isRest ? null : workout?.workoutId ?? null
    if (!isRest) workoutIndex += 1

    return {
      dayOfWeek,
      workoutId,
      workoutName: isRest
        ? "Rest Day"
        : (workoutNameMap?.[workoutId ?? ""] ?? plan.name),
      isRest,
      planId: plan.id,
      planName: plan.name,
    }
  })
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
  const restDays = getAutoRestDays(plan, startedAt.getDay())

  await updateUserDocument(userId, {
    currentPlanId: plan.id,
    currentPlanStartedAt: format(startedAt, "yyyy-MM-dd"),
    currentPlanEndsAt: format(endsAt, "yyyy-MM-dd"),
    planType: plan.type,
    preferredRestDays: restDays,
  })

  console.log("[activatePlan] activating plan:", plan.id, plan.name, "for userId:", userId)

  const scheduleEntries = buildPlanScheduleEntries(plan, workoutNameMap, restDays, startedAt.getDay())

  console.log("[activatePlan] schedule entries:", scheduleEntries)

  await clearScheduledWorkoutsFromToday(userId)
  await generateScheduledWorkouts(userId, scheduleEntries, durationDays)

  console.log("[activatePlan] done — plan:", plan.name)
}
