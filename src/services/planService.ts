import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { WorkoutPlan, Workout } from "@/data/models"
import { updateUserDocument } from "./userService"
import { clearScheduledWorkoutsFromDate, clearScheduledWorkoutsFromToday, generateScheduledWorkouts } from "./workoutService"
import { addDays, format } from "date-fns"
import { getAppDate } from "@/lib/appDate"

// ─── Plans ────────────────────────────────────────────────────────────────────

const SHARE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function normalizePlanShareCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function makePlanShareCode(): string {
  return Array.from({ length: 8 }, () => (
    SHARE_CODE_CHARS[Math.floor(Math.random() * SHARE_CODE_CHARS.length)]
  )).join("")
}

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

export async function getCustomPlanByShareCode(code: string): Promise<WorkoutPlan | null> {
  const normalizedCode = normalizePlanShareCode(code)
  if (!normalizedCode) return null

  const q = query(
    collection(db, "workoutPlans"),
    where("shareCode", "==", normalizedCode),
    limit(1)
  )
  const snap = await getDocs(q)
  const plan = snap.docs[0]?.data() as WorkoutPlan | undefined
  return plan?.type === "custom" ? plan : null
}

export async function generateUniquePlanShareCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makePlanShareCode()
    const existing = await getCustomPlanByShareCode(code)
    if (!existing) return code
  }

  throw Object.assign(
    new Error("Could not create a unique plan share code. Please try again."),
    { code: "firestore/share-code-collision" }
  )
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

export async function importCustomPlanFromShareCode(
  userId: string,
  code: string
): Promise<WorkoutPlan> {
  const shareCode = normalizePlanShareCode(code)
  if (shareCode.length < 4) {
    throw Object.assign(
      new Error("Enter a valid custom plan code."),
      { code: "custom-plan/invalid-share-code" }
    )
  }

  const sharedPlan = await getCustomPlanByShareCode(shareCode)
  if (!sharedPlan) {
    throw Object.assign(
      new Error("No custom plan was found for that code."),
      { code: "custom-plan/share-code-not-found" }
    )
  }

  let sharedWorkouts = sharedPlan.sharedWorkouts ?? []
  if (sharedWorkouts.length === 0) {
    sharedWorkouts = await getWorkoutsForPlan(sharedPlan.id)
  }
  if (sharedWorkouts.length === 0) {
    throw Object.assign(
      new Error("This custom plan does not have any workouts to import."),
      { code: "custom-plan/share-code-empty" }
    )
  }

  const nowIso = new Date().toISOString()
  const importedPlanId = `custom-${userId}-${Date.now()}`
  const workoutIdMap = new Map<string, string>()
  const importedWorkouts = sharedWorkouts.map((workout, index) => {
    const workoutId = `${importedPlanId}-${index + 1}`
    workoutIdMap.set(workout.id, workoutId)
    return {
      ...workout,
      id: workoutId,
      planId: importedPlanId,
    }
  })
  const workoutMap = Object.fromEntries(importedWorkouts.map((workout) => [workout.id, workout]))
  const workoutNameMap = Object.fromEntries(importedWorkouts.map((workout) => [workout.id, workout.name]))
  const importedPlan: WorkoutPlan = {
    ...sharedPlan,
    id: importedPlanId,
    name: sharedPlan.name,
    type: "custom",
    createdBy: userId,
    shareCode: await generateUniquePlanShareCode(),
    sharedFromPlanId: sharedPlan.id,
    sharedWorkouts: importedWorkouts,
    schedule: sharedPlan.schedule.map((day) => ({
      ...day,
      workoutId: day.workoutId ? workoutIdMap.get(day.workoutId) ?? null : null,
    })),
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  await Promise.all(importedWorkouts.map((workout) => saveWorkout(workout)))
  await activatePlan(userId, importedPlan, workoutNameMap, workoutMap)
  return importedPlan
}

export async function updatePlanRestDays(
  userId: string,
  plan: WorkoutPlan,
  restDays: number[],
  workoutNameMap?: Record<string, string>,
  durationDays = plan.durationDays ?? 63,
  startDate = addDays(getAppDate(), 1),
  protectedDayOfWeek = getAppDate().getDay(),
  workoutMap?: Record<string, Workout>
): Promise<void> {
  const normalizedRestDays = normalizeRestDays(restDays, getRestDayCount(plan), protectedDayOfWeek)
  const scheduleEntries = buildPlanScheduleEntries(plan, workoutNameMap, normalizedRestDays, protectedDayOfWeek, workoutMap)
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
  workout?: Workout
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
  protectedDayOfWeek = getAppDate().getDay(),
  workoutMap?: Record<string, Workout>
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
      workout: workoutId ? workoutMap?.[workoutId] : undefined,
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
  workoutNameMap?: Record<string, string>,
  workoutMap?: Record<string, Workout>
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

  const scheduleEntries = buildPlanScheduleEntries(plan, workoutNameMap, restDays, startedAt.getDay(), workoutMap)

  console.log("[activatePlan] schedule entries:", scheduleEntries)

  await clearScheduledWorkoutsFromToday(userId)
  await generateScheduledWorkouts(userId, scheduleEntries, durationDays)

  console.log("[activatePlan] done — plan:", plan.name)
}
