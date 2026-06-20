import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Check, X, Moon, Dumbbell, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { allWorkouts } from "@/data/mock"
import { formatElapsedTime } from "@/data/helpers"
import type { ScheduledWorkout } from "@/data/models"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { getScheduledWorkouts } from "@/services/workoutService"
import { calculateConsistencyFromSchedule, markMissedWorkouts, syncUserStatsFromSchedule, syncUserStreakFromSchedule } from "@/services/workoutService"
import { activatePlan, getPlan, getWorkoutsForPlan } from "@/services/planService"
import { DEFAULT_CORE_PLAN_ID, getPlanById, buildWorkoutNameMap, ALL_CORE_PLANS, getWorkoutById } from "@/data/planSeedData"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, getDaysInMonth, getDay, addDays, addMonths, subMonths, isBefore, isAfter, isSameMonth } from "date-fns"
import { getAppDate, getTodayString } from "@/lib/appDate"
import type { WorkoutPlan } from "@/data/models"

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
const PLAN_PAGE_LOAD_TIMEOUT_MS = 15000

interface PlanOption {
  id: string
  name: string
  level: string
  location?: string
  goal?: string
  days: number
  kind: "core" | "saved-custom" | "create-custom"
}

function getStatusColor(status: ScheduledWorkout["status"]) {
  switch (status) {
    case "completed": return "bg-[var(--success)]"
    case "partial": return "bg-[var(--gold)]"
    case "missed": return "bg-destructive"
    case "rest": return "bg-muted-foreground/30"
    default: return "bg-secondary"
  }
}

function getStatusIcon(status: ScheduledWorkout["status"]) {
  switch (status) {
    case "completed": return <Check className="size-3.5 text-white" />
    case "partial": return <Check className="size-3.5 text-[var(--gold-foreground)]" />
    case "missed": return <X className="size-3.5 text-white" />
    case "rest": return <Moon className="size-3 text-muted-foreground" />
    default: return null
  }
}

function computeMonthStats(schedules: ScheduledWorkout[]) {
  const completed = schedules.filter((d) => d.status === "completed").length
  const partial = schedules.filter((d) => d.status === "partial").length
  const missed = schedules.filter((d) => d.status === "missed").length
  const consistency = calculateConsistencyFromSchedule(schedules)
  return { completed, partial, missed, consistency }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00")
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function normalizePastScheduled(days: ScheduledWorkout[], today: string): ScheduledWorkout[] {
  return days.map((day) =>
    day.status === "scheduled" && day.date < today
      ? { ...day, status: "missed" }
      : day
  )
}

function getAccountCreatedMonth(createdAt: string | undefined, fallback: Date): Date {
  if (!createdAt) return startOfMonth(fallback)
  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) return startOfMonth(fallback)
  return startOfMonth(createdDate)
}

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  const dayMs = 24 * 60 * 60 * 1000
  return Math.floor((end.getTime() - start.getTime()) / dayMs)
}

function getPlanPageErrorMessage(error: unknown, fallbackCode: string, fallbackMessage: string) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : fallbackCode
  const message = error instanceof Error ? error.message : fallbackMessage
  return `${code}: ${message}`
}

function withPlanTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(Object.assign(
        new Error(`${label} timed out after ${PLAN_PAGE_LOAD_TIMEOUT_MS / 1000} seconds`),
        { code: "firestore/plan-page-timeout" }
      ))
    }, PLAN_PAGE_LOAD_TIMEOUT_MS)

    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeout))
  })
}

