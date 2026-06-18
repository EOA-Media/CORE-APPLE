import type { Rank } from "./models"

export const ranks: Rank[] = [
  { name: "Bronze", minDP: 0, maxDP: 99, color: "#CD7F32" },
  { name: "Silver", minDP: 100, maxDP: 299, color: "#C0C0C0" },
  { name: "Gold", minDP: 300, maxDP: 699, color: "#D4A017" },
  { name: "Platinum", minDP: 700, maxDP: 1499, color: "#B0C4DE" },
  { name: "Diamond", minDP: 1500, maxDP: 2999, color: "#B9F2FF" },
  { name: "Elite", minDP: 3000, maxDP: Infinity, color: "#FF6B35" },
]

export function getRankFromDP(disciplinePoints: number): Rank {
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (disciplinePoints >= ranks[i].minDP) {
      return ranks[i]
    }
  }
  return ranks[0]
}

export function calculateWorkoutRewards(completionPercent: number): {
  dp: number
} {
  const fraction = Math.min(Math.max(completionPercent, 0), 100) / 100
  return {
    dp: Math.round(10 * fraction),
  }
}

export function calculateMissPenalty(consecutiveMisses: number): number {
  if (consecutiveMisses <= 0) return 0
  if (consecutiveMisses === 1) return -5
  if (consecutiveMisses === 2) return -15
  if (consecutiveMisses === 3) return -30
  if (consecutiveMisses === 4) return -50
  return -75
}

export function formatRestTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

export function formatElapsedTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }
  return `${mins}:${String(secs).padStart(2, "0")}`
}
