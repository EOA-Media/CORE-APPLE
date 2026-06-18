import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

interface StatPillProps {
  icon: LucideIcon
  label: string
  value: string | number
  className?: string
}

export function StatPill({ icon: Icon, label, value, className }: StatPillProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1 rounded-xl bg-secondary px-4 py-3", className)}>
      <Icon className="size-5 text-[var(--gold)]" />
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}
