import { cn } from "@/lib/utils"
import { Trophy, Sword, Flame, Footprints, Dumbbell, Shield, Lock, Star, Zap, Target } from "lucide-react"
import type { Achievement } from "@/data/models"

const iconMap: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  trophy: Trophy,
  sword: Sword,
  flame: Flame,
  footprints: Footprints,
  dumbbell: Dumbbell,
  shield: Shield,
  star: Star,
  zap: Zap,
  target: Target,
  milestone: Trophy,
  consistency: Flame,
  streak: Zap,
  performance: Target,
  rank: Shield,
  program: Trophy,
}

interface AchievementCardProps {
  achievement: Achievement
  className?: string
  showDate?: boolean
}

export function AchievementCard({ achievement, className, showDate }: AchievementCardProps) {
  const Icon = iconMap[achievement.category] || Trophy

  const formattedDate =
    showDate && achievement.unlocked && achievement.unlockedAt
      ? new Date(achievement.unlockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null

  return (
    <div
      className={cn(
        "glass rounded-2xl p-5 transition-all duration-250",
        !achievement.unlocked && "opacity-50",
        achievement.unlocked && "card-elevated",
        className
      )}
    >
      <div className="flex items-center gap-3.5">
        <div className={cn(
          "flex size-11 items-center justify-center rounded-xl",
          achievement.unlocked ? "glass-subtle border-[var(--gold)]/20" : "glass-subtle"
        )}>
          {achievement.unlocked ? (
            <Icon className="size-5 text-[var(--gold)]" strokeWidth={1.5} />
          ) : (
            <Lock className="size-4 text-muted-foreground" strokeWidth={1.5} />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{achievement.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{achievement.description}</p>
          {formattedDate && (
            <p className="mt-1 text-[10px] text-[var(--gold-dim)]">{formattedDate}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-[var(--gold)]">+{achievement.disciplinePointReward} Discipline</p>
        </div>
      </div>
    </div>
  )
}
