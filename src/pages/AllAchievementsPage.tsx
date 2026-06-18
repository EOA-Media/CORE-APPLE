import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, Loader2 } from "lucide-react"
import { AchievementCard } from "@/components/core/AchievementCard"
import { useAuth } from "@/contexts/AuthContext"
import { checkAndUnlockAchievements, getUserAchievements } from "@/services/achievementService"
import type { Achievement } from "@/data/models"

export function AllAchievementsPage() {
  const navigate = useNavigate()
  const { firebaseUser, isGuest } = useAuth()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isGuest || !firebaseUser) {
      setAchievements([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    async function loadAchievements() {
      try {
        await checkAndUnlockAchievements(firebaseUser!.uid)
        const items = await getUserAchievements(firebaseUser!.uid)
        if (!cancelled) setAchievements(items)
      } catch (err) {
        console.warn("[AllAchievementsPage] failed to load achievements:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAchievements()
    return () => { cancelled = true }
  }, [firebaseUser, isGuest])

  const completed = [...achievements]
    .filter((a) => a.unlocked)
    .sort((a, b) => {
      if (!a.unlockedAt && !b.unlockedAt) return 0
      if (!a.unlockedAt) return 1
      if (!b.unlockedAt) return -1
      return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()
    })

  const locked = achievements.filter((a) => !a.unlocked)

  return (
    <div className="app-bg relative mx-auto flex h-svh max-w-[430px] flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pb-4 pt-14">
        <button
          onClick={() => navigate(-1)}
          className="flex size-9 items-center justify-center rounded-xl glass transition-all duration-250 hover:bg-accent active:scale-95"
        >
          <ChevronLeft className="size-5 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-lg font-bold text-foreground">Achievements</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-10">

        {/* Completed section */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
              Completed
            </span>
            <span className="rounded-full bg-[var(--gold-glow-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--gold)]">
              {completed.length}
            </span>
          </div>
          {loading ? (
            <div className="glass rounded-2xl px-5 py-8">
              <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : completed.length === 0 ? (
            <div className="glass rounded-2xl px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No achievements yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Complete your first workout to unlock one.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {completed.map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} showDate />
              ))}
            </div>
          )}
        </div>

        {/* Locked section */}
        {locked.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Locked
              </span>
              <span className="rounded-full bg-[var(--glass-bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-[var(--glass-border)]">
                {locked.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {locked.map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
