import { useState, useEffect, useRef } from "react"
import { CalendarCheck, CheckCircle, Clock, Coffee, Loader2, Play, Sparkles, Trophy } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { getTodaysSchedule } from "@/data/mock"
import { formatElapsedTime } from "@/data/helpers"
import { useAuth } from "@/contexts/AuthContext"
import {
  getScheduledWorkout,
  markMissedWorkouts,
  generateScheduledWorkouts,
  getRecentSessions,
  syncUserStatsFromSchedule,
  syncUserStreakFromSchedule,
} from "@/services/workoutService"
import { DEFAULT_CORE_PLAN_ID, getPlanById, getWorkoutById, buildWorkoutNameMap } from "@/data/planSeedData"
import type { ScheduledWorkout, WorkoutSession } from "@/data/models"
import { ExerciseCategoryIcon } from "@/components/core/ExerciseCategoryIcon"
import { cn } from "@/lib/utils"
import { getTodayString } from "@/lib/appDate"
import { formatExerciseTarget } from "@/data/exerciseTiming"
import { AdSlot } from "@/components/core/AdSlot"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function HomePage() {
  const navigate = useNavigate()
  const { firebaseUser, isGuest, userDoc, refreshUserDoc } = useAuth()
  const today = getTodayString()

  const [todaysSchedule, setTodaysSchedule] = useState<ScheduledWorkout | null>(null)
  const [todaySession, setTodaySession] = useState<WorkoutSession | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  // Only show full-screen spinner on the very first load
  const hasLoadedOnce = useRef(false)
  const [initialLoading, setInitialLoading] = useState(!isGuest && !!firebaseUser)
  const currentPlan = getPlanById(userDoc?.currentPlanId ?? "") ?? getPlanById(DEFAULT_CORE_PLAN_ID)!
  const planCompleted = !!firebaseUser && !isGuest && !!userDoc?.currentPlanEndsAt && today >= userDoc.currentPlanEndsAt

  useEffect(() => {
    if (isGuest || !firebaseUser) {
      const sched = getTodaysSchedule()
      setTodaysSchedule(sched)
      hasLoadedOnce.current = true
      setInitialLoading(false)
      return
    }

    let cancelled = false
    async function load() {
      // Only block UI with spinner on first load; subsequent refreshes are silent
      if (!hasLoadedOnce.current) setInitialLoading(true)

      try {
        // markMissedWorkouts needs a composite Firestore index — isolate so it
        // can't block the Home load if the index doesn't exist yet.
        try {
          await markMissedWorkouts(firebaseUser!.uid)
          await syncUserStatsFromSchedule(firebaseUser!.uid)
          await syncUserStreakFromSchedule(firebaseUser!.uid)
          await refreshUserDoc()
        } catch (missedErr) {
          console.warn("[HomePage] markMissedWorkouts failed (non-fatal):", missedErr)
        }

        let sched = planCompleted ? null : await getScheduledWorkout(firebaseUser!.uid, today)
        console.log(
          "[HomePage] todayDate:", today,
          "| loaded scheduled workout — workoutId:", sched?.workoutId,
          "workoutName:", sched?.workoutName,
          "status:", sched?.status,
          "source: Firestore"
        )

        // If no scheduled workout doc exists for today, auto-generate from current plan
        if (!sched && !planCompleted) {
          const planId = userDoc?.currentPlanId ?? DEFAULT_CORE_PLAN_ID
          const plan = getPlanById(planId) ?? getPlanById(DEFAULT_CORE_PLAN_ID)!
          console.log("[HomePage] no schedule doc for today — generating from plan:", plan.id, plan.name)
          const workoutNameMap = buildWorkoutNameMap(plan)
          await generateScheduledWorkouts(
            firebaseUser!.uid,
            plan.schedule.map((s) => ({
              dayOfWeek: s.dayOfWeek,
              workoutId: s.workoutId,
              workoutName: s.isRest ? "Rest Day" : (workoutNameMap[s.workoutId ?? ""] ?? plan.name),
              isRest: s.isRest,
              planId: plan.id,
              planName: plan.name,
            })),
            plan.durationDays ?? 63
          )
          sched = await getScheduledWorkout(firebaseUser!.uid, today)
          console.log(
            "[HomePage] re-fetched after generation — workoutId:", sched?.workoutId,
            "workoutName:", sched?.workoutName
          )
        }

        if (!cancelled) {
          // Use Firestore doc directly, fall back to mock only if completely missing
          const resolved = sched ?? (planCompleted ? null : getTodaysSchedule())
          if (!resolved) {
            setTodaysSchedule(null)
            setTodaySession(null)
            return
          }
          setTodaysSchedule(resolved)

          // If today is completed or partial, load the session for exercise completion detail
          if (resolved.status === "completed" || resolved.status === "partial") {
            try {
              const sessions = await getRecentSessions(firebaseUser!.uid, 5)
              const todaysSession = sessions.find(
                (s) => s.date === today && s.workoutId === resolved.workoutId
              )
              if (!cancelled) {
                setTodaySession(todaysSession ?? null)
                console.log(
                  "[HomePage] loaded session for completed/partial state:",
                  todaysSession ? `found (${todaysSession.exercises.length} exercises)` : "not found"
                )
              }
            } catch (sessErr) {
              console.warn("[HomePage] session load failed (non-fatal):", sessErr)
            }
          } else {
            setTodaySession(null)
          }

          console.log(
            "[HomePage] rendering card — status:", resolved.status,
            "| workoutName:", resolved.workoutName,
            "| muscleGroups:", resolved.muscleGroups,
            "| estimatedMinutes:", resolved.estimatedMinutes,
            "| scheduledExercises count:", resolved.scheduledExercises?.length ?? 0
          )
          console.log("[HomePage] userDoc stats:", {
            currentPlanId: userDoc?.currentPlanId,
            streak: userDoc?.streak,
            disciplinePoints: userDoc?.disciplinePoints,
            rank: userDoc?.rank,
          })
        }
      } catch (err) {
        console.error("[HomePage] load error:", err)
        if (!cancelled && !hasLoadedOnce.current) {
          const sched = getTodaysSchedule()
          setTodaysSchedule(sched)
          console.log("[HomePage] using mock fallback due to load error")
        }
      } finally {
        if (!cancelled) {
          hasLoadedOnce.current = true
          setInitialLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
    // userDoc?.disciplinePoints is intentionally in deps because it changes after workout completion,
    // which triggers a silent re-fetch so Home immediately reflects the completed state.
  }, [firebaseUser, isGuest, today, userDoc?.currentPlanId, userDoc?.currentPlanEndsAt, userDoc?.disciplinePoints, planCompleted])

  if (initialLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    )
  }

  if (planCompleted) {
    const celebrationStats = [
      { label: "Program", value: `${currentPlan.durationDays ?? 90} days` },
      { label: "Schedule", value: `${currentPlan.daysPerWeek}x / week` },
      { label: "Status", value: "Complete" },
    ]
    const consistencyStats = [
      { label: "Consistency", value: `${userDoc?.consistencyPercent ?? 0}%`, highlight: true },
      { label: "Completed", value: `${userDoc?.workoutsCompleted ?? 0}` },
      { label: "Partial", value: `${userDoc?.partialWorkouts ?? 0}` },
      { label: "Missed", value: `${userDoc?.missedWorkouts ?? 0}` },
    ]

    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-6">
        <div className="relative w-full overflow-hidden rounded-[32px] border border-[var(--gold)]/25 bg-[#070a0f] p-6 shadow-[0_0_48px_rgba(201,147,14,0.16),0_24px_70px_rgba(0,0,0,0.55)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(240,180,41,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_32%)]" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 18 }).map((_, index) => (
              <span
                key={index}
                className="core-confetti absolute rounded-full bg-[var(--gold)] opacity-80"
                style={{
                  left: `${8 + ((index * 17) % 84)}%`,
                  top: `${-12 - (index % 5) * 8}%`,
                  width: `${4 + (index % 3) * 2}px`,
                  height: `${8 + (index % 4) * 3}px`,
                  animationDelay: `${index * 110}ms`,
                  animationDuration: `${2600 + (index % 5) * 260}ms`,
                }}
              />
            ))}
          </div>

          <div className="relative flex flex-col items-center text-center">
            <div className="relative">
              <div className="absolute inset-[-18px] rounded-full bg-[var(--gold-glow-soft)] blur-xl core-reward-pulse" />
              <div className="relative flex size-24 items-center justify-center rounded-full border border-[var(--gold)]/35 bg-[var(--gold-glow-soft)] shadow-[0_0_34px_rgba(240,180,41,0.28),inset_0_1px_0_rgba(255,255,255,0.14)]">
                <Trophy className="size-11 text-[var(--gold)] drop-shadow-[0_0_14px_var(--gold-glow)]" strokeWidth={1.5} />
              </div>
              <div className="absolute -right-2 -top-1 flex size-9 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--gold-foreground)] shadow-[0_0_18px_var(--gold-glow)]">
                <Sparkles className="size-4" strokeWidth={1.7} />
              </div>
            </div>

            <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--gold)] text-glow-gold">
              Program Complete
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">
              You Finished It
            </h2>
            <p className="mt-3 max-w-[310px] text-sm leading-relaxed text-muted-foreground">
              Congratulations. You completed <span className="font-semibold text-foreground">{currentPlan.name}</span>.
            </p>

            <div className="mt-6 grid w-full grid-cols-3 gap-2">
              {celebrationStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/5 bg-white/[0.035] px-2.5 py-3">
                  <p className="text-[10px] font-medium text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-xs font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid w-full grid-cols-4 gap-2">
              {consistencyStats.map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    "rounded-2xl border px-2 py-3",
                    stat.highlight
                      ? "border-[var(--gold)]/20 bg-[var(--gold-glow-soft)]"
                      : "border-white/5 bg-white/[0.03]"
                  )}
                >
                  <p className="text-[9px] font-medium text-muted-foreground">{stat.label}</p>
                  <p className={cn(
                    "mt-1 text-sm font-extrabold",
                    stat.highlight ? "text-[var(--gold)] text-glow-gold" : "text-foreground"
                  )}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-[var(--gold)]/15 bg-[var(--gold-glow-soft)]/50 px-4 py-3 text-left">
              <CalendarCheck className="size-5 shrink-0 text-[var(--gold)]" strokeWidth={1.5} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Your program is complete. Pick the next one and keep the streak moving.
              </p>
            </div>

            <button
              onClick={() => navigate("/onboarding?mode=change-plan")}
              className="glow-gold mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gold)] py-4 text-sm font-bold text-[var(--gold-foreground)] transition-all duration-250 active:scale-[0.97]"
            >
              <CheckCircle className="size-4" strokeWidth={1.7} />
              Select New Program
            </button>
          </div>
        </div>
        <AdSlot placement="home-main-card" className="mt-4 w-full shrink-0" />
      </div>
    )
  }

  if (!todaysSchedule) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    )
  }

  const isCompleted = todaysSchedule.status === "completed"
  const isPartial = todaysSchedule.status === "partial"
  const isRest = todaysSchedule.status === "rest"

  // Resolve exercise list: prefer scheduledExercises from Firestore doc,
  // fall back to planSeedData workout for older docs that lack scheduledExercises.
  const fallbackWorkout = todaysSchedule.workoutId ? getWorkoutById(todaysSchedule.workoutId) : null
  const displayExercises = todaysSchedule.scheduledExercises ?? fallbackWorkout?.exercises ?? []
  const displayName = todaysSchedule.workoutName || fallbackWorkout?.name || "Workout"
  const displayMuscleGroups = todaysSchedule.muscleGroups ?? fallbackWorkout?.muscleGroups ?? []
  const displayMinutes = todaysSchedule.estimatedMinutes ?? fallbackWorkout?.estimatedMinutes

  // ── Rest day ────────────────────────────────────────────────────────────────

  if (isRest) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="glass card-elevated w-full rounded-3xl p-10">
          <div className="flex flex-col items-center text-center">
            <div className="glass-subtle flex size-18 items-center justify-center rounded-full">
              <Coffee className="size-8 text-[var(--rest)]" />
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Recovery Day
            </p>
            <p className="mt-5 text-sm text-muted-foreground">No workout scheduled.</p>
            <p className="mt-1 text-sm text-muted-foreground">Your streak remains active.</p>
            <button
              onClick={() => navigate("/plan")}
              className="glass mt-10 w-full rounded-2xl py-4 text-sm font-semibold text-foreground transition-all duration-250 hover:border-[var(--gold)]/30 active:scale-[0.97]"
            >
              VIEW PLAN
            </button>
          </div>
        </div>
        <AdSlot placement="home-main-card" className="mt-4 w-full shrink-0" />
      </div>
    )
  }

  // ── Completed / Partial ─────────────────────────────────────────────────────

  if (isCompleted || isPartial) {
    // Build exercise summary: prefer session data for per-exercise completion status
    const sessionExercises = todaySession?.exercises ?? null
    const summaryExercises = sessionExercises
      ? sessionExercises.map((se) => ({
          id: se.exerciseId,
          name: se.name,
          sets: se.sets,
          repsMin: se.repsMin,
          repsMax: se.repsMax,
          completed: se.completed,
          targetUnit: se.targetUnit,
          timedSeconds: se.timedSeconds,
          // Look up category from the scheduled exercises list for icon rendering
          category: displayExercises.find(
            (ex) => ("exerciseId" in ex ? ex.exerciseId : ex.id) === se.exerciseId
          )?.category ?? "",
        }))
      : displayExercises.map((ex) => ({
          id: "exerciseId" in ex ? ex.exerciseId : ex.id,
          name: ex.name,
          sets: ex.sets,
          repsMin: ex.repsMin,
          repsMax: ex.repsMax,
          category: ex.category ?? "",
          targetUnit: ex.targetUnit,
          timedSeconds: ex.timedSeconds,
          completed: isCompleted,
        }))

    return (
      <>
      <div className="flex flex-1 flex-col px-5 pt-4 pb-3">
        <div
          className="flex flex-1 flex-col overflow-hidden"
          style={{
            borderRadius: 30,
            background: "#070a0f",
            border: "1px solid rgba(201, 147, 14, 0.18)",
            boxShadow: "var(--shadow-xl), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* ── Top: completion header ── */}
          <div className="flex flex-col items-center px-7 pt-9 pb-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-[var(--success)]/10 glow-success">
              <CheckCircle className="size-7 text-[var(--success)]" strokeWidth={1.5} />
            </div>
            <p
              className="mt-5 text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{ color: "#707176" }}
            >
              Today's Workout
            </p>
            <h2
              className="mt-2 font-extrabold leading-none tracking-tight text-foreground"
              style={{ fontSize: 28, textShadow: "0 0 32px rgba(201,147,14,0.12)" }}
            >
              {displayName}
            </h2>
            <p className="mt-2 text-sm font-semibold text-[var(--success)]">
              {isCompleted ? "Completed" : `${todaysSchedule.completionPercent}% Complete`}
            </p>
          </div>

          {/* Separator */}
          <div
            className="mx-6"
            style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,147,14,0.12), transparent)" }}
          />

          {/* ── Stats row ── */}
          <div className="px-5 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <div
                className="flex flex-col items-center rounded-2xl px-3 py-3"
                style={{ background: "#0d1216", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <span className="text-[10px] font-medium text-muted-foreground">Discipline</span>
                <span className="mt-1 text-sm font-bold text-[var(--gold)]">+{todaysSchedule.disciplinePointsEarned}</span>
              </div>
              <div
                className="flex flex-col items-center rounded-2xl px-3 py-3"
                style={{ background: "#0d1216", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <span className="text-[10px] font-medium text-muted-foreground">Time</span>
                <span className="mt-1 text-sm font-bold text-foreground">
                  {todaysSchedule.elapsedSeconds > 0 ? formatElapsedTime(todaysSchedule.elapsedSeconds) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Exercise summary ── */}
          <div className="mx-3 mt-3 flex-1 flex flex-col">
            <div
              className="flex-1 flex flex-col overflow-hidden"
              style={{
                borderRadius: 22,
                background: "#0d1216",
                border: "1px solid rgba(255,255,255,0.05)",
                boxShadow: "0 6px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div className="px-4 py-2.5">
                {summaryExercises.map((exercise, index) => (
                  <div key={exercise.id ?? index} className="flex items-center gap-3 py-2.5">
                    <ExerciseCategoryIcon
                      category={exercise.category}
                      completed={exercise.completed}
                      size={32}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold leading-tight truncate"
                        style={{
                          color: exercise.completed
                            ? "rgba(34,197,94,0.9)"
                            : "rgba(238,238,242,0.45)",
                        }}
                      >
                        {exercise.name}
                      </p>
                      <p
                        className="mt-0.5 text-[11px] font-medium"
                        style={{ color: "rgba(235,235,245,0.32)" }}
                      >
                        {exercise.sets} sets - {formatExerciseTarget(exercise)}
                      </p>
                      <p
                        className="hidden"
                        style={{ color: "rgba(235,235,245,0.32)" }}
                      >
                        {exercise.sets} sets · {formatExerciseTarget(exercise)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── View Summary button ── */}
          <div className="px-3 pt-4 pb-5">
            <button
              onClick={() => setShowSummary(true)}
              className="glass w-full rounded-[22px] py-4 text-sm font-semibold text-foreground transition-all duration-250 hover:border-[var(--gold)]/30 active:scale-[0.97]"
            >
              VIEW SUMMARY
            </button>
          </div>
        </div>
        <AdSlot placement="home-main-card" className="mt-4 shrink-0" />
      </div>
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-h-[86svh] max-w-[390px] overflow-hidden p-0">
          <DialogHeader className="px-5 pb-2 pt-5 text-left">
            <DialogTitle className="text-foreground">Workout Summary</DialogTitle>
            <DialogDescription>
              {displayName} · {isCompleted ? "Completed" : `${todaysSchedule.completionPercent}% complete`}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(86svh-88px)] overflow-y-auto px-5 pb-5">
            <div className="grid grid-cols-2 gap-2">
              <div className="glass-subtle rounded-2xl px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Completion</p>
                <p className="mt-1 text-lg font-bold text-foreground">{todaysSchedule.completionPercent}%</p>
              </div>
              <div className="glass-subtle rounded-2xl px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time</p>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {todaysSchedule.elapsedSeconds > 0 ? formatElapsedTime(todaysSchedule.elapsedSeconds) : "—"}
                </p>
              </div>
              <div className="glass-subtle rounded-2xl px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Discipline Earned</p>
                <p className="mt-1 text-lg font-bold text-[var(--gold)]">+{todaysSchedule.disciplinePointsEarned}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Exercises</p>
              {summaryExercises.map((exercise, index) => {
                const sessionExercise = todaySession?.exercises.find((se) => se.exerciseId === exercise.id)
                const setsCompleted = sessionExercise?.setsCompleted ?? (exercise.completed ? exercise.sets : 0)
                const weightUsed = sessionExercise?.weightUsed
                const weightUnit = sessionExercise?.weightUnit ?? "lbs"
                const exerciseSeconds = sessionExercise?.elapsedSeconds ?? 0

                return (
                  <div key={exercise.id ?? index} className="glass-subtle rounded-2xl px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <ExerciseCategoryIcon
                        category={exercise.category}
                        completed={exercise.completed}
                        size={34}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold leading-tight text-foreground">{exercise.name}</p>
                          <span className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                            exercise.completed
                              ? "bg-[var(--success)]/10 text-[var(--success)]"
                              : "bg-muted/30 text-muted-foreground"
                          )}>
                            {exercise.completed ? "Done" : "Skipped"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {setsCompleted}/{exercise.sets} sets · {formatExerciseTarget(exercise)}
                          {weightUsed !== undefined ? ` · ${weightUsed > 0 ? `${weightUsed}${weightUnit.toUpperCase()}` : "Bodyweight"}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Time: {exerciseSeconds > 0 ? formatElapsedTime(exerciseSeconds) : "Not tracked"}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </>
    )
  }

  // ── Scheduled (default: normal workout card) ────────────────────────────────

  return (
    <div className="flex flex-1 flex-col px-5 pt-4 pb-3">
      {/* Main card */}
      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{
          borderRadius: 30,
          background: "#070a0f",
          border: "1px solid rgba(201, 147, 14, 0.18)",
          boxShadow: "var(--shadow-xl), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* ── Top: centered workout info ── */}
        <div className="flex flex-col items-center px-7 pt-9 pb-6 text-center">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.25em]"
            style={{ color: "#707176" }}
          >
            Today's Workout
          </p>

          <h2
            className="mt-3 font-extrabold leading-none tracking-tight text-foreground"
            style={{ fontSize: 34, textShadow: "0 0 32px rgba(201,147,14,0.12)" }}
          >
            {displayName}
          </h2>

          <p
            className="mt-2.5 text-sm font-medium"
            style={{ color: "#b38315" }}
          >
            {displayMuscleGroups.join(" \u00B7 ")}
          </p>

          <div
            className="mt-3 flex items-center gap-1.5"
            style={{ color: "rgba(235,235,245,0.38)" }}
          >
            <Clock className="size-3.5" strokeWidth={1.5} />
            <span className="text-xs font-medium">{displayMinutes ?? "—"} min</span>
          </div>
        </div>

        {/* Separator */}
        <div
          className="mx-6"
          style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,147,14,0.12), transparent)" }}
        />

        {/* ── Inner exercise card ── */}
        <div className="mx-3 mt-4 flex-1 flex flex-col">
          <div
            className="flex-1 flex flex-col overflow-hidden"
            style={{
              borderRadius: 22,
              background: "#0d1216",
              border: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "0 6px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="px-4 py-2.5">
              {displayExercises.map((exercise, index) => {
                const exId = "exerciseId" in exercise ? exercise.exerciseId : exercise.id
                return (
                  <div key={exId ?? index} className="flex items-center gap-3 py-2.5">
                    <ExerciseCategoryIcon
                      category={exercise.category ?? ""}
                      completed={false}
                      size={32}
                    />
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold leading-tight truncate"
                        style={{ color: "rgba(238,238,242,0.92)" }}
                      >
                        {exercise.name}
                      </p>
                      <p
                        className="mt-0.5 text-[11px] font-medium"
                        style={{ color: "rgba(235,235,245,0.32)" }}
                      >
                        {exercise.sets} sets · {formatExerciseTarget(exercise)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Start Workout button ── */}
        <div className="px-3 pt-4 pb-5">
          <button
            onClick={() => navigate("/focus")}
            className="relative w-full overflow-hidden active:scale-[0.97] transition-transform duration-150"
            style={{
              height: 56,
              borderRadius: 22,
              background: "linear-gradient(135deg, var(--gold-bright) 0%, var(--gold) 55%, var(--gold-dim) 100%)",
              boxShadow: "0 0 22px rgba(201,147,14,0.45), 0 0 48px rgba(201,147,14,0.18), 0 4px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
              border: "1px solid rgba(240,180,41,0.35)",
            }}
          >
            {/* Top shimmer */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                borderRadius: 22,
                background: "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, transparent 55%)",
              }}
            />
            <span className="relative flex items-center justify-center gap-2.5">
              <Play className="size-4 fill-current" style={{ color: "var(--gold-foreground)" }} />
              <span
                className="text-sm font-bold uppercase tracking-[0.15em]"
                style={{ color: "var(--gold-foreground)" }}
              >
                Start Workout
              </span>
            </span>
          </button>
        </div>
      </div>
      <AdSlot placement="home-main-card" className="mt-4 shrink-0" />
    </div>
  )
}
