import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore"
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { db } from "@/lib/firebase"
import { getRankFromDP } from "@/data/helpers"
import { getTodayString } from "@/lib/appDate"
import type {
  Achievement,
  AchievementConditionType,
  AchievementDefinition,
  ScheduledWorkout,
  User,
  UserAchievement,
} from "@/data/models"

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { id: "streak-7", name: "First Spark", description: "Reach a 7 day streak", category: "streak", disciplinePointReward: 10, conditionType: "streak_days", conditionValue: 7 },
  { id: "streak-30", name: "Building Momentum", description: "Reach a 30 day streak", category: "streak", disciplinePointReward: 25, conditionType: "streak_days", conditionValue: 30 },
  { id: "streak-90", name: "Unstoppable", description: "Reach a 90 day streak", category: "streak", disciplinePointReward: 50, conditionType: "streak_days", conditionValue: 90 },
  { id: "streak-150", name: "Consistency Machine", description: "Reach a 150 day streak", category: "streak", disciplinePointReward: 75, conditionType: "streak_days", conditionValue: 150 },
  { id: "streak-250", name: "Iron Will", description: "Reach a 250 day streak", category: "streak", disciplinePointReward: 100, conditionType: "streak_days", conditionValue: 250 },
  { id: "streak-365", name: "CORE Legend", description: "Reach a 365 day streak", category: "streak", disciplinePointReward: 150, conditionType: "streak_days", conditionValue: 365 },

  { id: "workouts-1", name: "Getting Started", description: "Complete your first workout", category: "milestone", disciplinePointReward: 5, conditionType: "workouts_completed", conditionValue: 1 },
  { id: "workouts-10", name: "Dedicated", description: "Complete 10 workouts", category: "milestone", disciplinePointReward: 15, conditionType: "workouts_completed", conditionValue: 10 },
  { id: "workouts-25", name: "Locked In", description: "Complete 25 workouts", category: "milestone", disciplinePointReward: 30, conditionType: "workouts_completed", conditionValue: 25 },
  { id: "workouts-50", name: "Workhorse", description: "Complete 50 workouts", category: "milestone", disciplinePointReward: 50, conditionType: "workouts_completed", conditionValue: 50 },
  { id: "workouts-100", name: "Fitness Addict", description: "Complete 100 workouts", category: "milestone", disciplinePointReward: 85, conditionType: "workouts_completed", conditionValue: 100 },
  { id: "workouts-250", name: "Veteran", description: "Complete 250 workouts", category: "milestone", disciplinePointReward: 150, conditionType: "workouts_completed", conditionValue: 250 },

  { id: "program-consistency", name: "Consistency Champion", description: "Complete 30-Day Consistency Challenge", category: "program", disciplinePointReward: 40, conditionType: "program_completed", conditionValue: 30 },
  { id: "program-muscle", name: "Muscle Builder", description: "Complete 90-Day Muscle Builder", category: "program", disciplinePointReward: 90, conditionType: "program_completed", conditionValue: 90 },
  { id: "program-fat-loss", name: "Fat Loss Finisher", description: "Complete 60-Day Fat Loss Challenge", category: "program", disciplinePointReward: 60, conditionType: "program_completed", conditionValue: 60 },
  { id: "program-fitness", name: "Fitness Graduate", description: "Complete 60-Day Fitness Foundation", category: "program", disciplinePointReward: 60, conditionType: "program_completed", conditionValue: 61 },

  { id: "perfect-week", name: "First Week", description: "Complete all scheduled workouts in a week", category: "consistency", disciplinePointReward: 25, conditionType: "perfect_weeks", conditionValue: 1 },
  { id: "perfect-month", name: "Perfect Month", description: "Complete all scheduled workouts in a month", category: "consistency", disciplinePointReward: 75, conditionType: "perfect_months", conditionValue: 1 },
  { id: "comeback-after-miss", name: "Never Miss Twice", description: "Complete a workout the day after missing one", category: "consistency", disciplinePointReward: 20, conditionType: "comeback_after_miss", conditionValue: 1 },
  { id: "adherence-90", name: "90% Club", description: "Get 90% adherence for a completed plan", category: "consistency", disciplinePointReward: 60, conditionType: "plan_adherence", conditionValue: 90 },
  { id: "adherence-100", name: "Consistency King", description: "Get 100% adherence for a completed plan", category: "consistency", disciplinePointReward: 100, conditionType: "plan_adherence", conditionValue: 100 },

  { id: "onboarding-started", name: "Level Up", description: "Finish onboarding and start your first program", category: "program", disciplinePointReward: 10, conditionType: "onboarding_completed", conditionValue: 1 },
  { id: "unique-days-5", name: "Locked In", description: "Complete workouts on 5 different days", category: "consistency", disciplinePointReward: 20, conditionType: "unique_workout_days", conditionValue: 5 },
  { id: "program-halfway", name: "Halfway There", description: "Reach 50% completion in a program", category: "program", disciplinePointReward: 30, conditionType: "program_progress", conditionValue: 50 },
  { id: "program-finish-line", name: "Finish Line", description: "Reach 100% completion in a program", category: "program", disciplinePointReward: 60, conditionType: "program_progress", conditionValue: 100 },
]

