import { format } from "date-fns"

export function getAppDate(): Date {
  return new Date()
}

export function getTodayString(): string {
  return format(getAppDate(), "yyyy-MM-dd")
}

export function getAppDayOfWeek(): number {
  return getAppDate().getDay()
}
