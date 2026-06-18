import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight, Plus, Trash2, Dumbbell, Moon, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { exerciseLibrary, CATEGORIES, EQUIPMENT_LIST, type LibraryExercise } from "@/data/exerciseLibrary"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { activatePlan, saveWorkout } from "@/services/planService"
import type { Exercise, Workout, WorkoutPlan } from "@/data/models"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomExercise {
  uid: string
  name: string
  category: string
  equipment: string
  sets: number
  repsMin: number
  repsMax: number
  restSeconds: number
  startingWeight: number | null
}

interface DayConfig {
  dayOfWeek: number
  label: string
  shortLabel: string
  type: "rest" | "workout"
  workoutName: string
  exercises: CustomExercise[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: Pick<DayConfig, "dayOfWeek" | "label" | "shortLabel">[] = [
  { dayOfWeek: 1, label: "Monday", shortLabel: "MON" },
  { dayOfWeek: 2, label: "Tuesday", shortLabel: "TUE" },
  { dayOfWeek: 3, label: "Wednesday", shortLabel: "WED" },
  { dayOfWeek: 4, label: "Thursday", shortLabel: "THU" },
  { dayOfWeek: 5, label: "Friday", shortLabel: "FRI" },
  { dayOfWeek: 6, label: "Saturday", shortLabel: "SAT" },
  { dayOfWeek: 0, label: "Sunday", shortLabel: "SUN" },
]

const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"]
const LOCATIONS = ["Gym", "Home"]

function uid() {
  return Math.random().toString(36).slice(2)
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

function estimateWorkoutMinutes(exercises: CustomExercise[]) {
  const seconds = exercises.reduce((sum, ex) => {
    const workSeconds = ex.sets * 45
    const restSeconds = Math.max(0, ex.sets - 1) * ex.restSeconds
    return sum + workSeconds + restSeconds
  }, 0)
  return Math.max(10, Math.round(seconds / 60))
}

function toExercise(ex: CustomExercise): Exercise {
  return {
    id: ex.uid,
    name: ex.name,
    category: ex.category,
    equipment: ex.equipment,
    sets: ex.sets,
    repsMin: ex.repsMin,
    repsMax: ex.repsMax,
    restSeconds: ex.restSeconds,
    defaultWeight: ex.startingWeight ?? 0,
  }
}

function makeDefaultDays(): DayConfig[] {
  return DAYS.map((d) => ({
    ...d,
    type: "rest",
    workoutName: "",
    exercises: [],
  }))
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 rounded-full transition-all duration-300",
            i < step
              ? "bg-[var(--gold)] w-6"
              : i === step - 1
              ? "bg-[var(--gold)] w-6 glow-gold-xs"
              : "bg-[var(--glass-border)] w-3"
          )}
        />
      ))}
    </div>
  )
}

// ─── Exercise Picker Dialog ───────────────────────────────────────────────────

function ExercisePickerDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (ex: CustomExercise) => void
}) {
  const [tab, setTab] = useState<"library" | "custom">("library")
  const [filterCat, setFilterCat] = useState<string>("All")
  const [search, setSearch] = useState("")

  const [customName, setCustomName] = useState("")
  const [customCategory, setCustomCategory] = useState("Custom")
  const [customEquipment, setCustomEquipment] = useState("Other")
  const [customSets, setCustomSets] = useState(3)
  const [customRepsMin, setCustomRepsMin] = useState(8)
  const [customRepsMax, setCustomRepsMax] = useState(12)
  const [customRest, setCustomRest] = useState(60)
  const [customWeight, setCustomWeight] = useState("")

  const filtered = exerciseLibrary.filter((e) => {
    const matchCat = filterCat === "All" || e.category === filterCat
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  function addFromLibrary(lib: LibraryExercise) {
    onAdd({
      uid: uid(),
      name: lib.name,
      category: lib.category,
      equipment: lib.equipment,
      sets: lib.defaultSets,
      repsMin: lib.defaultRepsMin,
      repsMax: lib.defaultRepsMax,
      restSeconds: lib.defaultRestSeconds,
      startingWeight: null,
    })
  }

  function addCustom() {
    if (!customName.trim()) return
    onAdd({
      uid: uid(),
      name: customName.trim(),
      category: customCategory,
      equipment: customEquipment,
      sets: customSets,
      repsMin: customRepsMin,
      repsMax: customRepsMax,
      restSeconds: customRest,
      startingWeight: customWeight ? parseFloat(customWeight) : null,
    })
    setCustomName("")
    setCustomWeight("")
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] max-h-[85svh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-foreground">Add Exercise</DialogTitle>
          <DialogDescription className="sr-only">Search or create an exercise</DialogDescription>
        </DialogHeader>

        {/* Tab */}
        <div className="mx-6 mb-4 shrink-0 glass-subtle flex rounded-xl p-1">
          <button
            onClick={() => setTab("library")}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-200",
              tab === "library" ? "glass text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Library
          </button>
          <button
            onClick={() => setTab("custom")}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-200",
              tab === "custom" ? "glass text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Custom
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {tab === "library" && (
            <div className="space-y-3">
              {/* Search */}
              <input
                type="text"
                placeholder="Search exercises…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm"
              />
              {/* Category filter */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {["All", ...CATEGORIES.filter((c) => c !== "Custom")].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
                      filterCat === cat
                        ? "bg-[var(--gold)] text-[var(--gold-foreground)]"
                        : "glass-subtle text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* Exercise list */}
              <div className="space-y-2">
                {filtered.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => addFromLibrary(ex)}
                    className="flex w-full items-center justify-between rounded-xl glass-subtle px-4 py-3 text-left transition-all duration-200 hover:border-[var(--glass-border-highlight)] active:scale-[0.98]"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{ex.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ex.category} · {ex.equipment}
                      </p>
                    </div>
                    <div className="flex size-7 items-center justify-center rounded-full bg-[var(--gold-glow-soft)]">
                      <Plus className="size-3.5 text-[var(--gold)]" strokeWidth={2.5} />
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No exercises found</p>
                )}
              </div>
            </div>
          )}

          {tab === "custom" && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Exercise Name</label>
                <input
                  type="text"
                  placeholder="e.g. Cable Crossover"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm"
                    style={{ background: "var(--glass-bg-subtle)", color: "var(--foreground)", border: "1px solid var(--glass-border)" }}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Equipment</label>
                  <select
                    value={customEquipment}
                    onChange={(e) => setCustomEquipment(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm"
                    style={{ background: "var(--glass-bg-subtle)", color: "var(--foreground)", border: "1px solid var(--glass-border)" }}
                  >
                    {EQUIPMENT_LIST.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Sets</label>
                  <input type="number" value={customSets} onChange={(e) => setCustomSets(Number(e.target.value))} min={1} max={10} className="w-full rounded-xl px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Rest (sec)</label>
                  <input type="number" value={customRest} onChange={(e) => setCustomRest(Number(e.target.value))} min={15} step={15} className="w-full rounded-xl px-4 py-3 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reps Min</label>
                  <input type="number" value={customRepsMin} onChange={(e) => setCustomRepsMin(Number(e.target.value))} min={1} className="w-full rounded-xl px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reps Max</label>
                  <input type="number" value={customRepsMax} onChange={(e) => setCustomRepsMax(Number(e.target.value))} min={1} className="w-full rounded-xl px-4 py-3 text-sm" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Starting Weight (lbs) — optional</label>
                <input type="number" placeholder="e.g. 135" value={customWeight} onChange={(e) => setCustomWeight(e.target.value)} min={0} className="w-full rounded-xl px-4 py-3 text-sm" />
              </div>

              <button
                onClick={addCustom}
                disabled={!customName.trim()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)] py-3.5 text-sm font-bold text-[var(--gold-foreground)] transition-all duration-250 disabled:opacity-40 active:scale-[0.97]"
              >
                <Plus className="size-4" strokeWidth={2.5} />
                Add Exercise
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Step 1: Plan Details ─────────────────────────────────────────────────────

function Step1({
  planName, setPlanName,
  daysPerWeek, setDaysPerWeek,
  experienceLevel, setExperienceLevel,
  location, setLocation,
}: {
  planName: string; setPlanName: (v: string) => void
  daysPerWeek: number; setDaysPerWeek: (v: number) => void
  experienceLevel: string; setExperienceLevel: (v: string) => void
  location: string; setLocation: (v: string) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">Plan Name</label>
        <input
          type="text"
          placeholder="My Custom Plan"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          className="w-full rounded-2xl px-5 py-4 text-sm font-medium"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">Days Per Week</label>
        <div className="flex gap-2">
          {[3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => setDaysPerWeek(n)}
              className={cn(
                "flex-1 rounded-2xl py-4 text-sm font-bold transition-all duration-200",
                daysPerWeek === n
                  ? "bg-[var(--gold)] text-[var(--gold-foreground)] glow-gold"
                  : "glass-subtle text-muted-foreground hover:text-foreground"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">Experience Level</label>
        <div className="flex gap-2">
          {EXPERIENCE_LEVELS.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setExperienceLevel(lvl)}
              className={cn(
                "flex-1 rounded-2xl py-3.5 text-sm font-semibold transition-all duration-200",
                experienceLevel === lvl
                  ? "bg-[var(--gold)] text-[var(--gold-foreground)] glow-gold"
                  : "glass-subtle text-muted-foreground hover:text-foreground"
              )}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">Location</label>
        <div className="flex gap-2">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => setLocation(loc)}
              className={cn(
                "flex-1 rounded-2xl py-3.5 text-sm font-bold transition-all duration-200",
                location === loc
                  ? "bg-[var(--gold)] text-[var(--gold-foreground)] glow-gold"
                  : "glass-subtle text-muted-foreground hover:text-foreground"
              )}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Select Days ──────────────────────────────────────────────────────

function Step2({ days, setDays }: { days: DayConfig[]; setDays: (d: DayConfig[]) => void }) {
  function toggleType(idx: number) {
    const updated = [...days]
    const cur = updated[idx]
    updated[idx] = {
      ...cur,
      type: cur.type === "rest" ? "workout" : "rest",
      workoutName: cur.type === "rest" ? `${cur.label} Workout` : "",
    }
    setDays(updated)
  }

  function setName(idx: number, name: string) {
    const updated = [...days]
    updated[idx] = { ...updated[idx], workoutName: name }
    setDays(updated)
  }

  return (
    <div className="space-y-2.5">
      {days.map((day, idx) => (
        <div
          key={day.dayOfWeek}
          className={cn(
            "rounded-2xl p-4 transition-all duration-200",
            day.type === "workout" ? "glass card-elevated" : "glass-subtle"
          )}
        >
          <div className="flex items-center gap-3">
            <span className={cn(
              "w-10 text-xs font-bold",
              day.type === "workout" ? "text-[var(--gold)]" : "text-muted-foreground"
            )}>
              {day.shortLabel}
            </span>

            <button
              onClick={() => toggleType(idx)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                day.type === "workout"
                  ? "bg-[var(--gold-glow-soft)] text-[var(--gold)] border border-[var(--gold)]/20"
                  : "glass-subtle text-muted-foreground"
              )}
            >
              {day.type === "workout" ? (
                <><Dumbbell className="size-3" strokeWidth={2} /> Workout</>
              ) : (
                <><Moon className="size-3" strokeWidth={1.5} /> Rest</>
              )}
            </button>

            {day.type === "workout" && (
              <input
                type="text"
                placeholder={`${day.label} Workout`}
                value={day.workoutName}
                onChange={(e) => setName(idx, e.target.value)}
                className="flex-1 rounded-xl px-3 py-1.5 text-sm"
                style={{ background: "var(--glass-bg-subtle)", border: "1px solid var(--glass-border)" }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Step 3: Build Workouts ───────────────────────────────────────────────────

function Step3({ days, setDays }: { days: DayConfig[]; setDays: (d: DayConfig[]) => void }) {
  const [activeDayIdx, setActiveDayIdx] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const workoutDays = days.filter((d) => d.type === "workout")

  // Open first workout day by default
  const displayIdx = activeDayIdx ?? (workoutDays.length > 0 ? days.indexOf(workoutDays[0]) : null)

  function addExercise(dayIdx: number, ex: CustomExercise) {
    const updated = [...days]
    updated[dayIdx] = { ...updated[dayIdx], exercises: [...updated[dayIdx].exercises, ex] }
    setDays(updated)
    setPickerOpen(false)
  }

  function removeExercise(dayIdx: number, exUid: string) {
    const updated = [...days]
    updated[dayIdx] = {
      ...updated[dayIdx],
      exercises: updated[dayIdx].exercises.filter((e) => e.uid !== exUid),
    }
    setDays(updated)
  }

  function updateExercise(dayIdx: number, exUid: string, patch: Partial<CustomExercise>) {
    const updated = [...days]
    updated[dayIdx] = {
      ...updated[dayIdx],
      exercises: updated[dayIdx].exercises.map((exercise) =>
        exercise.uid === exUid ? { ...exercise, ...patch } : exercise
      ),
    }
    setDays(updated)
  }

  if (workoutDays.length === 0) {
    return (
      <div className="glass rounded-2xl px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">No workout days selected</p>
        <p className="mt-1 text-xs text-muted-foreground">Go back to Step 2 and mark at least one day as Workout.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Day selector tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day, idx) => {
          if (day.type !== "workout") return null
          const isActive = displayIdx === idx
          return (
            <button
              key={day.dayOfWeek}
              onClick={() => setActiveDayIdx(idx)}
              className={cn(
                "shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200",
                isActive
                  ? "bg-[var(--gold)] text-[var(--gold-foreground)]"
                  : "glass-subtle text-muted-foreground hover:text-foreground"
              )}
            >
              {day.shortLabel}
              {day.exercises.length > 0 && (
                <span className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  isActive ? "bg-[var(--gold-foreground)]/20" : "bg-[var(--gold-glow-soft)] text-[var(--gold)]"
                )}>
                  {day.exercises.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {displayIdx !== null && days[displayIdx] && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">{days[displayIdx].workoutName || days[displayIdx].label + " Workout"}</p>
              <p className="text-xs text-muted-foreground">{days[displayIdx].exercises.length} exercise{days[displayIdx].exercises.length !== 1 ? "s" : ""}</p>
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-glow-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--gold)] transition-all duration-200 hover:border-[var(--gold)]/50 active:scale-[0.97]"
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
              Add Exercise
            </button>
          </div>

          {days[displayIdx].exercises.length === 0 ? (
            <div className="glass-subtle rounded-2xl px-5 py-8 text-center">
              <Dumbbell className="mx-auto mb-3 size-8 text-muted-foreground/40" strokeWidth={1} />
              <p className="text-sm text-muted-foreground">No exercises yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Tap Add Exercise to build this workout</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {days[displayIdx].exercises.map((ex) => (
                <div key={ex.uid} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{ex.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ex.sets} sets · {ex.repsMin}–{ex.repsMax} reps · {ex.restSeconds >= 60 ? `${ex.restSeconds / 60} min` : `${ex.restSeconds}s`} rest
                      </p>
                      {ex.startingWeight && (
                        <p className="mt-0.5 text-xs text-[var(--gold-dim)]">Weight: {ex.startingWeight} lbs</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeExercise(displayIdx, ex.uid)}
                      className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" strokeWidth={1.5} />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    <label className="space-y-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sets</span>
                      <input
                        type="number"
                        value={ex.sets}
                        min={1}
                        max={10}
                        onChange={(event) => updateExercise(displayIdx, ex.uid, {
                          sets: clampNumber(Number(event.target.value), 1, 10),
                        })}
                        className="w-full rounded-xl px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Min</span>
                      <input
                        type="number"
                        value={ex.repsMin}
                        min={1}
                        onChange={(event) => {
                          const repsMin = clampNumber(Number(event.target.value), 1, 100)
                          updateExercise(displayIdx, ex.uid, { repsMin, repsMax: Math.max(repsMin, ex.repsMax) })
                        }}
                        className="w-full rounded-xl px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Max</span>
                      <input
                        type="number"
                        value={ex.repsMax}
                        min={1}
                        onChange={(event) => {
                          const repsMax = clampNumber(Number(event.target.value), 1, 100)
                          updateExercise(displayIdx, ex.uid, { repsMax, repsMin: Math.min(ex.repsMin, repsMax) })
                        }}
                        className="w-full rounded-xl px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rest</span>
                      <input
                        type="number"
                        value={ex.restSeconds}
                        min={15}
                        step={15}
                        onChange={(event) => updateExercise(displayIdx, ex.uid, {
                          restSeconds: clampNumber(Number(event.target.value), 15, 600),
                        })}
                        className="w-full rounded-xl px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ExercisePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={(ex) => displayIdx !== null && addExercise(displayIdx, ex)}
      />
    </div>
  )
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function Step4({
  planName, experienceLevel, location,
  days,
}: {
  planName: string; experienceLevel: string; location: string
  days: DayConfig[]
}) {
  const workoutDays = days.filter((d) => d.type === "workout")
  const totalExercises = days.reduce((sum, d) => sum + d.exercises.length, 0)

  return (
    <div className="space-y-4">
      {/* Plan summary card */}
      <div className="premium-gradient rounded-3xl p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Custom Plan</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">{planName || "My Custom Plan"}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--gold-glow-soft)] px-3 py-1 text-xs font-medium text-[var(--gold)]">
            {workoutDays.length} Days / Week
          </span>
          <span className="rounded-full glass-subtle px-3 py-1 text-xs font-medium text-muted-foreground capitalize">
            {experienceLevel}
          </span>
          <span className="rounded-full glass-subtle px-3 py-1 text-xs font-medium text-muted-foreground capitalize">
            {location}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{totalExercises} total exercise{totalExercises !== 1 ? "s" : ""}</p>
      </div>

      {/* Weekly schedule */}
      <div className="space-y-2">
        {days.map((day) => (
          <div
            key={day.dayOfWeek}
            className={cn(
              "rounded-2xl p-4 transition-all",
              day.type === "workout" ? "glass" : "glass-subtle"
            )}
          >
            <div className="flex items-center gap-3">
              <span className={cn(
                "w-10 text-xs font-bold",
                day.type === "workout" ? "text-[var(--gold)]" : "text-muted-foreground"
              )}>
                {day.shortLabel}
              </span>

              <div className="flex-1">
                <p className={cn(
                  "text-sm font-medium",
                  day.type === "workout" ? "text-foreground" : "text-muted-foreground"
                )}>
                  {day.type === "workout" ? (day.workoutName || day.label + " Workout") : "Rest"}
                </p>
                {day.type === "workout" && day.exercises.length > 0 && (
                  <p className="text-xs text-muted-foreground">{day.exercises.length} exercise{day.exercises.length !== 1 ? "s" : ""}</p>
                )}
              </div>

              {day.type === "workout" ? (
                <Dumbbell className="size-4 text-[var(--gold)]" strokeWidth={1.5} />
              ) : (
                <Moon className="size-4 text-muted-foreground/40" strokeWidth={1.5} />
              )}
            </div>

            {day.type === "workout" && day.exercises.length > 0 && (
              <div className="mt-3 ml-[52px] space-y-1.5">
                {day.exercises.map((ex) => (
                  <div key={ex.uid} className="flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-[var(--gold)]/50" />
                    <span className="text-xs text-muted-foreground">
                      {ex.name} — {ex.sets} × {ex.repsMin}–{ex.repsMax}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export function CustomPlanBuilderPage() {
  const navigate = useNavigate()
  const { firebaseUser, isGuest, refreshUserDoc } = useAuth()

  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 4

  // Step 1
  const [planName, setPlanName] = useState("")
  const [daysPerWeek, setDaysPerWeek] = useState(4)
  const [experienceLevel, setExperienceLevel] = useState("Intermediate")
  const [location, setLocation] = useState("Gym")

  // Steps 2 & 3
  const [days, setDays] = useState<DayConfig[]>(makeDefaultDays)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const stepTitles = ["Plan Details", "Workout Days", "Build Workouts", "Review Plan"]

  const canNext = () => {
    if (step === 1) return planName.trim().length > 0
    if (step === 2) return days.some((d) => d.type === "workout")
    if (step === 3) return days
      .filter((d) => d.type === "workout")
      .every((d) => d.exercises.length > 0)
    return true
  }

  async function handleSave() {
    if (!firebaseUser || isGuest) {
      setSaveError("Create or sign in to an account before saving a custom plan.")
      return
    }

    const workoutDays = days.filter((day) => day.type === "workout")
    if (workoutDays.length === 0 || workoutDays.some((day) => day.exercises.length === 0)) {
      setSaveError("Add at least one exercise to every workout day before saving.")
      return
    }

    setSaving(true)
    setSaveError("")

    try {
      const nowIso = new Date().toISOString()
      const safePlanName = planName.trim() || "My Custom Plan"
      const planId = `custom-${firebaseUser.uid}-${Date.now()}`
      const workouts: Workout[] = workoutDays.map((day) => {
        const workoutId = `${planId}-${day.dayOfWeek}`
        const exercises = day.exercises.map(toExercise)
        return {
          id: workoutId,
          name: day.workoutName.trim() || `${day.label} Workout`,
          muscleGroups: Array.from(new Set(exercises.map((exercise) => exercise.category))),
          estimatedMinutes: estimateWorkoutMinutes(day.exercises),
          exercises,
          planId,
        }
      })

      await Promise.all(workouts.map((workout) => saveWorkout(workout)))

      const workoutByDay = new Map(workouts.map((workout) => {
        const day = workoutDays.find((candidate) => `${planId}-${candidate.dayOfWeek}` === workout.id)
        return [day?.dayOfWeek ?? -1, workout]
      }))

      const plan: WorkoutPlan = {
        id: planId,
        name: safePlanName,
        type: "custom",
        createdBy: firebaseUser.uid,
        experienceLevel: experienceLevel.toLowerCase() as WorkoutPlan["experienceLevel"],
        location: location.toLowerCase() as WorkoutPlan["location"],
        daysPerWeek: workoutDays.length,
        goal: "Custom",
        schedule: days.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          workoutId: day.type === "workout" ? workoutByDay.get(day.dayOfWeek)?.id ?? null : null,
          isRest: day.type === "rest",
        })),
        createdAt: nowIso,
        updatedAt: nowIso,
      }

      const workoutNameMap = Object.fromEntries(workouts.map((workout) => [workout.id, workout.name]))
      await activatePlan(firebaseUser.uid, plan, workoutNameMap)
      await refreshUserDoc()
      navigate("/plan")
    } catch (err) {
      console.error("[CustomPlanBuilderPage] failed to save custom plan:", err)
      setSaveError("Could not save this custom plan. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-bg relative mx-auto flex h-svh max-w-[430px] flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pb-4 pt-14 shrink-0">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
          className="flex size-9 items-center justify-center rounded-xl glass transition-all duration-250 hover:bg-accent active:scale-95"
        >
          <ChevronLeft className="size-5 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Step {step} of {TOTAL_STEPS}</p>
          <h1 className="text-base font-bold text-foreground">{stepTitles[step - 1]}</h1>
        </div>
        <StepIndicator step={step} total={TOTAL_STEPS} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {step === 1 && (
          <Step1
            planName={planName} setPlanName={setPlanName}
            daysPerWeek={daysPerWeek} setDaysPerWeek={setDaysPerWeek}
            experienceLevel={experienceLevel} setExperienceLevel={setExperienceLevel}
            location={location} setLocation={setLocation}
          />
        )}
        {step === 2 && <Step2 days={days} setDays={setDays} />}
        {step === 3 && <Step3 days={days} setDays={setDays} />}
        {step === 4 && (
          <Step4
            planName={planName}
            experienceLevel={experienceLevel}
            location={location}
            days={days}
          />
        )}
      </div>

      {/* Footer CTA */}
      <div className="shrink-0 px-6 pb-8 pt-3">
        {saveError && (
          <p className="mb-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {saveError}
          </p>
        )}
        {step < TOTAL_STEPS ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)] py-4 text-sm font-bold text-[var(--gold-foreground)] transition-all duration-250 disabled:opacity-40 active:scale-[0.97] glow-gold"
          >
            Continue
            <ChevronRight className="size-4" strokeWidth={2.5} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)] py-4 text-sm font-bold text-[var(--gold-foreground)] transition-all duration-250 disabled:opacity-60 active:scale-[0.97] glow-gold"
          >
            {saving ? (
              <span className="animate-pulse">Saving…</span>
            ) : (
              <><Check className="size-4" strokeWidth={2.5} /> Save Plan</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
