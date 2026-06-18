import type { Exercise } from "./models"

export type ExerciseGuide = {
  name: string
  category: string
  equipment: string
  muscleGroup: string
  primaryMuscles: string[]
  steps: string[]
  cues: string[]
  mistakes: string[]
}

type GuideInput = Pick<Exercise, "name" | "category" | "equipment">

type GuideTemplate = Omit<ExerciseGuide, "name" | "category" | "equipment">

function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const aliases: Record<string, string> = {
  "barbell bench press": "bench press",
  "barbell squat": "back squat",
  "dumbbell row": "one arm dumbbell row",
  "dumbbell fly": "cable fly",
  "front raise": "dumbbell shoulder press",
  "lateral raises": "dumbbell lateral raise",
  "lying leg curl": "leg curl",
  "overhead press": "barbell overhead press",
  "overhead tricep extension": "overhead cable extension",
  "skull crusher": "skull crushers",
  "tricep rope pushdown": "tricep pushdown",
  "walking lunge": "walking lunges",
}

const guides: Record<string, GuideTemplate> = {
  "bench press": {
    muscleGroup: "Chest",
    primaryMuscles: ["Chest", "Front shoulders", "Triceps"],
    steps: ["Lie with your eyes under the bar and feet planted.", "Lower the bar under control to the lower chest.", "Press up until your arms are straight without losing shoulder position."],
    cues: ["Keep shoulder blades pulled back.", "Wrists stacked over elbows.", "Control the bar path."],
    mistakes: ["Bouncing the bar off your chest.", "Letting elbows flare straight out.", "Lifting hips off the bench."],
  },
  "incline dumbbell press": {
    muscleGroup: "Chest",
    primaryMuscles: ["Upper chest", "Front shoulders", "Triceps"],
    steps: ["Set the bench to a low incline and start with dumbbells at chest level.", "Press the dumbbells up and slightly together.", "Lower until elbows are just below the bench line."],
    cues: ["Keep ribs down.", "Move both dumbbells evenly.", "Use a controlled lower."],
    mistakes: ["Setting the bench too steep.", "Crashing dumbbells together.", "Arching hard through the lower back."],
  },
  "incline barbell bench press": {
    muscleGroup: "Chest",
    primaryMuscles: ["Upper chest", "Front shoulders", "Triceps"],
    steps: ["Set up on an incline bench with hands slightly wider than shoulders.", "Lower the bar to the upper chest.", "Press up while keeping your upper back tight."],
    cues: ["Touch high on the chest.", "Keep elbows under the bar.", "Plant your feet."],
    mistakes: ["Lowering to the neck.", "Using a very steep incline.", "Losing tightness at the bottom."],
  },
  "dumbbell bench press": {
    muscleGroup: "Chest",
    primaryMuscles: ["Chest", "Front shoulders", "Triceps"],
    steps: ["Lie back with dumbbells beside the chest.", "Press both dumbbells up until arms are straight.", "Lower slowly until elbows are below shoulder level."],
    cues: ["Keep forearms vertical.", "Press evenly.", "Stay tight on the bench."],
    mistakes: ["Letting dumbbells drift too wide.", "Rushing the lower.", "Shrugging shoulders toward ears."],
  },
  "push up": {
    muscleGroup: "Chest",
    primaryMuscles: ["Chest", "Triceps", "Core"],
    steps: ["Start in a straight plank with hands under shoulders.", "Lower your chest toward the floor.", "Push the floor away until arms are straight."],
    cues: ["Body stays in one line.", "Elbows angle slightly back.", "Brace your core."],
    mistakes: ["Hips sagging.", "Only moving the head and shoulders.", "Hands too far forward."],
  },
  "incline push up": {
    muscleGroup: "Chest",
    primaryMuscles: ["Chest", "Triceps", "Core"],
    steps: ["Place hands on a stable raised surface.", "Keep a straight line from head to heels.", "Lower chest to the surface and press back up."],
    cues: ["Use a height that lets you control the rep.", "Keep elbows tucked slightly.", "Brace your abs."],
    mistakes: ["Letting hips drop.", "Standing too close to the surface.", "Bouncing off the hands."],
  },
  "knee push up": {
    muscleGroup: "Chest",
    primaryMuscles: ["Chest", "Triceps", "Core"],
    steps: ["Set hands under shoulders and knees on the floor.", "Keep hips forward so your body is a straight line from knees to head.", "Lower the chest and press back up."],
    cues: ["Squeeze glutes lightly.", "Control the bottom.", "Press through the whole hand."],
    mistakes: ["Bending only at the hips.", "Letting elbows flare wide.", "Dropping quickly."],
  },
  "decline push up": {
    muscleGroup: "Chest",
    primaryMuscles: ["Upper chest", "Shoulders", "Triceps"],
    steps: ["Place feet on a stable raised surface.", "Set hands under shoulders and brace your core.", "Lower under control and press back to the top."],
    cues: ["Keep shoulders away from ears.", "Body stays rigid.", "Use a modest foot height first."],
    mistakes: ["Sagging through the lower back.", "Going too steep too soon.", "Shortening the range of motion."],
  },
  "diamond push up": {
    muscleGroup: "Triceps",
    primaryMuscles: ["Triceps", "Chest", "Core"],
    steps: ["Place hands close together under the chest.", "Keep a straight plank position.", "Lower under control and press up through the triceps."],
    cues: ["Keep elbows close.", "Use full-body tension.", "Move slowly."],
    mistakes: ["Forcing hands into a painful position.", "Flaring elbows hard.", "Letting hips sag."],
  },
  "dips": {
    muscleGroup: "Chest and Triceps",
    primaryMuscles: ["Chest", "Triceps", "Front shoulders"],
    steps: ["Support yourself on parallel bars or a stable dip station.", "Lower until elbows bend comfortably.", "Press back up without shrugging."],
    cues: ["Shoulders stay down.", "Lean slightly forward for chest.", "Control the depth."],
    mistakes: ["Dropping too low.", "Shrugging at the top.", "Swinging the legs."],
  },
  "weighted dips": {
    muscleGroup: "Chest and Triceps",
    primaryMuscles: ["Chest", "Triceps", "Front shoulders"],
    steps: ["Set up on dip bars with added weight secure.", "Lower smoothly to a strong shoulder position.", "Press up until elbows are straight."],
    cues: ["Own the bodyweight version first.", "Keep reps controlled.", "Stay tall through the chest."],
    mistakes: ["Adding weight before good form.", "Diving into the bottom.", "Letting shoulders roll forward."],
  },
  "lat pulldown": {
    muscleGroup: "Back",
    primaryMuscles: ["Lats", "Upper back", "Biceps"],
    steps: ["Grip the bar wider than shoulders and sit tall.", "Pull the bar toward the upper chest.", "Return slowly until arms are long."],
    cues: ["Drive elbows down.", "Keep chest up.", "Do not lean far back."],
    mistakes: ["Pulling behind the neck.", "Using momentum.", "Shrugging the shoulders."],
  },
  "assisted pull up": {
    muscleGroup: "Back",
    primaryMuscles: ["Lats", "Upper back", "Biceps"],
    steps: ["Set assistance so you can control full reps.", "Start from long arms.", "Pull chest toward the bar and lower slowly."],
    cues: ["Drive elbows down.", "Keep ribs from flaring.", "Use full range."],
    mistakes: ["Using too much bounce.", "Stopping halfway down.", "Craning the neck."],
  },
  "pull up": {
    muscleGroup: "Back",
    primaryMuscles: ["Lats", "Upper back", "Biceps"],
    steps: ["Hang from the bar with hands overhand.", "Pull your chest toward the bar.", "Lower with control to straight arms."],
    cues: ["Start by pulling shoulders down.", "Keep legs quiet.", "Think elbows to ribs."],
    mistakes: ["Half reps.", "Kipping when not intended.", "Shrugging into the neck."],
  },
  "chin up": {
    muscleGroup: "Back",
    primaryMuscles: ["Lats", "Biceps", "Upper back"],
    steps: ["Hang with palms facing you.", "Pull until chin clears the bar.", "Lower slowly to a full hang."],
    cues: ["Keep chest lifted.", "Drive elbows down.", "Control the bottom."],
    mistakes: ["Swinging for momentum.", "Only doing the top half.", "Losing shoulder control."],
  },
  "seated cable row": {
    muscleGroup: "Back",
    primaryMuscles: ["Mid back", "Lats", "Biceps"],
    steps: ["Sit tall with arms extended.", "Pull the handle toward your lower ribs.", "Return slowly without rounding your back."],
    cues: ["Squeeze shoulder blades together.", "Keep chest tall.", "Pause briefly at the pull."],
    mistakes: ["Rocking back and forth.", "Shrugging.", "Rounding the spine."],
  },
  "chest supported row": {
    muscleGroup: "Back",
    primaryMuscles: ["Upper back", "Lats", "Rear delts"],
    steps: ["Set your chest firmly against the pad.", "Pull handles or dumbbells toward your ribs.", "Lower until arms are long."],
    cues: ["Keep chest on the pad.", "Lead with elbows.", "Pause at the top."],
    mistakes: ["Lifting off the pad.", "Jerking the weight.", "Shrugging instead of rowing."],
  },
  "barbell row": {
    muscleGroup: "Back",
    primaryMuscles: ["Lats", "Mid back", "Hamstrings"],
    steps: ["Hinge at the hips with a flat back.", "Pull the bar toward your lower ribs.", "Lower under control without standing up."],
    cues: ["Brace hard.", "Keep bar close.", "Row with elbows."],
    mistakes: ["Rounding your back.", "Turning it into a deadlift.", "Using too much body swing."],
  },
  "t bar row": {
    muscleGroup: "Back",
    primaryMuscles: ["Mid back", "Lats", "Rear delts"],
    steps: ["Set your torso at a strong hinged angle.", "Pull the handle toward your chest or upper abs.", "Lower with control until arms extend."],
    cues: ["Keep neck neutral.", "Squeeze the back.", "Brace your trunk."],
    mistakes: ["Standing too upright.", "Jerking the first rep.", "Rounding the lower back."],
  },
  "one arm dumbbell row": {
    muscleGroup: "Back",
    primaryMuscles: ["Lats", "Mid back", "Biceps"],
    steps: ["Support one hand on a bench or stable surface.", "Pull the dumbbell toward your hip.", "Lower until the arm is long."],
    cues: ["Keep shoulders square.", "Pull elbow back.", "Move through a full range."],
    mistakes: ["Twisting hard.", "Shrugging the weight.", "Shortening the lower."],
  },
  "face pull": {
    muscleGroup: "Upper Back",
    primaryMuscles: ["Rear delts", "Upper back", "Rotator cuff"],
    steps: ["Set a cable or band at face height.", "Pull toward your face with elbows high.", "Control back to the start."],
    cues: ["Separate the hands as you pull.", "Keep ribs down.", "Use light control."],
    mistakes: ["Going too heavy.", "Pulling to the chest.", "Arching the back."],
  },
  "dumbbell shoulder press": {
    muscleGroup: "Shoulders",
    primaryMuscles: ["Shoulders", "Triceps", "Upper chest"],
    steps: ["Start with dumbbells at shoulder height.", "Press overhead until arms are straight.", "Lower to shoulder level with control."],
    cues: ["Keep ribs down.", "Press slightly back over the head.", "Wrists stay stacked."],
    mistakes: ["Overarching the back.", "Bouncing from the bottom.", "Letting dumbbells drift forward."],
  },
  "barbell overhead press": {
    muscleGroup: "Shoulders",
    primaryMuscles: ["Shoulders", "Triceps", "Core"],
    steps: ["Hold the bar at upper chest height.", "Press overhead while keeping your body tight.", "Finish with the bar over shoulders and hips."],
    cues: ["Squeeze glutes.", "Move head back then through.", "Keep wrists stacked."],
    mistakes: ["Turning it into a standing incline press.", "Leaning back hard.", "Pressing around the face instead of straight up."],
  },
  "machine shoulder press": {
    muscleGroup: "Shoulders",
    primaryMuscles: ["Shoulders", "Triceps"],
    steps: ["Set the seat so handles start near shoulder height.", "Press the handles overhead.", "Lower with control to the start."],
    cues: ["Keep back against the pad.", "Move both sides evenly.", "Do not lock out aggressively."],
    mistakes: ["Seat too low.", "Shrugging every rep.", "Letting the weight stack slam."],
  },
  "dumbbell lateral raise": {
    muscleGroup: "Shoulders",
    primaryMuscles: ["Side delts"],
    steps: ["Hold dumbbells at your sides with a slight elbow bend.", "Raise arms out to shoulder height.", "Lower slowly."],
    cues: ["Lead with elbows.", "Keep traps relaxed.", "Use light control."],
    mistakes: ["Swinging the weights.", "Raising far above shoulders.", "Shrugging."],
  },
  "cable lateral raise": {
    muscleGroup: "Shoulders",
    primaryMuscles: ["Side delts"],
    steps: ["Stand beside a low cable with the handle in the outside hand.", "Raise your arm out to the side.", "Lower slowly across the body."],
    cues: ["Keep tension smooth.", "Lead with elbow.", "Stay upright."],
    mistakes: ["Twisting the torso.", "Going too heavy.", "Shrugging at the top."],
  },
  "rear delt fly": {
    muscleGroup: "Upper Back",
    primaryMuscles: ["Rear delts", "Upper back"],
    steps: ["Hinge slightly or use a machine setup.", "Open the arms out to the sides.", "Return slowly with control."],
    cues: ["Use light weight.", "Keep shoulders down.", "Move from the rear delts."],
    mistakes: ["Swinging.", "Shrugging.", "Turning it into a row."],
  },
  "dumbbell curl": {
    muscleGroup: "Biceps",
    primaryMuscles: ["Biceps", "Forearms"],
    steps: ["Stand tall with dumbbells at your sides.", "Curl up without moving the elbows forward.", "Lower until arms are straight."],
    cues: ["Keep elbows close.", "Control the lower.", "Squeeze at the top."],
    mistakes: ["Swinging the torso.", "Half reps.", "Letting elbows drift far forward."],
  },
  "hammer curl": {
    muscleGroup: "Biceps",
    primaryMuscles: ["Biceps", "Brachialis", "Forearms"],
    steps: ["Hold dumbbells with palms facing each other.", "Curl while keeping the neutral grip.", "Lower with control."],
    cues: ["Wrists stay neutral.", "Elbows stay pinned.", "Use steady tempo."],
    mistakes: ["Swinging.", "Bending wrists.", "Rushing the lower."],
  },
  "ez bar curl": {
    muscleGroup: "Biceps",
    primaryMuscles: ["Biceps", "Forearms"],
    steps: ["Grip the EZ bar comfortably.", "Curl the bar up while elbows stay near your sides.", "Lower to full extension."],
    cues: ["Stand tall.", "Control the bottom.", "Keep shoulders quiet."],
    mistakes: ["Leaning back.", "Cutting the rep short.", "Letting elbows travel forward."],
  },
  "cable curl": {
    muscleGroup: "Biceps",
    primaryMuscles: ["Biceps"],
    steps: ["Stand facing a low cable.", "Curl the handle or bar toward your chest.", "Lower slowly while keeping tension."],
    cues: ["Keep elbows still.", "Use constant tension.", "Do not rush."],
    mistakes: ["Stepping too far back.", "Swinging.", "Letting shoulders take over."],
  },
  "preacher curl": {
    muscleGroup: "Biceps",
    primaryMuscles: ["Biceps"],
    steps: ["Set upper arms on the preacher pad.", "Curl the weight up under control.", "Lower until arms are nearly straight."],
    cues: ["Keep arms on the pad.", "Use a controlled stretch.", "Squeeze the top."],
    mistakes: ["Bouncing from the bottom.", "Lifting elbows off the pad.", "Going too heavy."],
  },
  "tricep pushdown": {
    muscleGroup: "Triceps",
    primaryMuscles: ["Triceps"],
    steps: ["Stand facing a high cable.", "Pin elbows by your sides.", "Push down until arms are straight, then return slowly."],
    cues: ["Only forearms move.", "Lock elbows gently.", "Keep shoulders down."],
    mistakes: ["Leaning over the cable.", "Letting elbows flare.", "Using momentum."],
  },
  "overhead cable extension": {
    muscleGroup: "Triceps",
    primaryMuscles: ["Triceps"],
    steps: ["Set the cable behind or below you.", "Keep elbows pointed forward or up.", "Extend the arms and control back to a stretch."],
    cues: ["Feel the long-head stretch.", "Keep elbows steady.", "Brace your ribs down."],
    mistakes: ["Flaring elbows wide.", "Arching the back.", "Rushing the stretch."],
  },
  "skull crushers": {
    muscleGroup: "Triceps",
    primaryMuscles: ["Triceps"],
    steps: ["Lie back with the weight above your shoulders.", "Bend elbows to lower toward forehead or behind head.", "Extend arms back to the start."],
    cues: ["Keep upper arms mostly still.", "Use smooth reps.", "Control the bottom."],
    mistakes: ["Letting elbows drift wide.", "Dropping too fast.", "Turning it into a press."],
  },
  "goblet squat": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes", "Core"],
    steps: ["Hold a dumbbell at your chest.", "Squat down between your hips.", "Drive through the floor to stand tall."],
    cues: ["Knees track over toes.", "Chest stays tall.", "Brace your core."],
    mistakes: ["Heels lifting.", "Knees caving in.", "Rounding forward."],
  },
  "back squat": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes", "Core"],
    steps: ["Set the bar securely on your upper back.", "Sit down and slightly back into a squat.", "Stand by driving through midfoot."],
    cues: ["Brace before each rep.", "Knees track with toes.", "Keep bar over midfoot."],
    mistakes: ["Relaxing at the bottom.", "Caving knees.", "Letting heels rise."],
  },
  "front squat": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Core", "Upper back"],
    steps: ["Hold the bar on the front of your shoulders.", "Squat down while keeping elbows high.", "Stand tall without letting the chest collapse."],
    cues: ["Elbows up.", "Brace hard.", "Stay upright."],
    mistakes: ["Dropping elbows.", "Rounding the upper back.", "Rocking onto toes."],
  },
  "hack squat": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes"],
    steps: ["Set feet on the platform and back against the pad.", "Lower until knees bend comfortably.", "Press through the platform to stand."],
    cues: ["Keep hips on the pad.", "Control depth.", "Drive through the whole foot."],
    mistakes: ["Locking knees hard.", "Letting heels lift.", "Cutting depth too short."],
  },
  "leg press": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes"],
    steps: ["Place feet on the platform about shoulder width.", "Lower the sled until knees bend comfortably.", "Press back up without locking knees hard."],
    cues: ["Keep lower back against the pad.", "Knees follow toes.", "Control the bottom."],
    mistakes: ["Going so deep hips tuck under.", "Locking out aggressively.", "Letting knees cave."],
  },
  "bulgarian split squat": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes", "Core"],
    steps: ["Place rear foot on a bench behind you.", "Lower straight down with the front foot planted.", "Drive through the front foot to stand."],
    cues: ["Start light.", "Keep front knee stable.", "Use a controlled range."],
    mistakes: ["Standing too close to the bench.", "Pushing mostly from the back leg.", "Losing balance by rushing."],
  },
  "walking lunges": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes", "Hamstrings"],
    steps: ["Step forward into a long, stable stance.", "Lower until both knees bend.", "Drive through the front foot and step into the next rep."],
    cues: ["Tall posture.", "Front knee tracks over toes.", "Smooth steps."],
    mistakes: ["Tiny unstable steps.", "Pushing off the back foot too much.", "Letting knees cave."],
  },
  "reverse lunge": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes", "Hamstrings"],
    steps: ["Step one foot back.", "Lower until the front leg does most of the work.", "Push through the front foot to return."],
    cues: ["Keep torso tall.", "Control the step back.", "Front foot stays planted."],
    mistakes: ["Launching off the back leg.", "Stepping too narrow.", "Rushing balance."],
  },
  "step up": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes"],
    steps: ["Place one foot fully on a stable box or bench.", "Drive through that foot to stand on the box.", "Step down slowly with control."],
    cues: ["Use a manageable height.", "Keep knee stable.", "Control the lowering."],
    mistakes: ["Pushing off the floor leg.", "Letting knee cave.", "Dropping down quickly."],
  },
  "bodyweight squat": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes", "Core"],
    steps: ["Stand with feet around shoulder width.", "Squat down by bending knees and hips.", "Stand tall by pressing through the floor."],
    cues: ["Chest proud.", "Knees follow toes.", "Use full comfortable depth."],
    mistakes: ["Heels lifting.", "Knees caving.", "Folding forward."],
  },
  "jump squat": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes", "Calves"],
    steps: ["Start in a squat stance.", "Dip into a controlled squat.", "Jump up and land softly back into the next rep."],
    cues: ["Land quiet.", "Absorb with knees and hips.", "Keep reps crisp."],
    mistakes: ["Landing stiff-legged.", "Letting knees cave.", "Turning it into sloppy cardio."],
  },
  "single leg squat progression": {
    muscleGroup: "Legs",
    primaryMuscles: ["Quads", "Glutes", "Core"],
    steps: ["Stand on one leg near support if needed.", "Lower slowly as far as you can control.", "Drive through the working foot to stand."],
    cues: ["Use assistance as needed.", "Keep knee tracking forward.", "Own the range."],
    mistakes: ["Dropping quickly.", "Twisting the knee inward.", "Forcing painful depth."],
  },
  "romanian deadlift": {
    muscleGroup: "Hamstrings",
    primaryMuscles: ["Hamstrings", "Glutes", "Lower back"],
    steps: ["Hold the weight in front of your thighs.", "Push hips back with a slight knee bend.", "Stand by squeezing glutes and driving hips forward."],
    cues: ["Keep weight close.", "Feel hamstrings stretch.", "Back stays flat."],
    mistakes: ["Squatting instead of hinging.", "Rounding the back.", "Letting weight drift away."],
  },
  "deadlift": {
    muscleGroup: "Full Body",
    primaryMuscles: ["Glutes", "Hamstrings", "Back", "Core"],
    steps: ["Set feet under the bar and grip just outside legs.", "Brace, pull slack out of the bar, and push the floor away.", "Stand tall, then lower with control."],
    cues: ["Bar stays close.", "Back stays braced.", "Hips and chest rise together."],
    mistakes: ["Yanking the bar.", "Rounding off the floor.", "Letting bar drift forward."],
  },
  "hip thrust": {
    muscleGroup: "Glutes",
    primaryMuscles: ["Glutes", "Hamstrings"],
    steps: ["Set upper back on a bench and feet planted.", "Drive hips up until body forms a straight line.", "Lower with control."],
    cues: ["Tuck ribs down.", "Pause and squeeze glutes.", "Shins near vertical at the top."],
    mistakes: ["Overarching the lower back.", "Feet too far away.", "Bouncing off the bottom."],
  },
  "glute bridge": {
    muscleGroup: "Glutes",
    primaryMuscles: ["Glutes", "Hamstrings"],
    steps: ["Lie on your back with feet planted.", "Drive hips up by squeezing glutes.", "Lower slowly to the floor."],
    cues: ["Ribs down.", "Push through heels.", "Pause at the top."],
    mistakes: ["Overarching back.", "Feet too far forward.", "Rushing reps."],
  },
  "leg curl": {
    muscleGroup: "Hamstrings",
    primaryMuscles: ["Hamstrings"],
    steps: ["Set the machine so the pad sits near your lower leg.", "Curl heels toward your body.", "Return slowly to the start."],
    cues: ["Keep hips down.", "Squeeze hamstrings.", "Control the stretch."],
    mistakes: ["Lifting hips.", "Letting the stack slam.", "Using momentum."],
  },
  "standing calf raise": {
    muscleGroup: "Calves",
    primaryMuscles: ["Calves"],
    steps: ["Stand with balls of feet on the platform.", "Rise as high as you can onto toes.", "Lower slowly into a stretch."],
    cues: ["Pause at the top.", "Use full range.", "Keep knees mostly straight."],
    mistakes: ["Bouncing.", "Tiny partial reps.", "Rolling ankles outward."],
  },
  "seated calf raise": {
    muscleGroup: "Calves",
    primaryMuscles: ["Calves"],
    steps: ["Sit with knees under the pad and balls of feet on the platform.", "Raise heels as high as possible.", "Lower slowly into a stretch."],
    cues: ["Pause at top and bottom.", "Control every rep.", "Keep feet stable."],
    mistakes: ["Bouncing.", "Too much weight for full range.", "Letting feet slide."],
  },
  "plank": {
    muscleGroup: "Core",
    primaryMuscles: ["Abs", "Obliques", "Glutes"],
    steps: ["Set elbows under shoulders.", "Step feet back into a straight line.", "Brace and hold without letting hips move."],
    cues: ["Squeeze glutes.", "Ribs down.", "Breathe while braced."],
    mistakes: ["Hips sagging.", "Butt too high.", "Holding breath."],
  },
  "side plank": {
    muscleGroup: "Core",
    primaryMuscles: ["Obliques", "Abs", "Glutes"],
    steps: ["Set elbow under shoulder on your side.", "Stack or stagger feet.", "Lift hips and hold a straight line."],
    cues: ["Push floor away.", "Hips forward.", "Stay long through the body."],
    mistakes: ["Shoulder collapsing.", "Hips drifting back.", "Neck tension."],
  },
  "dead bug": {
    muscleGroup: "Core",
    primaryMuscles: ["Abs", "Deep core"],
    steps: ["Lie on your back with knees and arms up.", "Brace so your low back stays near the floor.", "Slowly extend opposite arm and leg, then switch."],
    cues: ["Move slowly.", "Keep ribs down.", "Only go as far as you can control."],
    mistakes: ["Arching the back.", "Moving too fast.", "Holding breath."],
  },
  "hanging knee raise": {
    muscleGroup: "Core",
    primaryMuscles: ["Abs", "Hip flexors"],
    steps: ["Hang from a bar with shoulders active.", "Raise knees toward your chest.", "Lower without swinging."],
    cues: ["Control the bottom.", "Curl pelvis slightly.", "Keep legs quiet."],
    mistakes: ["Swinging.", "Only lifting thighs halfway.", "Shrugging hard."],
  },
  "hanging leg raise": {
    muscleGroup: "Core",
    primaryMuscles: ["Abs", "Hip flexors"],
    steps: ["Hang from a bar with active shoulders.", "Raise legs under control.", "Lower slowly without swinging."],
    cues: ["Start with knee raises if needed.", "Brace abs.", "Control the descent."],
    mistakes: ["Using momentum.", "Arching at the bottom.", "Losing grip control."],
  },
  "cable crunch": {
    muscleGroup: "Core",
    primaryMuscles: ["Abs"],
    steps: ["Kneel facing a high cable.", "Hold the rope near your head.", "Crunch ribs toward hips, then return slowly."],
    cues: ["Round through the abs.", "Keep hips mostly still.", "Exhale as you crunch."],
    mistakes: ["Pulling with arms.", "Sitting back into hips.", "Using too much weight."],
  },
  "ab wheel rollout": {
    muscleGroup: "Core",
    primaryMuscles: ["Abs", "Lats", "Shoulders"],
    steps: ["Start kneeling with the wheel under shoulders.", "Roll forward only as far as you can brace.", "Pull back using abs and lats."],
    cues: ["Ribs down.", "Squeeze glutes.", "Short range is fine."],
    mistakes: ["Letting lower back sag.", "Rolling too far too soon.", "Rushing back."],
  },
  "hollow hold": {
    muscleGroup: "Core",
    primaryMuscles: ["Abs", "Hip flexors"],
    steps: ["Lie on your back and press low back toward the floor.", "Lift shoulders and legs slightly.", "Hold while keeping your back flat."],
    cues: ["Scale by bending knees.", "Ribs down.", "Breathe shallow but steady."],
    mistakes: ["Low back arching.", "Holding too hard a version.", "Neck strain."],
  },
  "mountain climbers": {
    muscleGroup: "Core",
    primaryMuscles: ["Abs", "Shoulders", "Hip flexors"],
    steps: ["Start in a strong push-up position.", "Drive one knee toward the chest.", "Switch legs while keeping shoulders stable."],
    cues: ["Hands under shoulders.", "Keep hips level.", "Move with control."],
    mistakes: ["Bouncing hips high.", "Letting shoulders drift back.", "Sloppy fast reps."],
  },
  "leg raises": {
    muscleGroup: "Core",
    primaryMuscles: ["Abs", "Hip flexors"],
    steps: ["Lie on your back with legs straight or slightly bent.", "Raise legs until hips flex.", "Lower slowly without arching your back."],
    cues: ["Press low back down.", "Use a controlled range.", "Exhale as legs rise."],
    mistakes: ["Lower back lifting.", "Dropping legs quickly.", "Swinging."],
  },
  "v ups": {
    muscleGroup: "Core",
    primaryMuscles: ["Abs", "Hip flexors"],
    steps: ["Lie flat with arms overhead.", "Lift arms and legs toward each other.", "Lower under control."],
    cues: ["Move smoothly.", "Reach toward toes.", "Control the descent."],
    mistakes: ["Throwing momentum.", "Neck pulling.", "Crashing down."],
  },
  "doorway row": {
    muscleGroup: "Back",
    primaryMuscles: ["Upper back", "Lats", "Biceps"],
    steps: ["Hold a stable doorway or doorframe setup.", "Lean back with body straight.", "Pull chest toward your hands and lower slowly."],
    cues: ["Check stability first.", "Keep body straight.", "Pull elbows back."],
    mistakes: ["Using an unstable door.", "Sagging hips.", "Only bending arms halfway."],
  },
  "towel row": {
    muscleGroup: "Back",
    primaryMuscles: ["Upper back", "Lats", "Biceps"],
    steps: ["Anchor a towel securely.", "Lean back with arms straight.", "Row your chest toward the towel and lower slowly."],
    cues: ["Test the anchor.", "Body stays rigid.", "Squeeze shoulder blades."],
    mistakes: ["Unsafe anchor.", "Jerking reps.", "Shrugging."],
  },
  "backpack row": {
    muscleGroup: "Back",
    primaryMuscles: ["Lats", "Upper back", "Biceps"],
    steps: ["Hold a loaded backpack with a hinged torso.", "Row it toward your ribs.", "Lower slowly with a flat back."],
    cues: ["Keep load secure.", "Brace your trunk.", "Pull elbows back."],
    mistakes: ["Rounding back.", "Swinging the bag.", "Standing up each rep."],
  },
  "resistance band row": {
    muscleGroup: "Back",
    primaryMuscles: ["Upper back", "Lats", "Biceps"],
    steps: ["Anchor the band securely in front of you.", "Pull handles toward your ribs.", "Return slowly with tension."],
    cues: ["Squeeze shoulder blades.", "Keep chest tall.", "Control the band back."],
    mistakes: ["Unsafe anchor.", "Letting band snap back.", "Shrugging."],
  },
  "resistance band pulldown": {
    muscleGroup: "Back",
    primaryMuscles: ["Lats", "Upper back"],
    steps: ["Anchor the band overhead.", "Pull elbows down toward your ribs.", "Return slowly until arms are long."],
    cues: ["Drive elbows down.", "Keep ribs down.", "Use smooth tension."],
    mistakes: ["Pulling with only hands.", "Leaning back too much.", "Letting band snap."],
  },
  "pike push up": {
    muscleGroup: "Shoulders",
    primaryMuscles: ["Shoulders", "Triceps", "Upper chest"],
    steps: ["Start in a pike position with hips high.", "Lower head toward the floor between hands.", "Press back up while keeping hips high."],
    cues: ["Think overhead press.", "Elbows angle back.", "Use controlled depth."],
    mistakes: ["Turning it into a regular push-up.", "Flaring elbows wide.", "Dropping onto the head."],
  },
  "handstand push up progression": {
    muscleGroup: "Shoulders",
    primaryMuscles: ["Shoulders", "Triceps", "Core"],
    steps: ["Use a wall or elevated pike setup appropriate to your level.", "Lower under control.", "Press back up while keeping your body tight."],
    cues: ["Master pike push-ups first.", "Brace hard.", "Use a safe range."],
    mistakes: ["Rushing to full handstand reps.", "Crashing into the bottom.", "Arching hard."],
  },
  "jog": {
    muscleGroup: "Cardio",
    primaryMuscles: ["Heart and lungs", "Legs"],
    steps: ["Start at an easy pace you can sustain.", "Keep strides relaxed and posture tall.", "Finish at the assigned time without sprinting early."],
    cues: ["Breathe steadily.", "Land quietly.", "Stay conversational for easy jogs."],
    mistakes: ["Starting too fast.", "Overstriding.", "Turning every jog into a race."],
  },
}

