import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Dumbbell, Clock, Flame, Award, Users, Mail, Lock, User, AlertCircle, Loader2, Sparkles, SlidersHorizontal } from "lucide-react"
import { signUpWithEmail, signInWithEmail, signInWithGoogle } from "@/services/authService"
import { createUserDocument, isDisplayNameTaken, updateUserDocument } from "@/services/userService"
import { checkAndUnlockAchievements, initUserAchievements } from "@/services/achievementService"
import { activatePlan } from "@/services/planService"
import { ALL_CORE_PLANS, getCorePlanForOnboarding, getPlanById, getProgramReason, buildWorkoutNameMap } from "@/data/planSeedData"
import { useAuth } from "@/contexts/AuthContext"
import { CoreLogo } from "@/components/core/CoreLogo"

type Goal = "Build Muscle" | "Lose Weight" | "Stay Consistent" | "General Fitness"
type Location = "Gym" | "Home"
type Level = "Beginner" | "Intermediate" | "Advanced"
type Days = 2 | 3 | 4 | 5 | 6
type AuthTab = "signup" | "signin"
const ACCOUNT_SETUP_TIMEOUT_MS = 45000

interface RecommendedPlan {
  id: string
  name: string
  daysPerWeek: number
  estimatedMinutes: number
  reason: string
}

interface FirestoreSetupError extends Error {
  code: string
}

function toDisplayedError(error: unknown, fallbackCode: string, fallbackMessage: string) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : fallbackCode
  const message = error instanceof Error ? error.message : fallbackMessage
  return `${code}: ${message}`
}

function withOnboardingTimeout<T>(promise: Promise<T>, label: string, code: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      const timeoutError = Object.assign(
        new Error(`${label} timed out after ${ACCOUNT_SETUP_TIMEOUT_MS / 1000} seconds`),
        { code }
      )
      console.error(`[Onboarding] ${label} timed out:`, timeoutError)
      reject(timeoutError)
    }, ACCOUNT_SETUP_TIMEOUT_MS)

    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeout))
  })
}

function OptionButton({ selected, children, onClick }: { selected: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl px-6 py-5 text-left text-sm font-medium transition-all duration-250 active:scale-[0.97]",
        selected
          ? "glass border-[var(--gold)]/40 text-[var(--gold)] glow-gold-subtle"
          : "glass-subtle text-foreground hover:border-[var(--glass-border)]"
      )}
    >
      {children}
    </button>
  )
}

