import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  where,
  limit,
  increment,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type {
  WorkoutSession,
  ScheduledWorkout,
  UserExerciseData,
  ExerciseWeightEntry,
  ScheduledExercise,
  Workout,
} from "@/data/models"
import { calculateMissPenalty, getRankFromDP } from "@/data/helpers"
import { getWorkoutById } from "@/data/planSeedData"
import { addDays, format, subDays } from "date-fns"
import { getAppDate, getTodayString } from "@/lib/appDate"

const INCA_TRAIL_PLAN_ID = "plan-special-inca-trail-prep-30"
const INCA_TRAIL_PROGRESSIONS: Record<string, number[]> = {
  "inca-tue-ex-1": [20, 25, 30, 35],
  "inca-sat-ex-1": [60, 90, 120, 150],
}

function applyIncaTrailProgression(exercise: ScheduledExercise, planId: string | undefined, dayIndex: number) {
  if (planId !== INCA_TRAIL_PLAN_ID) return exercise

  const weeklyDurations = INCA_TRAIL_PROGRESSIONS[exercise.exerciseId]
  if (!weeklyDurations) return exercise

  const weekIndex = Math.min(weeklyDurations.length - 1, Math.floor(dayIndex / 7))
  const durationMinutes = weeklyDurations[weekIndex]
  return {
    ...exercise,
    repsMin: durationMinutes,
    repsMax: durationMinutes,
    targetUnit: "minutes" as const,
    timedSeconds: durationMinutes * 60,
  }
}

