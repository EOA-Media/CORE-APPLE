import type { Exercise, ExerciseTargetUnit, Workout, WorkoutPlan } from "./models"
import { getAppDayOfWeek } from "@/lib/appDate"

export type CoreGoal = "Build Muscle" | "Lose Weight" | "Stay Consistent" | "General Fitness"
export type CoreLocation = "Gym" | "Home"
export type CoreLevel = "Beginner" | "Intermediate" | "Advanced"
export type CoreDays = 2 | 3 | 4 | 5 | 6
type CoreLocationKey = "gym" | "home"
type CoreLevelKey = "beginner" | "intermediate" | "advanced"
type SplitName = "Full Body A" | "Full Body B" | "Full Body C" | "Upper" | "Lower" | "Push" | "Pull" | "Legs"
type ProgramKey = "consistency" | "muscle" | "fat-loss" | "fitness"
type SplitFamily = "full-body" | "upper-lower" | "push-pull-legs"

interface ExerciseInput {
  name: string
  category: string
  equipment: string
  sets: number
  repsMin: number
  repsMax: number
  restSeconds: number
  targetUnit?: ExerciseTargetUnit
  timedSeconds?: number
}

interface ProgramDefinition {
  key: ProgramKey
  goal: CoreGoal
  gymName: string
  homeName: string
  durationDays: number
  estimatedMinutes: number
  reason: string
  cardio: "one-10" | "one-15" | "every-15-20" | "two-20"
}

export interface CoreProgramMapping {
  goal: CoreGoal
  location: CoreLocation
  level: CoreLevel
  daysPerWeek: CoreDays
  program: string
  planId: string
  splitFamily: SplitFamily
  split: SplitName[]
  weeklySchedule: { dayOfWeek: number; label: string; workout: SplitName | "Rest" }[]
  cardioSchedule: { split: SplitName; durationMinutes: string }[]
}

const DAY_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
}

const PROGRAMS: ProgramDefinition[] = [
  {
    key: "consistency",
    goal: "Stay Consistent",
    gymName: "30-Day Consistency Challenge",
    homeName: "30-Day Consistency Challenge (Bodyweight)",
    durationDays: 30,
    estimatedMinutes: 25,
    reason: "A simple, repeatable plan built to make training feel automatic.",
    cardio: "one-10",
  },
  {
    key: "muscle",
    goal: "Build Muscle",
    gymName: "90-Day Muscle Builder",
    homeName: "90-Day Muscle Builder (Bodyweight)",
    durationDays: 90,
    estimatedMinutes: 55,
    reason: "A proven strength and hypertrophy structure based on your weekly schedule.",
    cardio: "one-15",
  },
  {
    key: "fat-loss",
    goal: "Lose Weight",
    gymName: "60-Day Fat Loss Challenge",
    homeName: "60-Day Fat Loss Challenge (Bodyweight)",
    durationDays: 60,
    estimatedMinutes: 55,
    reason: "A steady training plan with post-workout jogging to support fat loss.",
    cardio: "every-15-20",
  },
  {
    key: "fitness",
    goal: "General Fitness",
    gymName: "60-Day Fitness Foundation",
    homeName: "60-Day Fitness Foundation (Bodyweight)",
    durationDays: 60,
    estimatedMinutes: 50,
    reason: "A balanced program for strength, conditioning, and consistency.",
    cardio: "two-20",
  },
]

const SPLIT_CYCLES: Record<SplitFamily, SplitName[]> = {
  "full-body": ["Full Body A", "Full Body B", "Full Body C"],
  "upper-lower": ["Upper", "Lower"],
  "push-pull-legs": ["Push", "Pull", "Legs"],
}

const TRAINING_DAYS_BY_COUNT: Record<CoreDays, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
}

const WORKOUT_MUSCLE_GROUPS: Record<SplitName, string[]> = {
  "Full Body A": ["Full Body"],
  "Full Body B": ["Full Body"],
  "Full Body C": ["Full Body"],
  Upper: ["Chest", "Back", "Shoulders", "Arms"],
  Lower: ["Quads", "Hamstrings", "Glutes", "Calves", "Core"],
  Push: ["Chest", "Shoulders", "Triceps"],
  Pull: ["Back", "Biceps"],
  Legs: ["Quads", "Hamstrings", "Glutes", "Calves"],
}

