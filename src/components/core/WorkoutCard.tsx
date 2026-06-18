import { Clock, Dumbbell, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Workout } from "@/data/models"

interface WorkoutCardProps {
  workout: Workout
  showStartButton?: boolean
  onStart?: () => void
  className?: string
}

export function WorkoutCard({ workout, showStartButton = false, onStart, className }: WorkoutCardProps) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground">{workout.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {workout.muscleGroups.join(" · ")}
          </p>
        </div>
        {!showStartButton && (
          <ChevronRight className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Clock className="size-4 text-[var(--rest)]" />
          <span className="text-xs text-muted-foreground">{workout.estimatedMinutes} min</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dumbbell className="size-4 text-[var(--rest)]" />
          <span className="text-xs text-muted-foreground">{workout.exercises.length} exercises</span>
        </div>
      </div>

      {showStartButton && (
        <button
          onClick={onStart}
          className="mt-5 w-full rounded-xl bg-[var(--gold)] py-3.5 text-sm font-bold text-[var(--gold-foreground)] transition-colors hover:bg-[#E0B83D] active:scale-[0.98]"
        >
          Start Workout
        </button>
      )}
    </div>
  )
}
