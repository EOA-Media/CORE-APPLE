import { cn } from "@/lib/utils"
import type { Exercise } from "@/data/models"

interface ExercisePreviewItemProps {
  exercise: Exercise
  index: number
  className?: string
}

export function ExercisePreviewItem({ exercise, index, className }: ExercisePreviewItemProps) {
  return (
    <div className={cn("flex items-center gap-4 rounded-xl bg-secondary p-4", className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-xs font-bold text-muted-foreground">
        {index + 1}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{exercise.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {exercise.sets} sets × {exercise.repsMin}-{exercise.repsMax}
          {exercise.defaultWeight > 0 && ` · ${exercise.defaultWeight}kg`}
        </p>
      </div>
    </div>
  )
}
