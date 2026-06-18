import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { AppNotification } from "@/data/models"

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createNotification(
  userId: string,
  notification: Omit<AppNotification, "id" | "read" | "createdAt">
): Promise<string> {
  const ref = doc(collection(db, "users", userId, "notifications"))
  await setDoc(ref, {
    id: ref.id,
    ...notification,
    read: false,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getNotifications(
  userId: string,
  count = 20
): Promise<AppNotification[]> {
  const q = query(
    collection(db, "users", userId, "notifications"),
    orderBy("createdAt", "desc"),
    limit(count)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      ...data,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : (data.createdAt ?? ""),
    } as AppNotification
  })
}

export async function getUnreadCount(userId: string): Promise<number> {
  const q = query(
    collection(db, "users", userId, "notifications"),
    where("read", "==", false)
  )
  const snap = await getDocs(q)
  return snap.size
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<void> {
  const ref = doc(db, "users", userId, "notifications", notificationId)
  await updateDoc(ref, { read: true })
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, "users", userId, "notifications"),
    where("read", "==", false)
  )
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })))
}
