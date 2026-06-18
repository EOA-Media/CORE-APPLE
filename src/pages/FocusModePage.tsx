import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Activity, AlertTriangle, ArrowLeft, BookOpen, Check, ChevronDown, Clock, Dumbbell, Flame, Footprints, Loader2, Pause, Play, Plus, RotateCcw, SkipForward, Sparkles, Target, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatElapsedTime, formatRestTime, calculateWorkoutRewards } from "@/data/helpers"
import { getExerciseGuide, type ExerciseGuide } from "@/data/exerciseGuides"
import { formatExerciseTarget, formatExerciseTimer, getTimedExerciseSeconds, isTimedExercise } from "@/data/exerciseTiming"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { saveWorkoutSession, updateScheduledWorkoutStatus, updateExerciseWeight, markMissedWorkouts, getScheduledWorkout, syncUserStreakFromSchedule, getAllExerciseData } from "@/services/workoutService"
import { updateUserStats } from "@/services/userService"
import { checkAndUnlockAchievements } from "@/services/achievementService"
import { showPostWorkoutVideoAd } from "@/services/adService"
import { useWorkoutSession } from "@/hooks/useWorkoutSession"
import { DEFAULT_CORE_PLAN_ID, getPlanById, getWorkoutById } from "@/data/planSeedData"
import type { Workout } from "@/data/models"
import { getAppDayOfWeek, getTodayString } from "@/lib/appDate"

type TimerState = "idle" | "running" | "paused"
type CompletionStep = "none" | "summary" | "ad" | "streak"

type ExerciseTimerState = {
  exerciseIndex: number
  setIndex: number
  remainingSeconds: number
  status: TimerState
} | null

function ExerciseGuideIcon({ muscleGroup }: { muscleGroup: string }) {
  const key = muscleGroup.toLowerCase()
  if (key.includes("cardio")) return <Activity className="size-6 text-[var(--gold)]" strokeWidth={1.6} />
  if (key.includes("leg") || key.includes("calf") || key.includes("hamstring") || key.includes("glute")) return <Footprints className="size-6 text-[var(--gold)]" strokeWidth={1.6} />
  if (key.includes("core")) return <Target className="size-6 text-[var(--gold)]" strokeWidth={1.6} />
  return <Dumbbell className="size-6 text-[var(--gold)]" strokeWidth={1.6} />
}

function workoutFromScheduledWorkout(sched: Awaited<ReturnType<typeof getScheduledWorkout>>): Workout | null {
  if (!sched?.workoutId || !sched.scheduledExercises?.length) return null
  return {
    id: sched.workoutId,
    name: sched.workoutName,
    muscleGroups: Array.from(new Set(sched.scheduledExercises.map((exercise) => exercise.category).filter(Boolean))) as string[],
    estimatedMinutes: sched.estimatedMinutes ?? 30,
    exercises: sched.scheduledExercises.map((exercise) => ({
      id: exercise.exerciseId,
      name: exercise.name,
      category: exercise.category ?? "Custom",
      equipment: exercise.equipment ?? "Other",
      sets: exercise.sets,
      repsMin: exercise.repsMin,
      repsMax: exercise.repsMax,
      restSeconds: exercise.restSeconds,
      defaultWeight: exercise.targetWeight ?? 0,
    })),
    planId: sched.planId,
  }
}

// ─── Inner session component (receives resolved workout) ──────────────────

