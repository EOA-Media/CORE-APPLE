import type {
  User,
  Exercise,
  Workout,
  WorkoutPlan,
  ScheduledWorkout,
  WorkoutSession,
  Achievement,
  Friend,
  FriendActivity,
  FriendRequest,
  WeeklyLeaderboardEntry,
} from "./models"
import { getRankFromDP } from "./helpers"
import { getAppDayOfWeek, getTodayString } from "@/lib/appDate"

// --- Exercises ---

const benchPress: Exercise = {
  id: "ex-001",
  name: "Barbell Bench Press",
  category: "Chest",
  equipment: "Barbell",
  sets: 4,
  repsMin: 8,
  repsMax: 10,
  restSeconds: 90,
  defaultWeight: 80,
}

const inclineDumbbell: Exercise = {
  id: "ex-002",
  name: "Incline Dumbbell Press",
  category: "Chest",
  equipment: "Dumbbells",
  sets: 3,
  repsMin: 10,
  repsMax: 12,
  restSeconds: 75,
  defaultWeight: 30,
}

const overheadPress: Exercise = {
  id: "ex-003",
  name: "Overhead Press",
  category: "Shoulders",
  equipment: "Barbell",
  sets: 3,
  repsMin: 8,
  repsMax: 10,
  restSeconds: 90,
  defaultWeight: 50,
}

const lateralRaises: Exercise = {
  id: "ex-004",
  name: "Lateral Raises",
  category: "Shoulders",
  equipment: "Dumbbells",
  sets: 3,
  repsMin: 12,
  repsMax: 15,
  restSeconds: 60,
  defaultWeight: 12,
}

const tricepPushdown: Exercise = {
  id: "ex-005",
  name: "Tricep Rope Pushdown",
  category: "Triceps",
  equipment: "Cable",
  sets: 3,
  repsMin: 12,
  repsMax: 15,
  restSeconds: 60,
  defaultWeight: 25,
}

const overheadExtension: Exercise = {
  id: "ex-006",
  name: "Overhead Tricep Extension",
  category: "Triceps",
  equipment: "Dumbbell",
  sets: 3,
  repsMin: 10,
  repsMax: 12,
  restSeconds: 60,
  defaultWeight: 20,
}

const barbellRow: Exercise = {
  id: "ex-007",
  name: "Barbell Row",
  category: "Back",
  equipment: "Barbell",
  sets: 4,
  repsMin: 8,
  repsMax: 10,
  restSeconds: 90,
  defaultWeight: 70,
}

const latPulldown: Exercise = {
  id: "ex-008",
  name: "Lat Pulldown",
  category: "Back",
  equipment: "Cable",
  sets: 3,
  repsMin: 10,
  repsMax: 12,
  restSeconds: 75,
  defaultWeight: 55,
}

const seatedRow: Exercise = {
  id: "ex-009",
  name: "Seated Cable Row",
  category: "Back",
  equipment: "Cable",
  sets: 3,
  repsMin: 10,
  repsMax: 12,
  restSeconds: 75,
  defaultWeight: 50,
}

const barbellCurl: Exercise = {
  id: "ex-010",
  name: "Barbell Curl",
  category: "Biceps",
  equipment: "Barbell",
  sets: 3,
  repsMin: 10,
  repsMax: 12,
  restSeconds: 60,
  defaultWeight: 30,
}

const hammerCurl: Exercise = {
  id: "ex-011",
  name: "Hammer Curl",
  category: "Biceps",
  equipment: "Dumbbells",
  sets: 3,
  repsMin: 10,
  repsMax: 12,
  restSeconds: 60,
  defaultWeight: 14,
}

const squat: Exercise = {
  id: "ex-012",
  name: "Barbell Squat",
  category: "Quads",
  equipment: "Barbell",
  sets: 4,
  repsMin: 8,
  repsMax: 10,
  restSeconds: 120,
  defaultWeight: 100,
}

const romanianDeadlift: Exercise = {
  id: "ex-013",
  name: "Romanian Deadlift",
  category: "Hamstrings",
  equipment: "Barbell",
  sets: 3,
  repsMin: 10,
  repsMax: 12,
  restSeconds: 90,
  defaultWeight: 80,
}

