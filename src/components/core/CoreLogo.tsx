import { cn } from "@/lib/utils"

interface CoreLogoProps {
  className?: string
  markClassName?: string
  showWordmark?: boolean
}

export function CoreLogo({ className, markClassName, showWordmark = false }: CoreLogoProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <img
        src="/core-logo-gold.png"
        alt="CORE"
        className={cn("object-contain drop-shadow-[0_0_12px_var(--gold-glow)]", markClassName)}
      />
      {showWordmark && (
        <span className="text-lg font-bold tracking-[0.24em] text-foreground">CORE</span>
      )}
    </div>
  )
}