const GYM_WORKOUTS: Record<CoreLevelKey, Record<SplitName, ExerciseInput[]>> = {
  beginner: {
    "Full Body A": [
      ex("Goblet Squat", "Quads", "Dumbbell", 3, 10, 12, 75),
      ex("Bench Press", "Chest", "Barbell", 3, 8, 10, 90),
      ex("Lat Pulldown", "Back", "Cable", 3, 10, 12, 75),
      ex("Dumbbell Shoulder Press", "Shoulders", "Dumbbells", 2, 10, 12, 75),
      ex("Plank", "Core", "Bodyweight", 3, 30, 45, 45),
    ],
    "Full Body B": [
      ex("Romanian Deadlift", "Hamstrings & Glutes", "Barbell", 3, 8, 10, 90),
      ex("Incline Dumbbell Press", "Chest", "Dumbbells", 3, 10, 12, 75),
      ex("Seated Cable Row", "Back", "Cable", 3, 10, 12, 75),
      ex("Walking Lunges", "Quads", "Bodyweight", 2, 10, 12, 60),
      ex("Side Plank", "Core", "Bodyweight", 3, 20, 30, 45),
    ],
    "Full Body C": [
      ex("Leg Press", "Quads", "Machine", 3, 10, 12, 90),
      ex("Push-Up", "Chest", "Bodyweight", 3, 8, 12, 60),
      ex("Assisted Pull-Up", "Back", "Machine", 3, 6, 10, 90),
      ex("Dumbbell Curl", "Biceps", "Dumbbells", 2, 10, 12, 60),
      ex("Tricep Pushdown", "Triceps", "Cable", 2, 10, 12, 60),
    ],
    Upper: [
      ex("Bench Press", "Chest", "Barbell", 3, 8, 10, 90),
      ex("Lat Pulldown", "Back", "Cable", 3, 10, 12, 75),
      ex("Dumbbell Shoulder Press", "Shoulders", "Dumbbells", 3, 10, 12, 75),
      ex("Seated Cable Row", "Back", "Cable", 3, 10, 12, 75),
      ex("Dumbbell Curl", "Biceps", "Dumbbells", 2, 10, 12, 60),
      ex("Tricep Pushdown", "Triceps", "Cable", 2, 10, 12, 60),
    ],
    Lower: [
      ex("Goblet Squat", "Quads", "Dumbbell", 3, 10, 12, 75),
      ex("Romanian Deadlift", "Hamstrings & Glutes", "Barbell", 3, 8, 10, 90),
      ex("Leg Press", "Quads", "Machine", 3, 10, 12, 90),
      ex("Standing Calf Raise", "Calves", "Machine", 3, 12, 15, 60),
      ex("Plank", "Core", "Bodyweight", 3, 30, 45, 45),
    ],
    Push: [
      ex("Bench Press", "Chest", "Barbell", 3, 8, 10, 90),
      ex("Incline Dumbbell Press", "Chest", "Dumbbells", 3, 10, 12, 75),
      ex("Dumbbell Shoulder Press", "Shoulders", "Dumbbells", 3, 10, 12, 75),
      ex("Dumbbell Lateral Raise", "Shoulders", "Dumbbells", 2, 12, 15, 60),
      ex("Tricep Pushdown", "Triceps", "Cable", 3, 10, 12, 60),
    ],
    Pull: [
      ex("Lat Pulldown", "Back", "Cable", 3, 10, 12, 75),
      ex("Seated Cable Row", "Back", "Cable", 3, 10, 12, 75),
      ex("Face Pull", "Back", "Cable", 2, 12, 15, 60),
      ex("Dumbbell Curl", "Biceps", "Dumbbells", 3, 10, 12, 60),
      ex("Hammer Curl", "Biceps", "Dumbbells", 2, 10, 12, 60),
    ],
    Legs: [
      ex("Goblet Squat", "Quads", "Dumbbell", 3, 10, 12, 75),
      ex("Romanian Deadlift", "Hamstrings & Glutes", "Barbell", 3, 8, 10, 90),
      ex("Walking Lunges", "Quads", "Bodyweight", 2, 10, 12, 60),
      ex("Leg Curl", "Hamstrings & Glutes", "Machine", 3, 10, 12, 60),
      ex("Standing Calf Raise", "Calves", "Machine", 3, 12, 15, 60),
    ],
  },
  intermediate: {
    "Full Body A": [
      ex("Back Squat", "Quads", "Barbell", 3, 6, 8, 120),
      ex("Incline Dumbbell Press", "Chest", "Dumbbells", 3, 8, 10, 90),
      ex("Pull-Up", "Back", "Bodyweight", 3, 6, 10, 90),
      ex("Barbell Overhead Press", "Shoulders", "Barbell", 3, 8, 10, 90),
      ex("Hanging Knee Raise", "Core", "Bodyweight", 3, 10, 12, 60),
    ],
    "Full Body B": [
      ex("Romanian Deadlift", "Hamstrings & Glutes", "Barbell", 3, 8, 10, 105),
      ex("Bench Press", "Chest", "Barbell", 3, 6, 8, 120),
      ex("Chest Supported Row", "Back", "Machine", 3, 8, 10, 90),
      ex("Bulgarian Split Squat", "Quads", "Bodyweight", 3, 8, 10, 75),
      ex("Cable Crunch", "Core", "Cable", 3, 10, 12, 60),
    ],
    "Full Body C": [
      ex("Leg Press", "Quads", "Machine", 3, 10, 12, 90),
      ex("Dumbbell Bench Press", "Chest", "Dumbbells", 3, 8, 10, 90),
      ex("Chin-Up", "Back", "Bodyweight", 3, 6, 10, 90),
      ex("EZ Bar Curl", "Biceps", "Barbell", 3, 10, 12, 60),
      ex("Overhead Cable Extension", "Triceps", "Cable", 3, 10, 12, 60),
    ],
    Upper: [
      ex("Bench Press", "Chest", "Barbell", 3, 6, 8, 120),
      ex("Pull-Up", "Back", "Bodyweight", 3, 6, 10, 90),
      ex("Barbell Overhead Press", "Shoulders", "Barbell", 3, 8, 10, 90),
      ex("Chest Supported Row", "Back", "Machine", 3, 8, 10, 90),
      ex("EZ Bar Curl", "Biceps", "Barbell", 3, 10, 12, 60),
      ex("Overhead Cable Extension", "Triceps", "Cable", 3, 10, 12, 60),
    ],
    Lower: [
      ex("Back Squat", "Quads", "Barbell", 3, 6, 8, 120),
      ex("Romanian Deadlift", "Hamstrings & Glutes", "Barbell", 3, 8, 10, 105),
      ex("Bulgarian Split Squat", "Quads", "Bodyweight", 3, 8, 10, 75),
      ex("Seated Calf Raise", "Calves", "Machine", 3, 12, 15, 60),
      ex("Cable Crunch", "Core", "Cable", 3, 10, 12, 60),
    ],
    Push: [
      ex("Bench Press", "Chest", "Barbell", 3, 6, 8, 120),
      ex("Incline Dumbbell Press", "Chest", "Dumbbells", 3, 8, 10, 90),
      ex("Barbell Overhead Press", "Shoulders", "Barbell", 3, 8, 10, 90),
      ex("Cable Lateral Raise", "Shoulders", "Cable", 3, 12, 15, 60),
      ex("Overhead Cable Extension", "Triceps", "Cable", 3, 10, 12, 60),
    ],
    Pull: [
      ex("Pull-Up", "Back", "Bodyweight", 3, 6, 10, 90),
      ex("Chest Supported Row", "Back", "Machine", 3, 8, 10, 90),
      ex("Face Pull", "Back", "Cable", 3, 12, 15, 60),
      ex("EZ Bar Curl", "Biceps", "Barbell", 3, 10, 12, 60),
      ex("Hammer Curl", "Biceps", "Dumbbells", 3, 10, 12, 60),
    ],
    Legs: [
      ex("Back Squat", "Quads", "Barbell", 3, 6, 8, 120),
      ex("Romanian Deadlift", "Hamstrings & Glutes", "Barbell", 3, 8, 10, 105),
      ex("Bulgarian Split Squat", "Quads", "Bodyweight", 3, 8, 10, 75),
      ex("Leg Curl", "Hamstrings & Glutes", "Machine", 3, 10, 12, 60),
      ex("Seated Calf Raise", "Calves", "Machine", 3, 12, 15, 60),
    ],
  },
  advanced: {
    "Full Body A": [
      ex("Front Squat", "Quads", "Barbell", 3, 5, 8, 120),
      ex("Weighted Dips", "Chest", "Bodyweight", 3, 6, 10, 105),
      ex("Barbell Row", "Back", "Barbell", 3, 6, 10, 105),
      ex("Barbell Overhead Press", "Shoulders", "Barbell", 3, 6, 8, 105),
      ex("Ab Wheel Rollout", "Core", "Bodyweight", 3, 8, 12, 60),
    ],
    "Full Body B": [
      ex("Deadlift", "Hamstrings & Glutes", "Barbell", 3, 4, 6, 150),
      ex("Incline Barbell Bench Press", "Chest", "Barbell", 3, 6, 8, 120),
      ex("T-Bar Row", "Back", "Machine", 3, 8, 10, 90),
      ex("Bulgarian Split Squat", "Quads", "Bodyweight", 3, 8, 10, 75),
      ex("Hanging Leg Raise", "Core", "Bodyweight", 3, 8, 12, 60),
    ],
    "Full Body C": [
      ex("Hack Squat", "Quads", "Machine", 3, 8, 10, 105),
      ex("Dumbbell Bench Press", "Chest", "Dumbbells", 3, 8, 10, 90),
      ex("Chin-Up", "Back", "Bodyweight", 3, 6, 10, 90),
      ex("Preacher Curl", "Biceps", "Machine", 3, 10, 12, 60),
      ex("Skull Crushers", "Triceps", "Barbell", 3, 10, 12, 60),
    ],
    Upper: [
      ex("Weighted Dips", "Chest", "Bodyweight", 3, 6, 10, 105),
      ex("Barbell Row", "Back", "Barbell", 3, 6, 10, 105),
      ex("Barbell Overhead Press", "Shoulders", "Barbell", 3, 6, 8, 105),
      ex("T-Bar Row", "Back", "Machine", 3, 8, 10, 90),
      ex("Preacher Curl", "Biceps", "Machine", 3, 10, 12, 60),
      ex("Skull Crushers", "Triceps", "Barbell", 3, 10, 12, 60),
    ],
    Lower: [
      ex("Front Squat", "Quads", "Barbell", 3, 5, 8, 120),
      ex("Deadlift", "Hamstrings & Glutes", "Barbell", 3, 4, 6, 150),
      ex("Hack Squat", "Quads", "Machine", 3, 8, 10, 105),
      ex("Standing Calf Raise", "Calves", "Machine", 3, 12, 15, 60),
      ex("Ab Wheel Rollout", "Core", "Bodyweight", 3, 8, 12, 60),
    ],
    Push: [
      ex("Weighted Dips", "Chest", "Bodyweight", 3, 6, 10, 105),
      ex("Incline Barbell Bench Press", "Chest", "Barbell", 3, 6, 8, 120),
      ex("Barbell Overhead Press", "Shoulders", "Barbell", 3, 6, 8, 105),
      ex("Cable Lateral Raise", "Shoulders", "Cable", 3, 12, 15, 60),
      ex("Skull Crushers", "Triceps", "Barbell", 3, 10, 12, 60),
    ],
    Pull: [
      ex("Chin-Up", "Back", "Bodyweight", 3, 6, 10, 90),
      ex("Barbell Row", "Back", "Barbell", 3, 6, 10, 105),
      ex("T-Bar Row", "Back", "Machine", 3, 8, 10, 90),
      ex("Preacher Curl", "Biceps", "Machine", 3, 10, 12, 60),
      ex("Cable Curl", "Biceps", "Cable", 3, 10, 12, 60),
    ],
    Legs: [
      ex("Front Squat", "Quads", "Barbell", 3, 5, 8, 120),
      ex("Deadlift", "Hamstrings & Glutes", "Barbell", 3, 4, 6, 150),
      ex("Walking Lunges", "Quads", "Bodyweight", 3, 10, 12, 75),
      ex("Leg Curl", "Hamstrings & Glutes", "Machine", 3, 10, 12, 60),
      ex("Standing Calf Raise", "Calves", "Machine", 3, 12, 15, 60),
    ],
  },
}

