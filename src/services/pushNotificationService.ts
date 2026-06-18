import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export type PushPermissionStatus = "unknown" | "granted" | "denied" | "prompt"

export interface WorkoutReminderSettings {
  pushNotificationsEnabled: boolean
  workoutReminderEnabled: boolean
  workoutReminderHour: number
  timezone: string
  pushTokens: string[]
  pushPermissionStatus: PushPermissionStatus
}

export function getDefaultWorkoutReminderSettings(): WorkoutReminderSettings {
  return {
    pushNotificationsEnabled: false,
    workoutReminderEnabled: true,
    workoutReminderHour: 9,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    pushTokens: [],
    pushPermissionStatus: "unknown",
  }
}

export async function saveWorkoutReminderSettings(
  userId: string,
  settings: Partial<WorkoutReminderSettings>
): Promise<void> {
  await setDoc(
    doc(db, "users", userId),
    {
      ...settings,
      notificationSettingsUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export async function registerWorkoutReminderPushToken(
  userId: string,
  token: string,
  settings: Partial<WorkoutReminderSettings> = {}
): Promise<void> {
  const defaults = getDefaultWorkoutReminderSettings()

  await saveWorkoutReminderSettings(userId, {
    pushNotificationsEnabled: true,
    workoutReminderEnabled: true,
    workoutReminderHour: settings.workoutReminderHour ?? defaults.workoutReminderHour,
    timezone: settings.timezone ?? defaults.timezone,
    pushPermissionStatus: "granted",
    pushTokens: [token],
  })
}

export async function requestWorkoutReminderPushNotifications(
  userId: string,
  settings: Partial<WorkoutReminderSettings> = {}
): Promise<PushPermissionStatus> {
  const [{ Capacitor }, { PushNotifications }] = await Promise.all([
    import("@capacitor/core"),
    import("@capacitor/push-notifications"),
  ])

  if (!Capacitor.isNativePlatform()) {
    await saveWorkoutReminderSettings(userId, {
      ...getDefaultWorkoutReminderSettings(),
      ...settings,
      pushPermissionStatus: "prompt",
    })
    return "prompt"
  }

  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== "granted") {
    await saveWorkoutReminderSettings(userId, {
      pushNotificationsEnabled: false,
      pushPermissionStatus: "denied",
    })
    return "denied"
  }

  await PushNotifications.addListener("registration", async (token) => {
    await registerWorkoutReminderPushToken(userId, token.value, settings)
  })

  await PushNotifications.addListener("registrationError", async () => {
    await saveWorkoutReminderSettings(userId, {
      pushNotificationsEnabled: false,
      pushPermissionStatus: "denied",
    })
  })

  await PushNotifications.register()
  await saveWorkoutReminderSettings(userId, {
    pushNotificationsEnabled: true,
    workoutReminderEnabled: true,
    workoutReminderHour: settings.workoutReminderHour ?? 9,
    timezone: settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "America/New_York",
    pushPermissionStatus: "granted",
  })

  return "granted"
}