type AchievementStats = {
  workoutsCompleted: number
  streak: number
  perfectWeeks: number
  perfectMonths: number
  completedProgramCodes: Set<number>
  completedPlanAdherence: number | null
  onboardingCompleted: boolean
  uniqueWorkoutDays: number
  programProgressPercent: number
  comebackAfterMiss: boolean
}

export async function seedAchievementCatalog(): Promise<void> {
  await Promise.all(
    ACHIEVEMENT_DEFINITIONS.map((def) =>
      setDoc(doc(db, "achievements", def.id), def, { merge: true })
    )
  )
}

export async function getAchievementCatalog(): Promise<AchievementDefinition[]> {
  return ACHIEVEMENT_DEFINITIONS
}

export async function initUserAchievements(userId: string): Promise<void> {
  const snap = await getDocs(collection(db, "users", userId, "achievements"))
  const existingIds = new Set(snap.docs.map((achievementDoc) => achievementDoc.id))

  await Promise.all(
    ACHIEVEMENT_DEFINITIONS.map((def) => {
      const ref = doc(db, "users", userId, "achievements", def.id)
      const baseUpdate = { ...def }

      return existingIds.has(def.id)
        ? setDoc(ref, baseUpdate, { merge: true })
        : setDoc(ref, { ...baseUpdate, unlocked: false }, { merge: true })
    })
  )
}

function normalizeUnlockedAt(value: unknown): string | undefined {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  return typeof value === "string" ? value : undefined
}

export async function getUserAchievements(userId: string): Promise<Achievement[]> {
  const snap = await getDocs(collection(db, "users", userId, "achievements"))
  const userAchievementMap = new Map(snap.docs.map((d) => [d.id, d.data()]))

  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    const saved = userAchievementMap.get(def.id)
    return {
      ...def,
      unlocked: saved?.unlocked ?? false,
      unlockedAt: normalizeUnlockedAt(saved?.unlockedAt),
    }
  })
}

