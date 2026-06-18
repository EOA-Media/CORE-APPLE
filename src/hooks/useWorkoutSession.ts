import { useState, useEffect, useRef, useCallback } from "react"
import type { Exercise } from "@/data/models"
import { calculateWorkoutRewards } from "@/data/helpers"
import { getTodayString } from "@/lib/appDate"

export interface ExerciseState {
  completed: boolean
  expanded: boolean
  weightUsed: number
  weightUnit: "lbs" | "kg"
  setsCompleted: number
  usedSetTimer: boolean
  startedAtSecond: number | null
  elapsedSeconds: number
}

export interface SessionSummary {
  completionPercent: number
  dpEarned: number
  elapsedSeconds: number
  date: string
  startedAt: string
  completedAt: string
}

export function useWorkoutSession(exercises: Exercise[]) {
  const startedAt = useRef(new Date().toISOString())
  const todayDate = useRef(getTodayString())

  const [exerciseStates, setExerciseStates] = useState<ExerciseState[]>(
    exercises.map(() => ({
      completed: false,
      expanded: false,
      weightUsed: 0,
      weightUnit: "lbs",
      setsCompleted: 0,
      usedSetTimer: false,
      startedAtSecond: null,
      elapsedSeconds: 0,
    }))
  )

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Elapsed timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Computed values
  const completedCount = exerciseStates.filter((e) => e.completed).length
  const totalExercises = exercises.length
  const completionPercent = totalExercises > 0
    ? Math.round((completedCount / totalExercises) * 100)
    : 0
  const allCompleted = completedCount === totalExercises && totalExercises > 0

  // Exercise mutations
  const toggleExercise = useCallback((index: number) => {
    setExerciseStates((prev) => {
      const next = [...prev]
      const toggled = !next[index].completed
      const exerciseStartedAtSecond = next[index].startedAtSecond ?? elapsedSeconds
      next[index] = {
        ...next[index],
        completed: toggled,
        setsCompleted: toggled ? exercises[index].sets : 0,
        expanded: toggled ? false : next[index].expanded,
        startedAtSecond: toggled ? exerciseStartedAtSecond : null,
        elapsedSeconds: toggled ? Math.max(1, elapsedSeconds - exerciseStartedAtSecond) : 0,
      }
      return next
    })
  }, [elapsedSeconds, exercises])

  const toggleExpand = useCallback((index: number) => {
    setExerciseStates((prev) => {
      const next = [...prev]
      const expanded = !next[index].expanded
      next[index] = {
        ...next[index],
        expanded,
        startedAtSecond: expanded ? (next[index].startedAtSecond ?? elapsedSeconds) : next[index].startedAtSecond,
      }
      return next
    })
  }, [elapsedSeconds])

  const completeSet = useCallback((exerciseIndex: number, usedTimer: boolean) => {
    setExerciseStates((prev) => {
      const next = [...prev]
      const ex = exercises[exerciseIndex]
      const newSetsCompleted = next[exerciseIndex].setsCompleted + 1
      const startedAtSecond = next[exerciseIndex].startedAtSecond ?? elapsedSeconds
      next[exerciseIndex] = {
        ...next[exerciseIndex],
        startedAtSecond,
        setsCompleted: newSetsCompleted,
        completed: newSetsCompleted >= ex.sets,
        expanded: newSetsCompleted >= ex.sets ? false : next[exerciseIndex].expanded,
        usedSetTimer: next[exerciseIndex].usedSetTimer || usedTimer,
        elapsedSeconds: Math.max(1, elapsedSeconds - startedAtSecond),
      }
      return next
    })
  }, [elapsedSeconds, exercises])

  const updateWeight = useCallback((index: number, weight: number, weightUnit?: "lbs" | "kg") => {
    setExerciseStates((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], weightUsed: weight, weightUnit: weightUnit ?? next[index].weightUnit }
      return next
    })
  }, [])

  // Build session summary for persistence
  const buildSummary = useCallback((): SessionSummary => {
    const rewards = calculateWorkoutRewards(completionPercent)
    return {
      completionPercent,
      dpEarned: rewards.dp,
      elapsedSeconds,
      date: todayDate.current,
      startedAt: startedAt.current,
      completedAt: new Date().toISOString(),
    }
  }, [completionPercent, elapsedSeconds])

  return {
    exerciseStates,
    elapsedSeconds,
    completedCount,
    totalExercises,
    completionPercent,
    allCompleted,
    isSaving,
    setIsSaving,
    toggleExercise,
    toggleExpand,
    completeSet,
    updateWeight,
    stopTimer,
    buildSummary,
    date: todayDate.current,
    startedAt: startedAt.current,
  }
}
