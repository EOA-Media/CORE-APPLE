import { useEffect, useRef, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { Flame, Dumbbell, Award, TrendingUp, Calendar, Clock, Crown, UserPen, Bell, LogOut, ChevronRight, Loader2, Check, AlertCircle, Users, UserMinus, Camera, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { RankBadge } from "@/components/core/RankBadge"
import { AchievementCard } from "@/components/core/AchievementCard"
import { ProgressBar } from "@/components/core/ProgressBar"
import { getRankFromDP, ranks } from "@/data/helpers"
import { useAuth } from "@/contexts/AuthContext"
import { deleteUserDocument, updateUserDocument } from "@/services/userService"
import { deleteAuthAccount } from "@/services/authService"
import { markMissedWorkouts, syncUserStatsFromSchedule, syncUserStreakFromSchedule } from "@/services/workoutService"
import { getFriends, removeFriend } from "@/services/friendService"
import { checkAndUnlockAchievements, getUserAchievements } from "@/services/achievementService"
import type { Achievement, Friend } from "@/data/models"
import { storage } from "@/lib/firebase"
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { requestWorkoutReminderPushNotifications } from "@/services/pushNotificationService"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const PROFILE_SAVE_TIMEOUT_MS = 45000

export function ProfilePage() {
  const navigate = useNavigate()
  const { userDoc, signOut, firebaseUser, isGuest, refreshUserDoc } = useAuth()

  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName, setEditName] = useState("")
  const [editUsername, setEditUsername] = useState("")
  const [editTime, setEditTime] = useState<"morning" | "afternoon" | "evening">("morning")
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState("")
  const [editSuccess, setEditSuccess] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const [friendsList, setFriendsList] = useState<Friend[]>([])
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [removingFriend, setRemovingFriend] = useState(false)
  const [userAchievements, setUserAchievements] = useState<Achievement[]>([])
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState("")

  const [logoutLoading, setLogoutLoading] = useState(false)
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState("")
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isGuest || !firebaseUser) return

    let cancelled = false
    async function syncStats() {
      try {
        await markMissedWorkouts(firebaseUser!.uid)
        await syncUserStatsFromSchedule(firebaseUser!.uid)
        await syncUserStreakFromSchedule(firebaseUser!.uid)
        await checkAndUnlockAchievements(firebaseUser!.uid)
        if (!cancelled) setUserAchievements(await getUserAchievements(firebaseUser!.uid))
        if (!cancelled) await refreshUserDoc()
      } catch (err) {
        console.warn("[ProfilePage] failed to sync schedule stats:", err)
      }
    }
    syncStats()
    return () => { cancelled = true }
  }, [firebaseUser, isGuest])

  useEffect(() => {
    if (isGuest || !firebaseUser) {
      setUserAchievements([])
      return
    }

    let cancelled = false
    getUserAchievements(firebaseUser.uid)
      .then((items) => {
        if (!cancelled) setUserAchievements(items)
      })
      .catch((err) => console.warn("[ProfilePage] failed to load achievements:", err))

    return () => { cancelled = true }
  }, [firebaseUser, isGuest])

  async function loadFriends() {
    if (isGuest || !firebaseUser) {
      setFriendsList([])
      return
    }

    setLoadingFriends(true)
    try {
      setFriendsList(await getFriends(firebaseUser.uid))
    } catch (err) {
      console.warn("[ProfilePage] failed to load friends:", err)
    } finally {
      setLoadingFriends(false)
    }
  }

  async function openFriends() {
    setShowFriends(true)
    await loadFriends()
  }

  async function handleUnfriend() {
    if (!selectedFriend) return
    if (isGuest || !firebaseUser) {
      setFriendsList((prev) => prev.filter((friend) => friend.id !== selectedFriend.id))
      setSelectedFriend(null)
      return
    }

    setRemovingFriend(true)
    try {
      await removeFriend(firebaseUser.uid, selectedFriend.id)
      setFriendsList((prev) => prev.filter((friend) => friend.id !== selectedFriend.id))
      setSelectedFriend(null)
    } finally {
      setRemovingFriend(false)
    }
  }

  // Use real user data; fall back to empty if not loaded
  const displayName = userDoc?.displayName ?? (firebaseUser?.displayName ?? "Athlete")
  const photoURL = userDoc?.photoURL ?? firebaseUser?.photoURL ?? ""
  const disciplinePoints = userDoc?.disciplinePoints ?? 0
  const streak = userDoc?.streak ?? 0
  const longestStreak = userDoc?.longestStreak ?? 0
  const workoutsCompleted = userDoc?.workoutsCompleted ?? 0
  const partialWorkouts = userDoc?.partialWorkouts ?? 0
  const missedWorkouts = userDoc?.missedWorkouts ?? 0
  const consistencyPercent = userDoc?.consistencyPercent ?? 0

  const currentRank = getRankFromDP(disciplinePoints)
  const currentRankIndex = ranks.indexOf(currentRank)
  const nextRank = currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : null

  const recentAchievements = [...userAchievements]
    .filter((a) => a.unlocked)
    .sort((a, b) => {
      if (!a.unlockedAt && !b.unlockedAt) return 0
      if (!a.unlockedAt) return 1
      if (!b.unlockedAt) return -1
      return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()
    })
    .slice(0, 3)

  function openEditProfile() {
    setEditName(userDoc?.displayName ?? displayName)
    setEditUsername(userDoc?.username ?? "")
    setEditTime(userDoc?.preferredWorkoutTime ?? "morning")
    setEditPhotoFile(null)
    setEditPhotoPreview(photoURL)
    setEditError("")
    setEditSuccess(false)
    setShowEditProfile(true)
  }

  function handlePhotoSelect(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setEditError("Please choose an image file.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setEditError("Profile picture must be under 5 MB.")
      return
    }

    setEditError("")
    setEditPhotoFile(file)
    setEditPhotoPreview(URL.createObjectURL(file))
  }

  function getStorageBucketName() {
    const bucket = storage.app.options.storageBucket
    if (!bucket) {
      throw Object.assign(new Error("Firebase Storage bucket is missing from configuration."), {
        code: "storage/missing-bucket",
      })
    }
    return bucket
  }

  function makeDownloadToken() {
    if ("randomUUID" in crypto) return crypto.randomUUID()
    const values = new Uint8Array(16)
    window.crypto.getRandomValues(values)
    values[6] = (values[6] & 0x0f) | 0x40
    values[8] = (values[8] & 0x3f) | 0x80
    return Array.from(values, (value, index) => {
      const part = value.toString(16).padStart(2, "0")
      return [4, 6, 8, 10].includes(index) ? `-${part}` : part
    }).join("")
  }

  function withProfileSaveTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        const error = Object.assign(
          new Error(`${label} timed out after ${PROFILE_SAVE_TIMEOUT_MS / 1000} seconds`),
          { code: "profile/save-timeout" }
        )
        console.error(`[ProfilePage] ${label} timed out:`, error)
        reject(error)
      }, PROFILE_SAVE_TIMEOUT_MS)

      promise
        .then(resolve, reject)
        .finally(() => window.clearTimeout(timeout))
    })
  }

  async function uploadProfilePhotoWithRest(file: File, storagePath: string) {
    const bucket = getStorageBucketName()
    const token = makeDownloadToken()
    const idToken = await withProfileSaveTimeout(firebaseUser!.getIdToken(), "get auth token for profile photo upload")
    const boundary = `core-profile-photo-${Date.now()}`
    const metadata = {
      name: storagePath,
      contentType: file.type || "image/jpeg",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    }
    const body = new Blob([
      `--${boundary}\r\n`,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      `Content-Type: ${file.type || "image/jpeg"}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`,
    ])

    console.log("[ProfilePage] uploading profile photo with Firebase Storage REST:", {
      bucket,
      storagePath,
      size: file.size,
      type: file.type,
    })

    const response = await withProfileSaveTimeout(
      fetch(
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?uploadType=multipart&name=${encodeURIComponent(storagePath)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      ),
      "upload profile photo"
    )
    const responseText = await response.text()

    if (!response.ok) {
      console.error("[ProfilePage] Firebase Storage REST upload failed:", {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      })
      throw Object.assign(new Error(responseText || response.statusText), {
        code: `storage/http-${response.status}`,
      })
    }

    console.log("[ProfilePage] Firebase Storage REST upload succeeded:", {
      status: response.status,
      body: responseText,
    })

    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`
  }

  async function uploadProfilePhoto(file: File) {
    const extension = file.name.split(".").pop() || "jpg"
    const storagePath = `users/${firebaseUser!.uid}/profile-picture.${extension}`

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
      return uploadProfilePhotoWithRest(file, storagePath)
    }

    console.log("[ProfilePage] uploading profile photo with Firebase Storage SDK:", {
      storagePath,
      size: file.size,
      type: file.type,
    })
    const imageRef = ref(storage, storagePath)
    await withProfileSaveTimeout(
      uploadBytes(imageRef, file, { contentType: file.type || "image/jpeg" }),
      "upload profile photo"
    )
    const downloadURL = await withProfileSaveTimeout(getDownloadURL(imageRef), "get profile photo download URL")
    console.log("[ProfilePage] Firebase Storage SDK upload succeeded:", { storagePath })
    return downloadURL
  }

  async function handleSaveProfile() {
    if (!userDoc || !firebaseUser) return
    if (!editName.trim()) { setEditError("Display name is required"); return }
    setEditLoading(true)
    setEditError("")
    try {
      let nextPhotoURL = userDoc.photoURL
      if (editPhotoFile) {
        nextPhotoURL = await uploadProfilePhoto(editPhotoFile)
      }

      console.log("[ProfilePage] saving profile document:", { uid: firebaseUser.uid, hasPhotoURL: !!nextPhotoURL })
      await withProfileSaveTimeout(
        updateUserDocument(firebaseUser.uid, {
          displayName: editName.trim(),
          username: editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") || userDoc.username,
          preferredWorkoutTime: editTime,
          photoURL: nextPhotoURL,
        }),
        "save profile document"
      )
      await withProfileSaveTimeout(refreshUserDoc(), "refresh profile after save")
      console.log("[ProfilePage] profile saved successfully:", { uid: firebaseUser.uid })
      setEditSuccess(true)
      setTimeout(() => setShowEditProfile(false), 800)
    } catch (error) {
      console.error("[ProfilePage] failed to save profile:", error)
      setEditError(getFirebaseErrorMessage(error, "Failed to save profile. Please try again."))
    } finally {
      setEditLoading(false)
    }
  }

  async function handleLogout() {
    setLogoutLoading(true)
    try {
      await signOut()
    } catch {
      setLogoutLoading(false)
    }
  }

  function getFirebaseErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) {
      const code = "code" in error && typeof error.code === "string" ? error.code : ""
      return code ? `${code}: ${error.message}` : error.message
    }

    return fallback
  }

  async function deleteProfilePhoto(photoUrl: string) {
    if (!photoUrl) return

    try {
      await deleteObject(ref(storage, photoUrl))
      console.log("[ProfilePage] profile photo deleted")
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined
      if (code === "storage/object-not-found") {
        console.warn("[ProfilePage] profile photo was already missing:", error)
        return
      }
      console.error("[ProfilePage] failed to delete profile photo:", error)
      throw error
    }
  }

  async function handleDeleteAccount() {
    if (!firebaseUser || isGuest) return

    setDeleteAccountLoading(true)
    setDeleteAccountError("")

    const userId = firebaseUser.uid
    const profilePhotoUrl = userDoc?.photoURL ?? firebaseUser.photoURL ?? ""

    try {
      console.log("[ProfilePage] delete account starting:", { userId })
      await deleteProfilePhoto(profilePhotoUrl)
      await deleteUserDocument(userId)
      await deleteAuthAccount(firebaseUser)

      try {
        await signOut()
      } catch (error) {
        console.warn("[ProfilePage] sign out after account deletion failed:", error)
      }

      setShowDeleteAccountConfirm(false)
      navigate("/onboarding", { replace: true })
    } catch (error) {
      console.error("[ProfilePage] delete account failed:", error)
      const message = getFirebaseErrorMessage(error, "Failed to delete account. Please try again.")
      setDeleteAccountError(
        message.includes("auth/requires-recent-login")
          ? `${message}. Please log out, sign back in, and try deleting your account again.`
          : message
      )
    } finally {
      setDeleteAccountLoading(false)
    }
  }

  async function handleEnableNotifications() {
    if (!firebaseUser || isGuest) return
    setNotificationLoading(true)
    setNotificationMessage("")
    try {
      const status = await requestWorkoutReminderPushNotifications(firebaseUser.uid)
      await refreshUserDoc()
      if (status === "granted") {
        setNotificationMessage("Workout reminders are set for 9:00 AM.")
      } else if (status === "prompt") {
        setNotificationMessage("Push reminders are ready for the iPhone app build.")
      } else {
        setNotificationMessage("Notifications are turned off for this device.")
      }
    } catch {
      setNotificationMessage("Could not set up notifications on this device.")
    } finally {
      setNotificationLoading(false)
    }
  }

  const SETTINGS_ITEMS: { icon: typeof UserPen; label: string; destructive?: boolean; loading?: boolean; onClick?: () => void }[] = [
    { icon: UserPen, label: "Edit Profile", onClick: openEditProfile },
    { icon: Bell, label: notificationLoading ? "Setting up..." : "Notifications", onClick: handleEnableNotifications },
    ...(isGuest ? [] : [{ icon: Trash2, label: "Delete Account", destructive: true, loading: deleteAccountLoading, onClick: () => {
      setDeleteAccountError("")
      setShowDeleteAccountConfirm(true)
    } }]),
    { icon: LogOut, label: logoutLoading ? "Logging out..." : "Logout", destructive: true, loading: logoutLoading, onClick: handleLogout },
  ]

  return (
    <div className="space-y-6 px-6 pb-8">
      {/* Profile Header */}
      <div className="glass card-elevated flex flex-col items-center rounded-3xl px-5 py-6">
        <div className="flex w-full flex-col items-center">
        <div className="relative">
          {photoURL ? (
            <img
              src={photoURL}
              alt=""
              className="size-[72px] rounded-full border border-[var(--gold)]/25 object-cover shadow-[0_0_22px_rgba(212,160,23,0.14)]"
            />
          ) : (
            <RankBadge rank={currentRank.name} size="lg" />
          )}
          {!isGuest && (
            <button
              onClick={openEditProfile}
              aria-label="Edit profile picture"
              className="glass absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-[var(--gold)]/25 transition-all duration-250 active:scale-95"
            >
              <Camera className="size-3.5 text-[var(--gold)]" strokeWidth={1.8} />
            </button>
          )}
        </div>
          <div className="mt-3.5 flex w-full flex-col items-center">
            <div className="flex flex-col items-center">
              <div className="min-w-0 text-center">
                <h2 className="max-w-full truncate text-xl font-bold text-foreground">{displayName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentRank.name} · {disciplinePoints} Discipline
        </p>
              </div>

        {!isGuest && (
          <button
            onClick={openFriends}
            className="glass mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-foreground transition-all duration-250 hover:border-[var(--gold)]/30 active:scale-[0.97]"
          >
            <Users className="size-3.5 text-[var(--gold)]" strokeWidth={1.5} />
            Friends
          </button>
        )}
            </div>

        {nextRank && (
          <div className="mt-4 w-full px-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{currentRank.name}</span>
              <span>{nextRank.name}</span>
            </div>
            <ProgressBar
              value={disciplinePoints - currentRank.minDP}
              max={nextRank.minDP - currentRank.minDP}
              className="mt-1.5"
            />
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {nextRank.minDP - disciplinePoints} Discipline to {nextRank.name}
            </p>
          </div>
        )}
          </div>
      </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass card-elevated flex flex-col items-center rounded-2xl p-5">
          <Flame className="size-5 text-[var(--gold)] drop-shadow-[0_0_6px_var(--gold-glow)]" strokeWidth={1.5} />
          <span className="mt-3 text-lg font-bold text-foreground">{streak}</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">Streak</span>
        </div>
        <div className="glass card-elevated flex flex-col items-center rounded-2xl p-5">
          <TrendingUp className="size-5 text-[var(--gold)]" strokeWidth={1.5} />
          <span className="mt-3 text-lg font-bold text-foreground">{longestStreak}</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">Best</span>
        </div>
        <div className="glass card-elevated flex flex-col items-center rounded-2xl p-5">
          <Dumbbell className="size-5 text-[var(--gold)]" strokeWidth={1.5} />
          <span className="mt-3 text-lg font-bold text-foreground">{workoutsCompleted}</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">Workouts</span>
        </div>
      </div>

      {/* Discipline */}
      <div className="glass card-elevated rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
            <span className="text-xs text-muted-foreground">Discipline</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{disciplinePoints}</p>
        </div>
      </div>

      {/* Consistency */}
      <div className="glass card-elevated rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-foreground">Consistency</span>
          </div>
          <span className="text-sm font-bold text-[var(--gold)] text-glow-gold">{consistencyPercent}%</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--success)]">{workoutsCompleted}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--partial)]">{partialWorkouts}</p>
            <p className="text-[10px] text-muted-foreground">Partial</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--missed)]">{missedWorkouts}</p>
            <p className="text-[10px] text-muted-foreground">Missed</p>
          </div>
        </div>
      </div>

      {/* Lifetime Statistics */}
      <div className="glass card-elevated rounded-2xl p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Lifetime Statistics</p>
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Crown className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
              Highest Rank
            </span>
            <span className="text-sm font-bold text-foreground">{currentRank.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
              Longest Streak
            </span>
            <span className="text-sm font-bold text-foreground">{longestStreak} days</span>
          </div>
        </div>
      </div>

      {/* Achievements */}
      {!isGuest && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Achievements</h2>
            <button
              onClick={() => navigate("/achievements")}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--gold)] transition-all duration-250 hover:bg-[var(--gold-glow-soft)] active:scale-95"
            >
              View All
              <ChevronRight className="size-3.5" strokeWidth={2} />
            </button>
          </div>
          {recentAchievements.length === 0 ? (
            <div className="glass rounded-2xl px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No achievements yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Complete your first workout to unlock one.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentAchievements.map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Settings</h2>
        <div className="glass card-elevated overflow-hidden rounded-2xl">
          {SETTINGS_ITEMS.map((item, index) => (
            <button
              key={item.label}
              onClick={item.onClick}
              disabled={item.loading}
              className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-all duration-250 hover:bg-accent active:scale-[0.98] disabled:opacity-50"
              style={index < SETTINGS_ITEMS.length - 1 ? { borderBottom: '1px solid var(--glass-border)' } : undefined}
            >
              {item.loading
                ? <Loader2 className="size-4 animate-spin text-destructive" strokeWidth={1.5} />
                : <item.icon
                    className={item.destructive ? "size-4 text-destructive" : "size-4 text-muted-foreground"}
                    strokeWidth={1.5}
                  />
              }
              <span className={item.destructive ? "text-sm font-medium text-destructive" : "text-sm font-medium text-foreground"}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
        {notificationMessage && (
          <p className="mt-3 rounded-2xl border border-[var(--gold)]/15 bg-[var(--gold)]/5 px-4 py-3 text-xs text-muted-foreground">
            {notificationMessage}
          </p>
        )}
      </div>

      {/* Friends List Modal */}
      <Dialog open={showFriends} onOpenChange={setShowFriends}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Friends</DialogTitle>
            <DialogDescription className="sr-only">View your friends</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {loadingFriends ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : friendsList.length === 0 ? (
              <div className="glass-subtle rounded-2xl px-5 py-8 text-center">
                <p className="text-sm font-semibold text-foreground">No friends yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Add friends from the Social tab.</p>
              </div>
            ) : (
              friendsList.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => {
                    setSelectedFriend(friend)
                    setShowFriends(false)
                  }}
                  className="glass-subtle flex w-full items-center gap-3.5 rounded-2xl px-5 py-4 text-left transition-all duration-250 hover:border-[var(--glass-border)] active:scale-[0.97]"
                >
                  <RankBadge rank={friend.rank} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{friend.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">@{friend.username}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.5} />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Friend Profile Modal */}
      <Dialog open={selectedFriend !== null} onOpenChange={(open) => !open && setSelectedFriend(null)}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="sr-only">Friend Profile</DialogTitle>
            <DialogDescription className="sr-only">View friend details</DialogDescription>
          </DialogHeader>
          {selectedFriend && (
            <div className="space-y-5">
              <div className="flex flex-col items-center">
                <RankBadge rank={selectedFriend.rank} size="lg" />
                <h3 className="mt-4 text-lg font-bold text-foreground">{selectedFriend.displayName}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">@{selectedFriend.username}</p>
              </div>

              <div className="space-y-2.5">
                <div className="glass-subtle flex items-center justify-between rounded-2xl px-5 py-3.5">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Flame className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
                    Streak
                  </span>
                  <span className="text-sm font-bold text-foreground">{selectedFriend.streak} days</span>
                </div>
                <div className="glass-subtle flex items-center justify-between rounded-2xl px-5 py-3.5">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Award className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
                    Rank
                  </span>
                  <span className="text-sm font-bold text-foreground">{selectedFriend.rank}</span>
                </div>
                <div className="glass-subtle flex items-center justify-between rounded-2xl px-5 py-3.5">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
                    Discipline
                  </span>
                  <span className="text-sm font-bold text-foreground">{selectedFriend.disciplinePoints.toLocaleString()}</span>
                </div>
                <div className="glass-subtle flex items-center justify-between rounded-2xl px-5 py-3.5">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
                    Consistency
                  </span>
                  <span className="text-sm font-bold text-foreground">{selectedFriend.consistencyPercent}%</span>
                </div>
                <div className="glass-subtle flex items-center justify-between rounded-2xl px-5 py-3.5">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Dumbbell className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
                    Workouts
                  </span>
                  <span className="text-sm font-bold text-foreground">{selectedFriend.workoutsCompleted}</span>
                </div>
              </div>

              <button
                onClick={handleUnfriend}
                disabled={removingFriend}
                className="glass w-full rounded-2xl py-3.5 text-sm font-semibold text-destructive transition-all duration-250 active:scale-[0.97] disabled:opacity-50"
              >
                {removingFriend ? "Removing..." : (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <UserMinus className="size-4" /> Unfriend
                  </span>
                )}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Profile</DialogTitle>
            <DialogDescription className="sr-only">Update your profile information</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {editPhotoPreview ? (
                  <img
                    src={editPhotoPreview}
                    alt={displayName}
                    className="size-24 rounded-full border border-[var(--gold)]/35 object-cover shadow-[0_0_28px_rgba(212,175,55,0.22)]"
                  />
                ) : (
                  <div className="grid size-24 place-items-center rounded-full border border-[var(--gold)]/35 bg-[var(--gold)]/10 text-3xl font-bold text-[var(--gold)] shadow-[0_0_28px_rgba(212,175,55,0.18)]">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border border-[var(--gold)]/35 bg-card text-[var(--gold)] shadow-lg">
                  <Camera className="size-4" strokeWidth={1.8} />
                </div>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="glass-subtle rounded-full px-4 py-2 text-xs font-semibold text-foreground transition-all duration-250 active:scale-[0.97]"
              >
                Change Photo
              </button>
              <p className="text-center text-[11px] text-muted-foreground">JPG, PNG, or WebP under 5 MB</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="glass-subtle w-full rounded-2xl px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-[var(--gold)]/50"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Username</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="glass-subtle w-full rounded-2xl px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-[var(--gold)]/50"
                placeholder="username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Preferred Workout Time</label>
              <div className="glass-subtle flex rounded-2xl p-1">
                {(["Morning", "Afternoon", "Evening"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEditTime(t.toLowerCase() as "morning" | "afternoon" | "evening")}
                    className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all duration-200 ${
                      editTime === t.toLowerCase() ? "glass text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {editError && (
              <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3">
                <AlertCircle className="size-4 shrink-0 text-destructive" strokeWidth={1.5} />
                <p className="text-xs text-destructive">{editError}</p>
              </div>
            )}

            {editSuccess && (
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--success)]/20 bg-[var(--success)]/10 px-4 py-3">
                <Check className="size-4 shrink-0 text-[var(--success)]" strokeWidth={1.5} />
                <p className="text-xs text-[var(--success)]">Profile saved!</p>
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setShowEditProfile(false)}
                className="glass flex-1 rounded-2xl py-3.5 text-sm font-semibold text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={editLoading}
                className="glow-gold flex-1 rounded-2xl bg-[var(--gold)] py-3.5 text-sm font-bold text-[var(--gold-foreground)] transition-all disabled:opacity-60"
              >
                {editLoading ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation */}
      <Dialog open={showDeleteAccountConfirm} onOpenChange={(open) => {
        if (!deleteAccountLoading) setShowDeleteAccountConfirm(open)
      }}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Account</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This permanently deletes your account, profile, and profile photo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {deleteAccountError && (
              <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3">
                <AlertCircle className="size-4 shrink-0 text-destructive" strokeWidth={1.5} />
                <p className="text-xs text-destructive">{deleteAccountError}</p>
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setShowDeleteAccountConfirm(false)}
                disabled={deleteAccountLoading}
                className="glass flex-1 rounded-2xl py-3.5 text-sm font-semibold text-foreground transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading}
                className="flex-1 rounded-2xl bg-destructive py-3.5 text-sm font-bold text-destructive-foreground transition-all disabled:opacity-60"
              >
                {deleteAccountLoading ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Delete"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