export async function unlockAchievement(
  userId: string,
  achievementId: string
): Promise<{ dpEarned: number } | null> {
  const definition = ACHIEVEMENT_DEFINITIONS.find((ach) => ach.id === achievementId)
  if (!definition) return null

  const userAchRef = doc(db, "users", userId, "achievements", achievementId)
  const userRef = doc(db, "users", userId)

  const unlocked = await runTransaction(db, async (transaction) => {
    const [achievementSnap, userSnap] = await Promise.all([
      transaction.get(userAchRef),
      transaction.get(userRef),
    ])

    if (achievementSnap.exists() && achievementSnap.data().unlocked) return false

    const userAch: UserAchievement = {
      unlockedAt: new Date().toISOString(),
      disciplinePointsEarned: definition.disciplinePointReward,
    }

    transaction.set(
      userAchRef,
      { ...definition, ...userAch, unlocked: true, unlockedAt: serverTimestamp() },
      { merge: true }
    )

    if (userSnap.exists()) {
      const currentDiscipline = (userSnap.data().disciplinePoints as number | undefined) ?? 0
      const nextDiscipline = Math.max(0, currentDiscipline + definition.disciplinePointReward)
      transaction.update(userRef, {
        disciplinePoints: nextDiscipline,
        rank: getRankFromDP(nextDiscipline).name,
        updatedAt: serverTimestamp(),
      })
    }

    return true
  })

  if (!unlocked) return null

  return { dpEarned: definition.disciplinePointReward }
}

function isWorkoutDay(scheduled: ScheduledWorkout): boolean {
  return scheduled.status !== "rest" && !!scheduled.workoutId
}

function getPerfectPeriodCount(scheduled: ScheduledWorkout[], period: "week" | "month", today: string): number {
  const groups = new Map<string, { end: string; days: ScheduledWorkout[] }>()

  for (const item of scheduled.filter(isWorkoutDay)) {
    const date = new Date(`${item.date}T12:00:00`)
    const start = period === "week"
      ? startOfWeek(date, { weekStartsOn: 0 })
      : startOfMonth(date)
    const end = period === "week"
      ? endOfWeek(date, { weekStartsOn: 0 })
      : endOfMonth(date)
    const endDate = format(end, "yyyy-MM-dd")
    const key = `${format(start, "yyyy-MM-dd")}:${endDate}`
    const group = groups.get(key) ?? { end: endDate, days: [] }
    groups.set(key, { ...group, days: [...group.days, item] })
  }

  let count = 0
  for (const { end, days } of groups.values()) {
    if (end > today) continue
    if (days.length > 0 && days.every((day) => day.status === "completed")) count += 1
  }
  return count
}

function getProgramCode(user: User | null, scheduled: ScheduledWorkout[]): number | null {
  const name = (user?.onboardingAnswers?.recommendedPlan || user?.currentPlanId || scheduled[0]?.planName || "").toLowerCase()
  if (name.includes("consistency")) return 30
  if (name.includes("muscle")) return 90
  if (name.includes("fat loss")) return 60
  if (name.includes("fitness foundation")) return 61
  return null
}

function getPlanWindow(user: User | null, scheduled: ScheduledWorkout[]): ScheduledWorkout[] {
  const start = user?.currentPlanStartedAt
  const end = user?.currentPlanEndsAt
  if (!start || !end) return scheduled
  return scheduled.filter((day) => day.date >= start && day.date <= end)
}

function getAdherence(scheduled: ScheduledWorkout[]): number | null {
  const workoutDays = scheduled.filter(isWorkoutDay)
  if (workoutDays.length === 0) return null
  const completedEquivalent = workoutDays.reduce((sum, day) => {
    if (day.status === "completed") return sum + 1
    if (day.status === "partial") return sum + (day.completionPercent / 100)
    return sum
  }, 0)
  return Math.round((completedEquivalent / workoutDays.length) * 100)
}

function hasComebackAfterMiss(scheduled: ScheduledWorkout[]): boolean {
  const byDate = new Map(scheduled.map((day) => [day.date, day]))
  return scheduled.some((day) => {
    if (day.status !== "completed") return false
    const date = new Date(`${day.date}T12:00:00`)
    date.setDate(date.getDate() - 1)
    const previousDay = byDate.get(format(date, "yyyy-MM-dd"))
    return previousDay?.status === "missed"
  })
}

