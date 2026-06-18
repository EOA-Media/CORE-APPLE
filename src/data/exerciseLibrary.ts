export interface LibraryExercise {
  id: string
  name: string
  category: string
  equipment: string
  defaultSets: number
  defaultRepsMin: number
  defaultRepsMax: number
  defaultRestSeconds: number
}

export const CATEGORIES = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps",
  "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Cardio", "Full Body", "Custom",
]

export const EQUIPMENT_LIST = [
  "Barbell", "Dumbbells", "Cable", "Machine", "Bodyweight", "Kettlebell", "Bands", "Other",
]

export const exerciseLibrary: LibraryExercise[] = [
  // Chest
  { id: "lib-001", name: "Barbell Bench Press", category: "Chest", equipment: "Barbell", defaultSets: 4, defaultRepsMin: 8, defaultRepsMax: 10, defaultRestSeconds: 90 },
  { id: "lib-002", name: "Incline Dumbbell Press", category: "Chest", equipment: "Dumbbells", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 75 },
  { id: "lib-003", name: "Cable Fly", category: "Chest", equipment: "Cable", defaultSets: 3, defaultRepsMin: 12, defaultRepsMax: 15, defaultRestSeconds: 60 },
  { id: "lib-004", name: "Push-Up", category: "Chest", equipment: "Bodyweight", defaultSets: 3, defaultRepsMin: 12, defaultRepsMax: 20, defaultRestSeconds: 60 },
  { id: "lib-005", name: "Dumbbell Fly", category: "Chest", equipment: "Dumbbells", defaultSets: 3, defaultRepsMin: 12, defaultRepsMax: 15, defaultRestSeconds: 60 },
  // Back
  { id: "lib-006", name: "Barbell Row", category: "Back", equipment: "Barbell", defaultSets: 4, defaultRepsMin: 8, defaultRepsMax: 10, defaultRestSeconds: 90 },
  { id: "lib-007", name: "Lat Pulldown", category: "Back", equipment: "Cable", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 75 },
  { id: "lib-008", name: "Seated Cable Row", category: "Back", equipment: "Cable", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 75 },
  { id: "lib-009", name: "Pull-Up", category: "Back", equipment: "Bodyweight", defaultSets: 3, defaultRepsMin: 6, defaultRepsMax: 10, defaultRestSeconds: 90 },
  { id: "lib-010", name: "Dumbbell Row", category: "Back", equipment: "Dumbbells", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 75 },
  // Shoulders
  { id: "lib-011", name: "Overhead Press", category: "Shoulders", equipment: "Barbell", defaultSets: 3, defaultRepsMin: 8, defaultRepsMax: 10, defaultRestSeconds: 90 },
  { id: "lib-012", name: "Lateral Raises", category: "Shoulders", equipment: "Dumbbells", defaultSets: 3, defaultRepsMin: 12, defaultRepsMax: 15, defaultRestSeconds: 60 },
  { id: "lib-013", name: "Front Raise", category: "Shoulders", equipment: "Dumbbells", defaultSets: 3, defaultRepsMin: 12, defaultRepsMax: 15, defaultRestSeconds: 60 },
  { id: "lib-014", name: "Face Pull", category: "Shoulders", equipment: "Cable", defaultSets: 3, defaultRepsMin: 15, defaultRepsMax: 20, defaultRestSeconds: 60 },
  // Biceps
  { id: "lib-015", name: "Barbell Curl", category: "Biceps", equipment: "Barbell", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 60 },
  { id: "lib-016", name: "Hammer Curl", category: "Biceps", equipment: "Dumbbells", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 60 },
  { id: "lib-017", name: "Preacher Curl", category: "Biceps", equipment: "Machine", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 60 },
  // Triceps
  { id: "lib-018", name: "Tricep Rope Pushdown", category: "Triceps", equipment: "Cable", defaultSets: 3, defaultRepsMin: 12, defaultRepsMax: 15, defaultRestSeconds: 60 },
  { id: "lib-019", name: "Overhead Tricep Extension", category: "Triceps", equipment: "Dumbbells", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 60 },
  { id: "lib-020", name: "Skull Crusher", category: "Triceps", equipment: "Barbell", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 75 },
  // Quads
  { id: "lib-021", name: "Barbell Squat", category: "Quads", equipment: "Barbell", defaultSets: 4, defaultRepsMin: 8, defaultRepsMax: 10, defaultRestSeconds: 120 },
  { id: "lib-022", name: "Leg Press", category: "Quads", equipment: "Machine", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 90 },
  { id: "lib-023", name: "Leg Extension", category: "Quads", equipment: "Machine", defaultSets: 3, defaultRepsMin: 12, defaultRepsMax: 15, defaultRestSeconds: 60 },
  // Hamstrings
  { id: "lib-024", name: "Romanian Deadlift", category: "Hamstrings", equipment: "Barbell", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 90 },
  { id: "lib-025", name: "Lying Leg Curl", category: "Hamstrings", equipment: "Machine", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 60 },
  // Glutes
  { id: "lib-026", name: "Hip Thrust", category: "Glutes", equipment: "Barbell", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 90 },
  { id: "lib-027", name: "Bulgarian Split Squat", category: "Glutes", equipment: "Dumbbells", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 12, defaultRestSeconds: 90 },
  // Calves
  { id: "lib-028", name: "Standing Calf Raise", category: "Calves", equipment: "Machine", defaultSets: 4, defaultRepsMin: 12, defaultRepsMax: 15, defaultRestSeconds: 60 },
  { id: "lib-029", name: "Seated Calf Raise", category: "Calves", equipment: "Machine", defaultSets: 3, defaultRepsMin: 15, defaultRepsMax: 20, defaultRestSeconds: 45 },
  // Core
  { id: "lib-030", name: "Plank", category: "Core", equipment: "Bodyweight", defaultSets: 3, defaultRepsMin: 30, defaultRepsMax: 60, defaultRestSeconds: 60 },
  { id: "lib-031", name: "Cable Crunch", category: "Core", equipment: "Cable", defaultSets: 3, defaultRepsMin: 15, defaultRepsMax: 20, defaultRestSeconds: 60 },
  { id: "lib-032", name: "Hanging Leg Raise", category: "Core", equipment: "Bodyweight", defaultSets: 3, defaultRepsMin: 10, defaultRepsMax: 15, defaultRestSeconds: 60 },
  // Deadlift (Full Body)
  { id: "lib-033", name: "Deadlift", category: "Full Body", equipment: "Barbell", defaultSets: 4, defaultRepsMin: 5, defaultRepsMax: 8, defaultRestSeconds: 180 },
]