function WorkoutSessionPage({ workout }: { workout: Workout }) {
  const navigate = useNavigate()
  const { firebaseUser, userDoc, refreshUserDoc, isGuest } = useAuth()

  const session = useWorkoutSession(workout.exercises)

  const [showFinishModal, setShowFinishModal] = useState(false)
  const [completionStep, setCompletionStep] = useState<CompletionStep>("none")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedExerciseGuide, setSelectedExerciseGuide] = useState<ExerciseGuide | null>(null)
  const [weightEditIndex, setWeightEditIndex] = useState<number | null>(null)
  const [weightInput, setWeightInput] = useState("")
  const [weightUnitInput, setWeightUnitInput] = useState<"lbs" | "kg">("lbs")
  const [completionData, setCompletionData] = useState<{
    completionPercent: number
    dpEarned: number
    elapsedSeconds: number
    newStreak: number
    newlyUnlocked: string[]
  } | null>(null)

  const [restTimerIndex, setRestTimerIndex] = useState<number | null>(null)
  const [restTimeRemaining, setRestTimeRemaining] = useState(0)
  const [restTimerState, setRestTimerState] = useState<TimerState>("idle")
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [exerciseTimer, setExerciseTimer] = useState<ExerciseTimerState>(null)
  const exerciseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const workoutExercisesRef = useRef(workout.exercises)
  const completeSetRef = useRef(session.completeSet)
  const startRestTimerRef = useRef<(exerciseIndex: number) => void>(() => undefined)
  const saveStartedRef = useRef(false)

  useEffect(() => {
    workoutExercisesRef.current = workout.exercises
    completeSetRef.current = session.completeSet
  }, [session.completeSet, workout.exercises])

  useEffect(() => {
    if (restTimerState === "running" && restTimeRemaining > 0) {
      restTimerRef.current = setInterval(() => {
        setRestTimeRemaining((t) => {
          if (t <= 1) {
            setRestTimerState("idle")
            setRestTimerIndex(null)
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current)
    }
  }, [restTimerState, restTimeRemaining])

  useEffect(() => {
    if (isGuest || !firebaseUser) return

    let cancelled = false
    async function loadSavedWeights() {
      try {
        const exerciseData = await getAllExerciseData(firebaseUser.uid)
        if (cancelled) return

        workout.exercises.forEach((exercise, index) => {
          const savedWeight = exerciseData[exercise.id]?.currentWeight ?? 0
          const savedUnit = exerciseData[exercise.id]?.weightUnit ?? "lbs"
          if (savedWeight > 0) {
            session.updateWeight(index, savedWeight, savedUnit)
          }
        })
      } catch (err) {
        console.warn("[FocusMode] failed to load saved exercise weights:", err)
      }
    }

    loadSavedWeights()
    return () => { cancelled = true }
  }, [firebaseUser, isGuest, workout.exercises, session.updateWeight])

  const startRestTimer = useCallback((exerciseIndex: number) => {
    setRestTimerIndex(exerciseIndex)
    setRestTimeRemaining(workout.exercises[exerciseIndex].restSeconds)
    setRestTimerState("running")
  }, [workout.exercises])

  useEffect(() => {
    startRestTimerRef.current = startRestTimer
  }, [startRestTimer])

  useEffect(() => {
    if (exerciseTimer?.status !== "running") return

    exerciseTimerRef.current = setInterval(() => {
      setExerciseTimer((timer) => {
        if (!timer || timer.status !== "running") return timer
        if (timer.remainingSeconds <= 1) {
          const exercise = workoutExercisesRef.current[timer.exerciseIndex]
          completeSetRef.current(timer.exerciseIndex, true)
          if (timer.setIndex < exercise.sets - 1) startRestTimerRef.current(timer.exerciseIndex)
          return null
        }
        return { ...timer, remainingSeconds: timer.remainingSeconds - 1 }
      })
    }, 1000)

    return () => {
      if (exerciseTimerRef.current) clearInterval(exerciseTimerRef.current)
    }
  }, [exerciseTimer?.status])

  const startExerciseTimer = useCallback((exerciseIndex: number, setIndex: number) => {
    setExerciseTimer({
      exerciseIndex,
      setIndex,
      remainingSeconds: getTimedExerciseSeconds(workout.exercises[exerciseIndex]),
      status: "running",
    })
  }, [workout.exercises])

  const pauseExerciseTimer = useCallback(() => {
    setExerciseTimer((timer) => timer ? { ...timer, status: "paused" } : timer)
  }, [])

  const resumeExerciseTimer = useCallback(() => {
    setExerciseTimer((timer) => timer ? { ...timer, status: "running" } : timer)
  }, [])

  const resetExerciseTimer = useCallback(() => {
    setExerciseTimer((timer) => timer
      ? { ...timer, remainingSeconds: getTimedExerciseSeconds(workout.exercises[timer.exerciseIndex]), status: "idle" }
      : timer
    )
  }, [workout.exercises])

  const clearExerciseTimerFor = useCallback((exerciseIndex: number) => {
    setExerciseTimer((timer) => timer?.exerciseIndex === exerciseIndex ? null : timer)
  }, [])

  const addRestTime = useCallback(() => setRestTimeRemaining((t) => t + 30), [])
  const skipRestTimer = useCallback(() => {
    setRestTimerState("idle")
    setRestTimerIndex(null)
    setRestTimeRemaining(0)
  }, [])

  const prepareCompletionSummary = useCallback(() => {
    session.stopTimer()
    const summary = session.buildSummary()

    setCompletionData({
      completionPercent: summary.completionPercent,
      dpEarned: summary.dpEarned,
      elapsedSeconds: summary.elapsedSeconds,
      newStreak: userDoc?.streak ?? 0,
      newlyUnlocked: [],
    })
    setSaveError(null)
    saveStartedRef.current = false
    setCompletionStep("summary")
  }, [session, userDoc?.streak])

  const persistCompletion = useCallback(async (): Promise<boolean> => {
    const summary = session.buildSummary()
    const today = getTodayString()
    const isFullyComplete = summary.completionPercent >= 100
    const isPartial = summary.completionPercent > 0 && summary.completionPercent < 100
    let newStreak = userDoc?.streak ?? 0

    console.log("[persistCompletion] payload:", {
      workoutId: workout.id,
      workoutName: workout.name,
      completionPercent: summary.completionPercent,
      dpEarned: summary.dpEarned,
      elapsedSeconds: summary.elapsedSeconds,
      newStreak,
    })

    if (isGuest || !firebaseUser) {
      return true
    }

    session.setIsSaving(true)
    setSaveError(null)
    try {
      // markMissedWorkouts requires a composite Firestore index — isolate so it
      // can't block the core completion save if the index doesn't exist yet.
      try {
        await markMissedWorkouts(firebaseUser.uid)
      } catch (missedErr) {
        console.warn("[persistCompletion] markMissedWorkouts failed (non-fatal):", missedErr)
      }

      await saveWorkoutSession(firebaseUser.uid, {
        date: today,
        workoutId: workout.id,
        workoutName: workout.name,
        startedAt: summary.startedAt,
        completedAt: summary.completedAt ?? null,
        elapsedSeconds: summary.elapsedSeconds ?? 0,
        completionPercent: summary.completionPercent ?? 0,
        disciplinePointsEarned: summary.dpEarned ?? 0,
        exercises: session.exerciseStates.map((es, i) => ({
          exerciseId: workout.exercises[i]?.id ?? "",
          name: workout.exercises[i]?.name ?? "",
          completed: es.completed ?? false,
          sets: workout.exercises[i]?.sets ?? 0,
          repsMin: workout.exercises[i]?.repsMin ?? 0,
          repsMax: workout.exercises[i]?.repsMax ?? 0,
          weightUsed: es.weightUsed ?? 0,
          weightUnit: es.weightUnit ?? "lbs",
          restSeconds: workout.exercises[i]?.restSeconds ?? 0,
          usedSetTimer: es.usedSetTimer ?? false,
          setsCompleted: es.setsCompleted ?? 0,
          elapsedSeconds: es.elapsedSeconds ?? 0,
        })),
      })
      console.log("[persistCompletion] session saved")

      const schedStatus = isFullyComplete ? "completed" : isPartial ? "partial" : "missed"
      await updateScheduledWorkoutStatus(firebaseUser.uid, today, {
        status: schedStatus,
        completionPercent: summary.completionPercent ?? 0,
        disciplinePointsEarned: summary.dpEarned ?? 0,
        elapsedSeconds: summary.elapsedSeconds ?? 0,
      })
      console.log("[persistCompletion] scheduled workout updated to:", schedStatus)

      newStreak = await syncUserStreakFromSchedule(firebaseUser.uid)
      setCompletionData((prev) => prev ? { ...prev, newStreak } : prev)

      await Promise.all(
        session.exerciseStates
          .map((es, i) => ({ state: es, exercise: workout.exercises[i] }))
          .filter(({ state, exercise }) => exercise && (state.weightUsed ?? 0) > 0)
          .map(({ state, exercise }) =>
            updateExerciseWeight(
              firebaseUser.uid,
              exercise.id,
              exercise.name,
              state.weightUsed,
              state.setsCompleted ?? 0,
              state.weightUnit ?? "lbs"
            )
          )
      )

      await updateUserStats(firebaseUser.uid, {
        dpDelta: summary.dpEarned ?? 0,
        completionPercent: summary.completionPercent ?? 0,
        newStreak,
      })
      console.log("[persistCompletion] user stats updated — newStreak:", newStreak)

      // checkAndUnlockAchievements reads a subcollection that may not be seeded —
      // isolate so it can't block the core completion save.
      try {
        const newly = await checkAndUnlockAchievements(firebaseUser.uid, {
          workoutsCompleted: (userDoc?.workoutsCompleted ?? 0) + (isFullyComplete ? 1 : 0),
          streak: newStreak,
        })
        if (newly.length > 0) {
          setCompletionData((prev) =>
            prev ? { ...prev, newlyUnlocked: newly.map((a) => a.name) } : prev
          )
        }
      } catch (achErr) {
        console.warn("[persistCompletion] checkAndUnlockAchievements failed (non-fatal):", achErr)
      }

      await refreshUserDoc()
      console.log("[persistCompletion] userDoc refreshed")
      return true
    } catch (err) {
      console.error("[persistCompletion] FAILED to save workout:", err)
      setSaveError("Failed to save workout. Please check your connection and try again.")
      saveStartedRef.current = false
      return false
    } finally {
      session.setIsSaving(false)
    }
  }, [session, workout, firebaseUser, userDoc, isGuest, refreshUserDoc])

  const handleCompleteWorkout = useCallback(() => {
    prepareCompletionSummary()
  }, [prepareCompletionSummary])

  const handleFinishEarly = useCallback(() => {
    setShowFinishModal(false)
    prepareCompletionSummary()
  }, [prepareCompletionSummary])

  const handleSaveWorkout = useCallback(async () => {
    if (saveStartedRef.current) return
    saveStartedRef.current = true
    setSaveError(null)

    const saved = await persistCompletion()
    if (!saved) return

    setCompletionStep("ad")
    await showPostWorkoutVideoAd()
    setCompletionStep("streak")
  }, [persistCompletion])

  const handleSaveWeight = useCallback(async () => {
    if (weightEditIndex === null) return

    const nextWeight = Number(weightInput)
    if (!Number.isFinite(nextWeight) || nextWeight <= 0) return

    session.updateWeight(weightEditIndex, nextWeight, weightUnitInput)

    if (!isGuest && firebaseUser) {
      const exercise = workout.exercises[weightEditIndex]
      try {
        await updateExerciseWeight(
          firebaseUser.uid,
          exercise.id,
          exercise.name,
          nextWeight,
          session.exerciseStates[weightEditIndex]?.setsCompleted ?? 0,
          weightUnitInput
        )
      } catch (err) {
        console.warn("[FocusMode] failed to save exercise weight:", err)
      }
    }

    setWeightEditIndex(null)
    setWeightInput("")
  }, [firebaseUser, isGuest, session, weightEditIndex, weightInput, weightUnitInput, workout.exercises])

  const handleExit = useCallback(() => {
    session.stopTimer()
    navigate("/")
  }, [session, navigate])

  // ─── Completion screen ─────────────────────────────────────────────────

  if (completionStep !== "none" && completionData) {
    const isFullComplete = completionData.completionPercent >= 100
    const isPartialComplete = completionData.completionPercent > 0 && completionData.completionPercent < 100
    const statItems = [
      {
        label: "Completion",
        value: `${completionData.completionPercent}%`,
        icon: <Check className="size-4 text-[var(--success)]" strokeWidth={1.5} />,
        accent: "text-foreground",
      },
      {
        label: "Discipline",
        value: `+${completionData.dpEarned}`,
        icon: <Trophy className="size-4 text-[var(--gold)]" strokeWidth={1.5} />,
        accent: "text-[var(--gold)]",
      },
      {
        label: "Streak",
        value: completionData.newStreak > 0 ? `${completionData.newStreak} Days` : "Broken",
        icon: <Flame className="size-4 text-[var(--gold)]" strokeWidth={1.5} />,
        accent: "text-foreground",
      },
      {
        label: "Time",
        value: formatElapsedTime(completionData.elapsedSeconds),
        icon: <Clock className="size-4 text-muted-foreground" strokeWidth={1.5} />,
        accent: "text-foreground",
      },
    ]

    if (completionStep === "ad") {
      return (
        <div className="app-bg fixed inset-0 z-50 flex items-center justify-center overflow-hidden px-6">
          <div className="pointer-events-none absolute inset-x-8 top-20 h-56 rounded-full bg-[var(--gold)]/10 blur-3xl" />
          <div className="motion-fade-rise relative w-full max-w-[390px] overflow-hidden rounded-[32px] border border-[var(--gold)]/20 bg-[#05070b] p-5 text-center shadow-[0_0_42px_rgba(201,147,14,0.14)]">
            <div className="aspect-[9/16] w-full overflow-hidden rounded-3xl border border-white/10 bg-black">
              <div className="flex h-full flex-col items-center justify-center px-6">
                <div className="flex size-16 items-center justify-center rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10">
                  <Play className="ml-1 size-7 text-[var(--gold)]" strokeWidth={1.6} />
                </div>
                <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--gold)]">Video Ad</p>
                <h2 className="mt-3 text-2xl font-black text-foreground">Sponsored Break</h2>
                <p className="mt-2 max-w-[240px] text-sm leading-relaxed text-muted-foreground">
                  Test ad placeholder. Real AdMob video connects in the native iOS build.
                </p>
                <Loader2 className="mt-8 size-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (completionStep === "streak") {
      return (
        <div className="app-bg fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="core-confetti pointer-events-none absolute h-2.5 w-1.5"
              style={{
                left: `${(index * 19) % 100}%`,
                top: `${-12 - (index % 5) * 8}%`,
                animationDelay: `${index * 95}ms`,
                animationDuration: `${2500 + (index % 6) * 260}ms`,
              }}
            />
          ))}
          <div className="pointer-events-none absolute inset-x-8 top-20 h-56 rounded-full bg-[var(--gold)]/12 blur-3xl" />
          <div className="mx-auto w-full max-w-[430px] px-6">
            <div className="motion-fade-rise flex flex-col items-center text-center">
              <div className="relative">
                <div className="absolute inset-[-22px] rounded-full bg-[var(--gold-glow-soft)] blur-xl core-reward-pulse" />
                <div className="core-medal-pop relative flex size-28 items-center justify-center rounded-full border border-[var(--gold)]/35 bg-[var(--gold)]/12 shadow-[0_0_34px_rgba(240,180,41,0.26)]">
                  <Flame className="size-14 text-[var(--gold)] drop-shadow-[0_0_14px_var(--gold-glow)]" strokeWidth={1.5} />
                </div>
              </div>

              <p className="mt-10 text-xs font-bold uppercase tracking-[0.32em] text-[var(--gold)]">Streak Updated</p>
              <h1 className="mt-3 text-5xl font-black text-foreground">
                {completionData.newStreak > 0 ? completionData.newStreak : 0}
              </h1>
              <p className="mt-2 text-base font-semibold text-muted-foreground">
                {completionData.newStreak === 1 ? "Day Streak" : "Day Streak"}
              </p>

              {completionData.newlyUnlocked.length > 0 && (
                <div className="mt-8 w-full">
                  <div className="premium-gradient rounded-2xl p-5">
                    <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
                      <Sparkles className="size-3.5" strokeWidth={1.8} />
                      Achievement{completionData.newlyUnlocked.length > 1 ? "s" : ""} Unlocked
                    </p>
                    <div className="mt-3 space-y-2">
                      {completionData.newlyUnlocked.map((name) => (
                        <div key={name} className="flex items-center justify-center gap-2.5">
                          <Trophy className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
                          <span className="text-sm font-medium text-foreground">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate("/")}
                className="glow-gold mt-10 w-full rounded-2xl bg-[var(--gold)] py-4 text-sm font-bold uppercase tracking-wider text-[var(--gold-foreground)] transition-all duration-250 active:scale-[0.97]"
              >
                CONTINUE
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="app-bg fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
        {isFullComplete && Array.from({ length: 22 }).map((_, index) => (
          <span
            key={index}
            className="core-confetti pointer-events-none absolute h-2.5 w-1.5"
            style={{
              left: `${(index * 17) % 100}%`,
              top: `${-12 - (index % 5) * 8}%`,
              animationDelay: `${index * 90}ms`,
              animationDuration: `${2600 + (index % 6) * 280}ms`,
            }}
          />
        ))}
        <div className="pointer-events-none absolute inset-x-8 top-16 h-48 rounded-full bg-[var(--gold)]/10 blur-3xl" />
        <div className="mx-auto w-full max-w-[430px] px-6">
          <div className="motion-fade-rise flex flex-col items-center text-center">
            <div className="relative">
              <div className={cn(
                "core-medal-pop relative z-10 flex size-24 items-center justify-center rounded-full border",
                isFullComplete
                  ? "core-ring-burst border-[var(--success)]/25 bg-[var(--success)]/12 glow-success"
                  : isPartialComplete
                    ? "border-[var(--gold)]/30 bg-[var(--gold)]/12 glow-gold-subtle"
                    : "border-destructive/25 bg-destructive/10"
              )}>
                {isFullComplete
                  ? <Trophy className="size-12 text-[var(--success)]" strokeWidth={1.5} />
                  : <Check className="size-12 text-[var(--gold)]" strokeWidth={1.5} />
                }
              </div>
              {isFullComplete && (
                <div className="absolute -right-2 -top-1 z-20 flex size-9 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--gold-foreground)] shadow-[0_0_18px_var(--gold-glow)]">
                  <Sparkles className="size-4" strokeWidth={1.8} />
                </div>
              )}
            </div>

            <p className="mt-8 text-xs font-bold uppercase tracking-[0.32em] text-[var(--gold)]">
              {isFullComplete ? "Session Crushed" : "Progress Ready"}
            </p>
            <h1 className="mt-3 text-4xl font-black text-foreground">
              {isFullComplete ? "Workout Complete" : "Workout Ready"}
            </h1>
            <p className="mt-2 max-w-[300px] text-base leading-relaxed text-muted-foreground">
              {workout.name}
            </p>

            <div className="mt-8 w-full rounded-3xl border border-[var(--gold)]/15 bg-[var(--glass-bg)] p-3 shadow-[0_0_32px_rgba(201,147,14,0.09)] backdrop-blur-2xl">
              <div className="grid grid-cols-2 gap-2.5">
                {statItems.map((item, index) => (
                  <div
                    key={item.label}
                    className="core-stat-rise glass-subtle rounded-2xl px-4 py-4 text-left"
                    style={{ animationDelay: `${220 + index * 95}ms` }}
                  >
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      {item.icon}
                      {item.label}
                    </div>
                    <p className={cn("mt-3 text-xl font-black", item.accent)}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 overflow-hidden rounded-full bg-[var(--glass-border)]">
                <div
                  className={cn(
                    "gold-sheen h-2 rounded-full transition-all duration-700",
                    isFullComplete ? "bg-[var(--success)]" : "bg-[var(--gold)]"
                  )}
                  style={{ width: `${completionData.completionPercent}%` }}
                />
              </div>
            </div>

            {saveError && (
              <div className="mt-5 w-full rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {saveError}
              </div>
            )}

            <button
              onClick={handleSaveWorkout}
              disabled={session.isSaving || saveStartedRef.current}
              className="glow-gold mt-10 w-full rounded-2xl bg-[var(--gold)] py-4 text-sm font-bold uppercase tracking-wider text-[var(--gold-foreground)] transition-all duration-250 active:scale-[0.97] disabled:opacity-60"
            >
              {session.isSaving || saveStartedRef.current ? "SAVING..." : "SAVE WORKOUT"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Active workout screen ─────────────────────────────────────────────

  const rewards = calculateWorkoutRewards(session.completionPercent)

  return (
    <div className="app-bg fixed inset-0 z-50 flex flex-col">
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col overflow-hidden">

        <header className="flex items-center justify-between px-6 py-5">
          <button
            onClick={() => setShowFinishModal(true)}
            className="flex items-center gap-2 text-muted-foreground transition-all duration-250 hover:text-foreground"
          >
            <ArrowLeft className="size-5" strokeWidth={1.5} />
            <span className="text-sm font-medium">Exit</span>
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">{workout.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Progress</p>
            <p className="text-sm font-bold text-[var(--gold)] text-glow-gold">{session.completionPercent}%</p>
          </div>
        </header>

        <div className="glass-subtle mx-6 flex items-center justify-center rounded-2xl py-3">
          <Clock className="mr-2 size-4 text-muted-foreground" strokeWidth={1.5} />
          <span className="font-mono text-sm font-medium text-foreground">
            {formatElapsedTime(session.elapsedSeconds)}
          </span>
        </div>

        <div className="mx-6 mt-4 h-0.5 w-[calc(100%-3rem)] overflow-hidden rounded-full bg-[var(--glass-border)]">
          <div
            className="gold-sheen h-full rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold-glow)] transition-all duration-700"
            style={{ width: `${session.completionPercent}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-3">
            {workout.exercises.map((exercise, index) => {
              const state = session.exerciseStates[index]
              const isRestTimerActive = restTimerIndex === index && restTimerState === "running"

              return (
                <div
                  key={exercise.id}
                  className={cn(
                    "glass rounded-2xl transition-all duration-250",
                    state.completed && "border-[var(--success)]/20 opacity-50"
                  )}
                >
                  <div className="flex items-start gap-3.5 p-5">
                    <button
                      onClick={() => {
                        clearExerciseTimerFor(index)
                        session.toggleExercise(index)
                      }}
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-250",
                        state.completed
                          ? "border-[var(--success)] bg-[var(--success)] glow-success"
                          : "border-[var(--glass-border)] hover:border-[var(--gold)]"
                      )}
                    >
                      {state.completed && <Check className="size-3.5 text-white" />}
                    </button>

                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => setSelectedExerciseGuide(getExerciseGuide(exercise))}
                        className={cn(
                          "group flex items-center gap-1.5 text-left text-sm font-semibold transition-colors",
                          state.completed ? "text-muted-foreground line-through" : "text-foreground hover:text-[var(--gold)]"
                        )}
                      >
                        <span>{exercise.name}</span>
                        <BookOpen className={cn("size-3.5 shrink-0 text-[var(--gold)] opacity-70 transition-opacity", state.completed ? "opacity-40" : "group-hover:opacity-100")} strokeWidth={1.6} />
                      </button>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {exercise.sets} sets - {formatExerciseTarget(exercise)} - {formatRestTime(exercise.restSeconds)} rest
                      </p>
                      <p className="hidden">
                        {exercise.sets} sets · {exercise.repsMin}–{exercise.repsMax} reps · {formatRestTime(exercise.restSeconds)} rest
                      </p>
                      <button
                        onClick={() => { setWeightEditIndex(index); setWeightInput(state.weightUsed > 0 ? String(state.weightUsed) : ""); setWeightUnitInput(state.weightUnit ?? "lbs") }}
                        className="mt-2 text-xs font-medium text-[var(--gold)] transition-colors hover:text-[var(--gold-glow)]"
                      >
                        {state.weightUsed > 0 ? `Weight: ${state.weightUsed} ${(state.weightUnit ?? "lbs").toUpperCase()}` : "Add weight"}
                      </button>
                    </div>

                    {!state.completed && (
                      <button
                        onClick={() => session.toggleExpand(index)}
                        className={cn(
                          "rounded-xl px-3 py-2 transition-all duration-250",
                          state.expanded ? "glass border-[var(--gold)]/30 text-[var(--gold)]" : "glass-subtle text-muted-foreground hover:text-foreground"
                        )}
                      >
                          <ChevronDown
                            className={cn(
                              "size-4 scale-y-75 text-current transition-transform duration-250",
                              state.expanded && "rotate-180"
                            )}
                            strokeWidth={1.6}
                          />
                      </button>
                    )}
                  </div>

                  {state.expanded && !state.completed && (
                    <div className="border-t border-border/50 px-5 pb-5 pt-4">
                      <div className="space-y-2">
                        {Array.from({ length: exercise.sets }).map((_, setIndex) => {
                          const isSetDone = setIndex < state.setsCompleted
                          const isCurrentSet = setIndex === state.setsCompleted
                          const showRestAfterSet = isRestTimerActive && setIndex === state.setsCompleted - 1
                          const isTimed = isTimedExercise(exercise)
                          const activeExerciseTimer = exerciseTimer?.exerciseIndex === index && exerciseTimer.setIndex === setIndex ? exerciseTimer : null

                          return (
                            <div key={setIndex}>
                              <div className={cn(
                                "flex items-center justify-between rounded-xl px-4 py-3",
                                isSetDone ? "bg-[var(--success)]/8" : isCurrentSet ? "glass-subtle" : "bg-transparent"
                              )}>
                                <span className={cn("text-xs font-medium", isSetDone ? "text-[var(--success)]" : "text-foreground")}>
                                  Set {setIndex + 1}
                                </span>
                                {isSetDone ? (
                                  <Check className="size-4 text-[var(--success)]" />
                                ) : isCurrentSet && isTimed ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-bold text-foreground">
                                      {formatExerciseTimer(activeExerciseTimer?.remainingSeconds ?? getTimedExerciseSeconds(exercise))}
                                    </span>
                                    {!activeExerciseTimer || activeExerciseTimer.status === "idle" ? (
                                      <button
                                        onClick={() => startExerciseTimer(index, setIndex)}
                                        className="rounded-xl bg-[var(--gold)] px-3 py-1.5 text-xs font-bold text-[var(--gold-foreground)] transition-all active:scale-[0.97]"
                                      >
                                        <Play className="inline size-3" strokeWidth={2} /> Start
                                      </button>
                                    ) : activeExerciseTimer.status === "running" ? (
                                      <button
                                        onClick={pauseExerciseTimer}
                                        className="glass-subtle rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground transition-all active:scale-[0.97]"
                                      >
                                        <Pause className="inline size-3" strokeWidth={2} /> Pause
                                      </button>
                                    ) : (
                                      <button
                                        onClick={resumeExerciseTimer}
                                        className="rounded-xl bg-[var(--gold)] px-3 py-1.5 text-xs font-bold text-[var(--gold-foreground)] transition-all active:scale-[0.97]"
                                      >
                                        <Play className="inline size-3" strokeWidth={2} /> Resume
                                      </button>
                                    )}
                                  </div>
                                ) : isCurrentSet ? (
                                  <button
                                    onClick={() => {
                                      clearExerciseTimerFor(index)
                                      session.completeSet(index, true)
                                      if (setIndex < exercise.sets - 1) startRestTimer(index)
                                    }}
                                    className="rounded-xl bg-[var(--gold)] px-4 py-1.5 text-xs font-bold text-[var(--gold-foreground)] transition-all"
                                  >
                                    Complete
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Pending</span>
                                )}
                              </div>

                              {isCurrentSet && isTimed && !isSetDone && (
                                <div className="mt-2.5 glass rounded-2xl border-[var(--gold)]/20 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground">Exercise Timer</p>
                                      <p className="mt-1 text-xs text-muted-foreground">Target: {formatExerciseTarget(exercise)}</p>
                                    </div>
                                    <p className="font-mono text-2xl font-bold text-foreground">
                                      {formatExerciseTimer(activeExerciseTimer?.remainingSeconds ?? getTimedExerciseSeconds(exercise))}
                                    </p>
                                  </div>
                                  <div className="mt-4 grid grid-cols-2 gap-2">
                                    <button
                                      onClick={resetExerciseTimer}
                                      disabled={!activeExerciseTimer}
                                      className="glass-subtle flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:text-foreground disabled:opacity-40"
                                    >
                                      <RotateCcw className="size-3" strokeWidth={1.5} /> Reset
                                    </button>
                                    <button
                                      onClick={() => {
                                        clearExerciseTimerFor(index)
                                        session.completeSet(index, true)
                                        if (setIndex < exercise.sets - 1) startRestTimer(index)
                                      }}
                                      className="rounded-xl bg-[var(--gold)] px-3 py-2 text-xs font-bold text-[var(--gold-foreground)] transition-all active:scale-[0.97]"
                                    >
                                      Complete Set
                                    </button>
                                  </div>
                                </div>
                              )}

                              {showRestAfterSet && (
                                <div className="mt-2.5 glass rounded-2xl border-[var(--gold)]/20 p-5">
                                  <p className="text-center text-xs font-medium text-muted-foreground">Rest Timer</p>
                                  <p className="mt-1.5 text-center font-mono text-2xl font-bold text-foreground">
                                    {formatRestTime(restTimeRemaining)}
                                  </p>
                                  <div className="mt-4 flex items-center justify-center gap-2.5">
                                    <button onClick={addRestTime} className="glass-subtle flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                                      <Plus className="size-3" strokeWidth={1.5} />30s
                                    </button>
                                    <button onClick={skipRestTimer} className="glass-subtle flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                                      <SkipForward className="size-3" strokeWidth={1.5} />Skip
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-8 space-y-3 pb-6">
            {saveError && (
              <div className="glass-subtle rounded-2xl border border-destructive/30 px-5 py-3.5">
                <p className="text-xs text-destructive">{saveError}</p>
              </div>
            )}
            {session.allCompleted ? (
              <button
                disabled={session.isSaving}
                onClick={handleCompleteWorkout}
                className="glow-gold-strong w-full rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)] py-4 text-sm font-bold uppercase tracking-wider text-[var(--gold-foreground)] transition-all active:scale-[0.97] disabled:opacity-60"
              >
                COMPLETE WORKOUT
              </button>
            ) : (
              <button
                onClick={() => setShowFinishModal(true)}
                className="glass w-full rounded-2xl py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground transition-all hover:text-foreground hover:border-[var(--gold)]/20 active:scale-[0.97]"
              >
                FINISH EARLY
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Finish Early Modal */}
      <Dialog open={selectedExerciseGuide !== null} onOpenChange={(open) => !open && setSelectedExerciseGuide(null)}>
        <DialogContent className="max-h-[86svh] max-w-[390px] overflow-hidden p-0">
          <DialogHeader className="px-5 pb-2 pt-5 text-left">
            <DialogTitle className="sr-only">{selectedExerciseGuide?.name ?? "Exercise Guide"}</DialogTitle>
            <DialogDescription className="sr-only">Exercise form guide, steps, cues, and common mistakes</DialogDescription>
          </DialogHeader>
          {selectedExerciseGuide && (
            <div className="overflow-y-auto px-5 pb-5">
              <div className="premium-gradient rounded-3xl p-5">
                <div className="flex items-start gap-4">
                  <div className="glass-subtle flex size-14 shrink-0 items-center justify-center rounded-2xl border-[var(--gold)]/20">
                    <ExerciseGuideIcon muscleGroup={selectedExerciseGuide.muscleGroup} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-foreground">{selectedExerciseGuide.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[var(--gold)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">
                        {selectedExerciseGuide.muscleGroup}
                      </span>
                      <span className="rounded-full glass-subtle px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {selectedExerciseGuide.equipment}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 glass-subtle rounded-2xl px-4 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Target className="size-4 text-[var(--gold)]" strokeWidth={1.6} />
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Muscles Worked</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{selectedExerciseGuide.primaryMuscles.join(", ")}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="glass rounded-2xl p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <BookOpen className="size-4 text-[var(--gold)]" strokeWidth={1.6} />
                    <p className="text-sm font-semibold text-foreground">How to do it</p>
                  </div>
                  <div className="space-y-2.5">
                    {selectedExerciseGuide.steps.map((step, index) => (
                      <div key={step} className="flex gap-3">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-[10px] font-bold text-[var(--gold-foreground)]">
                          {index + 1}
                        </span>
                        <p className="text-sm leading-relaxed text-muted-foreground">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="glass-subtle rounded-2xl p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Dumbbell className="size-4 text-[var(--gold)]" strokeWidth={1.6} />
                      <p className="text-sm font-semibold text-foreground">Form cues</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedExerciseGuide.cues.map((cue) => (
                        <span key={cue} className="rounded-full bg-[var(--gold)]/10 px-3 py-1.5 text-xs font-medium text-[var(--gold)]">
                          {cue}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="glass-subtle rounded-2xl p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <AlertTriangle className="size-4 text-destructive" strokeWidth={1.6} />
                      <p className="text-sm font-semibold text-foreground">Avoid</p>
                    </div>
                    <div className="space-y-2">
                      {selectedExerciseGuide.mistakes.map((mistake) => (
                        <p key={mistake} className="text-sm leading-relaxed text-muted-foreground">
                          {mistake}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showFinishModal} onOpenChange={setShowFinishModal}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Finish Workout Early?</DialogTitle>
            <DialogDescription className="sr-only">Confirm finishing your workout early</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="glass-subtle flex items-center justify-between rounded-2xl px-5 py-3.5">
              <span className="text-sm text-muted-foreground">Completed</span>
              <span className="text-sm font-semibold text-foreground">{session.completedCount} of {session.totalExercises} exercises</span>
            </div>
            <div className="glass-subtle flex items-center justify-between rounded-2xl px-5 py-3.5">
              <span className="text-sm text-muted-foreground">Completion</span>
              <span className="text-sm font-semibold text-foreground">{session.completionPercent}%</span>
            </div>
            <div className="glass-subtle flex items-center justify-between rounded-2xl px-5 py-3.5">
              <span className="text-sm text-muted-foreground">Discipline</span>
              <span className="text-sm font-semibold text-[var(--gold)]">+{rewards.dp}</span>
            </div>
            {session.completionPercent < 50 && session.completionPercent > 0 && (
              <div className="glass-subtle rounded-2xl px-5 py-3.5">
                <p className="text-xs text-destructive">Under 50% completion will break your streak.</p>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2.5">
            <button onClick={() => setShowFinishModal(false)} className="glass w-full rounded-2xl py-3.5 text-sm font-semibold text-foreground transition-all hover:border-[var(--gold)]/30">
              Continue Workout
            </button>
            <button onClick={handleFinishEarly} disabled={session.isSaving} className="glow-gold w-full rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)] py-3.5 text-sm font-bold text-[var(--gold-foreground)] transition-all disabled:opacity-60">
              Finish Workout
            </button>
            <button onClick={handleExit} className="w-full py-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
              Exit without saving
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weight Edit Modal */}
      <Dialog open={weightEditIndex !== null} onOpenChange={() => setWeightEditIndex(null)}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {weightEditIndex !== null ? `Weight for ${workout.exercises[weightEditIndex].name}` : "Edit Weight"}
            </DialogTitle>
            <DialogDescription className="sr-only">Set the weight for this exercise</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="number"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="glass-subtle w-full rounded-2xl px-5 py-4 text-center text-lg font-bold text-foreground outline-none focus:border-[var(--gold)]/50"
              placeholder={weightEditIndex !== null && session.exerciseStates[weightEditIndex]?.weightUsed > 0 ? "Change weight" : "Add weight"}
              autoFocus
            />
            <div className="glass-subtle grid grid-cols-2 rounded-2xl p-1">
              {(["lbs", "kg"] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setWeightUnitInput(unit)}
                  className={cn(
                    "rounded-xl py-2.5 text-xs font-bold uppercase transition-all",
                    weightUnitInput === unit
                      ? "bg-[var(--gold)] text-[var(--gold-foreground)] shadow-[0_0_14px_var(--gold-glow)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {unit}
                </button>
              ))}
            </div>
            <button
              onClick={handleSaveWeight}
              disabled={!weightInput || Number(weightInput) <= 0}
              className="glow-gold w-full rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)] py-3.5 text-sm font-bold text-[var(--gold-foreground)] transition-all"
            >
              Save Weight
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Outer wrapper: resolves today's workout then renders session ──────────

export function FocusModePage() {
  const navigate = useNavigate()
  const { firebaseUser, isGuest, userDoc } = useAuth()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function resolveWorkout() {
      setLoading(true)
      const today = getTodayString()

      // For authenticated users, load from Firestore scheduled workout
      if (!isGuest && firebaseUser) {
        try {
          const sched = await getScheduledWorkout(firebaseUser.uid, today)
          console.log("[FocusModePage] loaded scheduled workout:", sched?.workoutId, sched?.workoutName, "status:", sched?.status)
          if (sched?.workoutId) {
            const wk = getWorkoutById(sched.workoutId) ?? workoutFromScheduledWorkout(sched)
            if (wk) {
              console.log("[FocusModePage] resolved workout from schedule:", wk.name)
              setWorkout(wk); setLoading(false); return
            }
          }
        } catch (err) {
          console.error("[FocusModePage] failed to load schedule:", err)
          // fall through to plan-based lookup
        }
      }

      // Fall back: derive today's workout from user's current plan
      const planId = userDoc?.currentPlanId ?? DEFAULT_CORE_PLAN_ID
      const plan = getPlanById(planId) ?? getPlanById(DEFAULT_CORE_PLAN_ID)!
      const dayOfWeek = getAppDayOfWeek()
      const planDay = plan.schedule.find((s) => s.dayOfWeek === dayOfWeek)

      if (planDay && !planDay.isRest && planDay.workoutId) {
        const wk = getWorkoutById(planDay.workoutId)
        if (wk) { setWorkout(wk); setLoading(false); return }
      }

      // Last resort: use first non-rest workout from plan
      for (const day of plan.schedule) {
        if (!day.isRest && day.workoutId) {
          const wk = getWorkoutById(day.workoutId)
          if (wk) { setWorkout(wk); setLoading(false); return }
        }
      }

      setLoading(false)
    }

    resolveWorkout()
  }, [firebaseUser, isGuest, userDoc?.currentPlanId])

  if (loading) {
    return (
      <div className="app-bg fixed inset-0 z-50 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="app-bg fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-center text-muted-foreground">No workout scheduled for today.</p>
        <button onClick={() => navigate("/")} className="glass rounded-2xl px-6 py-3 text-sm font-semibold text-foreground">
          Go Back
        </button>
      </div>
    )
  }

  return <WorkoutSessionPage workout={workout} />
}