const categoryDefaults: Record<string, GuideTemplate> = {
  chest: guides["bench press"],
  push: guides["push up"],
  back: guides["seated cable row"],
  pull: guides["seated cable row"],
  shoulders: guides["dumbbell shoulder press"],
  biceps: guides["dumbbell curl"],
  triceps: guides["tricep pushdown"],
  quads: guides["goblet squat"],
  legs: guides["bodyweight squat"],
  "hamstrings and glutes": guides["romanian deadlift"],
  hamstrings: guides["romanian deadlift"],
  glutes: guides["glute bridge"],
  calves: guides["standing calf raise"],
  core: guides["plank"],
  cardio: guides["jog"],
}

function findTemplate(name: string, category: string): GuideTemplate {
  const normalized = normalizeName(name)
  const alias = aliases[normalized] ?? normalized
  if (guides[alias]) return guides[alias]

  const singular = alias.endsWith("s") ? alias.slice(0, -1) : alias
  if (guides[singular]) return guides[singular]

  if (alias.includes("push up")) return guides["push up"]
  if (alias.includes("pull up")) return guides["pull up"]
  if (alias.includes("row")) return guides["seated cable row"]
  if (alias.includes("curl")) return guides["dumbbell curl"]
  if (alias.includes("squat")) return guides["goblet squat"]
  if (alias.includes("lunge")) return guides["walking lunges"]
  if (alias.includes("calf")) return guides["standing calf raise"]
  if (alias.includes("deadlift")) return guides["romanian deadlift"]
  if (alias.includes("press")) return guides["dumbbell shoulder press"]
  if (alias.includes("plank")) return guides["plank"]
  if (alias.includes("raise")) return guides["leg raises"]

  const categoryKey = normalizeName(category)
  return categoryDefaults[categoryKey] ?? {
    muscleGroup: category || "Exercise",
    primaryMuscles: [category || "Target muscles"],
    steps: ["Set up in a stable position before starting.", "Move through a controlled range of motion.", "Return to the start position without rushing."],
    cues: ["Stay braced.", "Use controlled reps.", "Stop if the movement causes sharp pain."],
    mistakes: ["Rushing the movement.", "Using momentum instead of control.", "Letting form change as you get tired."],
  }
}

export function getExerciseGuide(exercise: GuideInput): ExerciseGuide {
  const template = findTemplate(exercise.name, exercise.category)
  return {
    name: exercise.name,
    category: exercise.category,
    equipment: exercise.equipment,
    ...template,
  }
}
