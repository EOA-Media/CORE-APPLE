import {
  collection,
  documentId,
  doc,
  deleteDoc,
  setDoc,
  getDocs,
  updateDoc,
  query,
  where,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Friend, FriendRequest, FriendEntry, User, WeeklyLeaderboardEntry } from "@/data/models"
import { getRankFromDP } from "@/data/helpers"
import { getUserDocument } from "./userService"

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, "").toLowerCase()
}

export async function searchUserByUsername(username: string): Promise<User | null> {
  const normalized = normalizeUsername(username)
  if (!normalized) return null

  const q = query(
    collection(db, "users"),
    where("username", "==", normalized),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null

  const data = snap.docs[0].data()
  return {
    ...data,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : (data.createdAt ?? ""),
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate().toISOString()
        : (data.updatedAt ?? ""),
  } as User
}

// ─── Friend Requests ──────────────────────────────────────────────────────────

/**
 * Send a friend request from one user to another.
 * Stores in the top-level friendRequests collection.
 */
export async function sendFriendRequest(
  fromUserId: string,
  fromUsername: string,
  fromDisplayName: string,
  fromRank: string,
  toUserId: string
): Promise<void> {
  if (fromUserId === toUserId) return

  const [existingOut, existingIn, existingFriend] = await Promise.all([
    getDocs(query(
      collection(db, "friendRequests"),
      where("fromUserId", "==", fromUserId),
      where("toUserId", "==", toUserId),
      where("status", "==", "pending")
    )),
    getDocs(query(
      collection(db, "friendRequests"),
      where("fromUserId", "==", toUserId),
      where("toUserId", "==", fromUserId),
      where("status", "==", "pending")
    )),
    getDocs(query(collection(db, "users", fromUserId, "friends"), where(documentId(), "==", toUserId), limit(1))),
  ])
  if (!existingOut.empty || !existingIn.empty || !existingFriend.empty) return

  const ref = doc(collection(db, "friendRequests"))
  await setDoc(ref, {
    id: ref.id,
    fromUserId,
    toUserId,
    fromUsername,
    fromDisplayName,
    fromRank,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Accept a pending friend request.
 * Writes mutual friend entries under each user's friends subcollection.
 */
export async function acceptFriendRequest(
  requestId: string,
  fromUserId: string,
  toUserId: string
): Promise<void> {
  const ref = doc(db, "friendRequests", requestId)
  await updateDoc(ref, {
    status: "accepted",
    updatedAt: serverTimestamp(),
  })

  // Load both user profiles for the friend entry data
  const [fromUser, toUser] = await Promise.all([
    getUserDocument(fromUserId),
    getUserDocument(toUserId),
  ])

  const toEntry: FriendEntry = {
    username: toUser?.username ?? "",
    displayName: toUser?.displayName ?? "",
    photoURL: toUser?.photoURL ?? "",
    addedAt: new Date().toISOString(),
  }
  const fromEntry: FriendEntry = {
    username: fromUser?.username ?? "",
    displayName: fromUser?.displayName ?? "",
    photoURL: fromUser?.photoURL ?? "",
    addedAt: new Date().toISOString(),
  }

  await Promise.all([
    // fromUser gets toUser in their friends list
    setDoc(doc(db, "users", fromUserId, "friends", toUserId), {
      ...toEntry,
      addedAt: serverTimestamp(),
    }),
    // toUser gets fromUser in their friends list
    setDoc(doc(db, "users", toUserId, "friends", fromUserId), {
      ...fromEntry,
      addedAt: serverTimestamp(),
    }),
  ])
}

/**
 * Decline a pending friend request.
 */
export async function declineFriendRequest(requestId: string): Promise<void> {
  const ref = doc(db, "friendRequests", requestId)
  await updateDoc(ref, {
    status: "declined",
    updatedAt: serverTimestamp(),
  })
}

/**
 * Legacy helper — wraps accept/decline. `accept=true` calls acceptFriendRequest.
 */
export async function respondToRequest(
  requestId: string,
  fromId: string,
  toUserId: string,
  accept: boolean
): Promise<void> {
  if (accept) {
    await acceptFriendRequest(requestId, fromId, toUserId)
  } else {
    await declineFriendRequest(requestId)
  }
}

// ─── Fetch requests ───────────────────────────────────────────────────────────

export async function getPendingRequests(userId: string): Promise<FriendRequest[]> {
  const q = query(
    collection(db, "friendRequests"),
    where("toUserId", "==", userId),
    where("status", "==", "pending")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      ...data,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
    } as FriendRequest
  })
}

export async function getSentRequests(userId: string): Promise<FriendRequest[]> {
  const q = query(
    collection(db, "friendRequests"),
    where("fromUserId", "==", userId),
    where("status", "==", "pending")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as FriendRequest)
}

// ─── Friends list ─────────────────────────────────────────────────────────────

/**
 * Fetch the list of friend entries, then hydrate with live user profiles.
 */
export async function getFriends(userId: string): Promise<Friend[]> {
  const snap = await getDocs(collection(db, "users", userId, "friends"))
  const friendIds = snap.docs
    .filter((d) => d.data().removed !== true)
    .map((d) => d.id)

  if (friendIds.length === 0) return []

  const profiles = await Promise.all(
    friendIds.map((id) => getUserDocument(id))
  )

  return profiles
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      photoURL: p.photoURL,
      streak: p.streak,
      rank: p.rank,
      disciplinePoints: p.disciplinePoints,
      consistencyPercent: p.consistencyPercent,
      workoutsCompleted: p.workoutsCompleted,
    }))
}

