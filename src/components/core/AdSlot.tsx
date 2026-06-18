import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAdLabel, isAdEnabled, type AdPlacement } from "@/services/adService"

interface AdSlotProps {
  placement: AdPlacement
  className?: string
}

export function AdSlot({ placement, className }: AdSlotProps) {
  if (!isAdEnabled()) return null

  return (
    <div
      className={cn(
        "glass-subtle rounded-2xl border border-[var(--gold)]/10 px-4 py-3",
        className
      )}
      data-ad-placement={placement}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-[var(--gold)]" strokeWidth={1.5} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {getAdLabel(placement)}
          </span>
        </div>
        <span className="rounded-full border border-[var(--gold)]/15 bg-[var(--gold)]/5 px-2 py-0.5 text-[9px] font-semibold text-[var(--gold)]">
          Test Ad
        </span>
      </div>
      <div className="mt-3 flex h-16 items-center justify-center rounded-xl border border-dashed border-[var(--gold)]/18 bg-black/18">
        <p className="text-xs font-medium text-muted-foreground">Ad placement reserved</p>
      </div>
    </div>
  )
}
