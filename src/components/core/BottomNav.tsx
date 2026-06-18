import { Home, Calendar, Users, UserCircle } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/plan", icon: Calendar, label: "Plan" },
  { path: "/social", icon: Users, label: "Social" },
  { path: "/profile", icon: UserCircle, label: "Profile" },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 nav-fade-bg">
      <div className="flex items-center justify-around px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "tap-lift flex flex-col items-center gap-1.5 rounded-xl px-5 py-2 transition-all duration-250",
                isActive
                  ? "text-[var(--gold)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon
                className={cn(
                  "size-5 transition-all duration-250",
                  isActive && "-translate-y-0.5 scale-110 drop-shadow-[0_0_8px_var(--gold-glow)]"
                )}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span className={cn(
                "text-[10px] font-medium transition-all duration-250",
                isActive && "text-glow-gold"
              )}>
                {tab.label}
              </span>
              <span className="grid h-1 place-items-center">
                <span
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    isActive ? "soft-breathe w-1 bg-[var(--gold)]" : "w-0 bg-transparent"
                  )}
                />
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
