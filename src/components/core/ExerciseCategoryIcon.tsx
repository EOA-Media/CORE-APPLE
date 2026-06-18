interface ExerciseCategoryIconProps {
  category?: string
  completed?: boolean
  /** Container diameter in px (default 32) */
  size?: number
}

export function ExerciseCategoryIcon({
  completed = false,
  size = 32,
}: ExerciseCategoryIconProps) {
  const imgSize = Math.round(size * 1.00)

  const containerStyle: React.CSSProperties = completed
    ? {
        width: size,
        height: size,
        background: "rgba(34,197,94,0.12)",
        border: "1px solid rgba(34,197,94,0.30)",
        boxShadow: "0 0 8px rgba(34,197,94,0.12)",
      }
    : {
        width: size,
        height: size,
        background: "rgba(201,147,14,0.07)",
        border: "1px solid rgba(201,147,14,0.24)",
        boxShadow: "0 0 10px rgba(201,147,14,0.12)",
      }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={containerStyle}
    >
      <img
        src="/dumbbell.svg"
        width={imgSize}
        height={imgSize}
        alt=""
        style={{ opacity: completed ? 1 : 0.85 }}
      />
    </div>
  )
}