function getRecommendedCorePlan(goal: Goal, location: Location, level: Level, days: Days): RecommendedPlan {
  const plan = getCorePlanForOnboarding(goal, location, level, days)
  return {
    id: plan.id,
    name: plan.name,
    daysPerWeek: plan.daysPerWeek,
    estimatedMinutes: goal === "Stay Consistent" ? 25 : goal === "General Fitness" ? 50 : 55,
    reason: getProgramReason(goal),
  }
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { firebaseUser, isGuest, refreshUserDoc } = useAuth()
  const isChangePlanMode = searchParams.get("mode") === "change-plan" && !!firebaseUser && !isGuest

  const [step, setStep] = useState(isChangePlanMode ? 1 : 0)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [location, setLocation] = useState<Location | null>(null)
  const [level, setLevel] = useState<Level | null>(null)
  const [days, setDays] = useState<Days | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  const [authTab, setAuthTab] = useState<AuthTab>("signup")
  const [authName, setAuthName] = useState("")
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState("")

  const recommendedPlan = goal && location && level && days
    ? getRecommendedCorePlan(goal, location, level, days)
    : null
  const otherCorePlans = goal && location && level && days
    ? ALL_CORE_PLANS.filter((plan) =>
        plan.location === (location === "Home" ? "home" : "gym") &&
        plan.experienceLevel === level.toLowerCase() &&
        plan.daysPerWeek === days
      )
    : []
  const selectedCorePlan = selectedPlanId && selectedPlanId !== "custom"
    ? ALL_CORE_PLANS.find((plan) => plan.id === selectedPlanId) ?? null
    : null
  const selectedPlanLabel = selectedPlanId === "custom"
    ? "Custom Plan"
    : selectedCorePlan?.name ?? recommendedPlan?.name ?? "your plan"

  const goNext = () => setStep((s) => s + 1)

  useEffect(() => {
    if (step !== 5) return
    const timer = window.setTimeout(() => setStep(6), 3000)
    return () => window.clearTimeout(timer)
  }, [step])

  function chooseDays(value: Days) {
    setDays(value)
    setSelectedPlanId(null)
    setTimeout(() => setStep(5), 200)
  }

  function useRecommendedPlan() {
    if (!recommendedPlan) return
    setSelectedPlanId(recommendedPlan.id)
    if (isChangePlanMode) {
      void applyPlanForCurrentUser(recommendedPlan.id)
      return
    }
    setStep(8)
  }

  function chooseCorePlan(planId: string) {
    setSelectedPlanId(planId)
  }

  function chooseCustomPlan() {
    setSelectedPlanId("custom")
  }

  async function applyPlanForCurrentUser(planId = selectedPlanId ?? recommendedPlan?.id) {
    if (!firebaseUser || isGuest || !goal || !location || !level || !days || !recommendedPlan || !planId) {
      navigate("/")
      return
    }
    if (planId === "custom") {
      navigate("/custom-plan-builder")
      return
    }

    const finalPlan = getPlanById(planId)
    if (!finalPlan) return

    setAuthLoading(true)
    setAuthError("")
    try {
      await updateUserDocument(firebaseUser.uid, {
        onboardingAnswers: {
          goal,
          location,
          level,
          daysPerWeek: days,
          preferredTime: "Morning",
          recommendedPlan: finalPlan.name,
        },
      })
      await activatePlan(firebaseUser.uid, finalPlan, buildWorkoutNameMap(finalPlan))
      await refreshUserDoc()
      navigate("/plan")
    } catch {
      setAuthError("Plan change failed. Please try again.")
    } finally {
      setAuthLoading(false)
    }
  }

  async function finishWithAccount(fbUser: { uid: string; displayName: string | null; email: string | null }) {
    if (!goal || !location || !level || !days || !recommendedPlan) {
      navigate("/")
      return
    }
    const finalPlanId = selectedPlanId ?? recommendedPlan.id
    const finalPlan = finalPlanId === "custom" ? null : getPlanById(finalPlanId)
    try {
      console.log("[Onboarding] Firestore profile setup starting:", { uid: fbUser.uid })
      await withOnboardingTimeout(
        (async () => {
          await createUserDocument(fbUser.uid, fbUser.displayName ?? "Athlete", fbUser.email ?? "", {
            goal,
            location,
            level,
            daysPerWeek: days,
            preferredTime: "Morning",
            recommendedPlan: finalPlanId === "custom" ? "Custom Plan" : finalPlan?.name ?? recommendedPlan.name,
          })
          await initUserAchievements(fbUser.uid)

          // Activate the recommended plan and generate scheduled workouts
          if (finalPlan) {
            const workoutNameMap = buildWorkoutNameMap(finalPlan)
            await activatePlan(fbUser.uid, finalPlan, workoutNameMap)
            await checkAndUnlockAchievements(fbUser.uid)
          }

          await refreshUserDoc()
        })(),
        "Firestore profile setup",
        "firestore/setup-timeout"
      )
      console.log("[Onboarding] Firestore profile setup succeeded:", { uid: fbUser.uid })
    } catch (error) {
      console.error("[Onboarding] Firestore profile setup failed:", error)
      throw Object.assign(
        error instanceof Error ? error : new Error("Firestore profile setup failed"),
        { code: typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "firestore/setup-failed" }
      ) as FirestoreSetupError
    }
    navigate(finalPlanId === "custom" ? "/custom-plan-builder" : "/")
  }

  async function handleEmailAuth() {
    if (!authEmail || !authPassword) return
    setAuthLoading(true)
    setAuthError("")
    try {
      if (authTab === "signup") {
        if (!authName.trim()) { setAuthError("Display name is required"); setAuthLoading(false); return }
        console.log("[Onboarding] Display name availability check starting")
        const taken = await withOnboardingTimeout(
          isDisplayNameTaken(authName.trim()),
          "Display name availability check",
          "firestore/display-name-timeout"
        )
        console.log("[Onboarding] Display name availability check succeeded:", { taken })
        if (taken) { setAuthError("That username is already taken. Please choose a different one."); setAuthLoading(false); return }
        const fbUser = await signUpWithEmail(authEmail, authPassword, authName.trim())
        await finishWithAccount(fbUser)
      } else {
        await signInWithEmail(authEmail, authPassword)
        await refreshUserDoc()
        navigate("/")
      }
    } catch (err: unknown) {
      console.error("[Onboarding] Email authentication failed:", err)
      const fallbackCode = authTab === "signup" ? "auth/signup-failed" : "auth/signin-failed"
      setAuthError(toDisplayedError(err, fallbackCode, "Authentication failed"))
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleGoogleAuth() {
    setAuthLoading(true)
    setAuthError("")
    try {
      const fbUser = await signInWithGoogle()
      await finishWithAccount(fbUser)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (!msg.includes("popup-closed")) {
        setAuthError("Google sign-in failed. Please try again.")
      }
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className="app-bg relative mx-auto flex min-h-svh max-w-[430px] flex-col">
      {step > 0 && step < 9 && (
        <div className="px-6 pt-4">
          <div className="h-1 w-full rounded-full bg-secondary">
            <div
              className="gold-sheen h-1 rounded-full bg-[var(--gold)] transition-all duration-700"
              style={{ width: `${(Math.min(step, 8) / 8) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center px-6 py-10">

        {/* Step 0: Welcome */}
        {step === 0 && (
            <div className="flex flex-col items-center text-center">
              <div className="glass flex size-20 items-center justify-center rounded-3xl">
                <CoreLogo markClassName="h-12 w-16" />
              </div>
            <h1 className="mt-10 text-3xl font-bold tracking-tight text-foreground">CORE</h1>
            <p className="mt-3 text-base text-muted-foreground">Fitness Made Simple</p>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">Know what to do. Just do it.</p>
            <button
              onClick={goNext}
              className="glow-gold mt-12 w-full rounded-2xl bg-[var(--gold)] py-4 text-sm font-bold text-[var(--gold-foreground)] transition-all duration-250 active:scale-[0.97]"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Step 1: Goal */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-foreground">What's your goal?</h2>
            <div className="space-y-3">
              {(["Build Muscle", "Lose Weight", "Stay Consistent", "General Fitness"] as Goal[]).map((g) => (
                <OptionButton key={g} selected={goal === g} onClick={() => { setGoal(g); setTimeout(goNext, 200) }}>
                  {g}
                </OptionButton>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-foreground">Where do you work out?</h2>
            <div className="space-y-3">
              {(["Gym", "Home"] as Location[]).map((l) => (
                <OptionButton key={l} selected={location === l} onClick={() => { setLocation(l); setTimeout(goNext, 200) }}>
                  {l}
                </OptionButton>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Level */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-foreground">How experienced are you?</h2>
            <div className="space-y-3">
              {(["Beginner", "Intermediate", "Advanced"] as Level[]).map((l) => (
                <OptionButton key={l} selected={level === l} onClick={() => { setLevel(l); setTimeout(goNext, 200) }}>
                  {l}
                </OptionButton>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Days */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-foreground">How many days can you realistically train?</h2>
            <div className="grid grid-cols-5 gap-2.5">
              {([2, 3, 4, 5, 6] as Days[]).map((d) => (
                <button
                  key={d}
                  onClick={() => chooseDays(d)}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-2xl text-lg font-bold transition-all duration-250 active:scale-[0.93]",
                    days === d
                      ? "glass border-[var(--gold)]/40 text-[var(--gold)] glow-gold-subtle"
                      : "glass-subtle text-foreground hover:border-[var(--glass-border)]"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Generating */}
        {step === 5 && (
          <div className="flex flex-col items-center text-center">
            <div className="glass flex size-20 items-center justify-center rounded-3xl glow-gold-subtle">
              <Sparkles className="size-9 animate-pulse text-[var(--gold)]" strokeWidth={1.5} />
            </div>
            <h2 className="mt-8 text-2xl font-bold text-foreground">Generating your personalized workout plan</h2>
            <p className="mt-4 max-w-[300px] text-sm leading-relaxed text-muted-foreground">
              Matching your goal, experience, schedule, and training location.
            </p>
            <div className="mt-10 flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-[var(--gold)]" />
              <span className="size-2 animate-pulse rounded-full bg-[var(--gold)] [animation-delay:150ms]" />
              <span className="size-2 animate-pulse rounded-full bg-[var(--gold)] [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* Step 6: Recommended Plan */}
        {step === 6 && recommendedPlan && (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recommended Plan</p>
              <h2 className="mt-3 text-2xl font-bold text-foreground">{recommendedPlan.name}</h2>
            </div>
            <div className="glass card-elevated rounded-3xl p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Dumbbell className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
                    Days Per Week
                  </span>
                  <span className="text-sm font-bold text-foreground">{recommendedPlan.daysPerWeek}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
                    Estimated Time
                  </span>
                  <span className="text-sm font-bold text-foreground">{recommendedPlan.estimatedMinutes} min</span>
                </div>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{recommendedPlan.reason}</p>
            </div>
            <div className="space-y-3">
              <button onClick={useRecommendedPlan} className="glow-gold w-full rounded-2xl bg-[var(--gold)] py-4 text-sm font-bold text-[var(--gold-foreground)] transition-all duration-250 active:scale-[0.97]">
                Use This Plan
              </button>
              <button onClick={() => setStep(7)} className="glass w-full rounded-2xl py-4 text-sm font-semibold text-foreground transition-all duration-250 hover:border-[var(--gold)]/30 active:scale-[0.97]">
                View Other Plans
              </button>
            </div>
          </div>
        )}

        {/* Step 7: Other Plans */}
        {step === 7 && (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Choose Your Plan</p>
              <h2 className="mt-3 text-2xl font-bold text-foreground">Other workout plans</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {isChangePlanMode ? "Pick the plan you want to switch to." : "Pick a CORE plan or build your own from scratch."}
              </p>
            </div>

            <div className="max-h-[55svh] space-y-2.5 overflow-y-auto pr-1">
              {otherCorePlans.map((plan) => {
                const isRecommended = plan.id === recommendedPlan?.id
                const isSelected = selectedPlanId === plan.id
                return (
                  <button
                    key={plan.id}
                    onClick={() => chooseCorePlan(plan.id)}
                    className={cn(
                      "glass-subtle w-full rounded-2xl px-5 py-4 text-left transition-all duration-250 active:scale-[0.97]",
                      isRecommended && "border-[var(--gold)]/35",
                      isSelected && "glass border-[var(--gold)]/60 glow-gold-subtle"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">{plan.name}</p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">
                          {plan.daysPerWeek} days/week - {plan.experienceLevel} - {plan.location}
                        </p>
                      </div>
                      {isSelected ? (
                        <span className="rounded-full bg-[var(--gold)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--gold-foreground)]">
                          Selected
                        </span>
                      ) : isRecommended && (
                        <span className="rounded-full bg-[var(--gold-glow-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">
                          Best Fit
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}

              <button
                onClick={chooseCustomPlan}
                className={cn(
                  "glass w-full rounded-2xl border-[var(--gold)]/30 px-5 py-4 text-left transition-all duration-250 active:scale-[0.97]",
                  selectedPlanId === "custom" && "border-[var(--gold)]/60 glow-gold-subtle"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--gold-glow-soft)]">
                    <SlidersHorizontal className="size-5 text-[var(--gold)]" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">Create Custom Plan</p>
                    <p className="mt-1 text-xs text-muted-foreground">Build your own days, exercises, sets, reps, and rest times.</p>
                  </div>
                  {selectedPlanId === "custom" && (
                    <span className="rounded-full bg-[var(--gold)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--gold-foreground)]">
                      Selected
                    </span>
                  )}
                </div>
              </button>
            </div>

            <button
              onClick={() => isChangePlanMode ? void applyPlanForCurrentUser() : setStep(8)}
              disabled={!selectedPlanId || authLoading}
              className="glow-gold w-full rounded-2xl bg-[var(--gold)] py-4 text-sm font-bold text-[var(--gold-foreground)] transition-all duration-250 disabled:opacity-40 active:scale-[0.97]"
            >
              {authLoading ? "Switching Plan..." : selectedPlanId === "custom" ? "Continue to Custom Plan" : isChangePlanMode ? "Switch to Selected Plan" : "Continue with Selected Plan"}
            </button>

            {authError && (
              <p className="text-center text-xs text-destructive">{authError}</p>
            )}

            <button
              onClick={() => setStep(6)}
              className="w-full py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to recommendation
            </button>
          </div>
        )}

        {/* Step 8: Auth */}
        {step === 8 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {selectedPlanId === "custom" ? "Save Your Custom Plan" : "Save Your Progress"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedPlanId === "custom"
                  ? "Create an account first, then build your custom workout plan."
                  : `Create an account to start ${selectedPlanLabel} and track your progress.`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: <Dumbbell className="size-4 text-[var(--gold)]" strokeWidth={1.5} />, label: "Save workouts" },
                { icon: <Flame className="size-4 text-[var(--gold)]" strokeWidth={1.5} />, label: "Build streaks" },
                { icon: <Award className="size-4 text-[var(--gold)]" strokeWidth={1.5} />, label: "Earn rank" },
                { icon: <Users className="size-4 text-[var(--gold)]" strokeWidth={1.5} />, label: "Add friends" },
              ].map((b) => (
                <div key={b.label} className="glass-subtle flex items-center gap-2.5 rounded-2xl px-4 py-3">
                  {b.icon}
                  <span className="text-xs font-medium text-foreground">{b.label}</span>
                </div>
              ))}
            </div>

            {/* Auth tab switch */}
            <div className="glass-subtle flex rounded-2xl p-1">
              <button
                onClick={() => { setAuthTab("signup"); setAuthError("") }}
                className={cn("flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200", authTab === "signup" ? "glass text-foreground" : "text-muted-foreground")}
              >
                Sign Up
              </button>
              <button
                onClick={() => { setAuthTab("signin"); setAuthError("") }}
                className={cn("flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200", authTab === "signin" ? "glass text-foreground" : "text-muted-foreground")}
              >
                Sign In
              </button>
            </div>

            <div className="space-y-3">
              {authTab === "signup" && (
                <div className="relative">
                  <User className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                  <input type="text" placeholder="Display name" value={authName} onChange={(e) => setAuthName(e.target.value)}
                    className="w-full rounded-2xl py-3.5 pl-11 pr-4 text-sm" autoComplete="name" />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                <input type="email" placeholder="Email address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full rounded-2xl py-3.5 pl-11 pr-4 text-sm" autoComplete="email" />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full rounded-2xl py-3.5 pl-11 pr-4 text-sm"
                  autoComplete={authTab === "signup" ? "new-password" : "current-password"}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()} />
              </div>

              {authError && (
                <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3">
                  <AlertCircle className="size-4 shrink-0 text-destructive" strokeWidth={1.5} />
                  <p className="text-xs text-destructive">{authError}</p>
                </div>
              )}

              <button
                onClick={handleEmailAuth}
                disabled={authLoading}
                className="glow-gold flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gold)] py-4 text-sm font-bold text-[var(--gold-foreground)] transition-all duration-250 disabled:opacity-60 active:scale-[0.97]"
              >
                {authLoading
                  ? <Loader2 className="size-4 animate-spin" />
                  : (authTab === "signup" ? "Create Account" : "Sign In")}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              onClick={handleGoogleAuth}
              disabled={authLoading}
              className="glass flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-semibold text-foreground transition-all duration-250 disabled:opacity-60 hover:border-[var(--gold)]/30 active:scale-[0.97]"
            >
              <GoogleIcon />
              Continue with Google
            </button>

          </div>
        )}
      </div>
    </div>
  )
}