const legPress: Exercise = {
  id: "ex-014",
  name: "Leg Press",
  category: "Quads",
  equipment: "Machine",
  sets: 3,
  repsMin: 10,
  repsMax: 12,
  restSeconds: 90,
  defaultWeight: 150,
}

const legCurl: Exercise = {
  id: "ex-015",
  name: "Lying Leg Curl",
  category: "Hamstrings",
  equipment: "Machine",
  sets: 3,
  repsMin: 10,
  repsMax: 12,
  restSeconds: 60,
  defaultWeight: 40,
}

const calfRaise: Exercise = {
  id: "ex-016",
  name: "Standing Calf Raise",
  category: "Calves",
  equipment: "Machine",
  sets: 4,
  repsMin: 12,
  repsMax: 15,
  restSeconds: 60,
  defaultWeight: 60,
}

// --- Workouts ---

export const pushWorkout: Workout = {
  id: "wk-001",
  name: "Push Day",
  muscleGroups: ["Chest", "Shoulders", "Triceps"],
  estimatedMinutes: 45,
  exercises: [benchPress, inclineDumbbell, overheadPress, lateralRaises, tricepPushdown, overheadExtension],
}

export const pullWorkout: Workout = {
  id: "wk-002",
  name: "Pull Day",
  muscleGroups: ["Back", "Biceps"],
  estimatedMinutes: 50,
  exercises: [barbellRow, latPulldown, seatedRow, barbellCurl, hammerCurl],
}

export const legWorkout: Workout = {
  id: "wk-003",
  name: "Leg Day",
  muscleGroups: ["Quads", "Hamstrings", "Calves"],
  estimatedMinutes: 55,
  exercises: [squat, romanianDeadlift, legPress, legCurl, calfRaise],
}

export const allWorkouts: Workout[] = [pushWorkout, pullWorkout, legWorkout]

// --- Workout Plan ---

export const currentPlan: WorkoutPlan = {
  id: "plan-001",
  name: "Push Pull Legs",
  type: "core",
  createdBy: "core",
  experienceLevel: "intermediate",
  location: "gym",
  daysPerWeek: 5,
  goal: "Build muscle and strength",
  schedule: [
    { dayOfWeek: 1, workoutId: "wk-002", isRest: false },
    { dayOfWeek: 2, workoutId: "wk-003", isRest: false },
    { dayOfWeek: 3, workoutId: null, isRest: true },
    { dayOfWeek: 4, workoutId: "wk-001", isRest: false },
    { dayOfWeek: 5, workoutId: "wk-002", isRest: false },
    { dayOfWeek: 6, workoutId: "wk-003", isRest: false },
    { dayOfWeek: 0, workoutId: null, isRest: true },
  ],
}

// --- Current User ---

export const currentUser: User = {
  id: "user-001",
  username: "athlete",
  displayName: "Athlete",
  email: "athlete@example.com",
  photoURL: "",
  currentPlanId: "plan-001",
  planType: "core",
  streak: 17,
  longestStreak: 32,
  disciplinePoints: 340,
  rank: getRankFromDP(340).name,
  workoutsCompleted: 156,
  partialWorkouts: 12,
  missedWorkouts: 8,
  consistencyPercent: 88,
  preferredWorkoutTime: "morning",
  createdAt: "2025-11-01T08:00:00Z",
  updatedAt: "2026-05-21T06:00:00Z",
}

// --- Weekly Schedule (Mon May 18 – Sun May 24) ---

