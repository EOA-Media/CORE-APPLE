import { useEffect, useState } from "react"
import { UserPlus, Search, QrCode, Share2, Flame, Trophy, Dumbbell, TrendingUp, Calendar, Award, Loader2, UserMinus, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import { RankBadge } from "@/components/core/RankBadge"
import { ProgressBar } from "@/components/core/ProgressBar"
import { AdSlot } from "@/components/core/AdSlot"
import {
  friends,
  currentUser,
  friendActivities,
  friendRequests as initialRequests,
} from "@/data/mock"
import type { Friend, FriendRequest, User } from "@/data/models"
import { getRankFromDP, ranks } from "@/data/helpers"
import { useAuth } from "@/contexts/AuthContext"
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchLeagueLeaderboard,
  getFriends,
  getPendingRequests,
  type LeagueLeaderboardEntry,
  removeFriend,
  searchUserByUsername,
  sendFriendRequest,
} from "@/services/friendService"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

function getActivityIcon(type: string) {
  switch (type) {
    case "completed": return <Dumbbell className="size-4 text-[var(--success)]" strokeWidth={1.5} />
    case "streak": return <Flame className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
    case "rank": return <Trophy className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
    case "partial": return <TrendingUp className="size-4 text-[var(--partial)]" strokeWidth={1.5} />
    default: return <Dumbbell className="size-4 text-muted-foreground" strokeWidth={1.5} />
  }
}

function getTimeAgo(timestamp: string): string {
  const now = new Date("2026-05-22T12:00:00Z")
  const then = new Date(timestamp)
  const diffHours = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60))
  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

function getNextLeague(leagueName: string) {
  const index = ranks.findIndex((rank) => rank.name === leagueName)
  return index >= 0 && index < ranks.length - 1 ? ranks[index + 1] : null
}

function getLeagueProgress(dp: number, leagueName: string): { value: number; max: number; remaining: number } {
  const league = ranks.find((rank) => rank.name === leagueName) ?? ranks[0]
  const nextLeague = getNextLeague(league.name)
  if (!nextLeague) {
    return { value: 1, max: 1, remaining: 0 }
  }

  return {
    value: Math.max(0, dp - league.minDP),
    max: nextLeague.minDP - league.minDP,
    remaining: Math.max(0, nextLeague.minDP - dp),
  }
}

function makeMockLeagueLeaderboard(): LeagueLeaderboardEntry[] {
  const mockUsers = [currentUser, ...friends]
  const currentLeague = getRankFromDP(currentUser.disciplinePoints).name
  return mockUsers
    .map((user) => ({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      photoURL: user.photoURL,
      rank: getRankFromDP(user.disciplinePoints).name,
      disciplinePoints: user.disciplinePoints,
      leaguePosition: 0,
      isCurrentUser: user.id === currentUser.id,
    }))
    .filter((user) => user.rank === currentLeague)
    .sort((a, b) => b.disciplinePoints - a.disciplinePoints || a.username.localeCompare(b.username))
    .map((user, index) => ({ ...user, leaguePosition: index + 1 }))
}