const BODYWEIGHT_WORKOUTS: Record<CoreLevelKey, Record<SplitName, ExerciseInput[]>> = {
  beginner: {
    "Full Body A": [
      ex("Bodyweight Squat", "Legs", "Bodyweight", 3, 10, 15, 60),
      ex("Incline Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Doorway Row", "Pull", "Bodyweight", 3, 8, 12, 60),
      ex("Glute Bridge", "Legs", "Bodyweight", 3, 12, 15, 45),
      ex("Plank", "Core", "Bodyweight", 3, 30, 45, 45),
    ],
    "Full Body B": [
      ex("Reverse Lunge", "Legs", "Bodyweight", 3, 8, 10, 60),
      ex("Knee Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Towel Row", "Pull", "Bodyweight", 3, 8, 12, 60),
      ex("Step-Up", "Legs", "Bodyweight", 3, 8, 10, 60),
      ex("Side Plank", "Core", "Bodyweight", 3, 20, 30, 45),
    ],
    "Full Body C": [
      ex("Bodyweight Squat", "Legs", "Bodyweight", 3, 12, 15, 60),
      ex("Push-Up", "Push", "Bodyweight", 3, 6, 10, 60),
      ex("Backpack Row", "Pull", "Bodyweight", 3, 10, 12, 60),
      ex("Mountain Climbers", "Core", "Bodyweight", 3, 20, 30, 45),
      ex("Dead Bug", "Core", "Bodyweight", 3, 10, 12, 45),
    ],
    Upper: [
      ex("Incline Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Doorway Row", "Pull", "Bodyweight", 3, 8, 12, 60),
      ex("Knee Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Towel Row", "Pull", "Bodyweight", 3, 8, 12, 60),
      ex("Plank", "Core", "Bodyweight", 3, 30, 45, 45),
    ],
    Lower: [
      ex("Bodyweight Squat", "Legs", "Bodyweight", 3, 10, 15, 60),
      ex("Reverse Lunge", "Legs", "Bodyweight", 3, 8, 10, 60),
      ex("Glute Bridge", "Legs", "Bodyweight", 3, 12, 15, 45),
      ex("Step-Up", "Legs", "Bodyweight", 3, 8, 10, 60),
      ex("Dead Bug", "Core", "Bodyweight", 3, 10, 12, 45),
    ],
    Push: [
      ex("Incline Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Knee Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Push-Up", "Push", "Bodyweight", 3, 6, 10, 60),
      ex("Pike Push-Up", "Push", "Bodyweight", 2, 6, 10, 60),
      ex("Plank", "Core", "Bodyweight", 3, 30, 45, 45),
    ],
    Pull: [
      ex("Doorway Row", "Pull", "Bodyweight", 3, 8, 12, 60),
      ex("Towel Row", "Pull", "Bodyweight", 3, 8, 12, 60),
      ex("Backpack Row", "Pull", "Bodyweight", 3, 10, 12, 60),
      ex("Resistance Band Row", "Pull", "Band", 3, 10, 12, 60),
      ex("Dead Bug", "Core", "Bodyweight", 3, 10, 12, 45),
    ],
    Legs: [
      ex("Bodyweight Squat", "Legs", "Bodyweight", 3, 10, 15, 60),
      ex("Reverse Lunge", "Legs", "Bodyweight", 3, 8, 10, 60),
      ex("Glute Bridge", "Legs", "Bodyweight", 3, 12, 15, 45),
      ex("Step-Up", "Legs", "Bodyweight", 3, 8, 10, 60),
      ex("Side Plank", "Core", "Bodyweight", 3, 20, 30, 45),
    ],
  },
  intermediate: {
    "Full Body A": [
      ex("Jump Squat", "Legs", "Bodyweight", 3, 8, 12, 60),
      ex("Push-Up", "Push", "Bodyweight", 3, 10, 15, 60),
      ex("Resistance Band Row", "Pull", "Band", 3, 10, 15, 60),
      ex("Bulgarian Split Squat", "Legs", "Bodyweight", 3, 8, 10, 75),
      ex("Hollow Hold", "Core", "Bodyweight", 3, 20, 40, 45),
    ],
    "Full Body B": [
      ex("Walking Lunge", "Legs", "Bodyweight", 3, 10, 12, 60),
      ex("Decline Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Pull-Up", "Pull", "Bodyweight", 3, 5, 8, 90),
      ex("Step-Up", "Legs", "Bodyweight", 3, 10, 12, 60),
      ex("Leg Raises", "Core", "Bodyweight", 3, 10, 15, 45),
    ],
    "Full Body C": [
      ex("Bodyweight Squat", "Legs", "Bodyweight", 3, 15, 20, 60),
      ex("Diamond Push-Up", "Push", "Bodyweight", 3, 6, 10, 60),
      ex("Backpack Row", "Pull", "Bodyweight", 3, 12, 15, 60),
      ex("Mountain Climbers", "Core", "Bodyweight", 3, 30, 40, 45),
      ex("V-Ups", "Core", "Bodyweight", 3, 8, 12, 45),
    ],
    Upper: [
      ex("Push-Up", "Push", "Bodyweight", 3, 10, 15, 60),
      ex("Pull-Up", "Pull", "Bodyweight", 3, 5, 8, 90),
      ex("Decline Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Resistance Band Row", "Pull", "Band", 3, 10, 15, 60),
      ex("Pike Push-Up", "Push", "Bodyweight", 3, 6, 10, 60),
    ],
    Lower: [
      ex("Jump Squat", "Legs", "Bodyweight", 3, 8, 12, 60),
      ex("Bulgarian Split Squat", "Legs", "Bodyweight", 3, 8, 10, 75),
      ex("Walking Lunge", "Legs", "Bodyweight", 3, 10, 12, 60),
      ex("Single-Leg Squat Progression", "Legs", "Bodyweight", 3, 6, 8, 75),
      ex("Hollow Hold", "Core", "Bodyweight", 3, 20, 40, 45),
    ],
    Push: [
      ex("Push-Up", "Push", "Bodyweight", 3, 10, 15, 60),
      ex("Decline Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Diamond Push-Up", "Push", "Bodyweight", 3, 6, 10, 60),
      ex("Pike Push-Up", "Push", "Bodyweight", 3, 6, 10, 60),
      ex("Dips", "Push", "Bodyweight", 3, 6, 10, 75),
    ],
    Pull: [
      ex("Pull-Up", "Pull", "Bodyweight", 3, 5, 8, 90),
      ex("Chin-Up", "Pull", "Bodyweight", 3, 5, 8, 90),
      ex("Resistance Band Row", "Pull", "Band", 3, 10, 15, 60),
      ex("Backpack Row", "Pull", "Bodyweight", 3, 12, 15, 60),
      ex("Resistance Band Pulldown", "Pull", "Band", 3, 10, 15, 60),
    ],
    Legs: [
      ex("Jump Squat", "Legs", "Bodyweight", 3, 8, 12, 60),
      ex("Bulgarian Split Squat", "Legs", "Bodyweight", 3, 8, 10, 75),
      ex("Walking Lunge", "Legs", "Bodyweight", 3, 10, 12, 60),
      ex("Single-Leg Squat Progression", "Legs", "Bodyweight", 3, 6, 8, 75),
      ex("Leg Raises", "Core", "Bodyweight", 3, 10, 15, 45),
    ],
  },
  advanced: {
    "Full Body A": [
      ex("Single-Leg Squat Progression", "Legs", "Bodyweight", 3, 6, 8, 90),
      ex("Decline Push-Up", "Push", "Bodyweight", 3, 10, 15, 60),
      ex("Pull-Up", "Pull", "Bodyweight", 3, 6, 10, 90),
      ex("Pike Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("V-Ups", "Core", "Bodyweight", 3, 10, 15, 45),
    ],
    "Full Body B": [
      ex("Bulgarian Split Squat", "Legs", "Bodyweight", 3, 10, 12, 75),
      ex("Diamond Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Chin-Up", "Pull", "Bodyweight", 3, 6, 10, 90),
      ex("Jump Squat", "Legs", "Bodyweight", 3, 10, 12, 60),
      ex("Hollow Hold", "Core", "Bodyweight", 3, 30, 45, 45),
    ],
    "Full Body C": [
      ex("Walking Lunge", "Legs", "Bodyweight", 3, 12, 15, 60),
      ex("Dips", "Push", "Bodyweight", 3, 8, 12, 75),
      ex("Backpack Row", "Pull", "Bodyweight", 3, 12, 15, 60),
      ex("Handstand Push-Up Progression", "Push", "Bodyweight", 3, 5, 8, 90),
      ex("Leg Raises", "Core", "Bodyweight", 3, 12, 15, 45),
    ],
    Upper: [
      ex("Decline Push-Up", "Push", "Bodyweight", 3, 10, 15, 60),
      ex("Pull-Up", "Pull", "Bodyweight", 3, 6, 10, 90),
      ex("Dips", "Push", "Bodyweight", 3, 8, 12, 75),
      ex("Chin-Up", "Pull", "Bodyweight", 3, 6, 10, 90),
      ex("Handstand Push-Up Progression", "Push", "Bodyweight", 3, 5, 8, 90),
    ],
    Lower: [
      ex("Single-Leg Squat Progression", "Legs", "Bodyweight", 3, 6, 8, 90),
      ex("Bulgarian Split Squat", "Legs", "Bodyweight", 3, 10, 12, 75),
      ex("Jump Squat", "Legs", "Bodyweight", 3, 10, 12, 60),
      ex("Walking Lunge", "Legs", "Bodyweight", 3, 12, 15, 60),
      ex("V-Ups", "Core", "Bodyweight", 3, 10, 15, 45),
    ],
    Push: [
      ex("Decline Push-Up", "Push", "Bodyweight", 3, 10, 15, 60),
      ex("Diamond Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Dips", "Push", "Bodyweight", 3, 8, 12, 75),
      ex("Pike Push-Up", "Push", "Bodyweight", 3, 8, 12, 60),
      ex("Handstand Push-Up Progression", "Push", "Bodyweight", 3, 5, 8, 90),
    ],
    Pull: [
      ex("Pull-Up", "Pull", "Bodyweight", 3, 6, 10, 90),
      ex("Chin-Up", "Pull", "Bodyweight", 3, 6, 10, 90),
      ex("Backpack Row", "Pull", "Bodyweight", 3, 12, 15, 60),
      ex("Resistance Band Row", "Pull", "Band", 3, 12, 15, 60),
      ex("Resistance Band Pulldown", "Pull", "Band", 3, 12, 15, 60),
    ],
    Legs: [
      ex("Single-Leg Squat Progression", "Legs", "Bodyweight", 3, 6, 8, 90),
      ex("Bulgarian Split Squat", "Legs", "Bodyweight", 3, 10, 12, 75),
      ex("Jump Squat", "Legs", "Bodyweight", 3, 10, 12, 60),
      ex("Walking Lunge", "Legs", "Bodyweight", 3, 12, 15, 60),
      ex("Hollow Hold", "Core", "Bodyweight", 3, 30, 45, 45),
    ],
  },
}

function ex(name: string, category: string, equipment: string, sets: number, repsMin: number, repsMax: number, restSeconds: number): ExerciseInput {
  return { name, category, equipment, sets, repsMin, repsMax, restSeconds }
}

function timedEx(
  name: string,
  category: string,
  equipment: string,
  sets: number,
  amount: number,
  targetUnit: "seconds" | "minutes",
  restSeconds: number
): ExerciseInput {
  return {
    name,
    category,
    equipment,
    sets,
    repsMin: amount,
    repsMax: amount,
    restSeconds,
    targetUnit,
    timedSeconds: targetUnit === "minutes" ? amount * 60 : amount,
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function locationKey(location: CoreLocation): CoreLocationKey {
  return location === "Home" ? "home" : "gym"
}

function levelKey(level: CoreLevel): CoreLevelKey {
  return level.toLowerCase() as CoreLevelKey
}

function makeExercise(input: ExerciseInput, id: string): Exercise {
  return {
    id,
    name: input.name,
    category: input.category,
    equipment: input.equipment,
    sets: input.sets,
    repsMin: input.repsMin,
    repsMax: input.repsMax,
    restSeconds: input.restSeconds,
    defaultWeight: 0,
    targetUnit: input.targetUnit,
    timedSeconds: input.timedSeconds,
  }
}

function jogExercise(durationMinutes: string, id: string): Exercise {
  const [minRaw, maxRaw] = durationMinutes.split("-")
  return {
    id,
    name: "Jog",
    category: "Cardio",
    equipment: "Bodyweight",
    sets: 1,
    repsMin: Number(minRaw),
    repsMax: Number(maxRaw ?? minRaw),
    restSeconds: 0,
    defaultWeight: 0,
    targetUnit: "minutes",
  }
}

function getProgramByGoal(goal: CoreGoal): ProgramDefinition {
  return PROGRAMS.find((program) => program.goal === goal) ?? PROGRAMS[3]
}

function getProgramName(program: ProgramDefinition, location: CoreLocation): string {
  return location === "Home" ? program.homeName : program.gymName
}

function getSplitFamily(goal: CoreGoal, days: CoreDays): SplitFamily {
  if (goal === "Build Muscle") {
    if (days === 2 || days === 4) return "upper-lower"
    return "push-pull-legs"
  }

  if (days <= 3) return "full-body"
  if (days === 4) return "upper-lower"
  return "push-pull-legs"
}

function getSplitForPlan(goal: CoreGoal, days: CoreDays): SplitName[] {
  const family = getSplitFamily(goal, days)
  const cycle = SPLIT_CYCLES[family]
  return Array.from({ length: days }, (_, index) => cycle[index % cycle.length])
}

function getTemplates(location: CoreLocation, level: CoreLevel): Record<SplitName, ExerciseInput[]> {
  return location === "Home" ? BODYWEIGHT_WORKOUTS[levelKey(level)] : GYM_WORKOUTS[levelKey(level)]
}

function cardioTargets(program: ProgramDefinition, split: SplitName[]): { indexes: number[]; duration: string } {
  if (program.cardio === "every-15-20") {
    return { indexes: split.map((_, index) => index), duration: "15-20" }
  }

  const preferred = ["Upper", "Push", "Pull", "Full Body A", "Full Body B", "Full Body C"] as SplitName[]
  const allowedIndexes = split
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => name !== "Legs" && name !== "Lower")
    .sort((a, b) => preferred.indexOf(a.name) - preferred.indexOf(b.name))
    .map(({ index }) => index)

  if (allowedIndexes.length === 0) return { indexes: [], duration: "0" }
  if (program.cardio === "two-20") {
    return { indexes: allowedIndexes.slice(0, 2), duration: "20" }
  }
  return { indexes: [allowedIndexes[0]], duration: program.cardio === "one-10" ? "10" : "15" }
}

function makeWorkout(
  program: ProgramDefinition,
  location: CoreLocation,
  level: CoreLevel,
  days: CoreDays,
  splitName: SplitName,
  occurrenceIndex: number,
  includeCardio: boolean,
  cardioDuration: string
): Workout {
  const templates = getTemplates(location, level)
  const workoutId = [
    "wk-core",
    program.key,
    locationKey(location),
    levelKey(level),
    days,
    slug(splitName),
    occurrenceIndex + 1,
  ].join("-")
  const baseExercises = templates[splitName].map((exercise, index) =>
    makeExercise(exercise, `${workoutId}-ex-${index + 1}`)
  )
  const exercises = includeCardio
    ? [...baseExercises, jogExercise(cardioDuration, `${workoutId}-jog`)]
    : baseExercises

  return {
    id: workoutId,
    name: includeCardio ? `${splitName} + Jog` : splitName,
    muscleGroups: includeCardio ? [...WORKOUT_MUSCLE_GROUPS[splitName], "Cardio"] : WORKOUT_MUSCLE_GROUPS[splitName],
    estimatedMinutes: program.cardio === "one-10" ? Math.min(30, program.estimatedMinutes) : program.estimatedMinutes,
    exercises,
  }
}

function makePlan(goal: CoreGoal, location: CoreLocation, level: CoreLevel, days: CoreDays): {
  plan: WorkoutPlan
  workouts: Workout[]
  mapping: CoreProgramMapping
} {
  const program = getProgramByGoal(goal)
  const splitFamily = getSplitFamily(goal, days)
  const split = getSplitForPlan(goal, days)
  const trainingDays = TRAINING_DAYS_BY_COUNT[days]
  const cardio = cardioTargets(program, split)
  const programName = getProgramName(program, location)
  const planId = [
    "plan-core",
    program.key,
    locationKey(location),
    levelKey(level),
    days,
  ].join("-")
  const workouts = split.map((splitName, index) =>
    makeWorkout(program, location, level, days, splitName, index, cardio.indexes.includes(index), cardio.duration)
  )

  const schedule = Array.from({ length: 7 }, (_, dayIndex) => {
    const splitIndex = trainingDays.indexOf(dayIndex)
    return {
      dayOfWeek: dayIndex,
      workoutId: splitIndex >= 0 ? workouts[splitIndex].id : null,
      isRest: splitIndex < 0,
    }
  })

  return {
    plan: {
      id: planId,
      name: programName,
      type: "core",
      createdBy: "core",
      experienceLevel: levelKey(level),
      location: locationKey(location),
      daysPerWeek: days,
      durationDays: program.durationDays,
      goal,
      schedule,
    },
    workouts,
    mapping: {
      goal,
      location,
      level,
      daysPerWeek: days,
      program: programName,
      planId,
      splitFamily,
      split,
      weeklySchedule: schedule.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        label: DAY_LABELS[day.dayOfWeek],
        workout: day.workoutId ? split[trainingDays.indexOf(day.dayOfWeek)] : "Rest",
      })),
      cardioSchedule: cardio.indexes.map((index) => ({
        split: split[index],
        durationMinutes: cardio.duration,
      })),
    },
  }
}

