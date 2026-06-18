import { cn } from "@/lib/utils"
import { getRankFromDP } from "@/data/helpers"

interface RankBadgeProps {
  rank: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function RankBadge({ rank, size = "md", className }: RankBadgeProps) {
  const rankData = getRankFromDP(
    rank === "Bronze" ? 0 :
    rank === "Silver" ? 100 :
    rank === "Gold" ? 300 :
    rank === "Platinum" ? 700 :
    rank === "Diamond" ? 1500 :
    rank === "Elite" ? 3000 : 0
  )
  const color = rankData.color
  const sizeClasses = {
    sm: "size-8 text-xs",
    md: "size-12 text-sm",
    lg: "size-16 text-base",
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-bold",
        sizeClasses[size],
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `1.5px solid ${color}60`,
        color,
        boxShadow: `0 0 12px ${color}25, inset 0 1px 0 ${color}15`,
      }}
    >
      {rank[0]}
    </div>
  )
}