export interface LeagueLeaderboardEntry {
  userId: string
  username: string
  displayName: string
  photoURL: string
  rank: string
  disciplinePoints: number
  leaguePosition: number
  isCurrentUser: boolean
}

export async function fetchLeagueLeaderboard(currentUserId: string): Promise<LeagueLeaderboardEntry[]> {
  const currentUser = await getUserDocument(currentUserId)
  if (!currentUser) return []

  const currentLeague = getRankFromDP(currentUser.disciplinePoints).name
  const snap = await getDocs(collection(db, "users"))
  const leagueUsers = snap.docs
    .map((d) => {
      const data = d.data()
      const disciplinePoints = Number(data.disciplinePoints ?? 0)
      return {
        userId: d.id,
        username: data.username ?? "",
        displayName: data.displayName ?? "",
        photoURL: data.photoURL ?? "",
        rank: getRankFromDP(disciplinePoints).name,
        disciplinePoints,
        leaguePosition: 0,
        isCurrentUser: d.id === currentUserId,
      }
    })
    .filter((user) => user.rank === currentLeague)
    .sort((a, b) => b.disciplinePoints - a.disciplinePoints || a.username.localeCompare(b.username))

  return leagueUsers.map((user, index) => ({
    ...user,
    leaguePosition: index + 1,
  }))
}

export async function removeFriend(
  userId: string,
  friendId: string
): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, "users", userId, "friends", friendId)),
    deleteDoc(doc(db, "users", friendId, "friends", userId)),
  ])
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

/**
 * Fetch a discipline-points leaderboard consisting of the current user + friends.
 * Sorted descending by disciplinePoints (all-time, not weekly — weekly DP
 * would require a separate aggregation counter, deferred to a future Cloud Function).
 */
export async function fetchLeaderboard(
  currentUserId: string
): Promise<WeeklyLeaderboardEntry[]> {
  const [currentUser, friends] = await Promise.all([
    getUserDocument(currentUserId),
    getFriends(currentUserId),
  ])

  if (!currentUser) return []

  const entries: WeeklyLeaderboardEntry[] = [
    {
      friendId: currentUserId,
      displayName: currentUser.displayName,
      username: currentUser.username,
      weeklyDP: currentUser.disciplinePoints,
      rank: currentUser.rank,
      isCurrentUser: true,
    },
    ...friends.map((f) => ({
      friendId: f.id,
      displayName: f.displayName,
      username: f.username,
      weeklyDP: f.disciplinePoints,
      rank: f.rank,
      isCurrentUser: false,
    })),
  ]

  return entries.sort((a, b) => b.weeklyDP - a.weeklyDP)
}
