import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom"
import { Component, type ErrorInfo, type ReactNode } from "react"
import { AppHeader } from "@/components/core/AppHeader"
import { BottomNav } from "@/components/core/BottomNav"
import { HomePage } from "@/pages/HomePage"
import { PlanPage } from "@/pages/PlanPage"
import { SocialPage } from "@/pages/SocialPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { FocusModePage } from "@/pages/FocusModePage"
import { OnboardingPage } from "@/pages/OnboardingPage"
import { AllAchievementsPage } from "@/pages/AllAchievementsPage"
import { CustomPlanBuilderPage } from "@/pages/CustomPlanBuilderPage"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { Loader2 } from "lucide-react"
import { CoreLogo } from "@/components/core/CoreLogo"

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: Readonly<{ error: Error | null }> = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-bg flex h-svh items-center justify-center px-6">
          <div className="glass max-w-[360px] rounded-3xl p-6 text-center">
            <p className="text-sm font-semibold text-foreground">Something went wrong.</p>
            <p className="mt-2 text-xs text-muted-foreground">{this.state.error.message}</p>
            <button
              onClick={() => window.location.href = "/"}
              className="glass-subtle mt-5 rounded-2xl px-5 py-3 text-sm font-semibold text-foreground"
            >
              Go Home
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// ─── Loading screen ──────────────────────────────────────────────────────────

function AppLoading() {
  return (
    <div className="app-bg flex h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="glass motion-soft-pop flex size-16 items-center justify-center rounded-3xl">
            <CoreLogo markClassName="h-9 w-12" />
          </div>
        <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    </div>
  )
}

// ─── Guest save-progress banner ───────────────────────────────────────────────

function GuestBanner() {
  return (
    <div className="flex items-center justify-between bg-[var(--gold-glow-soft)] px-5 py-2.5 text-xs">
      <span className="text-[var(--gold-dim)]">Guest mode — progress is local only</span>
      <button
        onClick={() => window.location.href = "/onboarding"}
        className="font-bold text-[var(--gold)] underline-offset-2 hover:underline"
      >
        Save Progress
      </button>
    </div>
  )
}

// ─── Authenticated app shell ─────────────────────────────────────────────────

function AppLayout() {
  const location = useLocation()
  const { isGuest } = useAuth()
  const isFocusMode = location.pathname === "/focus"

  if (isFocusMode) {
    return <FocusModePage />
  }

  return (
    <div className="app-bg relative mx-auto flex h-svh max-w-[430px] flex-col overflow-hidden">
      {isGuest && <GuestBanner />}
      <AppHeader />
      <main key={location.pathname} className="motion-fade-rise flex-1 overflow-y-auto pb-24">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Root with auth gating ────────────────────────────────────────────────────

function RootRouter() {
  const { mode } = useAuth()

  if (mode === "loading") {
    return <AppLoading />
  }

  if (mode === "unauthenticated") {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    )
  }

  // authenticated or guest
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/achievements" element={<AllAchievementsPage />} />
      <Route path="/custom-plan-builder" element={<CustomPlanBuilderPage />} />
      <Route path="*" element={<AppLayout />} />
    </Routes>
  )
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppErrorBoundary>
          <RootRouter />
        </AppErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
