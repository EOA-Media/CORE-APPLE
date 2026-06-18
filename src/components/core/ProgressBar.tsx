import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number
  max: number
  className?: string
  barClassName?: string
}

export function ProgressBar({ value, max, className, barClassName }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[var(--glass-border)]", className)}>
      <div
        className={cn("gold-sheen h-full rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold-glow)] transition-all duration-700", barClassName)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
