import { useState } from "react"
import { Bell, Check, Flame, Loader2, ToggleLeft, ToggleRight, Trophy, User } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { getRankFromDP, ranks } from "@/data/helpers"
import { CoreLogo } from "@/components/core/CoreLogo"
import {
  getDefaultWorkoutReminderSettings,
  requestWorkoutReminderPushNotifications,
  saveWorkoutReminderSettings,
} from "@/services/pushNotificationService"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export function AppHeader() {
  const navigate = useNavigate()
  const { firebaseUser, isGuest, refreshUserDoc, userDoc } = useAuth()

  const streak = userDoc?.streak ?? 0
  const longestStreak = userDoc?.longestStreak ?? 0
  const disciplinePoints = userDoc?.disciplinePoints ?? 0
  const photoURL = userDoc?.photoURL ?? ""
  const rank = getRankFromDP(disciplinePoints)
  const currentRankIndex = ranks.indexOf(rank)
  const nextRank = currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : null

  const [streakOpen, setStreakOpen] = useState(false)
  const [rankOpen, setRankOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notificationSaving, setNotificationSaving] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState("")

  const reminderEnabled = userDoc?.workoutReminderEnabled ?? true
  const pushEnabled = userDoc?.pushNotificationsEnabled ?? false
  const pushStatus = userDoc?.pushPermissionStatus ?? "unknown"
  const reminderHour = userDoc?.workoutReminderHour ?? 9
  const timezone = userDoc?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Local time"
  const reminderHourOptions = Array.from({ length: 24 }, (_, hour) => hour)

  function formatReminderHour(hour: number) {
    if (hour === 0) return "12:00 AM"
    if (hour < 12) return `${hour}:00 AM`
    if (hour === 12) return "12:00 PM"
    return `${hour - 12}:00 PM`
  }

  async function updateReminderEnabled(enabled: boolean) {
    if (!firebaseUser || isGuest) return
    setNotificationSaving(true)
    setNotificationMessage("")
    try {
      await saveWorkoutReminderSettings(firebaseUser.uid, {
        workoutReminderEnabled: enabled,
        timezone,
        workoutReminderHour: reminderHour,
      })
      await refreshUserDoc()
      setNotificationMessage(enabled ? "Workout reminders are on." : "Workout reminders are off.")
    } catch {
      setNotificationMessage("Could not update notification settings.")
    } finally {
      setNotificationSaving(false)
    }
  }

  async function enablePushNotifications() {
    if (!firebaseUser || isGuest) return
    setNotificationSaving(true)
    setNotificationMessage("")
    try {
      const status = await requestWorkoutReminderPushNotifications(firebaseUser.uid, {
        workoutReminderEnabled: reminderEnabled,
        workoutReminderHour: reminderHour,
        timezone,
      })
      await refreshUserDoc()
      if (status === "granted") {
        setNotificationMessage("Push reminders are enabled for workout days.")
      } else if (status === "prompt") {
        setNotificationMessage("Push reminders are ready for the iPhone app build.")
      } else {
        setNotificationMessage("Notifications are disabled for this device.")
      }
    } catch {
      setNotificationMessage("Could not set up push notifications.")
    } finally {
      setNotificationSaving(false)
    }
  }

  async function updateReminderHour(hour: number) {
    if (!firebaseUser || isGuest) return
    setNotificationSaving(true)
    setNotificationMessage("")
    try {
      await saveWorkoutReminderSettings(firebaseUser.uid, {
        workoutReminderEnabled: reminderEnabled,
        workoutReminderHour: hour,
        timezone,
      })
      await refreshUserDoc()
      setNotificationMessage(`Workout reminders set for ${formatReminderHour(hour)}.`)
    } catch {
      setNotificationMessage("Could not update reminder time.")
    } finally {
      setNotificationSaving(false)
    }
  }

  async function resetReminderDefaults() {
    if (!firebaseUser || isGuest) return
    setNotificationSaving(true)
    setNotificationMessage("")
    try {
      await saveWorkoutReminderSettings(firebaseUser.uid, getDefaultWorkoutReminderSettings())
      await refreshUserDoc()
      setNotificationMessage("Reminder settings reset to 9:00 AM.")
    } catch {
      setNotificationMessage("Could not reset notification settings.")
    } finally {
      setNotificationSaving(false)
    }
  }

  return (
    <>
      <header className="motion-fade-rise relative flex items-center justify-between border-b border-border/40 px-5 pb-5 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="glass tap-lift flex size-10 items-center justify-center overflow-hidden rounded-full transition-all duration-250 hover:border-[var(--gold)]/30"
            aria-label="Open profile"
          >
            {photoURL ? (
              <img
                src={photoURL}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <User className="size-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => setStreakOpen(true)}
            className="glass tap-lift flex items-center gap-2 rounded-full px-3.5 py-2 transition-all duration-250 hover:border-[var(--gold)]/30"
          >
            <Flame className="size-4 text-[var(--gold)] drop-shadow-[0_0_6px_var(--gold-glow)]" />
            <span className="text-sm font-semibold text-foreground">{streak}</span>
          </button>
        </div>

        <CoreLogo className="absolute left-1/2 -translate-x-1/2 transition-transform duration-500 hover:scale-[1.03]" markClassName="h-9 w-14" />

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRankOpen(true)}
            className="glass tap-lift flex size-10 items-center justify-center rounded-full transition-all duration-250 hover:border-[var(--gold)]/30"
          >
            <Trophy className="size-4 text-[var(--gold)]" />
          </button>
          <button
            onClick={() => setNotifOpen(true)}
            className="glass tap-lift relative flex size-10 items-center justify-center rounded-full transition-all duration-250 hover:border-[var(--gold)]/30"
          >
            <Bell className="size-4 text-muted-foreground" />
            <span className="soft-breathe absolute top-2 right-2 size-2 rounded-full bg-[var(--gold)] shadow-[0_0_6px_var(--gold-glow)]" />
          </button>
        </div>
      </header>

      {/* Streak Modal */}
      <Dialog open={streakOpen} onOpenChange={setStreakOpen}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Flame className="size-5 text-[var(--gold)]" />
              Streak
            </DialogTitle>
            <DialogDescription className="sr-only">Your workout streak details</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="glass-subtle rounded-2xl p-4">
              <span className="text-sm text-muted-foreground">Current Streak</span>
              <p className="mt-1 text-2xl font-bold text-foreground">{streak} days</p>
            </div>
            <div className="glass-subtle rounded-2xl p-4">
              <span className="text-sm text-muted-foreground">Longest Streak</span>
              <p className="mt-1 text-2xl font-bold text-foreground">{longestStreak} days</p>
            </div>
            <p className="pt-1 text-center text-xs text-muted-foreground">
              Rest days keep your streak alive.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rank Modal */}
      <Dialog open={rankOpen} onOpenChange={setRankOpen}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Trophy className="size-5 text-[var(--gold)]" />
              Rank
            </DialogTitle>
            <DialogDescription className="sr-only">Your current rank and progress</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="glass-subtle rounded-2xl p-4">
              <span className="text-sm text-muted-foreground">Current Rank</span>
              <p className="mt-1 text-lg font-bold" style={{ color: rank.color }}>{rank.name}</p>
            </div>
            <div className="glass-subtle rounded-2xl p-4">
              <span className="text-sm text-muted-foreground">Discipline</span>
              <p className="mt-1 text-lg font-bold text-foreground">{disciplinePoints}</p>
            </div>
            {nextRank && (
              <>
                <div className="glass-subtle rounded-2xl p-4">
                  <span className="text-sm text-muted-foreground">Next Rank</span>
                  <p className="mt-1 text-lg font-bold" style={{ color: nextRank.color }}>{nextRank.name}</p>
                </div>
                <div className="glass-subtle rounded-2xl p-4">
                  <span className="text-sm text-muted-foreground">Points Needed</span>
                  <p className="mt-1 text-lg font-bold text-foreground">{nextRank.minDP - disciplinePoints}</p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifications Panel */}
      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Notifications</DialogTitle>
            <DialogDescription className="sr-only">Notification settings and recent notifications</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="glass-subtle rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Workout Reminders</p>
                  <p className="mt-1 text-xs text-muted-foreground">Sent on scheduled workout days.</p>
                </div>
                <button
                  onClick={() => updateReminderEnabled(!reminderEnabled)}
                  disabled={notificationSaving || !firebaseUser || isGuest}
                  className="flex items-center justify-center rounded-full text-[var(--gold)] transition-all active:scale-95 disabled:opacity-50"
                  aria-label={reminderEnabled ? "Turn workout reminders off" : "Turn workout reminders on"}
                >
                  {reminderEnabled ? (
                    <ToggleRight className="size-9" strokeWidth={1.5} />
                  ) : (
                    <ToggleLeft className="size-9 text-muted-foreground" strokeWidth={1.5} />
                  )}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3">
                  <label className="text-[10px] font-medium text-muted-foreground" htmlFor="workout-reminder-hour">
                    Time
                  </label>
                  <select
                    id="workout-reminder-hour"
                    value={reminderHour}
                    onChange={(event) => updateReminderHour(Number(event.target.value))}
                    disabled={notificationSaving || !firebaseUser || isGuest}
                    className="mt-1 w-full appearance-none rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-sm font-bold text-foreground outline-none transition-colors focus:border-[var(--gold)]/50 disabled:opacity-50"
                  >
                    {reminderHourOptions.map((hour) => (
                      <option key={hour} value={hour} className="bg-background text-foreground">
                        {formatReminderHour(hour)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] font-medium text-muted-foreground">Push</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{pushEnabled ? "On" : "Off"}</p>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground">{timezone}</p>
            </div>

            <div className="glass-subtle rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Phone Push Notifications</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pushStatus === "granted"
                      ? "Enabled for this account."
                      : pushStatus === "denied"
                        ? "Disabled on this device."
                        : "Enable in the iPhone app build."}
                  </p>
                </div>
                {pushStatus === "granted" && <Check className="size-5 text-[var(--success)]" strokeWidth={1.7} />}
              </div>
              <button
                onClick={enablePushNotifications}
                disabled={notificationSaving || !firebaseUser || isGuest}
                className="glass mt-4 w-full rounded-2xl py-3 text-xs font-bold text-foreground transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {notificationSaving ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Enable Push"}
              </button>
            </div>

            <button
              onClick={resetReminderDefaults}
              disabled={notificationSaving || !firebaseUser || isGuest}
              className="w-full rounded-2xl py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Reset to 9:00 AM
            </button>

            {notificationMessage && (
              <p className="rounded-2xl border border-[var(--gold)]/15 bg-[var(--gold)]/5 px-4 py-3 text-xs text-muted-foreground">
                {notificationMessage}
              </p>
            )}

            <div className="glass-subtle rounded-2xl p-4">
              <p className="text-sm font-medium text-foreground">Welcome to CORE</p>
              <p className="mt-1 text-xs text-muted-foreground">Your fitness journey starts here. Complete your first workout today.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