async function buildAchievementStats(userId: string): Promise<AchievementStats> {
  const userSnap = await getDoc(doc(db, "users", userId))
  const user = userSnap.exists() ? (userSnap.data() as User) : null
  const today = getTodayString()
  const scheduledSnap = await getDocs(collection(db, "users", userId, "scheduledWorkouts"))
  const scheduled = scheduledSnap.docs
    .map((d) => d.data() as ScheduledWorkout)
    .sort((a, b) => a.date.localeCompare(b.date))
  const scheduledThroughToday = scheduled
    .filter((day) => day.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const planWindow = getPlanWindow(user, scheduledThroughToday)
  const planEndDate = user?.currentPlanEndsAt
  const isPlanComplete = !!planEndDate && today >= planEndDate
  const completedWorkoutDays = scheduledThroughToday.filter((day) => day.status === "completed")
  const durationDays = user?.currentPlanStartedAt && user?.currentPlanEndsAt
    ? Math.max(1, Math.round((new Date(`${user.currentPlanEndsAt}T12:00:00`).getTime() - new Date(`${user.currentPlanStartedAt}T12:00:00`).getTime()) / 86400000) + 1)
    : Math.max(1, planWindow.length)
  const elapsedDays = user?.currentPlanStartedAt
    ? Math.max(0, Math.min(durationDays, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${user.currentPlanStartedAt}T12:00:00`).getTime()) / 86400000) + 1))
    : 0
  const programCode = getProgramCode(user, planWindow)
  const completedProgramCodes = new Set<number>()
  if (isPlanComplete && programCode !== null) completedProgramCodes.add(programCode)

  return {
    workoutsCompleted: completedWorkoutDays.length,
    streak: user?.streak ?? 0,
    perfectWeeks: getPerfectPeriodCount(scheduled, "week", today),
    perfectMonths: getPerfectPeriodCount(scheduled, "month", today),
    completedProgramCodes,
    completedPlanAdherence: isPlanComplete ? getAdherence(planWindow) : null,
    onboardingCompleted: !!user?.currentPlanId,
    uniqueWorkoutDays: new Set(completedWorkoutDays.map((day) => day.date)).size,
    programProgressPercent: Math.min(100, Math.round((elapsedDays / durationDays) * 100)),
    comebackAfterMiss: hasComebackAfterMiss(scheduledThroughToday),
  }
}

function isUnlockedByStats(conditionType: AchievementConditionType, conditionValue: number, stats: AchievementStats): boolean {
  switch (conditionType) {
    case "workouts_completed":
      return stats.workoutsCompleted >= conditionValue
    case "streak_days":
      return stats.streak >= conditionValue
    case "perfect_weeks":
      return stats.perfectWeeks >= conditionValue
    case "perfect_months":
      return stats.perfectMonths >= conditionValue
    case "program_completed":
      return stats.completedProgramCodes.has(conditionValue)
    case "plan_adherence":
      return stats.completedPlanAdherence !== null && stats.completedPlanAdherence >= conditionValue
    case "onboarding_completed":
      return stats.onboardingCompleted
    case "unique_workout_days":
      return stats.uniqueWorkoutDays >= conditionValue
    case "program_progress":
      return stats.programProgressPercent >= conditionValue
    case "comeback_after_miss":
      return stats.comebackAfterMiss
  }
}

export async function checkAndUnlockAchievements(
  userId: string,
  statsOverride?: Partial<Pick<AchievementStats, "workoutsCompleted" | "streak">>
): Promise<Achievement[]> {
  await initUserAchievements(userId)

  const stats = await buildAchievementStats(userId)
  const mergedStats = { ...stats, ...statsOverride }
  const achievements = await getUserAchievements(userId)
  const newlyUnlocked: Achievement[] = []

  for (const achievement of achievements.filter((ach) => !ach.unlocked)) {
    if (!achievement.conditionType) continue
    const shouldUnlock = isUnlockedByStats(
      achievement.conditionType,
      achievement.conditionValue ?? 0,
      mergedStats
    )

    if (shouldUnlock) {
      const result = await unlockAchievement(userId, achievement.id)
      if (result) {
        newlyUnlocked.push({ ...achievement, unlocked: true, unlockedAt: new Date().toISOString() })
      }
    }
  }

  return newlyUnlocked
}