export function PlanPage() {
  const navigate = useNavigate()
  const { firebaseUser, isGuest, userDoc, refreshUserDoc } = useAuth()
  const [view, setView] = useState<"week" | "month">("month")
  const [selectedDay, setSelectedDay] = useState<ScheduledWorkout | null>(null)
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [showPlanList, setShowPlanList] = useState(false)
  const [switchingPlan, setSwitchingPlan] = useState(false)
  const [liveWeekly, setLiveWeekly] = useState<ScheduledWorkout[] | null>(null)
  const [liveMonthly, setLiveMonthly] = useState<ScheduledWorkout[] | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [selectedMonthDate, setSelectedMonthDate] = useState(() => startOfMonth(getAppDate()))
  const [remotePlan, setRemotePlan] = useState<WorkoutPlan | null>(null)
  const [savedCustomPlans] = useState<WorkoutPlan[]>([])
  const [scheduledPlanBounds, setScheduledPlanBounds] = useState<{ start: string; end: string } | null>(null)
  const [planLoadError, setPlanLoadError] = useState("")

  const now = getAppDate()
  const today = getTodayString()
  const currentMonth = startOfMonth(now)
  const accountCreatedMonth = useMemo(() => {
    const createdMonth = getAccountCreatedMonth(userDoc?.createdAt, now)
    return isAfter(createdMonth, currentMonth) ? currentMonth : createdMonth
  }, [userDoc?.createdAt, today])
  const selectedMonth = startOfMonth(selectedMonthDate)
  const monthLabel = format(selectedMonth, "MMMM yyyy")
  const daysInMonth = getDaysInMonth(selectedMonth)
  // First day of month offset (Mon=0 ... Sun=6)
  const firstDayOffset = (getDay(selectedMonth) + 6) % 7
  const canGoToPreviousMonth = isAfter(selectedMonth, accountCreatedMonth)
  const canGoToNextMonth = isBefore(selectedMonth, currentMonth)
  const monthStatsLabel = isSameMonth(selectedMonth, currentMonth) ? "This Month" : monthLabel

  // Current plan: from seed data or saved custom plan, then fall back to first core plan.
  const currentPlan = getPlanById(userDoc?.currentPlanId ?? "") ?? remotePlan ?? getPlanById(DEFAULT_CORE_PLAN_ID)!
  const planDurationDays = currentPlan.durationDays ?? 63
  const planStartDate = userDoc?.currentPlanStartedAt ?? scheduledPlanBounds?.start
  const calculatedPlanEndDate = planStartDate
    ? format(addDays(new Date(`${planStartDate}T12:00:00`), planDurationDays - 1), "yyyy-MM-dd")
    : undefined
  const planEndDate = userDoc?.currentPlanEndsAt ?? calculatedPlanEndDate ?? scheduledPlanBounds?.end
  const elapsedPlanDays = planStartDate
    ? Math.max(0, Math.min(planDurationDays, daysBetween(planStartDate, today) + 1))
    : 0
  const remainingPlanDays = planEndDate
    ? Math.max(0, daysBetween(today, planEndDate))
    : Math.max(0, planDurationDays - elapsedPlanDays)
  const planProgressPercent = Math.min(100, Math.round((elapsedPlanDays / planDurationDays) * 100))
  const isInsideActiveProgram = (day: ScheduledWorkout) => {
    if (day.planId && day.planId !== currentPlan.id) return false
    if (planStartDate && day.date < planStartDate) return false
    if (planEndDate && day.date > planEndDate) return false
    return true
  }
  const availablePlans = useMemo<PlanOption[]>(() => [
    ...ALL_CORE_PLANS.map((plan) => ({
      id: plan.id,
      name: plan.name,
      level: plan.experienceLevel,
      location: plan.location,
      goal: plan.goal,
      days: plan.daysPerWeek,
      kind: "core" as const,
    })),
    ...savedCustomPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      level: "custom",
      days: plan.daysPerWeek,
      kind: "saved-custom" as const,
    })),
    { id: "custom", name: "Create Custom Plan", level: "custom", days: 0, kind: "create-custom" as const },
  ], [savedCustomPlans])
  useEffect(() => {
    const planId = userDoc?.currentPlanId
    if (!planId || getPlanById(planId)) {
      setRemotePlan(null)
      return
    }

    let cancelled = false
    withPlanTimeout(getPlan(planId), "Custom plan load")
      .then((plan) => {
        if (!cancelled) setRemotePlan(plan)
      })
      .catch((err) => {
        console.error("[PlanPage] failed to load custom plan:", err)
        if (!cancelled) {
          setRemotePlan(null)
          setPlanLoadError(getPlanPageErrorMessage(err, "firestore/custom-plan-load-failed", "Custom plan load failed"))
        }
      })

    return () => { cancelled = true }
  }, [userDoc?.currentPlanId])

  useEffect(() => {
    if (isGuest || !firebaseUser || !currentPlan.id) {
      setScheduledPlanBounds(null)
      return
    }
    if (userDoc?.currentPlanStartedAt && userDoc?.currentPlanEndsAt) {
      setScheduledPlanBounds(null)
      return
    }

    let cancelled = false
    withPlanTimeout(
      getScheduledWorkouts(firebaseUser.uid, "1900-01-01", "9999-12-31"),
      "Plan date bounds load"
    )
      .then((scheduled) => {
        if (cancelled) return
        const currentPlanDays = scheduled
          .filter((day) => day.planId === currentPlan.id)
          .map((day) => day.date)
          .sort((a, b) => a.localeCompare(b))

        setScheduledPlanBounds(
          currentPlanDays.length > 0
            ? { start: currentPlanDays[0], end: currentPlanDays[currentPlanDays.length - 1] }
            : null
        )
      })
      .catch((err) => {
        console.error("[PlanPage] failed to load plan date bounds:", err)
        if (!cancelled) {
          setScheduledPlanBounds(null)
          setPlanLoadError(getPlanPageErrorMessage(err, "firestore/plan-bounds-load-failed", "Plan date bounds load failed"))
        }
      })

    return () => { cancelled = true }
  }, [firebaseUser, isGuest, currentPlan.id, userDoc?.currentPlanStartedAt, userDoc?.currentPlanEndsAt])

  // Build a fallback weekly schedule from plan + today
  const fallbackWeekly = useMemo<ScheduledWorkout[]>(() => {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      const dateStr = format(date, "yyyy-MM-dd")
      const dow = date.getDay()
      if ((planStartDate && dateStr < planStartDate) || (planEndDate && dateStr > planEndDate)) {
        return { date: dateStr, workoutId: null, workoutName: "Program Complete", status: "rest" as const, completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 }
      }
      const planDay = currentPlan.schedule.find((s) => s.dayOfWeek === dow)
      if (!planDay) return { date: dateStr, workoutId: null, workoutName: "Rest Day", status: "rest" as const, completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 }
      if (planDay.isRest) return { date: dateStr, workoutId: null, workoutName: "Rest Day", status: "rest" as const, completionPercent: 0, disciplinePointsEarned: 0, elapsedSeconds: 0 }
      const wk = getWorkoutById(planDay.workoutId ?? "")
      const isPast = dateStr < today
      return {
        date: dateStr,
        workoutId: planDay.workoutId,
        workoutName: wk?.name ?? "Workout",
        status: isPast ? "missed" as const : "scheduled" as const,
        completionPercent: 0,
        disciplinePointsEarned: 0,
        elapsedSeconds: 0,
      }
    })
  }, [currentPlan, today, planStartDate, planEndDate])

  useEffect(() => {
    if (isBefore(selectedMonth, accountCreatedMonth)) {
      setSelectedMonthDate(accountCreatedMonth)
    } else if (isAfter(selectedMonth, currentMonth)) {
      setSelectedMonthDate(currentMonth)
    }
  }, [accountCreatedMonth, currentMonth, selectedMonth])

  // Load live Firestore calendar data
  useEffect(() => {
    if (isGuest || !firebaseUser) {
      setLoadingData(false)
      setPlanLoadError("")
      return
    }

    let cancelled = false
    async function load() {
      setLoadingData(true)
      setPlanLoadError("")
      const uid = firebaseUser!.uid
      try {
        console.log("[PlanPage] loading Firestore calendar data:", { uid })
        await withPlanTimeout(markMissedWorkouts(uid), "Mark missed workouts")
        await withPlanTimeout(syncUserStatsFromSchedule(uid), "Sync user stats")
        await withPlanTimeout(syncUserStreakFromSchedule(uid), "Sync user streak")

        const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd")
        const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd")
        const monthStart = format(selectedMonth, "yyyy-MM-dd")
        const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd")

        const [weekly, monthly] = await withPlanTimeout(
          Promise.all([
            getScheduledWorkouts(uid, weekStart, weekEnd),
            getScheduledWorkouts(uid, monthStart, monthEnd),
          ]),
          "Workout calendar load"
        )
        if (!cancelled) {
          const normalizedWeekly = normalizePastScheduled(weekly, today).filter(isInsideActiveProgram)
          const normalizedMonthly = normalizePastScheduled(monthly, today).filter(isInsideActiveProgram)
          setLiveWeekly(normalizedWeekly.length > 0 ? normalizedWeekly : null)
          setLiveMonthly(normalizedMonthly.length > 0 ? normalizedMonthly : null)
          console.log("[PlanPage] loaded — currentPlanId:", userDoc?.currentPlanId, "weekly:", weekly.length, "monthly:", monthly.length)
        }
      } catch (error) {
        console.error("[PlanPage] Firestore calendar load failed:", { uid, error })
        if (!cancelled) {
          setLiveWeekly(null)
          setLiveMonthly(null)
          setPlanLoadError(getPlanPageErrorMessage(error, "firestore/calendar-load-failed", "Workout plan loading failed"))
        }
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [firebaseUser, isGuest, userDoc?.currentPlanId, today, selectedMonthDate])

  const displayWeekly = liveWeekly ?? fallbackWeekly
  const monthStats = useMemo(() => computeMonthStats(liveMonthly ?? []), [liveMonthly])

  async function handleSelectPlan(planId: string) {
    if (planId === "custom") {
      setShowPlanList(false)
      navigate("/custom-plan-builder")
      return
    }
    if (!firebaseUser || isGuest) {
      setShowPlanList(false)
      return
    }
    const plan = getPlanById(planId) ?? savedCustomPlans.find((customPlan) => customPlan.id === planId) ?? null
    if (!plan) return

    setSwitchingPlan(true)
    setShowPlanList(false)
    setPlanLoadError("")
    try {
      const savedWorkouts = plan.type === "custom"
        ? await withPlanTimeout(getWorkoutsForPlan(plan.id), "Custom plan workouts load")
        : []
      const workoutNameMap = plan.type === "custom"
        ? Object.fromEntries(savedWorkouts.map((workout) => [workout.id, workout.name]))
        : buildWorkoutNameMap(plan)
      console.log("[PlanPage] switching to plan:", plan.id, plan.name)
      await withPlanTimeout(activatePlan(firebaseUser.uid, plan, workoutNameMap), "Plan activation")
      // Refresh user doc so currentPlanId propagates to all components
      await refreshUserDoc(firebaseUser)
      console.log("[PlanPage] plan activated and userDoc refreshed")
      // Reload calendar data after plan switch
      const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd")
      const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd")
      const monthStart = format(selectedMonth, "yyyy-MM-dd")
      const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd")
      const [weekly, monthly] = await withPlanTimeout(
        Promise.all([
          getScheduledWorkouts(firebaseUser.uid, weekStart, weekEnd),
          getScheduledWorkouts(firebaseUser.uid, monthStart, monthEnd),
        ]),
        "Workout calendar reload"
      )
      const normalizedWeekly = normalizePastScheduled(weekly, today)
      const normalizedMonthly = normalizePastScheduled(monthly, today)
      setLiveWeekly(normalizedWeekly.length > 0 ? normalizedWeekly : null)
      setLiveMonthly(normalizedMonthly.length > 0 ? normalizedMonthly : null)
      console.log("[PlanPage] calendar reloaded — weekly:", weekly.length, "monthly:", monthly.length)
    } catch (err) {
      console.error("[PlanPage] plan switch failed:", err)
      setPlanLoadError(getPlanPageErrorMessage(err, "firestore/plan-switch-failed", "Plan switch failed"))
    } finally {
      setSwitchingPlan(false)
    }
  }

  // Look up workout exercises for day detail modal
  function getWorkoutForId(workoutId: string | null) {
    if (!workoutId) return null
    if (selectedDay?.workoutId === workoutId && selectedDay.scheduledExercises?.length) {
      return {
        id: workoutId,
        name: selectedDay.workoutName,
        muscleGroups: selectedDay.muscleGroups ?? [],
        estimatedMinutes: selectedDay.estimatedMinutes ?? 30,
        exercises: selectedDay.scheduledExercises.map((exercise) => ({
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
      }
    }
    return getWorkoutById(workoutId) ?? allWorkouts.find((w) => w.id === workoutId) ?? null
  }

  function goToPreviousMonth() {
    if (!canGoToPreviousMonth) return
    setSelectedMonthDate((month) => subMonths(month, 1))
  }

  function goToNextMonth() {
    if (!canGoToNextMonth) return
    setSelectedMonthDate((month) => addMonths(month, 1))
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      {/* View Toggle */}
      <div className="glass-subtle flex rounded-2xl p-1.5">
        <button
          onClick={() => setView("month")}
          className={cn(
            "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-250",
            view === "month" ? "glass text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Month
        </button>
        <button
          onClick={() => setView("week")}
          className={cn(
            "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-250",
            view === "week" ? "glass text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Week
        </button>
      </div>

      {planLoadError && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3">
          <p className="text-xs text-destructive">{planLoadError}</p>
        </div>
      )}

      {/* Week View */}
      {view === "week" && (
        <div className="space-y-3">
          {loadingData && (
            <div className="flex justify-center py-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
              <div className="space-y-2.5">
                {displayWeekly.map((day, index) => {
                  const isToday = day.date === today
                  const workoutLabel = day.status === "rest" ? "Rest Day" : day.workoutName.replace(" Day", "")
                  const dateLabel = format(new Date(`${day.date}T12:00:00`), "MMM d")
                  const exerciseCount = day.scheduledExercises?.length ?? getWorkoutForId(day.workoutId)?.exercises.length ?? 0
                  return (
                    <button
                      key={day.date}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all duration-250 active:scale-[0.97]",
                        isToday ? "glass border-[var(--gold)]/30 glow-gold-subtle" : "glass-subtle hover:border-[var(--glass-border)]"
                      )}
                    >
                      <div className={cn("w-12 shrink-0", isToday ? "text-[var(--gold)]" : "text-muted-foreground")}>
                        <p className="text-xs font-bold">{DAY_LABELS[index]}</p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "truncate text-sm font-semibold",
                          day.status === "scheduled" || day.status === "rest" ? "text-muted-foreground" : "text-foreground"
                        )}>
                          {workoutLabel}
                        </p>
                        <p className="hidden">
                          {dateLabel} · {day.status === "rest" ? "Recovery day" : `${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}`}
                        </p>
                      </div>

                      <div className={cn(
                        "flex size-7 items-center justify-center rounded-full transition-all",
                        getStatusColor(day.status),
                        day.status === "completed" && "glow-success",
                        day.status === "missed" && "glow-destructive"
                      )}>
                        {getStatusIcon(day.status)}
                      </div>
                    </button>
                  )
                })}
              </div>
        </div>
      )}

      {/* Month View */}
      {view === "month" && (
        <div className="space-y-5">
          <div className="glass card-elevated rounded-3xl p-5">
            <div className="mb-4 grid grid-cols-[36px_1fr_36px] items-center gap-2">
              <button
                type="button"
                onClick={goToPreviousMonth}
                disabled={!canGoToPreviousMonth}
                aria-label="Previous month"
                className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-center text-sm font-semibold text-foreground">{monthLabel}</p>
              <button
                type="button"
                onClick={goToNextMonth}
                disabled={!canGoToNextMonth}
                aria-label="Next month"
                className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-25"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label) => (
                <span key={label} className="text-center text-[10px] font-medium text-muted-foreground">
                  {label}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {/* Empty slots for first week offset */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* Actual days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1
                const dateStr = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), dayNum), "yyyy-MM-dd")
                const entry = liveMonthly?.find((d) => d.date === dateStr)
                const isToday = dateStr === today

                return (
                  <button
                    key={dateStr}
                    onClick={() => entry && setSelectedDay(entry)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg text-[11px] font-medium transition-all duration-200",
                      isToday && "ring-1.5 ring-[var(--gold)] shadow-[0_0_8px_rgba(212,160,23,0.2)]",
                      entry?.status === "completed" && "bg-[var(--success)]/15 text-[var(--success)] shadow-[0_0_6px_rgba(34,197,94,0.1)]",
                      entry?.status === "partial" && "bg-[var(--gold)]/15 text-[var(--gold)] shadow-[0_0_6px_rgba(212,160,23,0.1)]",
                      entry?.status === "missed" && "bg-destructive/15 text-destructive shadow-[0_0_6px_rgba(239,68,68,0.1)]",
                      entry?.status === "rest" && "bg-muted-foreground/5 text-muted-foreground",
                      entry?.status === "scheduled" && "text-muted-foreground",
                      !entry && "text-muted-foreground/30"
                    )}
                  >
                    {dayNum}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Month Stats */}
          {liveMonthly && liveMonthly.length > 0 && (
            <div className="glass card-elevated rounded-3xl p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{monthStatsLabel}</p>
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Completed</span>
                  <span className="text-sm font-bold text-[var(--success)]">{monthStats.completed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Partial</span>
                  <span className="text-sm font-bold text-[var(--gold)]">{monthStats.partial}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Missed</span>
                  <span className="text-sm font-bold text-destructive">{monthStats.missed}</span>
                </div>
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Consistency</span>
                    <span className="text-sm font-bold text-[var(--gold)] text-glow-gold">{monthStats.consistency}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Plan Card */}
      <div className="glass card-elevated rounded-3xl p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Current Plan</p>
        <h2 className="mt-3 text-xl font-bold text-foreground">{currentPlan.name}</h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{currentPlan.daysPerWeek} Days / Week</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span className="text-sm capitalize text-muted-foreground">{currentPlan.experienceLevel}</span>
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--gold)]/10 bg-[var(--gold-glow-soft)]/40 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Program Progress</span>
            <span className="text-xs font-bold text-[var(--gold)]">{planProgressPercent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="gold-sheen h-full rounded-full bg-[var(--gold)] transition-all duration-700"
              style={{ width: `${planProgressPercent}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Day {Math.max(1, elapsedPlanDays)} of {planDurationDays}</span>
            <span>{remainingPlanDays} days left</span>
          </div>
        </div>
        <button
          onClick={() => setShowChangePlan(true)}
          disabled={switchingPlan}
          className="glass mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold text-foreground transition-all duration-250 hover:border-[var(--gold)]/30 active:scale-[0.97] disabled:opacity-50"
        >
          {switchingPlan ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Switching Plan...
            </span>
          ) : "Change Plan"}
        </button>
      </div>

      {/* Day Detail Modal */}
      <Dialog open={selectedDay !== null} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">{selectedDay?.workoutName}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedDay?.date && formatDate(selectedDay.date)}
            </DialogDescription>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-2.5">
              <div className="glass-subtle rounded-2xl px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={cn(
                    "text-sm font-semibold capitalize",
                    selectedDay.status === "completed" && "text-[var(--success)]",
                    selectedDay.status === "partial" && "text-[var(--gold)]",
                    selectedDay.status === "missed" && "text-destructive",
                    selectedDay.status === "rest" && "text-muted-foreground",
                    selectedDay.status === "scheduled" && "text-foreground",
                  )}>
                    {selectedDay.status}
                  </span>
                </div>
              </div>

              {selectedDay.status !== "rest" && selectedDay.workoutId && (() => {
                const wk = getWorkoutForId(selectedDay.workoutId)
                return wk ? (
                  <>
                    <div className="glass-subtle rounded-2xl px-5 py-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Estimated Time</span>
                        <span className="text-sm font-semibold text-foreground">{wk.estimatedMinutes} min</span>
                      </div>
                    </div>
                    <div className="glass-subtle rounded-2xl px-5 py-3.5">
                      <p className="mb-2.5 text-xs font-medium text-muted-foreground">Exercises</p>
                      <div className="space-y-2">
                        {wk.exercises.map((ex) => (
                          <div key={ex.id} className="flex items-center gap-2.5">
                            <Dumbbell className="size-3 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-xs text-foreground">{ex.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null
              })()}

              {(selectedDay.status === "completed" || selectedDay.status === "partial") && (
                <>
                  <div className="glass-subtle rounded-2xl px-5 py-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Completion</span>
                      <span className="text-sm font-semibold text-foreground">{selectedDay.completionPercent}%</span>
                    </div>
                  </div>
                  <div className="glass-subtle rounded-2xl px-5 py-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Discipline Earned</span>
                      <span className="text-sm font-semibold text-[var(--gold)]">+{selectedDay.disciplinePointsEarned}</span>
                    </div>
                  </div>
                  {selectedDay.elapsedSeconds > 0 && (
                    <div className="glass-subtle rounded-2xl px-5 py-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Elapsed Time</span>
                        <span className="text-sm font-semibold text-foreground">{formatElapsedTime(selectedDay.elapsedSeconds)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Plan Confirm Modal */}
      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Change Workout Plan?</DialogTitle>
            <DialogDescription className="sr-only">Change your workout plan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="glass-subtle rounded-2xl px-5 py-3.5">
              <p className="text-xs text-muted-foreground">Current Plan</p>
              <p className="mt-1 text-sm font-bold text-foreground">{currentPlan.name}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Changing plans will reset your future workout schedule but will not delete past workout history.
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => setShowChangePlan(false)}
                className="glass w-full rounded-2xl py-3.5 text-sm font-semibold text-foreground transition-all duration-250 hover:border-[var(--gold)]/30"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowChangePlan(false); navigate("/onboarding?mode=change-plan") }}
                className="glow-gold w-full rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)] py-3.5 text-sm font-bold text-[var(--gold-foreground)] transition-all duration-250"
              >
                Choose New Plan
              </button>
              <button
                onClick={() => { setShowChangePlan(false); navigate("/custom-plan-builder") }}
                className="glass w-full rounded-2xl py-3.5 text-sm font-semibold text-foreground transition-all duration-250 hover:border-[var(--gold)]/30"
              >
                Create Custom Plan
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plan Selection Modal */}
      <Dialog open={showPlanList} onOpenChange={setShowPlanList}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Choose a Plan</DialogTitle>
            <DialogDescription className="sr-only">Select a new workout plan</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {availablePlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handleSelectPlan(plan.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left transition-all duration-250 active:scale-[0.97]",
                  plan.id === currentPlan.id
                    ? "glass border-[var(--gold)]/30 glow-gold-subtle"
                    : "glass-subtle hover:border-[var(--glass-border)]"
                )}
              >
                <div>
                  <p className={cn("text-sm font-semibold", plan.id === currentPlan.id ? "text-[var(--gold)]" : "text-foreground")}>
                    {plan.name}
                  </p>
                  {plan.kind === "create-custom" ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Build a new custom plan
                    </p>
                  ) : plan.kind === "saved-custom" ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Saved custom plan - {plan.days} days/week
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                      {plan.goal} - {plan.location} - {plan.level} - {plan.days} days/week
                    </p>
                  )}
                </div>
                {plan.id === currentPlan.id && (
                  <span className="text-xs font-medium text-[var(--gold)]">Current</span>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