export const weeklySchedule: ScheduledWorkout[] = [
  {
    date: "2026-05-18",
    workoutId: "wk-001",
    workoutName: "Push Day",
    status: "completed",
    completionPercent: 100,
    disciplinePointsEarned: 10,
    elapsedSeconds: 2520,
  },
  {
    date: "2026-05-19",
    workoutId: "wk-002",
    workoutName: "Pull Day",
    status: "completed",
    completionPercent: 100,
    disciplinePointsEarned: 10,
    elapsedSeconds: 2820,
  },
  {
    date: "2026-05-20",
    workoutId: "wk-003",
    workoutName: "Leg Day",
    status: "missed",
    completionPercent: 0,
    disciplinePointsEarned: 0,
    elapsedSeconds: 0,
  },
  {
    date: "2026-05-21",
    workoutId: null,
    workoutName: "Rest Day",
    status: "rest",
    completionPercent: 0,
    disciplinePointsEarned: 0,
    elapsedSeconds: 0,
  },
  {
    date: "2026-05-22",
    workoutId: "wk-001",
    workoutName: "Push Day",
    status: "scheduled",
    completionPercent: 0,
    disciplinePointsEarned: 0,
    elapsedSeconds: 0,
  },
  {
    date: "2026-05-23",
    workoutId: "wk-002",
    workoutName: "Pull Day",
    status: "scheduled",
    completionPercent: 0,
    disciplinePointsEarned: 0,
    elapsedSeconds: 0,
  },
  {
    date: "2026-05-24",
    workoutId: null,
    workoutName: "Rest Day",
    status: "rest",
    completionPercent: 0,
    disciplinePointsEarned: 0,
    elapsedSeconds: 0,
  },
]

// --- Monthly Calendar ---