async function resolveWorkoutById(workoutId: string): Promise<Workout | null> {
  const seedWorkout = getWorkoutById(workoutId)
  if (seedWorkout) return seedWorkout

  const ref = doc(db, "workouts", workoutId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as Workout
}

// ─── Workout sessions ─────────────────────────────────────────────────────────

export async function saveWorkoutSession(
  userId: string,
  session: Omit<WorkoutSession, "id">
): Promise<string> {
  const ref = doc(collection(db, "users", userId, "workoutSessions"))
  await setDoc(ref, {
    ...session,
    id: ref.id,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getRecentSessions(
  userId: string,
  count = 10
): Promise<WorkoutSession[]> {
  const q = query(
    collection(db, "users", userId, "workoutSessions"),
    orderBy("date", "desc"),
    limit(count)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      ...data,
      startedAt:
        data.startedAt instanceof Timestamp
          ? data.startedAt.toDate().toISOString()
          : data.startedAt,
      completedAt:
        data.completedAt instanceof Timestamp
          ? data.completedAt.toDate().toISOString()
          : data.completedAt,
    } as WorkoutSession
  })
}

// ─── Scheduled workouts ───────────────────────────────────────────────────────

/**
 * Generate scheduled workout stubs under
 * users/{userId}/scheduledWorkouts/{YYYY-MM-DD}.
 * Uses merge so completed/partial records are never overwritten.
 * Enriches each doc with full workout data (muscleGroups, estimatedMinutes, scheduledExercises).
 */
export async function generateScheduledWorkouts(
  userId: string,
  planSchedule: {
    dayOfWeek: number
    workoutId: string | null
    workoutName: string
    isRest: boolean
    planId?: string
    planName?: string
  }[],
  durationDays = 63,
  startDate = getAppDate()
): Promise<void> {
  const writes: Promise<void>[] = []

  console.log("[generateScheduledWorkouts] generating", durationDays, "days for userId:", userId)

  for (let i = 0; i < durationDays; i++) {
    const date = addDays(startDate, i)
    const dayOfWeek = date.getDay()
    const entry = planSchedule.find((s) => s.dayOfWeek === dayOfWeek)
    if (!entry) continue

    const dateStr = format(date, "yyyy-MM-dd")
    const ref = doc(db, "users", userId, "scheduledWorkouts", dateStr)

    const scheduled: Record<string, unknown> = {
      date: dateStr,
      workoutId: entry.workoutId,
      workoutName: entry.isRest ? "Rest Day" : entry.workoutName || "Workout",
      planId: entry.planId ?? "",
      planName: entry.planName ?? "",
      status: entry.isRest ? "rest" : "scheduled",
      completionPercent: 0,
      disciplinePointsEarned: 0,
      elapsedSeconds: 0,
      updatedAt: serverTimestamp(),
    }

    // Enrich workout days with exercise data for Home/Focus rendering
    if (!entry.isRest && entry.workoutId) {
      const workout = await resolveWorkoutById(entry.workoutId)
      if (workout) {
        scheduled.muscleGroups = workout.muscleGroups
        scheduled.estimatedMinutes = workout.estimatedMinutes
        scheduled.scheduledExercises = workout.exercises.map((ex): ScheduledExercise => {
          const scheduledExercise: ScheduledExercise = {
            exerciseId: ex.id,
            name: ex.name,
            category: ex.category,
            equipment: ex.equipment,
            sets: ex.sets,
            repsMin: ex.repsMin,
            repsMax: ex.repsMax,
            restSeconds: ex.restSeconds,
            targetWeight: ex.defaultWeight,
          }
          if (ex.targetUnit) scheduledExercise.targetUnit = ex.targetUnit
          if (ex.timedSeconds) scheduledExercise.timedSeconds = ex.timedSeconds
          return applyIncaTrailProgression(scheduledExercise, entry.planId, i)
        })
      }
    }

    writes.push(
      setDoc(ref, scheduled, { merge: true }).then(() => {
        if (i === 0) {
          console.log(
            "[generateScheduledWorkouts] today doc written:",
            dateStr,
            "workout:", scheduled.workoutName,
            "id:", scheduled.workoutId
          )
        }
      })
    )
  }

  await Promise.all(writes)
  console.log("[generateScheduledWorkouts] done — wrote", writes.length, "docs")
}

export async function clearScheduledWorkoutsFromToday(userId: string): Promise<void> {
  await clearScheduledWorkoutsFromDate(userId, getTodayString())
}

export async function clearScheduledWorkoutsFromDate(userId: string, startDate: string): Promise<void> {
  const today = getTodayString()
  const q = query(
    collection(db, "users", userId, "scheduledWorkouts"),
    where("date", ">=", startDate || today)
  )
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((scheduledDoc) => deleteDoc(scheduledDoc.ref)))
}

/**
 * Update the status of a scheduled workout after completion, partial, or missed.
 * Uses setDoc+merge so it works even if the document does not yet exist.
 */
export async function updateScheduledWorkoutStatus(
  userId: string,
  date: string,
  update: {
    status: ScheduledWorkout["status"]
    completionPercent: number
    disciplinePointsEarned: number
    elapsedSeconds: number
  }
): Promise<void> {
  const ref = doc(db, "users", userId, "scheduledWorkouts", date)

  console.log("[updateScheduledWorkoutStatus] writing:", { userId, date, ...update })

  await setDoc(
    ref,
    {
      ...update,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )

  console.log("[updateScheduledWorkoutStatus] done for date:", date)
}

export async function getScheduledWorkout(
  userId: string,
  date: string
): Promise<ScheduledWorkout | null> {
  const ref = doc(db, "users", userId, "scheduledWorkouts", date)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as ScheduledWorkout
}

export async function getScheduledWorkouts(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ScheduledWorkout[]> {
  const q = query(
    collection(db, "users", userId, "scheduledWorkouts"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as ScheduledWorkout)
}

// ─── Exercise weight tracking ─────────────────────────────────────────────────

export async function updateExerciseWeight(
  userId: string,
  exerciseId: string,
  exerciseName: string,
  weight: number,
  setsCompleted: number,
  weightUnit: "lbs" | "kg" = "lbs"
): Promise<void> {
  const ref = doc(db, "users", userId, "exerciseData", exerciseId)
  const snap = await getDoc(ref)

  const today = getTodayString()
  const newEntry: ExerciseWeightEntry = {
    date: today,
    weight,
    setsCompleted,
  }

  if (snap.exists()) {
    const existing = snap.data() as UserExerciseData
    const history = existing.history ?? []
    const todayIdx = history.findIndex((e) => e.date === today)
    const updatedHistory =
      todayIdx >= 0
        ? history.map((e, i) => (i === todayIdx ? newEntry : e))
        : [...history, newEntry]

    await updateDoc(ref, {
      currentWeight: weight,
      weightUnit,
      lastUpdated: serverTimestamp(),
      history: updatedHistory,
    })
  } else {
    const data: Omit<UserExerciseData, "lastUpdated"> & {
      lastUpdated: ReturnType<typeof serverTimestamp>
    } = {
      exerciseName,
      currentWeight: weight,
      weightUnit,
      lastUpdated: serverTimestamp(),
      history: [newEntry],
    }
    await setDoc(ref, data)
  }
}

export async function getExerciseData(
  userId: string,
  exerciseId: string
): Promise<UserExerciseData | null> {
  const ref = doc(db, "users", userId, "exerciseData", exerciseId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as UserExerciseData
}

export async function getAllExerciseData(
  userId: string
): Promise<Record<string, UserExerciseData>> {
  const snap = await getDocs(collection(db, "users", userId, "exerciseData"))
  const result: Record<string, UserExerciseData> = {}
  snap.docs.forEach((d) => {
    result[d.id] = d.data() as UserExerciseData
  })
  return result
}

// ─── Missed workout rollover ──────────────────────────────────────────────────

export async function markMissedWorkouts(userId: string): Promise<number> {
  const today = getTodayString()
  const lookbackStart = format(subDays(getAppDate(), 400), "yyyy-MM-dd")

  const q = query(
    collection(db, "users", userId, "scheduledWorkouts"),
    where("date", ">=", lookbackStart),
    where("date", "<", today)
  )
  const snap = await getDocs(q)
  const pastWorkoutDocs = snap.docs
    .map((d) => ({ ref: d.ref, data: d.data() as ScheduledWorkout }))
    .filter(({ data }) => data.status !== "rest")
    .sort((a, b) => a.data.date.localeCompare(b.data.date))
  const missedDocs = pastWorkoutDocs.filter(({ data }) => data.status === "scheduled")
  if (missedDocs.length === 0) return 0

  let consecutiveMisses = 0
  const missedUpdates = pastWorkoutDocs.map(({ ref, data }) => {
    if (data.status === "missed") {
      consecutiveMisses += 1
      return null
    }

    if (data.status === "scheduled") {
      consecutiveMisses += 1
      const penalty = calculateMissPenalty(consecutiveMisses)
      return {
        ref,
        penalty,
        data: {
          status: "missed" as const,
          completionPercent: 0,
          disciplinePointsEarned: penalty,
          updatedAt: serverTimestamp(),
        },
      }
    }

    consecutiveMisses = 0
    return null
  }).filter((update): update is NonNullable<typeof update> => update !== null)

  const totalPenalty = missedUpdates.reduce((sum, update) => sum + update.penalty, 0)

  await Promise.all(
    missedUpdates.map((update) =>
      updateDoc(update.ref, update.data)
    )
  )

  const userRef = doc(db, "users", userId)
  const userSnap = await getDoc(userRef)
  const currentDP = userSnap.exists() ? ((userSnap.data().disciplinePoints as number | undefined) ?? 0) : 0
  const newDP = Math.max(0, currentDP + totalPenalty)

  await updateDoc(doc(db, "users", userId), {
    disciplinePoints: newDP,
    rank: getRankFromDP(newDP).name,
    missedWorkouts: increment(missedDocs.length),
    streak: 0,
    updatedAt: serverTimestamp(),
  })

  return missedDocs.length
}

// ─── Consistency calculation ──────────────────────────────────────────────────

export function calculateConsistencyFromSchedule(
  scheduledWorkouts: ScheduledWorkout[]
): number {
  const workoutDays = scheduledWorkouts.filter(
    (s) => s.status !== "rest" && s.status !== "scheduled"
  )
  if (workoutDays.length === 0) return 0

  const totalEquivalents = workoutDays.reduce((sum, s) => {
    if (s.status === "completed") return sum + 1
    if (s.status === "partial") return sum + (s.completionPercent / 100)
    return sum // missed = 0
  }, 0)

  return Math.round((totalEquivalents / workoutDays.length) * 100)
}

// ─── Streak calculation ───────────────────────────────────────────────────────

export function calculateAllTimeStatsFromSchedule(scheduledWorkouts: ScheduledWorkout[]) {
  const decided = scheduledWorkouts.filter((s) =>
    s.status === "completed" || s.status === "partial" || s.status === "missed"
  )
  const completed = decided.filter((s) => s.status === "completed").length
  const partial = decided.filter((s) => s.status === "partial").length
  const missed = decided.filter((s) => s.status === "missed").length
  const completedEquivalent = decided.reduce((sum, s) => {
    if (s.status === "completed") return sum + 1
    if (s.status === "partial") return sum + (s.completionPercent / 100)
    return sum
  }, 0)
  const consistencyPercent = decided.length > 0
    ? Math.min(100, Math.round((completedEquivalent / decided.length) * 100))
    : 0

  return { completed, partial, missed, consistencyPercent }
}

export async function syncUserStatsFromSchedule(userId: string): Promise<void> {
  const scheduled = await getScheduledWorkouts(userId, "1900-01-01", getTodayString())
  const stats = calculateAllTimeStatsFromSchedule(scheduled)

  await updateDoc(doc(db, "users", userId), {
    workoutsCompleted: stats.completed,
    partialWorkouts: stats.partial,
    missedWorkouts: stats.missed,
    consistencyPercent: stats.consistencyPercent,
    updatedAt: serverTimestamp(),
  })
}

export function calculateStreakFromSchedule(
  scheduledWorkouts: ScheduledWorkout[],
  todayDate: string
): number {
  const sorted = [...scheduledWorkouts]
    .filter((s) => s.date <= todayDate)
    .sort((a, b) => b.date.localeCompare(a.date))

  let streak = 0
  for (const s of sorted) {
    if (s.status === "scheduled" && s.date === todayDate) continue
    if (s.status === "rest" || s.status === "completed" || (s.status === "partial" && s.completionPercent >= 50)) {
      streak += 1
      continue
    }
    break
  }

  return streak
}

export async function syncUserStreakFromSchedule(userId: string): Promise<number> {
  const today = getTodayString()
  const start = format(subDays(getAppDate(), 400), "yyyy-MM-dd")
  const scheduled = await getScheduledWorkouts(userId, start, today)
  const streak = calculateStreakFromSchedule(scheduled, today)
  const userRef = doc(db, "users", userId)
  const userSnap = await getDoc(userRef)
  const currentLongest = userSnap.exists() ? ((userSnap.data().longestStreak as number | undefined) ?? 0) : 0

  await updateDoc(userRef, {
    streak,
    longestStreak: Math.max(currentLongest, streak),
    updatedAt: serverTimestamp(),
  })

  return streak
}