export function SocialPage() {
  const { firebaseUser, isGuest, userDoc } = useAuth()
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResult, setSearchResult] = useState<User | null>(null)
  const [requestSent, setRequestSent] = useState(false)
  const [friendReqs, setFriendReqs] = useState<FriendRequest[]>(initialRequests)
  const [friendList, setFriendList] = useState<Friend[]>(friends)
  const [leagueLeaderboard, setLeagueLeaderboard] = useState<LeagueLeaderboardEntry[]>(makeMockLeagueLeaderboard())
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [loadingSocial, setLoadingSocial] = useState(false)
  const [searching, setSearching] = useState(false)
  const [addFriendError, setAddFriendError] = useState("")
  const [savingFriend, setSavingFriend] = useState(false)

  const currentProfile = userDoc ? {
    ...currentUser,
    id: userDoc.id,
    username: userDoc.username,
    displayName: userDoc.displayName,
    photoURL: userDoc.photoURL,
    streak: userDoc.streak,
    rank: userDoc.rank,
    disciplinePoints: userDoc.disciplinePoints,
    consistencyPercent: userDoc.consistencyPercent,
    workoutsCompleted: userDoc.workoutsCompleted,
  } : currentUser
  const visibleFriendActivities = (!firebaseUser || isGuest)
    ? friendActivities
    : friendActivities.filter((activity) => friendList.some((friend) => friend.id === activity.friendId))
  const currentLeague = getRankFromDP(currentProfile.disciplinePoints).name
  const currentLeagueRank = leagueLeaderboard.find((entry) => entry.isCurrentUser)?.leaguePosition ?? 1
  const nextLeague = getNextLeague(currentLeague)
  const leagueProgress = getLeagueProgress(currentProfile.disciplinePoints, currentLeague)
  const recentFriendActivities = visibleFriendActivities.slice(0, 5)

  async function loadSocialData() {
    if (!firebaseUser || isGuest) {
      setFriendReqs(initialRequests)
      setFriendList(friends)
      setLeagueLeaderboard(makeMockLeagueLeaderboard())
      return
    }

    setLoadingSocial(true)
    try {
      const [requests, liveFriends, liveLeaderboard] = await Promise.all([
        getPendingRequests(firebaseUser.uid),
        getFriends(firebaseUser.uid),
        fetchLeagueLeaderboard(firebaseUser.uid),
      ])
      setFriendReqs(requests)
      setFriendList(liveFriends)
      setLeagueLeaderboard(liveLeaderboard)
    } catch (err) {
      console.warn("[SocialPage] failed to load live social data:", err)
    } finally {
      setLoadingSocial(false)
    }
  }

  useEffect(() => {
    loadSocialData()
  }, [firebaseUser, isGuest])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setAddFriendError("")
    setRequestSent(false)
    try {
      if (!firebaseUser || isGuest) {
        setSearchResult({ ...currentUser, id: "mock-search", username: "olivia_fit", displayName: "Olivia F.", rank: "Gold" })
        return
      }

      const result = await searchUserByUsername(searchQuery)
      if (!result) {
        setSearchResult(null)
        setAddFriendError("No user found with that username.")
        return
      }
      if (result.id === firebaseUser.uid) {
        setSearchResult(null)
        setAddFriendError("That's your account.")
        return
      }
      if (friendList.some((friend) => friend.id === result.id)) {
        setSearchResult(null)
        setAddFriendError("You're already friends.")
        return
      }
      setSearchResult(result)
    } catch {
      setAddFriendError("Search failed. Please try again.")
    } finally {
      setSearching(false)
    }
  }

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (!firebaseUser || isGuest) {
      setFriendReqs((prev) => prev.filter((r) => r.id !== request.id))
      return
    }
    await acceptFriendRequest(request.id, request.fromUserId, firebaseUser.uid)
    await loadSocialData()
  }

  const handleDeclineRequest = async (id: string) => {
    if (!firebaseUser || isGuest) {
      setFriendReqs((prev) => prev.filter((r) => r.id !== id))
      return
    }
    await declineFriendRequest(id)
    await loadSocialData()
  }

  const handleSendRequest = async () => {
    if (!searchResult) return
    if (!firebaseUser || isGuest || !userDoc) {
      setRequestSent(true)
      return
    }

    setSavingFriend(true)
    setAddFriendError("")
    try {
      await sendFriendRequest(
        firebaseUser.uid,
        userDoc.username,
        userDoc.displayName,
        userDoc.rank,
        searchResult.id
      )
      setRequestSent(true)
    } catch {
      setAddFriendError("Could not send friend request. Please try again.")
    } finally {
      setSavingFriend(false)
    }
  }

  const handleUnfriend = async () => {
    if (!selectedFriend) return
    if (!firebaseUser || isGuest) {
      setFriendList((prev) => prev.filter((friend) => friend.id !== selectedFriend.id))
      setSelectedFriend(null)
      return
    }

    setSavingFriend(true)
    try {
      await removeFriend(firebaseUser.uid, selectedFriend.id)
      setSelectedFriend(null)
      await loadSocialData()
    } finally {
      setSavingFriend(false)
    }
  }

  const openFriendProfile = (friendId: string) => {
    const friend = friendList.find((f) => f.id === friendId) ?? (!firebaseUser || isGuest ? friends.find((f) => f.id === friendId) : null)
    if (friend) setSelectedFriend(friend)
  }

  return (
    <div className="space-y-6 px-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Social</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accountability & competition</p>
        </div>
        <button
          onClick={() => setShowAddFriend(true)}
          aria-label="Add friend"
          className="glass flex size-10 items-center justify-center rounded-full transition-all duration-250 hover:border-[var(--gold)]/30"
        >
          <UserPlus className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
        </button>
      </div>

      {/* Friend Requests */}
      {friendReqs.length > 0 && (
        <div className="space-y-2.5">
          {friendReqs.map((req) => (
            <div key={req.id} className="glass card-elevated rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <RankBadge rank={req.fromRank} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{req.fromDisplayName}</p>
                  <p className="text-xs text-muted-foreground">wants to connect</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2.5">
                <button
                  onClick={() => handleAcceptRequest(req)}
                  className="flex-1 rounded-xl bg-[var(--gold)] py-2.5 text-xs font-bold text-[var(--gold-foreground)] transition-all duration-250 hover:shadow-[0_0_12px_rgba(212,160,23,0.2)]"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDeclineRequest(req.id)}
                  className="glass flex-1 rounded-xl py-2.5 text-xs font-semibold text-muted-foreground transition-all duration-250 hover:text-foreground"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* League Panel */}
      <div className="glass card-elevated rounded-3xl border-[var(--gold)]/20 p-6 shadow-[0_0_28px_rgba(212,160,23,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Current League</p>
            <h3 className="mt-2 text-2xl font-bold text-foreground">{currentLeague} League</h3>
          </div>
          <div className="glass-subtle flex size-12 items-center justify-center rounded-2xl border-[var(--gold)]/20">
            <Crown className="size-6 text-[var(--gold)] drop-shadow-[0_0_8px_var(--gold-glow)]" strokeWidth={1.5} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <div className="glass-subtle rounded-2xl px-3 py-3 text-center">
            <p className="text-[10px] font-medium text-muted-foreground">Rank</p>
            <p className="mt-1 text-lg font-bold text-foreground">#{currentLeagueRank}</p>
          </div>
          <div className="glass-subtle rounded-2xl px-3 py-3 text-center">
            <p className="text-[10px] font-medium text-muted-foreground">Current Discipline</p>
            <p className="mt-1 text-lg font-bold text-[var(--gold)]">{currentProfile.disciplinePoints}</p>
          </div>
          <div className="glass-subtle rounded-2xl px-3 py-3 text-center">
            <p className="text-[10px] font-medium text-muted-foreground">To Next</p>
            <p className="mt-1 text-lg font-bold text-foreground">{leagueProgress.remaining}</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {nextLeague ? `${leagueProgress.remaining} Discipline until ${nextLeague.name}` : "Elite league reached"}
            </span>
            <span className="text-xs font-semibold text-[var(--gold)]">
              {nextLeague ? `${Math.round((leagueProgress.value / leagueProgress.max) * 100)}%` : "Max"}
            </span>
          </div>
          <ProgressBar value={leagueProgress.value} max={leagueProgress.max} className="h-2 bg-secondary" />
        </div>

        <div className="mt-6 border-t border-border/70 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">League Leaderboard</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{currentLeague} League</p>
            </div>
            <Trophy className="size-5 text-[var(--gold)] drop-shadow-[0_0_6px_var(--gold-glow)]" strokeWidth={1.5} />
          </div>
        </div>

        {loadingSocial && (
          <div className="mt-5 flex justify-center py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {leagueLeaderboard.map((entry) => (
            <div
              key={entry.userId}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-250",
                entry.isCurrentUser
                  ? "glass border-[var(--gold)]/25 glow-gold-subtle"
                  : "glass-subtle"
              )}
            >
              <span className={cn(
                "w-9 shrink-0 text-xs font-bold",
                entry.leaguePosition <= 3 ? "text-[var(--gold)]" : "text-muted-foreground"
              )}>
                #{entry.leaguePosition}
              </span>

              <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--glass-border)] bg-secondary">
                {entry.photoURL ? (
                  <img src={entry.photoURL} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-foreground">{(entry.displayName || entry.username || "?").charAt(0).toUpperCase()}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className={cn(
                  "truncate text-sm font-semibold",
                  entry.isCurrentUser ? "text-[var(--gold)] text-glow-gold" : "text-foreground"
                )}>
                  {entry.isCurrentUser ? "You" : entry.username}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{entry.displayName}</p>
              </div>

              <span className={cn(
                "text-sm font-bold",
                entry.isCurrentUser ? "text-[var(--gold)] text-glow-gold" : "text-foreground"
              )}>
                {entry.disciplinePoints} <span className="text-xs font-normal text-muted-foreground">Discipline</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <AdSlot placement="social-league" />

      {/* Friend Activity */}
      <div>
        <p className="mb-4 text-sm font-semibold text-foreground">Friend Activity</p>
        <div className="space-y-2.5">
          {recentFriendActivities.length === 0 && (
            <div className="glass rounded-2xl px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No friend activity yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Add friends to see their workouts here.</p>
            </div>
          )}
          {recentFriendActivities.map((activity) => (
            <button
              key={activity.id}
              onClick={() => openFriendProfile(activity.friendId)}
              className="glass flex w-full items-center gap-3.5 rounded-2xl p-4 text-left transition-all duration-250 hover:border-[var(--glass-border)] active:scale-[0.97]"
            >
              <div className="glass-subtle flex size-9 items-center justify-center rounded-xl">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{activity.friendName}</span>{" "}
                  <span className="text-muted-foreground">{activity.description}</span>
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{getTimeAgo(activity.timestamp)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Add Friend Modal */}
      <Dialog open={showAddFriend} onOpenChange={setShowAddFriend}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Friend</DialogTitle>
            <DialogDescription className="sr-only">Add a new friend to your network</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <button
              onClick={() => { setShowAddFriend(false); setShowSearch(true) }}
              className="glass-subtle flex w-full items-center gap-3.5 rounded-2xl px-5 py-4 text-left transition-all duration-250 hover:border-[var(--glass-border)] active:scale-[0.97]"
            >
              <Search className="size-5 text-[var(--gold)]" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold text-foreground">Search Username</p>
                <p className="text-xs text-muted-foreground">Find friends by @username</p>
              </div>
            </button>
            <button
              disabled
              className="glass-subtle flex w-full items-center gap-3.5 rounded-2xl px-5 py-4 text-left transition-all duration-250 hover:border-[var(--glass-border)] active:scale-[0.97]"
            >
              <QrCode className="size-5 text-[var(--gold)]" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold text-foreground">Scan QR Code</p>
                <p className="text-xs text-muted-foreground">Scan a friend's code to connect</p>
              </div>
            </button>
            <button
              disabled
              className="glass-subtle flex w-full items-center gap-3.5 rounded-2xl px-5 py-4 text-left transition-all duration-250 hover:border-[var(--glass-border)] active:scale-[0.97]"
            >
              <Share2 className="size-5 text-[var(--gold)]" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold text-foreground">Share Invite Link</p>
                <p className="text-xs text-muted-foreground">Send a link to join</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search Username Modal */}
      <Dialog open={showSearch} onOpenChange={(open) => { setShowSearch(open); if (!open) { setSearchQuery(""); setSearchResult(null); setRequestSent(false) } }}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Search Username</DialogTitle>
            <DialogDescription className="sr-only">Search for a friend by username</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="@username"
                className="glass-subtle flex-1 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-250 focus:border-[var(--gold)]/30"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                aria-label="Search username"
                className="glass flex size-11 items-center justify-center rounded-xl transition-all duration-250 hover:border-[var(--gold)]/30"
              >
                {searching ? <Loader2 className="size-4 animate-spin text-[var(--gold)]" /> : <Search className="size-4 text-[var(--gold)]" strokeWidth={1.5} />}
              </button>
            </div>

            {addFriendError && (
              <p className="rounded-xl bg-destructive/10 px-4 py-3 text-xs text-destructive">{addFriendError}</p>
            )}

            {searchResult && (
              <div className="glass-subtle rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <RankBadge rank={searchResult.rank} size="sm" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{searchResult.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{searchResult.username}</p>
                  </div>
                </div>
                <button
                  onClick={handleSendRequest}
                  disabled={requestSent || savingFriend}
                  className={cn(
                    "mt-4 w-full rounded-xl py-3 text-xs font-bold transition-all duration-250",
                    requestSent
                      ? "glass text-muted-foreground"
                      : "bg-[var(--gold)] text-[var(--gold-foreground)] hover:shadow-[0_0_12px_rgba(212,160,23,0.2)]"
                  )}
                >
                  {savingFriend ? "Sending..." : requestSent ? "Request Sent" : "Send Friend Request"}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Friend Profile Modal */}
      <Dialog open={selectedFriend !== null && !showCompare} onOpenChange={() => setSelectedFriend(null)}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="sr-only">Friend Profile</DialogTitle>
            <DialogDescription className="sr-only">View friend details</DialogDescription>
          </DialogHeader>
          {selectedFriend && (
            <div className="space-y-5">
              {/* Profile header */}
              <div className="flex flex-col items-center">
                <RankBadge rank={selectedFriend.rank} size="lg" />
                <h3 className="mt-4 text-lg font-bold text-foreground">{selectedFriend.displayName}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">@{selectedFriend.username}</p>
              </div>

              {/* Stats */}
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

              {/* Mini calendar preview */}
              <div className="glass-subtle rounded-2xl p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">This Week</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] text-muted-foreground">{day}</span>
                      <div className={cn(
                        "size-5 rounded-md",
                        i < 3 ? "bg-[var(--success)]/20" :
                        i === 3 ? "bg-muted-foreground/10" :
                        "bg-secondary"
                      )} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowCompare(true)}
                  className="glow-gold rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)] py-3.5 text-sm font-bold text-[var(--gold-foreground)] transition-all duration-250 hover:shadow-[0_0_30px_rgba(212,160,23,0.3)] active:scale-[0.97]"
                >
                  Compare
                </button>
                <button
                  onClick={handleUnfriend}
                  disabled={savingFriend}
                  className="glass rounded-2xl py-3.5 text-sm font-semibold text-destructive transition-all duration-250 active:scale-[0.97] disabled:opacity-50"
                >
                  {savingFriend ? "Removing..." : (
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <UserMinus className="size-4" /> Unfriend
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Compare View Modal */}
      <Dialog open={showCompare} onOpenChange={(open) => { setShowCompare(open); if (!open) setSelectedFriend(null) }}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-center text-foreground">You vs {selectedFriend?.displayName}</DialogTitle>
            <DialogDescription className="sr-only">Compare your stats with a friend</DialogDescription>
          </DialogHeader>
          {selectedFriend && (
            <div className="space-y-2.5">
              <CompareRow label="Streak" left={`${currentProfile.streak}`} right={`${selectedFriend.streak}`} unit="days" leftWins={currentProfile.streak > selectedFriend.streak} />
              <CompareRow label="Rank" left={currentProfile.rank} right={selectedFriend.rank} leftWins={currentProfile.disciplinePoints > selectedFriend.disciplinePoints} />
              <CompareRow label="Discipline" left={currentProfile.disciplinePoints.toLocaleString()} right={selectedFriend.disciplinePoints.toLocaleString()} leftWins={currentProfile.disciplinePoints > selectedFriend.disciplinePoints} />
              <CompareRow label="Consistency" left={`${currentProfile.consistencyPercent}%`} right={`${selectedFriend.consistencyPercent}%`} leftWins={currentProfile.consistencyPercent > selectedFriend.consistencyPercent} />
              <CompareRow label="Workouts" left={`${currentProfile.workoutsCompleted}`} right={`${selectedFriend.workoutsCompleted}`} leftWins={currentProfile.workoutsCompleted > selectedFriend.workoutsCompleted} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CompareRow({ label, left, right, unit, leftWins }: { label: string; left: string; right: string; unit?: string; leftWins: boolean }) {
  return (
    <div className="glass-subtle rounded-2xl px-5 py-4">
      <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-sm font-bold",
          leftWins ? "text-[var(--gold)] text-glow-gold" : "text-foreground"
        )}>
          {left}{unit ? ` ${unit}` : ""}
        </span>
        <span className="text-[10px] text-muted-foreground">vs</span>
        <span className={cn(
          "text-sm font-bold",
          !leftWins ? "text-[var(--gold)] text-glow-gold" : "text-foreground"
        )}>
          {right}{unit ? ` ${unit}` : ""}
        </span>
      </div>
    </div>
  )
}
