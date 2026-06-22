type ExerciseTimingInput = {
  name: string
  category?: string
  repsMin: number
  repsMax: number
  targetUnit?: "reps" | "seconds" | "minutes"
  timedSeconds?: number
}

function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const timedSecondExercises = new Set([
  "plank",
  "side plank",
  "hollow hold",
])

export function isTimedExercise(exercise: ExerciseTimingInput) {
  if (exercise.timedSeconds || exercise.targetUnit === "seconds" || exercise.targetUnit === "minutes") return true
  const name = normalizeName(exercise.name)
  return exercise.category?.toLowerCase() === "cardio" || name === "jog" || timedSecondExercises.has(name)
}

export function getTimedExerciseUnit(exercise: ExerciseTimingInput): "seconds" | "minutes" {
  if (exercise.targetUnit === "seconds" || exercise.targetUnit === "minutes") return exercise.targetUnit
  const name = normalizeName(exercise.name)
  return exercise.category?.toLowerCase() === "cardio" || name === "jog" ? "minutes" : "seconds"
}

export function getTimedExerciseSeconds(exercise: ExerciseTimingInput) {
  if (exercise.timedSeconds) return Math.max(1, exercise.timedSeconds)
  const unit = getTimedExerciseUnit(exercise)
  return Math.max(1, exercise.repsMin) * (unit === "minutes" ? 60 : 1)
}

export function formatExerciseTarget(exercise: ExerciseTimingInput) {
  if (!isTimedExercise(exercise)) {
    return `${exercise.repsMin}-${exercise.repsMax} reps`
  }

  const unit = getTimedExerciseUnit(exercise)
  const label = unit === "minutes" ? "min" : "sec"
  if (exercise.repsMin === exercise.repsMax) return `${exercise.repsMin} ${label}`
  return `${exercise.repsMin}-${exercise.repsMax} ${label}`
}

export function formatExerciseTimer(seconds: number) {
  const safeSeconds = Math.max(0, seconds)
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}
