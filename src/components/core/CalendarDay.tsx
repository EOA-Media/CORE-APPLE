import { cn } from "@/lib/utils"
import type { ScheduledWorkout } from "@/data/models"

interface CalendarDayProps {
  day: ScheduledWorkout
  isToday?: boolean
}

const statusColors: Record<ScheduledWorkout["status"], string> = {
  completed: "bg-[var(--success)]",
  partial: "bg-[var(--partial)]",
  missed: "bg-[var(--missed)]",
  rest: "bg-[var(--rest)]",
  scheduled: "bg-secondary",
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function CalendarDay({ day, isToday }: CalendarDayProps) {
  const date = new Date(day.date + "T12:00:00")
  const dayNumber = date.getDate()
  const dayOfWeek = dayNames[date.getDay()]

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground">{dayOfWeek}</span>
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-full text-xs font-medium transition-all",
          statusColors[day.status],
          day.status === "scheduled" && "text-muted-foreground",
          day.status === "completed" && "text-[#0F1115]",
          day.status === "partial" && "text-[#0F1115]",
          day.status === "missed" && "text-white",
          day.status === "rest" && "text-white",
          isToday && "ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-background"
        )}
      >
        {dayNumber}
      </div>
    </div>
  )
}
