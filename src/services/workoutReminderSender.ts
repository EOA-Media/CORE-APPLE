import { addDays, format } from "date-fns"
import type { ScheduledWorkout, User } from "@/data/models"

export function shouldSendWorkoutReminder(user: User, scheduledWorkout: ScheduledWorkout | null, localHour: number): boolean {
  if (!user.pushNotificationsEnabled || !user.workoutReminderEnabled) return false
  if ((user.workoutReminderHour ?? 9) !== localHour) return false
  if (!scheduledWorkout || scheduledWorkout.status !== "scheduled") return false
  if (!scheduledWorkout.workoutId) return false
  return true
}

export function getNextWorkoutReminderDate(fromDate: Date): string {
  return format(addDays(fromDate, 1), "yyyy-MM-dd")
}
