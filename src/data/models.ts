// ─── Core domain models — aligned with Firestore schema ──────────────────────

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  photoURL: string
  currentPlanId: string
  currentPlanStartedAt?: string
  currentPlanEndsAt?: string
  planType: "core" | "custom"
  streak: number
  longestStreak: number
  disciplinePoints: number
  rank: string
  workoutsCompleted: number
  partialWorkouts: number
  missedWorkouts: number
  consistencyPercent: number
  preferredWorkoutTime: "morning" | "afternoon" | "evening"
  pushNotificationsEnabled?: boolean
  workoutReminderEnabled?: boolean
  workoutReminderHour?: number
  preferredRestDays?: number[]
  timezone?: string
  pushTokens?: string[]
  pushPermissionStatus?: "unknown" | "granted" | "denied" | "prompt"
  onboardingAnswers?: OnboardingAnswers
  createdAt: string
  updatedAt: string
}

export interface OnboardingAnswers {
  goal: string
  location: string
  level: string
  daysPerWeek: number
  preferredTime: string
  recommendedPlan: string
}

// ─── Exercise ─────────────────────────────────────────────────────────────────

export interface Exercise {
  id: string
  name: string
  category: string
  equipment: string
  sets: number
  repsMin: number
  repsMax: number
  restSeconds: number
  defaultWeight: number
}

// exerciseLibrary/{exerciseId}
export interface ExerciseLibraryEntry {
  id: string
  name: string
  category: string
  equipment: string
  defaultSets: number
  defaultRepsMin: number
  defaultRepsMax: number
  defaultRestSeconds: number
}

// users/{userId}/exerciseData/{exerciseId}
export interface UserExerciseData {
  exerciseName: string
  currentWeight: number
  weightUnit: "lbs" | "kg"
  lastUpdated: string
  history: ExerciseWeightEntry[]
}

export interface ExerciseWeightEntry {
  date: string
  weight: number
  setsCompleted: number
}

// ─── Workout ──────────────────────────────────────────────────────────────────

// workouts/{workoutId}
export interface Workout {
  id: string
  name: string
  muscleGroups: string[]
  estimatedMinutes: number
  exercises: Exercise[]
  planId?: string
}

// Exercise object nested inside a Workout document
export interface WorkoutExercise {
  exerciseId: string
  name: string
  category: string
  equipment: string
  sets: number
  repsMin: number
  repsMax: number
  restSeconds: number
  defaultWeight: number
}

// ─── Workout Plan ─────────────────────────────────────────────────────────────

// workoutPlans/{planId}
export interface WorkoutPlan {
  id: string
  name: string
  type: "core" | "custom"
  createdBy: "core" | string
  experienceLevel: "beginner" | "intermediate" | "advanced"
  location: "gym" | "home"
  daysPerWeek: number
  durationDays?: number
  goal: string
  schedule: WorkoutPlanDay[]
  createdAt?: string
  updatedAt?: string
}

export interface WorkoutPlanDay {
  dayOfWeek: number
  workoutId: string | null
  isRest: boolean
}

// ─── Scheduled Workout ────────────────────────────────────────────────────────

// users/{userId}/scheduledWorkouts/{YYYY-MM-DD}
export interface ScheduledWorkout {
  date: string
  workoutId: string | null
  workoutName: string
  planId?: string
  planName?: string
  muscleGroups?: string[]
  estimatedMinutes?: number
  status: "scheduled" | "completed" | "partial" | "missed" | "rest"
  completionPercent: number
  disciplinePointsEarned: number
  elapsedSeconds: number
  scheduledExercises?: ScheduledExercise[]
  completedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface ScheduledExercise {
  exerciseId: string
  name: string
  category?: string
  equipment?: string
  sets: number
  repsMin: number
  repsMax: number
  restSeconds: number
  targetWeight?: number
}

// ─── Workout Session ──────────────────────────────────────────────────────────

// users/{userId}/workoutSessions/{sessionId}
export interface WorkoutSession {
  id: string
  date: string
  workoutId: string
  workoutName: string
  startedAt: string
  completedAt: string | null
  elapsedSeconds: number
  completionPercent: number
  disciplinePointsEarned: number
  exercises: WorkoutSessionExercise[]
}

export interface WorkoutSessionExercise {
  exerciseId: string
  name: string
  completed: boolean
  sets: number
  repsMin: number
  repsMax: number
  weightUsed: number
  weightUnit?: "lbs" | "kg"
  restSeconds: number
  usedSetTimer: boolean
  setsCompleted: number
  elapsedSeconds?: number
}

// ─── Achievement ──────────────────────────────────────────────────────────────

// achievements/{achievementId} — global catalog
export interface AchievementDefinition {
  id: string
  name: string
  description: string
  category: string
  disciplinePointReward: number
  conditionType: AchievementConditionType
  conditionValue: number
}

export type AchievementConditionType =
  | "workouts_completed"
  | "streak_days"
  | "perfect_weeks"
  | "perfect_months"
  | "program_completed"
  | "plan_adherence"
  | "onboarding_completed"
  | "unique_workout_days"
  | "program_progress"
  | "comeback_after_miss"

// users/{userId}/achievements/{achievementId}
export interface UserAchievement {
  unlockedAt: string
  disciplinePointsEarned: number
}

// Combined view used in UI
export interface Achievement {
  id: string
  name: string
  description: string
  category: string
  disciplinePointReward: number
  unlocked: boolean
  unlockedAt?: string
  conditionType?: AchievementConditionType
  conditionValue?: number
}

// ─── Friends ──────────────────────────────────────────────────────────────────

// users/{userId}/friends/{friendUserId}
export interface FriendEntry {
  username: string
  displayName: string
  photoURL: string
  addedAt: string
}

// friendRequests/{requestId}
export interface FriendRequest {
  id: string
  fromUserId: string
  toUserId: string
  fromUsername: string
  fromDisplayName: string
  fromRank: string
  status: "pending" | "accepted" | "declined"
  createdAt: string
  updatedAt?: string
}

// Populated friend profile (from user doc lookup)
export interface Friend {
  id: string
  username: string
  displayName: string
  photoURL: string
  streak: number
  rank: string
  disciplinePoints: number
  consistencyPercent: number
  workoutsCompleted: number
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface WeeklyLeaderboardEntry {
  friendId: string
  displayName: string
  username: string
  weeklyDP: number
  rank: string
  isCurrentUser: boolean
}

// ─── Notifications ────────────────────────────────────────────────────────────

// users/{userId}/notifications/{notificationId}
export interface AppNotification {
  id: string
  title: string
  body: string
  type: "achievement" | "friend" | "streak" | "reminder"
  read: boolean
  createdAt: string
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export interface Rank {
  name: string
  minDP: number
  maxDP: number
  color: string
}

export interface FriendActivity {
  id: string
  friendId: string
  friendName: string
  type: "completed" | "streak" | "rank" | "partial"
  description: string
  timestamp: string
}