const GOALS: CoreGoal[] = ["Build Muscle", "Lose Weight", "Stay Consistent", "General Fitness"]
const LOCATIONS: CoreLocation[] = ["Gym", "Home"]
const LEVELS: CoreLevel[] = ["Beginner", "Intermediate", "Advanced"]
const DAYS: CoreDays[] = [2, 3, 4, 5, 6]

const GENERATED = GOALS.flatMap((goal) =>
  LOCATIONS.flatMap((location) =>
    LEVELS.flatMap((level) =>
      DAYS.map((days) => makePlan(goal, location, level, days))
    )
  )
)

const INCA_TRAIL_PLAN_ID = "plan-special-inca-trail-prep-30"

const incaTrailWorkouts: Workout[] = [
  {
    id: "wk-special-inca-trail-monday-lower-body-durability",
    name: "Lower Body Durability",
    muscleGroups: ["Quads", "Glutes", "Calves", "Knees", "Mobility"],
    estimatedMinutes: 55,
    exercises: [
      makeExercise(ex("ATG Split Squat", "Quads", "Bodyweight", 3, 10, 10, 60), "inca-mon-ex-1"),
      makeExercise(ex("Step-Ups", "Quads", "Bodyweight", 3, 15, 15, 60), "inca-mon-ex-2"),
      makeExercise(ex("Tibialis Raises", "Shins", "Bodyweight", 3, 25, 25, 45), "inca-mon-ex-3"),
      makeExercise(ex("Single-Leg Calf Raises", "Calves", "Bodyweight", 3, 20, 20, 45), "inca-mon-ex-4"),
      makeExercise(ex("Patrick Step", "Knees", "Bodyweight", 3, 15, 15, 45), "inca-mon-ex-5"),
      makeExercise(timedEx("Couch Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-mon-ex-6"),
      makeExercise(timedEx("Standing Calf Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-mon-ex-7"),
    ],
  },
  {
    id: "wk-special-inca-trail-tuesday-trail-conditioning",
    name: "Trail Conditioning",
    muscleGroups: ["Cardio", "Calves", "Knees", "Mobility"],
    estimatedMinutes: 45,
    exercises: [
      makeExercise(timedEx("Incline Treadmill or Stair Climber", "Cardio", "Machine", 1, 20, "minutes", 0), "inca-tue-ex-1"),
      makeExercise(ex("Tibialis Raises", "Shins", "Bodyweight", 2, 25, 25, 45), "inca-tue-ex-2"),
      makeExercise(timedEx("Knees-Over-Toes Calf Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-tue-ex-3"),
    ],
  },
  {
    id: "wk-special-inca-trail-wednesday-bulletproofing",
    name: "Knee, Ankle & Hip Bulletproofing",
    muscleGroups: ["Knees", "Ankles", "Hips", "Glutes", "Mobility"],
    estimatedMinutes: 60,
    exercises: [
      makeExercise(timedEx("Backward Walking", "Knees", "Bodyweight", 1, 10, "minutes", 0), "inca-wed-ex-1"),
      makeExercise(ex("ATG Split Squat", "Quads", "Bodyweight", 3, 10, 10, 60), "inca-wed-ex-2"),
      makeExercise(ex("Patrick Step", "Knees", "Bodyweight", 3, 15, 15, 45), "inca-wed-ex-3"),
      makeExercise(ex("Tibialis Raises", "Shins", "Bodyweight", 3, 25, 25, 45), "inca-wed-ex-4"),
      makeExercise(ex("Single-Leg Calf Raise", "Calves", "Bodyweight", 3, 20, 20, 45), "inca-wed-ex-5"),
      makeExercise(ex("Glute Bridge", "Glutes", "Bodyweight", 3, 15, 15, 45), "inca-wed-ex-6"),
      makeExercise(timedEx("Couch Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-wed-ex-7"),
      makeExercise(timedEx("Butterfly Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-wed-ex-8"),
      makeExercise(timedEx("90/90 Hip Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-wed-ex-9"),
      makeExercise(timedEx("Deep Squat Hold", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-wed-ex-10"),
    ],
  },
  {
    id: "wk-special-inca-trail-thursday-hiking-strength",
    name: "Hiking Specific Strength",
    muscleGroups: ["Quads", "Glutes", "Calves", "Knees", "Mobility"],
    estimatedMinutes: 55,
    exercises: [
      makeExercise(ex("Walking Lunges", "Quads", "Bodyweight", 3, 20, 20, 60), "inca-thu-ex-1"),
      makeExercise(ex("Step-Ups", "Quads", "Bodyweight", 4, 15, 15, 60), "inca-thu-ex-2"),
      makeExercise(ex("ATG Split Squat", "Quads", "Bodyweight", 3, 10, 10, 60), "inca-thu-ex-3"),
      makeExercise(ex("Tibialis Raises", "Shins", "Bodyweight", 3, 25, 25, 45), "inca-thu-ex-4"),
      makeExercise(ex("Single-Leg Calf Raises", "Calves", "Bodyweight", 3, 20, 20, 45), "inca-thu-ex-5"),
      makeExercise(timedEx("Standing Calf Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-thu-ex-6"),
      makeExercise(timedEx("Couch Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-thu-ex-7"),
    ],
  },
  {
    id: "wk-special-inca-trail-friday-recovery-mobility",
    name: "Recovery Mobility Session",
    muscleGroups: ["Mobility", "Recovery", "Hips", "Calves"],
    estimatedMinutes: 30,
    exercises: [
      makeExercise(timedEx("Backward Walking", "Recovery", "Bodyweight", 1, 5, "minutes", 0), "inca-fri-ex-1"),
      makeExercise(timedEx("Couch Stretch", "Mobility", "Bodyweight", 2, 90, "seconds", 15), "inca-fri-ex-2"),
      makeExercise(timedEx("Standing Calf Stretch", "Mobility", "Bodyweight", 2, 90, "seconds", 15), "inca-fri-ex-3"),
      makeExercise(timedEx("90/90 Hip Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-fri-ex-4"),
      makeExercise(timedEx("Butterfly Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-fri-ex-5"),
      makeExercise(timedEx("Deep Squat Hold", "Mobility", "Bodyweight", 3, 60, "seconds", 15), "inca-fri-ex-6"),
      makeExercise(timedEx("Hamstring Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-fri-ex-7"),
      makeExercise(timedEx("Child's Pose", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-fri-ex-8"),
    ],
  },
  {
    id: "wk-special-inca-trail-saturday-long-hike",
    name: "Long Hike Day",
    muscleGroups: ["Cardio", "Hiking", "Calves", "Mobility"],
    estimatedMinutes: 150,
    exercises: [
      makeExercise(timedEx("Long Hike", "Cardio", "Outdoor", 1, 60, "minutes", 0), "inca-sat-ex-1"),
      makeExercise(timedEx("Standing Calf Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-sat-ex-2"),
      makeExercise(timedEx("Couch Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-sat-ex-3"),
      makeExercise(timedEx("Butterfly Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-sat-ex-4"),
    ],
  },
  {
    id: "wk-special-inca-trail-sunday-recovery-mobility",
    name: "Recovery & Mobility",
    muscleGroups: ["Recovery", "Mobility", "Hips", "Calves"],
    estimatedMinutes: 45,
    exercises: [
      makeExercise(timedEx("Easy Walk", "Recovery", "Bodyweight", 1, 30, "minutes", 0), "inca-sun-ex-1"),
      makeExercise(timedEx("Deep Squat Hold", "Mobility", "Bodyweight", 3, 60, "seconds", 15), "inca-sun-ex-2"),
      makeExercise(timedEx("Couch Stretch", "Mobility", "Bodyweight", 2, 90, "seconds", 15), "inca-sun-ex-3"),
      makeExercise(timedEx("Standing Calf Stretch", "Mobility", "Bodyweight", 2, 90, "seconds", 15), "inca-sun-ex-4"),
      makeExercise(timedEx("90/90 Hip Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-sun-ex-5"),
      makeExercise(timedEx("Butterfly Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-sun-ex-6"),
      makeExercise(timedEx("Child's Pose", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-sun-ex-7"),
      makeExercise(timedEx("Hamstring Stretch", "Mobility", "Bodyweight", 2, 60, "seconds", 15), "inca-sun-ex-8"),
    ],
  },
]

export const INCA_TRAIL_PLAN: WorkoutPlan = {
  id: INCA_TRAIL_PLAN_ID,
  name: "30-Day Inca Trail Preparation",
  type: "core",
  createdBy: "core",
  experienceLevel: "intermediate",
  location: "gym",
  daysPerWeek: 7,
  durationDays: 30,
  goal: "Inca Trail Preparation",
  schedule: [
    { dayOfWeek: 0, workoutId: "wk-special-inca-trail-sunday-recovery-mobility", isRest: false },
    { dayOfWeek: 1, workoutId: "wk-special-inca-trail-monday-lower-body-durability", isRest: false },
    { dayOfWeek: 2, workoutId: "wk-special-inca-trail-tuesday-trail-conditioning", isRest: false },
    { dayOfWeek: 3, workoutId: "wk-special-inca-trail-wednesday-bulletproofing", isRest: false },
    { dayOfWeek: 4, workoutId: "wk-special-inca-trail-thursday-hiking-strength", isRest: false },
    { dayOfWeek: 5, workoutId: "wk-special-inca-trail-friday-recovery-mobility", isRest: false },
    { dayOfWeek: 6, workoutId: "wk-special-inca-trail-saturday-long-hike", isRest: false },
  ],
}

export const SPECIAL_CORE_PLANS: WorkoutPlan[] = [INCA_TRAIL_PLAN]
export const ALL_CORE_PLANS: WorkoutPlan[] = [...GENERATED.map(({ plan }) => plan), ...SPECIAL_CORE_PLANS]
export const ALL_SEED_WORKOUTS: Workout[] = [...GENERATED.flatMap(({ workouts }) => workouts), ...incaTrailWorkouts]
export const CORE_PROGRAM_MAPPINGS: CoreProgramMapping[] = GENERATED.map(({ mapping }) => mapping)

export const DEFAULT_CORE_PLAN_ID = "plan-core-fitness-gym-beginner-3"

export function getCorePlanForOnboarding(goal: CoreGoal, location: CoreLocation, level: CoreLevel, days: CoreDays): WorkoutPlan {
  const plan = ALL_CORE_PLANS.find((candidate) =>
    candidate.goal === goal &&
    candidate.location === locationKey(location) &&
    candidate.experienceLevel === levelKey(level) &&
    candidate.daysPerWeek === days
  )
  return plan ?? getPlanById(DEFAULT_CORE_PLAN_ID)!
}

export function getProgramReason(goal: CoreGoal): string {
  return getProgramByGoal(goal).reason
}

export function getPlanById(planId: string): WorkoutPlan | null {
  return ALL_CORE_PLANS.find((p) => p.id === planId) ?? null
}

export function getPlanByName(name: string): WorkoutPlan | null {
  return ALL_CORE_PLANS.find((p) => p.name === name) ?? null
}

export function getWorkoutById(workoutId: string): Workout | null {
  return ALL_SEED_WORKOUTS.find((w) => w.id === workoutId) ?? null
}

export function buildWorkoutNameMap(plan: WorkoutPlan): Record<string, string> {
  const map: Record<string, string> = {}
  for (const day of plan.schedule) {
    if (day.workoutId) {
      const wk = getWorkoutById(day.workoutId)
      if (wk) map[day.workoutId] = wk.name
    }
  }
  return map
}

export function getTodayWorkoutForPlan(plan: WorkoutPlan): Workout | null {
  const dayOfWeek = getAppDayOfWeek()
  const planDay = plan.schedule.find((s) => s.dayOfWeek === dayOfWeek)
  if (!planDay || planDay.isRest || !planDay.workoutId) return null
  return getWorkoutById(planDay.workoutId)
}