export const monthlyCalendar: ScheduledWorkout[] = [
  { date: "2026-05-01", workoutId: "wk-001", workoutName: "Push Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 2700 },
  { date: "2026-05-02", workoutId: "wk-002", workoutName: "Pull Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 2850 },
  { date: "2026-05-03", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-04", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-05", workoutId: "wk-001", workoutName: "Push Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 2680 },
  { date: "2026-05-06", workoutId: "wk-002", workoutName: "Pull Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 2900 },
  { date: "2026-05-07", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-08", workoutId: "wk-003", workoutName: "Leg Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 3100 },
  { date: "2026-05-09", workoutId: "wk-001", workoutName: "Push Day", status: "partial", completionPercent: 70, disciplinePointsEarned: 7, elapsedSeconds: 1900 },
  { date: "2026-05-10", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-11", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-12", workoutId: "wk-002", workoutName: "Pull Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 2800 },
  { date: "2026-05-13", workoutId: "wk-003", workoutName: "Leg Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 3200 },
  { date: "2026-05-14", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-15", workoutId: "wk-001", workoutName: "Push Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 2750 },
  { date: "2026-05-16", workoutId: "wk-002", workoutName: "Pull Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 2880 },
  { date: "2026-05-17", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-18", workoutId: "wk-002", workoutName: "Pull Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 2820 },
  { date: "2026-05-19", workoutId: "wk-003", workoutName: "Leg Day", status: "completed", completionPercent: 100, disciplinePointsEarned: 10, elapsedSeconds: 3180 },
  { date: "2026-05-20", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-21", workoutId: "wk-001", workoutName: "Push Day", status: "scheduled", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-22", workoutId: "wk-002", workoutName: "Pull Day", status: "scheduled", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-23", workoutId: "wk-003", workoutName: "Leg Day", status: "scheduled", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-24", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-25", workoutId: "wk-001", workoutName: "Push Day", status: "scheduled", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-26", workoutId: "wk-002", workoutName: "Pull Day", status: "scheduled", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-27", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-28", workoutId: "wk-003", workoutName: "Leg Day", status: "scheduled", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-29", workoutId: "wk-001", workoutName: "Push Day", status: "scheduled", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-30", workoutId: null, workoutName: "Rest Day", status: "rest", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
  { date: "2026-05-31", workoutId: "wk-002", workoutName: "Pull Day", status: "scheduled", completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 },
]

// --- Past Session (example) ---

export const lastSession: WorkoutSession = {
  id: "sess-001",
  date: "2026-05-19",
  workoutId: "wk-003",
  workoutName: "Leg Day",
  startedAt: "2026-05-19T06:30:00Z",
  completedAt: "2026-05-19T07:23:00Z",
  elapsedSeconds: 3180,
  completionPercent: 100,
  disciplinePointsEarned: 10,
  exercises: [
    { exerciseId: "ex-012", name: "Barbell Squat", completed: true, sets: 4, repsMin: 8, repsMax: 10, weightUsed: 100, restSeconds: 120, usedSetTimer: true, setsCompleted: 4 },
    { exerciseId: "ex-013", name: "Romanian Deadlift", completed: true, sets: 3, repsMin: 10, repsMax: 12, weightUsed: 80, restSeconds: 90, usedSetTimer: true, setsCompleted: 3 },
    { exerciseId: "ex-014", name: "Leg Press", completed: true, sets: 3, repsMin: 10, repsMax: 12, weightUsed: 150, restSeconds: 90, usedSetTimer: true, setsCompleted: 3 },
    { exerciseId: "ex-015", name: "Lying Leg Curl", completed: true, sets: 3, repsMin: 10, repsMax: 12, weightUsed: 40, restSeconds: 60, usedSetTimer: false, setsCompleted: 3 },
    { exerciseId: "ex-016", name: "Standing Calf Raise", completed: true, sets: 4, repsMin: 12, repsMax: 15, weightUsed: 60, restSeconds: 60, usedSetTimer: false, setsCompleted: 4 },
  ],
}

// --- Friends ---

export const friends: Friend[] = [
  { id: "friend-001", username: "marcus_t", displayName: "Marcus T.", photoURL: "", streak: 24, rank: "Platinum", disciplinePoints: 780, consistencyPercent: 92, workoutsCompleted: 210 },
  { id: "friend-002", username: "sarah_k", displayName: "Sarah K.", photoURL: "", streak: 12, rank: "Gold", disciplinePoints: 520, consistencyPercent: 85, workoutsCompleted: 175 },
  { id: "friend-003", username: "jake_w", displayName: "Jake W.", photoURL: "", streak: 8, rank: "Silver", disciplinePoints: 210, consistencyPercent: 78, workoutsCompleted: 98 },
  { id: "friend-004", username: "nina_r", displayName: "Nina R.", photoURL: "", streak: 31, rank: "Diamond", disciplinePoints: 1620, consistencyPercent: 95, workoutsCompleted: 280 },
  { id: "friend-005", username: "alex_p", displayName: "Alex P.", photoURL: "", streak: 5, rank: "Bronze", disciplinePoints: 85, consistencyPercent: 65, workoutsCompleted: 52 },
]

// --- Leaderboard (friends + user sorted by Discipline Points) ---

export function getLeaderboard(): (Friend | User)[] {
  const allUsers = [
    ...friends,
    { ...currentUser, displayName: currentUser.displayName },
  ]
  return allUsers.sort((a, b) => b.disciplinePoints - a.disciplinePoints)
}

// --- Achievements ---

export const achievements: Achievement[] = [
  { id: "ach-001", name: "First Steps", description: "Complete your first workout", category: "milestone", disciplinePointReward: 5, unlocked: true, unlockedAt: "2025-11-03T08:00:00Z" },
  { id: "ach-002", name: "Week Warrior", description: "Complete 5 workouts in one week", category: "consistency", disciplinePointReward: 15, unlocked: true, unlockedAt: "2025-11-10T08:00:00Z" },
  { id: "ach-003", name: "Iron Will", description: "Maintain a 30-day streak", category: "streak", disciplinePointReward: 30, unlocked: false },
  { id: "ach-004", name: "Century Club", description: "Complete 100 total workouts", category: "milestone", disciplinePointReward: 20, unlocked: true, unlockedAt: "2026-03-15T08:00:00Z" },
  { id: "ach-005", name: "Heavy Hitter", description: "Complete all exercises in a workout at max weight", category: "performance", disciplinePointReward: 10, unlocked: false },
  { id: "ach-006", name: "Discipline Master", description: "Earn 500 Discipline Points", category: "rank", disciplinePointReward: 25, unlocked: false },
  { id: "ach-007", name: "Early Bird", description: "Complete 10 morning workouts", category: "consistency", disciplinePointReward: 10, unlocked: true, unlockedAt: "2026-01-20T08:00:00Z" },
  { id: "ach-008", name: "No Rest Days", description: "Work out 7 consecutive days", category: "streak", disciplinePointReward: 15, unlocked: true, unlockedAt: "2025-12-05T08:00:00Z" },
  { id: "ach-009", name: "Silver Rank", description: "Reach Silver rank", category: "rank", disciplinePointReward: 10, unlocked: true, unlockedAt: "2025-11-28T08:00:00Z" },
  { id: "ach-010", name: "Gold Rank", description: "Reach Gold rank", category: "rank", disciplinePointReward: 15, unlocked: true, unlockedAt: "2026-02-10T08:00:00Z" },
  { id: "ach-011", name: "Platinum Rank", description: "Reach Platinum rank", category: "rank", disciplinePointReward: 20, unlocked: false },
  { id: "ach-012", name: "Perfect Week", description: "Complete every scheduled workout in a week at 100%", category: "consistency", disciplinePointReward: 15, unlocked: true, unlockedAt: "2026-05-19T08:00:00Z" },
]

// --- Weekly Leaderboard (by weekly DP) ---

export const weeklyLeaderboard: WeeklyLeaderboardEntry[] = [
  { friendId: "friend-004", displayName: "Nina R.", username: "nina_r", weeklyDP: 82, rank: "Diamond", isCurrentUser: false },
  { friendId: "friend-003", displayName: "Jake W.", username: "jake_w", weeklyDP: 74, rank: "Silver", isCurrentUser: false },
  { friendId: "friend-002", displayName: "Sarah K.", username: "sarah_k", weeklyDP: 69, rank: "Gold", isCurrentUser: false },
  { friendId: "user-001", displayName: "You", username: "athlete", weeklyDP: 55, rank: "Gold", isCurrentUser: true },
  { friendId: "friend-001", displayName: "Marcus T.", username: "marcus_t", weeklyDP: 48, rank: "Platinum", isCurrentUser: false },
  { friendId: "friend-005", displayName: "Alex P.", username: "alex_p", weeklyDP: 30, rank: "Bronze", isCurrentUser: false },
]

// --- Friend Activity ---

export const friendActivities: FriendActivity[] = [
  { id: "act-001", friendId: "friend-003", friendName: "Jake W.", type: "completed", description: "completed Pull Day", timestamp: "2026-05-22T07:30:00Z" },
  { id: "act-002", friendId: "friend-002", friendName: "Sarah K.", type: "streak", description: "reached a 30-day streak", timestamp: "2026-05-22T06:00:00Z" },
  { id: "act-003", friendId: "friend-001", friendName: "Marcus T.", type: "rank", description: "earned Platinum Rank", timestamp: "2026-05-21T18:00:00Z" },
  { id: "act-004", friendId: "friend-004", friendName: "Nina R.", type: "completed", description: "completed Push Day", timestamp: "2026-05-21T07:15:00Z" },
  { id: "act-005", friendId: "friend-005", friendName: "Alex P.", type: "partial", description: "completed 80% of Leg Day", timestamp: "2026-05-21T06:45:00Z" },
]

// --- Friend Requests ---

export const friendRequests: FriendRequest[] = [
  { id: "req-001", fromUserId: "pending-001", toUserId: "user-001", fromUsername: "chris_m", fromDisplayName: "Chris M.", fromRank: "Silver", status: "pending", createdAt: "2026-05-22T10:00:00Z" },
]

// --- Today's workout helper ---

export function getTodaysWorkout(): Workout {
  return pushWorkout
}

export function getTodaysSchedule(): ScheduledWorkout {
  const today = getTodayString()
  const dayOfWeek = getAppDayOfWeek()
  const planDay = currentPlan.schedule.find((s) => s.dayOfWeek === dayOfWeek)

  if (!planDay || planDay.isRest) {
    return {
      date: today,
      workoutId: null,
      workoutName: "Rest Day",
      status: "rest",
      completionPercent: 0,
      disciplinePointsEarned: 0,
      elapsedSeconds: 0,
    }
  }

  const wk = allWorkouts.find((w) => w.id === planDay.workoutId)
  return {
    date: today,
    workoutId: planDay.workoutId,
    workoutName: wk?.name ?? "Workout",
    status: "scheduled",
    completionPercent: 0,
    disciplinePointsEarned: 0,
    elapsedSeconds: 0,
  }
}
