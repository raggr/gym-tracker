const ROUTINES = {
  day1: {
    name: "Chest, shoulders, triceps + goblet squat",
    exercises: [
      exercise("dumbbell_chest_press", "Dumbbell chest press", "3 × 6–10", 3, 6, 10, 2.5, "kg each", "Feet planted; shoulder blades gently back/down; elbows roughly 30–60° from torso; lower under control."),
      exercise("dumbbell_shoulder_press", "Dumbbell shoulder press", "3 × 8–12", 3, 8, 12, 2.5, "kg each", "Use a backrest if available; avoid excessive lower-back arching; press smoothly overhead."),
      exercise("incline_dumbbell_press", "Incline dumbbell press", "3 × 8–12", 3, 8, 12, 2.5, "kg each", "Bench around 30°; keep shoulders set; control the lowering phase."),
      exercise("cable_triceps_pushdown", "Cable triceps pushdown", "2 × 10–15", 2, 10, 15, 5, "machine setting", "Keep elbows close to your sides and mostly still; move at the elbow rather than swinging your torso."),
      exercise("goblet_squat", "Goblet squat", "3 × 8–10", 3, 8, 10, 2.5, "kg total", "Hold weight at chest; knees track over feet; keep heels down; only use a depth your ankle tolerates comfortably.")
    ]
  },
  day2: {
    name: "Back, biceps + posterior chain",
    exercises: [
      exercise("one_arm_dumbbell_row", "One-arm dumbbell row", "3 × 8–12 each side", 3, 8, 12, 2.5, "kg each", "Pull elbow toward hip/lower ribs; avoid rotating or jerking your torso."),
      exercise("lat_pulldown", "Lat pulldown", "3 × 8–12", 3, 8, 12, 5, "machine setting", "Pull to upper chest with a slight lean; drive elbows down; do not pull behind your neck."),
      exercise("romanian_deadlift", "Romanian deadlift", "3 × 8–10", 3, 8, 10, 2.5, "kg total", "Soft knees, push hips back, keep weight close to legs, stop when hamstrings are strongly stretched; do not turn it into a squat."),
      exercise("dumbbell_biceps_curl", "Dumbbell biceps curl", "2–3 × 8–12", 3, 8, 12, 2.5, "kg each", "Keep elbows near torso; no body swing; lower slowly."),
      exercise("plank", "Plank", "2–3 × 20–45 sec", 3, 20, 45, 5, "optional kg", "Keep ribs and pelvis controlled; avoid letting hips sag.", true)
    ]
  },
  day3: {
    name: "Legs + full body",
    exercises: [
      exercise("goblet_squat", "Goblet squat", "3 × 6–10", 3, 6, 10, 2.5, "kg total", "Controlled descent; knees track naturally; choose ankle-comfortable depth."),
      exercise("reverse_lunge", "Reverse lunge", "2 × 8–10 each leg", 2, 8, 10, 2.5, "kg total", "Step back far enough to stay balanced; front knee tracks over foot; move slowly."),
      exercise("romanian_deadlift", "Romanian deadlift", "3 × 8–10", 3, 8, 10, 2.5, "kg total", "Hinge at hips; keep the load close; neutral spine; stand tall without leaning back."),
      exercise("dumbbell_chest_press", "Dumbbell chest press", "3 × 8–12", 3, 8, 12, 2.5, "kg each", "Controlled reps; keep shoulder blades gently set and feet planted.")
    ],
    alternatives: [
      exercise("one_arm_dumbbell_row", "One-arm dumbbell row", "3 × 8–12 each side", 3, 8, 12, 2.5, "kg each", "Pull elbow toward hip/lower ribs; avoid rotating or jerking your torso."),
      exercise("lat_pulldown", "Lat pulldown", "3 × 8–12", 3, 8, 12, 5, "machine setting", "Pull to upper chest with a slight lean; drive elbows down; do not pull behind your neck.")
    ]
  }
};

const LEGACY_DAY3 = {
  ...exercise("legacy_row_or_pulldown", "Row or lat pulldown", "3 × 8–12", 3, 8, 12, 2.5, "recorded load", "This historical entry did not identify which movement was used."),
  legacy: true
};
const DAY_KEYS = ["day1", "day2", "day3"];
const DB_NAME = "GymTrackerDB";
const DB_VERSION = 3;
const STORES = {
  workouts: "workouts",
  body: "bodyMetrics",
  drafts: "drafts",
  preferences: "preferences"
};
const EFFORT_OPTIONS = ["", "Easy", "About right", "Hard", "Max effort"];

let db;
let isNewDatabase = false;
let activeWorkoutDay = "day1";
let activeProgressDay = "day1";
let activeProgressExerciseId = "dumbbell_chest_press";
let draftCache = new Map();
let preferenceCache = new Map();
let editingWorkout = null;
let timerInterval = null;

function exercise(id, name, target, sets, min, max, increment, loadLabel, tip, timed = false) {
  return { id, name, target, sets, min, max, increment, loadLabel, tip, timed };
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function fmt(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function todayISO() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function isISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function displayDate(value) {
  if (!isISODate(value)) return value || "Unknown date";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function friendlyDay(day) {
  return day === "day1" ? "Day 1" : day === "day2" ? "Day 2" : "Day 3";
}

function orderKey(record) {
  return `${record?.date || ""}|${record?.createdAt || ""}`;
}

function chronological(a, b) {
  return orderKey(a).localeCompare(orderKey(b));
}

function signed(value, unit) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${fmt(Math.abs(value))} ${unit}`;
}

function definitionKey(day, definition) {
  return `${day}:${definition.id}`;
}

function preferenceKey(kind, day, definition) {
  return `${kind}:${definitionKey(day, definition)}`;
}

function allDefinitions(day) {
  const routine = ROUTINES[day];
  return [...routine.exercises, ...(routine.alternatives || [])];
}

function definitionById(day, id) {
  if (id === LEGACY_DAY3.id && day === "day3") return LEGACY_DAY3;
  return allDefinitions(day).find(definition => definition.id === id) || null;
}

function definitionByName(day, name) {
  if (day === "day3" && name === LEGACY_DAY3.name) return LEGACY_DAY3;
  return allDefinitions(day).find(definition => definition.name === name) || null;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const database = event.target.result;
      isNewDatabase = event.oldVersion === 0;
      if (!database.objectStoreNames.contains(STORES.workouts)) {
        database.createObjectStore(STORES.workouts, { keyPath: "id", autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(STORES.body)) {
        database.createObjectStore(STORES.body, { keyPath: "id", autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(STORES.drafts)) {
        database.createObjectStore(STORES.drafts, { keyPath: "day" });
      }
      if (!database.objectStoreNames.contains(STORES.preferences)) {
        database.createObjectStore(STORES.preferences, { keyPath: "key" });
      }
    };
    request.onsuccess = event => {
      db = event.target.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function getOne(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function addOne(storeName, value) {
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).add(value);
  await transactionDone(transaction);
}

async function putOne(storeName, value) {
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value);
  await transactionDone(transaction);
}

async function deleteOne(storeName, key) {
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
}

async function loadLocalState() {
  const [drafts, preferences] = await Promise.all([getAll(STORES.drafts), getAll(STORES.preferences)]);
  draftCache = new Map(drafts.map(draft => [draft.day, draft]));
  preferenceCache = new Map(preferences.map(preference => [preference.key, preference.value]));
}

function getPreference(key, fallback = null) {
  return preferenceCache.has(key) ? preferenceCache.get(key) : fallback;
}

async function setPreference(key, value) {
  preferenceCache.set(key, value);
  await putOne(STORES.preferences, { key, value });
}

async function removePreference(key) {
  preferenceCache.delete(key);
  await deleteOne(STORES.preferences, key);
}

function selectedDay3Variant() {
  return getPreference("variant:day3", ROUTINES.day3.alternatives[0].id);
}

function newExerciseDraft(definition) {
  return {
    sets: Array.from({ length: definition.sets }, (_, index) => ({ set: index + 1, reps: null, weight: null, done: false })),
    sessionNote: "",
    effort: ""
  };
}

function newDraft(day) {
  return {
    day,
    date: todayISO(),
    variantId: day === "day3" ? selectedDay3Variant() : null,
    exercises: {},
    updatedAt: new Date().toISOString()
  };
}

function ensureDraft(day) {
  if (!draftCache.has(day)) draftCache.set(day, newDraft(day));
  return draftCache.get(day);
}

function ensureExerciseDraft(draft, definition) {
  if (!draft.exercises || typeof draft.exercises !== "object") draft.exercises = {};
  if (!draft.exercises[definition.id]) draft.exercises[definition.id] = newExerciseDraft(definition);
  const state = draft.exercises[definition.id];
  if (!Array.isArray(state.sets)) state.sets = [];
  while (state.sets.length < definition.sets) {
    state.sets.push({ set: state.sets.length + 1, reps: null, weight: null, done: false });
  }
  state.sets = state.sets.slice(0, definition.sets).map((set, index) => ({
    set: index + 1,
    reps: set?.reps ?? null,
    weight: set?.weight ?? null,
    done: set?.done === true
  }));
  if (typeof state.sessionNote !== "string") state.sessionNote = "";
  if (typeof state.effort !== "string") state.effort = "";
  return state;
}

function exerciseDraftHasContent(state) {
  return Boolean(
    state &&
    ((state.sessionNote || "").trim() ||
      state.effort ||
      (state.sets || []).some(set => set.done || set.reps !== null || set.weight !== null))
  );
}

function draftHasContent(draft) {
  if (!draft) return false;
  if (draft.date && draft.date !== todayISO()) return true;
  return Object.values(draft.exercises || {}).some(exerciseDraftHasContent);
}

async function persistDraft(day) {
  const draft = draftCache.get(day);
  if (!draft || !draftHasContent(draft)) {
    draftCache.delete(day);
    await deleteOne(STORES.drafts, day);
    return;
  }
  draft.updatedAt = new Date().toISOString();
  await putOne(STORES.drafts, structuredClone(draft));
}

async function discardDraft(day, ask = true) {
  if (ask && !confirm(`Discard the unfinished ${friendlyDay(day)} workout?`)) return;
  draftCache.delete(day);
  await deleteOne(STORES.drafts, day);
  if (activeWorkoutDay === day) draftCache.set(day, newDraft(day));
  await renderWorkoutSection(false);
  setStatus("workoutStatus", "Draft discarded.");
}

function latestWorkout(workouts) {
  return [...workouts].filter(workout => DAY_KEYS.includes(workout.day)).sort((a, b) => chronological(b, a))[0] || null;
}

function nextWorkoutRecommendation(workouts) {
  const latest = latestWorkout(workouts);
  if (!latest) return { day: "day1", latest: null };
  return { day: DAY_KEYS[(DAY_KEYS.indexOf(latest.day) + 1) % DAY_KEYS.length], latest };
}

function relevantWorkingSets(exerciseRecord, definition) {
  if (!exerciseRecord || !Array.isArray(exerciseRecord.sets)) return [];
  let sets = exerciseRecord.sets.filter(set =>
    set &&
    set.completed !== false &&
    set.reps !== null &&
    set.reps !== undefined &&
    Number.isFinite(Number(set.reps)) &&
    Number(set.reps) >= 0
  );
  if (sets.length > definition.sets) sets = sets.slice(-definition.sets);
  return sets;
}

function sessionStats(exerciseRecord, definition) {
  const sets = relevantWorkingSets(exerciseRecord, definition);
  const weighted = sets.filter(set => set.weight !== null && set.weight !== undefined && Number.isFinite(Number(set.weight)));
  const maxWeight = weighted.length ? Math.max(...weighted.map(set => Number(set.weight))) : null;
  const maxRepsAtMaxWeight = maxWeight === null
    ? null
    : Math.max(...weighted.filter(set => Number(set.weight) === maxWeight).map(set => Number(set.reps || 0)));
  const maxTimed = definition.timed && sets.length ? Math.max(...sets.map(set => Number(set.reps))) : null;
  const volume = weighted.reduce((sum, set) => sum + Number(set.weight) * Number(set.reps || 0), 0);
  return { sets, maxWeight, maxRepsAtMaxWeight, maxTimed, volume };
}

function findLastExercise(workouts, day, name) {
  const ordered = workouts.filter(workout => workout.day === day).sort((a, b) => chronological(b, a));
  for (const workout of ordered) {
    const found = (workout.exercises || []).find(item => item.name === name);
    if (found) return { workout, exercise: found };
  }
  return null;
}

function targetFromLast(definition, last) {
  if (!last) {
    return {
      headline: "Establish a baseline",
      detail: `Choose a load that lets you complete ${definition.target} with clean technique and about 2–3 reps in reserve.`,
      prescription: { type: "baseline", target: definition.target }
    };
  }
  const stats = sessionStats(last.exercise, definition);
  if (!stats.sets.length) {
    return {
      headline: "Repeat and establish a baseline",
      detail: `No completed working sets were available from ${displayDate(last.workout.date)}.`,
      prescription: { type: "baseline", target: definition.target }
    };
  }
  if (definition.timed) {
    const durations = stats.sets.map(set => Number(set.reps));
    const allTop = durations.length >= definition.sets && durations.slice(-definition.sets).every(value => value >= definition.max);
    if (allTop) {
      return {
        headline: "Progress the plank",
        detail: `All ${definition.sets} completed sets reached ${definition.max} seconds. Try a harder variation or add about ${definition.increment} seconds per set.`,
        prescription: { type: "time", seconds: definition.max + definition.increment, sets: definition.sets }
      };
    }
    const desired = durations.map(value => Math.min(definition.max, value + 5));
    while (desired.length < definition.sets) desired.push(definition.min);
    return {
      headline: "Add a little time",
      detail: `Completed last time: ${durations.join(" / ")} seconds. Aim for ${desired.slice(0, definition.sets).join(" / ")} seconds.`,
      prescription: { type: "time", seconds: desired.slice(0, definition.sets), sets: definition.sets }
    };
  }
  const weighted = stats.sets.filter(set => set.weight !== null && set.weight !== undefined);
  if (!weighted.length) {
    return {
      headline: "Repeat and record the load",
      detail: `The last completed sets did not include a ${definition.loadLabel} value.`,
      prescription: { type: "load", weight: null, unit: definition.loadLabel, reps: definition.min }
    };
  }
  const workingWeight = Math.max(...weighted.map(set => Number(set.weight)));
  const atWorkingWeight = weighted.filter(set => Number(set.weight) === workingWeight).slice(-definition.sets);
  const reps = atWorkingWeight.map(set => Number(set.reps));
  const allTop = atWorkingWeight.length >= definition.sets && reps.every(value => value >= definition.max);
  if (allTop) {
    const nextWeight = workingWeight + definition.increment;
    return {
      headline: `Increase to ${fmt(nextWeight)} ${definition.loadLabel}`,
      detail: `All ${definition.sets} completed sets reached the top of the range at ${fmt(workingWeight)} ${definition.loadLabel}. Start near ${definition.min} reps.`,
      prescription: { type: "load", weight: nextWeight, unit: definition.loadLabel, reps: definition.min, sets: definition.sets }
    };
  }
  const desired = [...reps];
  const firstBelowTop = desired.findIndex(value => value < definition.max);
  if (firstBelowTop >= 0) desired[firstBelowTop] += 1;
  while (desired.length < definition.sets) desired.push(definition.min);
  return {
    headline: `Keep ${fmt(workingWeight)} ${definition.loadLabel}`,
    detail: `Only completed sets at the current working load count. Last: ${reps.join(" / ") || "—"} reps; next: about ${desired.slice(0, definition.sets).join(" / ")}.`,
    prescription: { type: "load", weight: workingWeight, unit: definition.loadLabel, reps: desired.slice(0, definition.sets), sets: definition.sets }
  };
}

function setColumns(exerciseRecord, definition) {
  const sets = relevantWorkingSets(exerciseRecord, definition);
  return {
    reps: sets.length ? sets.map(set => fmt(set.reps)).join(" / ") : "—",
    weights: sets.length ? sets.map(set => set.weight === null || set.weight === undefined ? "—" : fmt(set.weight)).join(" / ") : "—"
  };
}

function dayPickerHTML(active) {
  return DAY_KEYS.map(day =>
    `<button type="button" data-day="${day}" class="${day === active ? "active" : ""}" aria-pressed="${day === active}">${friendlyDay(day)}</button>`
  ).join("");
}

function setStatus(id, message, error = false) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", error);
}

function chosenDefinitions(day, draft) {
  const routine = ROUTINES[day];
  if (!routine.alternatives) return [...routine.exercises];
  const variantId = draft.variantId || selectedDay3Variant();
  const selected = routine.alternatives.find(item => item.id === variantId) || routine.alternatives[0];
  return [...routine.exercises, selected];
}

function definitionsWithDraftContent(day, draft) {
  const definitions = chosenDefinitions(day, draft);
  for (const definition of allDefinitions(day)) {
    if (!definitions.some(item => item.id === definition.id) && exerciseDraftHasContent(draft.exercises?.[definition.id])) {
      definitions.push(definition);
    }
  }
  return definitions;
}

function timerSettings(day, definition) {
  return getPreference(preferenceKey("timer", day, definition), { enabled: false, duration: 90 });
}

function setupNote(day, definition) {
  return getPreference(preferenceKey("setup", day, definition), "");
}

function heldTarget(day, definition) {
  return getPreference(preferenceKey("hold", day, definition), null);
}

async function renderWorkoutSection(selectRecommended = false) {
  document.getElementById("finishReview").innerHTML = "";
  setStatus("workoutStatus", "");
  const workouts = await getAll(STORES.workouts);
  const recommendation = nextWorkoutRecommendation(workouts);
  if (selectRecommended) activeWorkoutDay = recommendation.day;
  const latestText = recommendation.latest
    ? `${friendlyDay(recommendation.latest.day)} on ${displayDate(recommendation.latest.date)}`
    : "No workouts saved yet";
  document.getElementById("upNext").innerHTML = `
    <div class="up-next">
      <div class="up-next-label">Up next</div>
      <div class="up-next-title">${friendlyDay(recommendation.day)} · ${esc(ROUTINES[recommendation.day].name)}</div>
      <div class="up-next-last">Most recently completed: ${esc(latestText)}</div>
      <button class="btn primary" id="startRecommended" type="button">Start ${friendlyDay(recommendation.day)}</button>
    </div>`;
  document.getElementById("workoutDayPicker").innerHTML = dayPickerHTML(activeWorkoutDay);
  document.getElementById("startRecommended").addEventListener("click", async () => {
    await persistDraft(activeWorkoutDay);
    activeWorkoutDay = recommendation.day;
    await renderWorkoutSection(false);
    document.getElementById("workoutDay").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("workoutDayPicker").querySelectorAll("button").forEach(button => {
    button.addEventListener("click", async () => {
      await persistDraft(activeWorkoutDay);
      activeWorkoutDay = button.dataset.day;
      await renderWorkoutSection(false);
    });
  });
  renderDraftPrompt();
  renderWorkoutDay(workouts);
  renderTimer();
}

function renderDraftPrompt() {
  const drafts = [...draftCache.values()].filter(draftHasContent).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const box = document.getElementById("draftPrompt");
  if (!drafts.length) {
    box.innerHTML = "";
    return;
  }
  const draft = drafts[0];
  const completed = Object.values(draft.exercises || {}).flatMap(state => state.sets || []).filter(set => set.done).length;
  box.innerHTML = `
    <div class="draft-banner">
      <div><strong>Unfinished ${friendlyDay(draft.day)}</strong><div class="small">${esc(displayDate(draft.date))} · ${completed} completed set${completed === 1 ? "" : "s"} saved locally</div></div>
      <div class="draft-actions">
        <button type="button" class="btn primary compact" id="resumeDraft">Resume</button>
        <button type="button" class="btn danger compact" id="discardDraft">Discard</button>
      </div>
    </div>`;
  document.getElementById("resumeDraft").addEventListener("click", async () => {
    activeWorkoutDay = draft.day;
    switchTab("workout");
    await renderWorkoutSection(false);
    document.getElementById("workoutDay").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("discardDraft").addEventListener("click", () => discardDraft(draft.day));
}

function renderWorkoutDay(workouts) {
  const day = activeWorkoutDay;
  const routine = ROUTINES[day];
  const draft = ensureDraft(day);
  if (!isISODate(draft.date)) draft.date = todayISO();
  if (day === "day3" && !routine.alternatives.some(item => item.id === draft.variantId)) {
    draft.variantId = selectedDay3Variant();
  }
  const definitions = chosenDefinitions(day, draft);
  const variantHTML = routine.alternatives ? `
    <div class="meta" style="margin-top:11px">Choose the pulling movement for this session. Switching keeps every entered value.</div>
    <div class="variant-picker" id="variantPicker">
      ${routine.alternatives.map(definition => `<button type="button" data-variant="${definition.id}" class="${definition.id === draft.variantId ? "active" : ""}" aria-pressed="${definition.id === draft.variantId}">${esc(definition.name)}</button>`).join("")}
    </div>
  ` : "";
  document.getElementById("workoutDay").innerHTML = `
    <div class="card">
      <div class="section-title">${friendlyDay(day)} · ${esc(routine.name)}</div>
      <div style="margin-top:10px">
        <label for="workoutDate">Workout date</label>
        <input type="date" id="workoutDate" value="${esc(draft.date)}">
      </div>
      ${variantHTML}
    </div>
    ${definitions.map(definition => renderExerciseCard(day, definition, draft, workouts)).join("")}
    <div class="actions">
      <button type="button" class="btn primary" id="finishWorkoutBtn">Finish workout</button>
      <button type="button" class="btn secondary" id="fillLastBtn">Fill from last</button>
      <button type="button" class="btn danger" id="discardCurrentBtn">Discard draft</button>
    </div>
  `;
  wireWorkoutControls(day, definitions, workouts);
}

function renderExerciseCard(day, definition, draft, workouts) {
  const state = ensureExerciseDraft(draft, definition);
  const last = findLastExercise(workouts, day, definition.name);
  const automaticTarget = targetFromLast(definition, last);
  const held = heldTarget(day, definition);
  const target = held || automaticTarget;
  const previousSets = last ? relevantWorkingSets(last.exercise, definition) : [];
  const setup = setupNote(day, definition);
  const timer = timerSettings(day, definition);
  const rows = state.sets.map((set, index) => {
    const previous = previousSets[index] || null;
    const previousReps = previous ? `Last: <strong>${fmt(previous.reps)}</strong>${definition.timed ? " sec" : " reps"}` : "No previous set";
    const previousLoad = previous && previous.weight !== null && previous.weight !== undefined
      ? `Last: <strong>${fmt(previous.weight)}</strong> ${esc(definition.loadLabel)}`
      : "No previous load";
    return `
      <div class="set-row ${set.done ? "completed" : ""}" data-set-row="${index}">
        <div class="set-number">${index + 1}</div>
        <div class="input-wrap">
          <input type="number" min="0" max="500" step="1" inputmode="numeric" data-draft-field="reps" data-exercise="${definition.id}" data-set="${index}" value="${set.reps ?? ""}" aria-label="${esc(definition.name)} set ${index + 1} ${definition.timed ? "seconds" : "reps"}" placeholder="${definition.timed ? "sec" : "reps"}">
          <div class="previous">${previousReps}</div>
        </div>
        <div class="input-wrap">
          <div class="input-shell has-unit">
            <input type="number" min="0" max="1000" step="0.25" inputmode="decimal" data-draft-field="weight" data-exercise="${definition.id}" data-set="${index}" value="${set.weight ?? ""}" aria-label="${esc(definition.name)} set ${index + 1} ${esc(definition.loadLabel)}" placeholder="load">
            <span class="unit">${esc(definition.loadLabel)}</span>
          </div>
          <div class="previous">${previousLoad}</div>
        </div>
        <div class="done-cell">
          <button type="button" class="done-btn" data-done-exercise="${definition.id}" data-done-set="${index}">${set.done ? "Undo" : "Done"}</button>
          <div class="complete-label">${set.done ? "✓ Completed" : "Not done"}</div>
        </div>
      </div>
    `;
  }).join("");
  return `
    <article class="card exercise-card" data-exercise-card="${definition.id}">
      <div class="exercise-head">
        <div class="exercise-context">
          <div><div class="exercise-title">${esc(definition.name)}</div><div class="meta">Target: ${esc(definition.target)} · ${esc(definition.loadLabel)}</div></div>
        </div>
      </div>
      <div class="targetbox ${held ? "held" : ""}">
        <div class="target-title"><span>${held ? "Held target" : "Automatic target"}</span><button type="button" class="link-button" data-target-action="${held ? "release" : "hold"}" data-exercise="${definition.id}">${held ? "Use automatic" : "Keep this target"}</button></div>
        <strong>${esc(target.headline)}</strong>
        <div class="target-detail">${esc(target.detail)}</div>
      </div>
      <div class="sets">
        <div class="set-head"><div>Set</div><div>${definition.timed ? "Seconds" : "Reps"}</div><div>Load</div><div>Status</div></div>
        ${rows}
      </div>
      <div class="exercise-extras">
        <details>
          <summary>Technique, notes and timer</summary>
          <div class="technique">${esc(definition.tip)}</div>
          <div class="notes-grid">
            <div>
              <label for="setup-${definitionKey(day, definition)}">Reusable setup note</label>
              <textarea id="setup-${definitionKey(day, definition)}" data-setup-note="${definition.id}" maxlength="1000" placeholder="Seat, bench, attachment or machine">${esc(setup)}</textarea>
            </div>
            <div>
              <label for="session-${definitionKey(day, definition)}">This session</label>
              <textarea id="session-${definitionKey(day, definition)}" data-session-note="${definition.id}" maxlength="1000" placeholder="Optional session note">${esc(state.sessionNote)}</textarea>
            </div>
          </div>
          <div class="effort-row">
            <label for="effort-${definitionKey(day, definition)}">How did the final completed set feel?</label>
            <select id="effort-${definitionKey(day, definition)}" data-effort="${definition.id}">
              ${EFFORT_OPTIONS.map(option => `<option value="${esc(option)}" ${option === state.effort ? "selected" : ""}>${esc(option || "Not recorded")}</option>`).join("")}
            </select>
            <div class="small">Effort is recorded for context only and does not change targets.</div>
          </div>
          <div class="timer-settings">
            <label class="check-label"><input type="checkbox" data-timer-enabled="${definition.id}" ${timer.enabled ? "checked" : ""}> Start rest timer after Done</label>
            <div><label for="timer-${definitionKey(day, definition)}">Rest seconds</label><input id="timer-${definitionKey(day, definition)}" type="number" min="15" max="1800" step="15" data-timer-duration="${definition.id}" value="${timer.duration}"></div>
          </div>
          <div class="small">The remaining time restores when you return to the app. Locked-screen alerts are not enabled.</div>
        </details>
      </div>
    </article>
  `;
}

function wireWorkoutControls(day, definitions, workouts) {
  const draft = ensureDraft(day);
  document.getElementById("workoutDate").addEventListener("change", async event => {
    draft.date = event.target.value;
    await persistDraft(day);
  });
  document.querySelectorAll("[data-draft-field]").forEach(input => {
    input.addEventListener("input", async event => {
      const definition = definitionById(day, event.target.dataset.exercise);
      const state = ensureExerciseDraft(draft, definition);
      const set = state.sets[Number(event.target.dataset.set)];
      set[event.target.dataset.draftField] = event.target.value === "" ? null : Number(event.target.value);
      if (set.done) set.done = false;
      updateSetRow(event.target.closest(".set-row"), false);
      document.getElementById("finishReview").innerHTML = "";
      await persistDraft(day);
    });
  });
  document.querySelectorAll("[data-done-exercise]").forEach(button => {
    button.addEventListener("click", () => toggleSetDone(day, button.dataset.doneExercise, Number(button.dataset.doneSet), button.closest(".set-row")));
  });
  document.querySelectorAll("[data-session-note]").forEach(input => {
    input.addEventListener("input", async event => {
      const definition = definitionById(day, event.target.dataset.sessionNote);
      ensureExerciseDraft(draft, definition).sessionNote = event.target.value;
      await persistDraft(day);
    });
  });
  document.querySelectorAll("[data-effort]").forEach(select => {
    select.addEventListener("change", async event => {
      const definition = definitionById(day, event.target.dataset.effort);
      ensureExerciseDraft(draft, definition).effort = event.target.value;
      await persistDraft(day);
    });
  });
  document.querySelectorAll("[data-setup-note]").forEach(input => {
    input.addEventListener("input", event => {
      const definition = definitionById(day, event.target.dataset.setupNote);
      void setPreference(preferenceKey("setup", day, definition), event.target.value);
    });
  });
  document.querySelectorAll("[data-target-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const definition = definitionById(day, button.dataset.exercise);
      const key = preferenceKey("hold", day, definition);
      if (button.dataset.targetAction === "release") {
        await removePreference(key);
      } else {
        const automatic = targetFromLast(definition, findLastExercise(workouts, day, definition.name));
        await setPreference(key, { ...automatic, heldAt: new Date().toISOString() });
      }
      await renderWorkoutSection(false);
    });
  });
  document.querySelectorAll("[data-timer-enabled]").forEach(input => {
    input.addEventListener("change", async event => {
      const definition = definitionById(day, event.target.dataset.timerEnabled);
      const current = timerSettings(day, definition);
      await setPreference(preferenceKey("timer", day, definition), { ...current, enabled: event.target.checked });
    });
  });
  document.querySelectorAll("[data-timer-duration]").forEach(input => {
    input.addEventListener("change", async event => {
      const definition = definitionById(day, event.target.dataset.timerDuration);
      const duration = Math.min(1800, Math.max(15, Number(event.target.value) || 90));
      event.target.value = duration;
      const current = timerSettings(day, definition);
      await setPreference(preferenceKey("timer", day, definition), { ...current, duration });
    });
  });
  if (document.getElementById("variantPicker")) {
    document.getElementById("variantPicker").querySelectorAll("button").forEach(button => {
      button.addEventListener("click", async () => {
        draft.variantId = button.dataset.variant;
        await Promise.all([
          persistDraft(day),
          setPreference("variant:day3", button.dataset.variant)
        ]);
        renderWorkoutDay(workouts);
      });
    });
  }
  document.getElementById("finishWorkoutBtn").addEventListener("click", () => reviewOrFinishWorkout(false));
  document.getElementById("fillLastBtn").addEventListener("click", () => fillFromLast(workouts));
  document.getElementById("discardCurrentBtn").addEventListener("click", () => discardDraft(day));
}

function updateSetRow(row, done) {
  row.classList.toggle("completed", done);
  row.querySelector(".done-btn").textContent = done ? "Undo" : "Done";
  row.querySelector(".complete-label").textContent = done ? "✓ Completed" : "Not done";
}

async function toggleSetDone(day, definitionId, setIndex, row) {
  const definition = definitionById(day, definitionId);
  const draft = ensureDraft(day);
  const state = ensureExerciseDraft(draft, definition);
  const set = state.sets[setIndex];
  if (set.done) {
    set.done = false;
    updateSetRow(row, false);
    await persistDraft(day);
    return;
  }
  if (set.reps === null || !Number.isInteger(Number(set.reps)) || Number(set.reps) < 0 || Number(set.reps) > 500) {
    setStatus("workoutStatus", definition.timed ? "Enter valid seconds before marking the set done." : "Enter valid reps before marking the set done.", true);
    return;
  }
  if (!definition.timed && (set.weight === null || !Number.isFinite(Number(set.weight)) || Number(set.weight) < 0 || Number(set.weight) > 1000)) {
    setStatus("workoutStatus", `Enter a valid ${definition.loadLabel} before marking the set done.`, true);
    return;
  }
  set.done = true;
  updateSetRow(row, true);
  setStatus("workoutStatus", `Set ${setIndex + 1} completed.`);
  await persistDraft(day);
  if (timerSettings(day, definition).enabled) await startTimer(day, definition);
}

async function fillFromLast(workouts) {
  const day = activeWorkoutDay;
  const draft = ensureDraft(day);
  for (const definition of chosenDefinitions(day, draft)) {
    const last = findLastExercise(workouts, day, definition.name);
    if (!last) continue;
    const state = ensureExerciseDraft(draft, definition);
    relevantWorkingSets(last.exercise, definition).slice(0, definition.sets).forEach((set, index) => {
      state.sets[index] = { set: index + 1, reps: Number(set.reps), weight: set.weight ?? null, done: false };
    });
  }
  await persistDraft(day);
  await renderWorkoutSection(false);
  setStatus("workoutStatus", "Previous values copied. Mark each completed set Done before finishing.");
}

function draftReview(day, draft) {
  const definitions = definitionsWithDraftContent(day, draft);
  let completed = 0;
  let incomplete = 0;
  let enteredButUnconfirmed = 0;
  for (const definition of definitions) {
    const state = ensureExerciseDraft(draft, definition);
    for (const set of state.sets) {
      if (set.done) completed += 1;
      else {
        incomplete += 1;
        if (set.reps !== null || set.weight !== null) enteredButUnconfirmed += 1;
      }
    }
  }
  return { completed, incomplete, enteredButUnconfirmed };
}

async function reviewOrFinishWorkout(confirmed) {
  const day = activeWorkoutDay;
  const draft = ensureDraft(day);
  const review = draftReview(day, draft);
  if (!review.completed) {
    setStatus("workoutStatus", "Mark at least one set Done before finishing the workout.", true);
    return;
  }
  if (!confirmed && review.incomplete) {
    document.getElementById("finishReview").innerHTML = `
      <div class="finish-review">
        <strong>Review incomplete sets</strong>
        <div class="meta">${review.completed} completed set${review.completed === 1 ? "" : "s"} will be saved. ${review.incomplete} incomplete set${review.incomplete === 1 ? "" : "s"}${review.enteredButUnconfirmed ? `, including ${review.enteredButUnconfirmed} with unconfirmed values,` : ""} will not count as recorded performance.</div>
        <div class="actions"><button type="button" class="btn primary" id="saveCompletedBtn">Save completed sets</button><button type="button" class="btn secondary" id="keepLoggingBtn">Keep logging</button></div>
      </div>
    `;
    document.getElementById("saveCompletedBtn").addEventListener("click", () => reviewOrFinishWorkout(true));
    document.getElementById("keepLoggingBtn").addEventListener("click", () => {
      document.getElementById("finishReview").innerHTML = "";
    });
    document.getElementById("finishReview").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  await saveCompletedWorkout(day, draft);
}

async function saveCompletedWorkout(day, draft) {
  if (!isISODate(draft.date)) {
    setStatus("workoutStatus", "Choose a valid workout date.", true);
    return;
  }
  const exercises = [];
  for (const definition of definitionsWithDraftContent(day, draft)) {
    const state = ensureExerciseDraft(draft, definition);
    const sets = state.sets
      .filter(set => set.done)
      .map(set => ({ set: set.set, reps: Number(set.reps), weight: set.weight === null ? null : Number(set.weight), completed: true }));
    if (!sets.length) continue;
    const record = { name: definition.name, target: definition.target, sets };
    if (state.sessionNote.trim()) record.sessionNote = state.sessionNote.trim();
    if (state.effort) record.effort = state.effort;
    exercises.push(record);
  }
  if (!exercises.length) {
    setStatus("workoutStatus", "No completed sets are ready to save.", true);
    return;
  }
  await addOne(STORES.workouts, {
    day,
    date: draft.date,
    exercises,
    createdAt: new Date().toISOString()
  });
  draftCache.delete(day);
  await deleteOne(STORES.drafts, day);
  document.getElementById("finishReview").innerHTML = "";
  await refreshAll({ selectRecommended: true });
  setStatus("workoutStatus", `Workout saved. ${friendlyDay(nextWorkoutRecommendation(await getAll(STORES.workouts)).day)} is up next.`);
}

async function startTimer(day, definition) {
  const settings = timerSettings(day, definition);
  const active = {
    day,
    exerciseId: definition.id,
    exerciseName: definition.name,
    duration: settings.duration,
    endAt: Date.now() + settings.duration * 1000
  };
  await setPreference("activeTimer", active);
  startTimerTicker();
  renderTimer();
}

function startTimerTicker() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(renderTimer, 1000);
}

function timerRemaining(active) {
  return Math.max(0, Math.ceil((Number(active.endAt) - Date.now()) / 1000));
}

function renderTimer() {
  const active = getPreference("activeTimer");
  const bar = document.getElementById("timerBar");
  if (!active) {
    bar.classList.remove("active");
    bar.innerHTML = "";
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    return;
  }
  const remaining = timerRemaining(active);
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  bar.classList.add("active");
  bar.innerHTML = `
    <div><div class="timer-time">${remaining ? `${minutes}:${seconds}` : "Rest complete"}</div><div class="small">${esc(active.exerciseName)}</div></div>
    <div class="timer-controls">
      <button type="button" class="btn secondary compact" data-timer-adjust="-15">−15</button>
      <button type="button" class="btn secondary compact" data-timer-adjust="15">+15</button>
      <button type="button" class="btn danger compact" id="stopTimerBtn">Stop</button>
    </div>
  `;
  bar.querySelectorAll("[data-timer-adjust]").forEach(button => {
    button.addEventListener("click", () => adjustTimer(Number(button.dataset.timerAdjust)));
  });
  document.getElementById("stopTimerBtn").addEventListener("click", stopTimer);
}

async function adjustTimer(seconds) {
  const active = getPreference("activeTimer");
  if (!active) return;
  const remaining = timerRemaining(active);
  active.endAt = Date.now() + Math.max(0, Math.min(3600, remaining + seconds)) * 1000;
  await setPreference("activeTimer", active);
  renderTimer();
}

async function stopTimer() {
  await removePreference("activeTimer");
  renderTimer();
}

function chartSVG(points, label, color = "#d9a441") {
  if (!points.length) return "";
  const width = 720;
  const height = 230;
  const pad = { left: 44, right: 18, top: 20, bottom: 40 };
  const values = points.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = index => points.length === 1 ? width / 2 : pad.left + index * ((width - pad.left - pad.right) / (points.length - 1));
  const y = value => pad.top + (max === min ? (height - pad.top - pad.bottom) / 2 : (max - value) * (height - pad.top - pad.bottom) / range);
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const path = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const labels = points.map((point, index) =>
    index === 0 || index === points.length - 1 || index % labelEvery === 0
      ? `<text x="${x(index)}" y="${height - 13}" text-anchor="middle" font-size="10" fill="#b9b1a5">${esc(point.date.slice(5))}</text>`
      : ""
  ).join("");
  const circles = points.map((point, index) =>
    `<circle cx="${x(index)}" cy="${y(point.value)}" r="4" fill="${color}"><title>${esc(point.date)}: ${fmt(point.value)} ${esc(label)}</title></circle>`
  ).join("");
  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)} over time">
      <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="#55564f"/>
      <polyline fill="none" stroke="${color}" stroke-width="3" points="${path}"/>
      ${circles}${labels}
      <text x="8" y="20" font-size="10" fill="${color}">${esc(label)}</text>
    </svg>
  `;
}

function progressDefinitions(day, workouts) {
  const definitions = allDefinitions(day);
  if (day === "day3" && workouts.some(workout => workout.day === day && (workout.exercises || []).some(item => item.name === LEGACY_DAY3.name))) {
    definitions.push(LEGACY_DAY3);
  }
  return definitions;
}

async function renderProgressSection() {
  const workouts = (await getAll(STORES.workouts)).sort(chronological);
  const definitions = progressDefinitions(activeProgressDay, workouts);
  if (!definitions.some(definition => definition.id === activeProgressExerciseId)) {
    activeProgressExerciseId = definitions[0].id;
  }
  document.getElementById("progressDayPicker").innerHTML = dayPickerHTML(activeProgressDay);
  document.getElementById("progressExercisePicker").innerHTML = definitions.map(definition => `
    <button type="button" data-exercise="${definition.id}" class="${definition.id === activeProgressExerciseId ? "active" : ""}" aria-pressed="${definition.id === activeProgressExerciseId}">
      ${esc(definition.legacy ? "Legacy: " + definition.name : definition.name)}
    </button>
  `).join("");
  document.getElementById("progressDayPicker").querySelectorAll("button").forEach(button => {
    button.addEventListener("click", async () => {
      activeProgressDay = button.dataset.day;
      activeProgressExerciseId = progressDefinitions(activeProgressDay, workouts)[0].id;
      await renderProgressSection();
    });
  });
  document.getElementById("progressExercisePicker").querySelectorAll("button").forEach(button => {
    button.addEventListener("click", async () => {
      activeProgressExerciseId = button.dataset.exercise;
      await renderProgressSection();
    });
  });
  const definition = definitionById(activeProgressDay, activeProgressExerciseId);
  const rows = [];
  workouts.filter(workout => workout.day === activeProgressDay).forEach(workout => {
    const record = (workout.exercises || []).find(item => item.name === definition.name);
    if (!record) return;
    const stats = sessionStats(record, definition);
    const columns = setColumns(record, definition);
    rows.push({
      date: workout.date,
      reps: columns.reps,
      weights: columns.weights,
      value: definition.timed ? stats.maxTimed : stats.maxWeight,
      repsAtBest: stats.maxRepsAtMaxWeight,
      volume: stats.volume,
      sessionNote: record.sessionNote || "",
      effort: record.effort || ""
    });
  });
  if (!rows.length) {
    document.getElementById("progressDetail").innerHTML = `
      <div class="card">
        <div class="exercise-title">${esc(definition.name)}</div>
        <div class="meta">${definition.legacy ? "Historical ambiguous entry" : `${friendlyDay(activeProgressDay)} target: ${definition.target}`}</div>
        <div class="empty">No sessions for this workout-day exercise yet. Complete its sets in Workout to start the record.</div>
      </div>
    `;
    return;
  }
  const valid = rows.filter(row => row.value !== null);
  const bestValue = valid.length ? Math.max(...valid.map(row => row.value)) : null;
  const bestRows = bestValue === null ? [] : valid.filter(row => row.value === bestValue);
  const bestReps = bestRows.length ? Math.max(...bestRows.map(row => row.repsAtBest || 0)) : null;
  const bestText = definition.timed
    ? bestValue === null ? "No timed result" : `${fmt(bestValue)} seconds`
    : bestValue === null ? "No load recorded" : `${fmt(bestReps)} reps · ${fmt(bestValue)} ${definition.loadLabel}`;
  const chart = valid.length
    ? chartSVG(valid.map(row => ({ date: row.date, value: row.value })), definition.timed ? "seconds" : definition.loadLabel)
    : '<div class="empty">Record a load to draw the chart.</div>';
  document.getElementById("progressDetail").innerHTML = `
    <div class="card">
      <div class="progress-summary">
        <div><div class="exercise-title">${esc(definition.name)}</div><div class="meta">${definition.legacy ? "Preserved as an ambiguous historical movement" : `${friendlyDay(activeProgressDay)} target: ${esc(definition.target)}`}</div></div>
        <div class="best-result"><span class="small">Best recorded</span><br>${esc(bestText)}</div>
      </div>
      <div class="chart-wrap">${chart}</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th>${definition.timed ? "Seconds" : "Reps"}</th><th>Load (${esc(definition.loadLabel)})</th>${definition.timed ? "" : "<th>Volume</th>"}<th>Context</th></tr></thead>
          <tbody>${rows.map(row => `<tr><td>${esc(row.date)}</td><td>${esc(row.reps)}</td><td>${esc(row.weights)}</td>${definition.timed ? "" : `<td>${fmt(row.volume)}</td>`}<td class="notes-cell">${esc([row.sessionNote, row.effort].filter(Boolean).join(" · ") || "—")}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
  `;
}

function optionalNumber(input) {
  return input.value.trim() === "" ? null : Number(input.value);
}

function bodyValidation(record) {
  if (!isISODate(record.date)) return "Choose a valid date.";
  if (record.weight === null && record.waist === null && record.bodyFat === null) return "Enter at least one measurement.";
  if (record.weight !== null && (!Number.isFinite(record.weight) || record.weight < 1 || record.weight > 1000)) return "Weight must be between 1 and 1000 kg.";
  if (record.waist !== null && (!Number.isFinite(record.waist) || record.waist < 1 || record.waist > 500)) return "Waist must be between 1 and 500 cm.";
  if (record.bodyFat !== null && (!Number.isFinite(record.bodyFat) || record.bodyFat <= 0 || record.bodyFat > 100)) return "Body fat must be greater than 0 and no more than 100%.";
  if (typeof record.notes !== "string" || record.notes.length > 1000) return "Notes must be 1000 characters or fewer.";
  return "";
}

async function saveBodyMetric() {
  const record = {
    date: document.getElementById("bodyDate").value,
    weight: optionalNumber(document.getElementById("bodyWeight")),
    waist: optionalNumber(document.getElementById("bodyWaist")),
    bodyFat: optionalNumber(document.getElementById("bodyFat")),
    notes: document.getElementById("bodyNotes").value.trim(),
    createdAt: new Date().toISOString()
  };
  const error = bodyValidation(record);
  if (error) {
    setStatus("bodyStatus", error, true);
    return;
  }
  const button = document.getElementById("saveBodyBtn");
  button.disabled = true;
  try {
    await addOne(STORES.body, record);
    ["bodyWeight", "bodyWaist", "bodyFat", "bodyNotes"].forEach(id => { document.getElementById(id).value = ""; });
    await renderBodySection();
    setStatus("bodyStatus", "Measurement saved.");
  } catch {
    setStatus("bodyStatus", "Measurement could not be saved. Try again.", true);
  } finally {
    button.disabled = false;
  }
}

async function renderBodySection() {
  const metrics = (await getAll(STORES.body)).sort(chronological);
  const weights = metrics.filter(metric => metric.weight !== null && metric.weight !== undefined);
  const current = weights.at(-1) || null;
  const first = weights[0] || null;
  const previous = weights.length > 1 ? weights.at(-2) : null;
  document.getElementById("bodySummary").innerHTML = weights.length ? `
    <div class="metrics">
      <div class="metric"><div class="metric-label">Current weight</div><div class="metric-value">${fmt(current.weight)} kg</div></div>
      <div class="metric"><div class="metric-label">From first</div><div class="metric-value">${signed(Number(current.weight) - Number(first.weight), "kg")}</div></div>
      <div class="metric"><div class="metric-label">From previous</div><div class="metric-value">${previous ? signed(Number(current.weight) - Number(previous.weight), "kg") : "—"}</div></div>
    </div>
  ` : '<div class="empty">No body-weight entries yet. Add one above to see changes over time.</div>';
  const weightPoints = weights.map(metric => ({ date: metric.date, value: Number(metric.weight) }));
  document.getElementById("bodyChart").innerHTML = weightPoints.length
    ? `${chartSVG(weightPoints, "kg", "#86b58f")}<div class="chart-caption">Body weight over time</div>`
    : '<div class="empty">Add a body-weight measurement to start the chart.</div>';
  document.getElementById("bodyHistory").innerHTML = metrics.length ? `
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Date</th><th>Weight (kg)</th><th>Waist (cm)</th><th>Body fat (%)</th><th>Notes</th><th>Action</th></tr></thead>
      <tbody>${metrics.map(metric => `<tr><td>${esc(metric.date)}</td><td>${fmt(metric.weight)}</td><td>${fmt(metric.waist)}</td><td>${fmt(metric.bodyFat)}</td><td class="notes-cell">${esc(metric.notes || "—")}</td><td><button type="button" class="btn danger compact" data-delete-body="${Number(metric.id)}">Delete</button></td></tr>`).join("")}</tbody>
    </table></div>
  ` : '<div class="empty">No measurements saved. Use the form above to add the first one.</div>';
  document.querySelectorAll("[data-delete-body]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this body measurement?")) return;
      await deleteOne(STORES.body, Number(button.dataset.deleteBody));
      await renderBodySection();
      setStatus("bodyStatus", "Measurement deleted.");
    });
  });
}

function historyDefinitions(day, workouts) {
  const definitions = [...ROUTINES[day].exercises, ...(ROUTINES[day].alternatives || [])];
  if (day === "day3" && workouts.some(workout => (workout.exercises || []).some(item => item.name === LEGACY_DAY3.name))) {
    definitions.push(LEGACY_DAY3);
  }
  return definitions;
}

function personalBestRows(workouts) {
  const rows = [];
  for (const day of DAY_KEYS) {
    for (const definition of historyDefinitions(day, workouts)) {
      const records = workouts
        .filter(workout => workout.day === day)
        .map(workout => (workout.exercises || []).find(item => item.name === definition.name))
        .filter(Boolean);
      if (!records.length) continue;
      if (definition.timed) {
        const best = Math.max(...records.map(record => sessionStats(record, definition).maxTimed || 0));
        rows.push({ day, name: definition.name, value: `${fmt(best)} seconds`, legacy: definition.legacy });
      } else {
        let bestWeight = null;
        let bestReps = 0;
        records.forEach(record => relevantWorkingSets(record, definition).forEach(set => {
          if (set.weight === null || set.weight === undefined) return;
          const weight = Number(set.weight);
          const reps = Number(set.reps || 0);
          if (bestWeight === null || weight > bestWeight || (weight === bestWeight && reps > bestReps)) {
            bestWeight = weight;
            bestReps = reps;
          }
        }));
        rows.push({
          day,
          name: definition.name,
          value: bestWeight === null ? "No load recorded" : `${fmt(bestReps)} reps · ${fmt(bestWeight)} ${definition.loadLabel}`,
          legacy: definition.legacy
        });
      }
    }
  }
  return rows;
}

async function renderHistoryData() {
  const workouts = (await getAll(STORES.workouts)).sort(chronological);
  const bests = personalBestRows(workouts);
  document.getElementById("personalBests").innerHTML = bests.length
    ? bests.map(best => `<div class="pr-card"><div><div class="pr-name">${esc(best.legacy ? "Legacy: " + best.name : best.name)}</div><div class="small">${friendlyDay(best.day)}</div></div><div class="pr-value">${esc(best.value)}</div></div>`).join("")
    : '<div class="empty">Finish a workout to start tracking personal bests.</div>';
  renderHistoryTables(workouts);
  renderSavedSessions(workouts);
}

function renderHistoryTables(workouts) {
  if (!workouts.length) {
    document.getElementById("history").innerHTML = '<div class="empty">No workouts saved. Start from the Workout section.</div>';
    return;
  }
  document.getElementById("history").innerHTML = DAY_KEYS.map(day => {
    const dayWorkouts = workouts.filter(workout => workout.day === day);
    if (!dayWorkouts.length) return "";
    const definitions = historyDefinitions(day, dayWorkouts);
    const headers = dayWorkouts.map(workout => `<th colspan="2" class="date-group">${esc(workout.date)}</th>`).join("");
    const subheaders = dayWorkouts.map(() => "<th>Reps</th><th>Load</th>").join("");
    const rows = definitions.map(definition => {
      const cells = dayWorkouts.map(workout => {
        const record = (workout.exercises || []).find(item => item.name === definition.name);
        if (!record) return "<td>—</td><td>—</td>";
        const columns = setColumns(record, definition);
        return `<td>${esc(columns.reps)}</td><td>${esc(columns.weights)}</td>`;
      }).join("");
      return `<tr><td class="history-exercise-name">${esc(definition.legacy ? "Legacy: " + definition.name : definition.name)}<span class="history-unit">${esc(definition.loadLabel)}</span></td>${cells}</tr>`;
    }).join("");
    const contexts = [];
    dayWorkouts.forEach(workout => (workout.exercises || []).forEach(record => {
      if (!record.sessionNote && !record.effort) return;
      contexts.push(`<div class="context-line"><strong>${esc(workout.date)} · ${esc(record.name)}</strong>${record.sessionNote ? ` — ${esc(record.sessionNote)}` : ""}${record.effort ? ` · Final set: ${esc(record.effort)}` : ""}</div>`);
    }));
    return `
      <div class="history-row">
        <div class="history-date">${friendlyDay(day)}</div>
        <div class="table-wrap"><table class="data-table history-table comparison-table"><thead><tr><th rowspan="2">Exercise</th>${headers}</tr><tr>${subheaders}</tr></thead><tbody>${rows}</tbody></table></div>
        <div class="small" style="margin-top:8px">Sets are listed in order. Load units stay attached to each exercise.</div>
        ${contexts.length ? `<div class="session-context">${contexts.join("")}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderSavedSessions(workouts) {
  const ordered = [...workouts].sort((a, b) => chronological(b, a));
  const destination = document.getElementById("savedWorkoutList");
  destination.innerHTML = ordered.length
    ? ordered.map(workout => `<div class="saved-session"><div><strong>${friendlyDay(workout.day)}</strong><div class="small">${esc(displayDate(workout.date))} · ${(workout.exercises || []).length} exercise${(workout.exercises || []).length === 1 ? "" : "s"}</div></div><button type="button" class="btn secondary compact" data-edit-workout="${Number(workout.id)}">Edit</button></div>`).join("")
    : '<div class="empty">No saved workouts to edit.</div>';
  destination.querySelectorAll("[data-edit-workout]").forEach(button => button.addEventListener("click", () => openWorkoutEditor(Number(button.dataset.editWorkout))));
}

async function openWorkoutEditor(id) {
  const record = await getOne(STORES.workouts, id);
  if (!record) return;
  editingWorkout = structuredClone(record);
  const exercises = (editingWorkout.exercises || []).map((recordExercise, exerciseIndex) => {
    const definition = definitionByName(editingWorkout.day, recordExercise.name) || { timed: false, loadLabel: "recorded load" };
    return `
      <div class="editor-exercise">
        <div class="exercise-title">${esc(recordExercise.name)}</div>
        <div class="editor-set editor-set-head"><div>Set</div><div>${definition.timed ? "Seconds" : "Reps"}</div><div>Load (${esc(definition.loadLabel)})</div></div>
        ${(recordExercise.sets || []).map((set, setIndex) => `
          <div class="editor-set">
            <div>${set.set ?? setIndex + 1}</div>
            <input type="number" min="0" max="500" step="1" data-edit-field="reps" data-edit-exercise="${exerciseIndex}" data-edit-set="${setIndex}" value="${set.reps ?? ""}" aria-label="${esc(recordExercise.name)} set ${setIndex + 1} ${definition.timed ? "seconds" : "reps"}">
            <input type="number" min="0" max="1000" step="0.25" data-edit-field="weight" data-edit-exercise="${exerciseIndex}" data-edit-set="${setIndex}" value="${set.weight ?? ""}" aria-label="${esc(recordExercise.name)} set ${setIndex + 1} ${esc(definition.loadLabel)}">
          </div>
        `).join("")}
      </div>
    `;
  }).join("");
  document.getElementById("workoutEditor").innerHTML = `
    <div class="section-title" id="editorTitle">Edit ${friendlyDay(editingWorkout.day)} workout</div>
    <div class="meta">This updates the original record. Existing notes, completion markers and unknown historical fields are preserved.</div>
    <div style="margin-top:12px"><label for="editWorkoutDate">Workout date</label><input type="date" id="editWorkoutDate" value="${esc(editingWorkout.date)}"></div>
    ${exercises}
    <div class="actions"><button type="button" class="btn primary" id="saveWorkoutEdit">Save changes</button><button type="button" class="btn secondary" id="cancelWorkoutEdit">Cancel</button></div>
    <div id="editStatus" class="status" aria-live="polite"></div>
  `;
  document.getElementById("editorOverlay").classList.add("active");
  document.getElementById("saveWorkoutEdit").addEventListener("click", saveWorkoutEdit);
  document.getElementById("cancelWorkoutEdit").addEventListener("click", closeWorkoutEditor);
  document.getElementById("editWorkoutDate").focus();
}

function closeWorkoutEditor() {
  editingWorkout = null;
  document.getElementById("editorOverlay").classList.remove("active");
  document.getElementById("workoutEditor").innerHTML = "";
}

async function saveWorkoutEdit() {
  if (!editingWorkout) return;
  const date = document.getElementById("editWorkoutDate").value;
  if (!isISODate(date)) {
    setStatus("editStatus", "Choose a valid date.", true);
    return;
  }
  const updated = structuredClone(editingWorkout);
  updated.date = date;
  for (const input of document.querySelectorAll("[data-edit-field]")) {
    const exercise = updated.exercises[Number(input.dataset.editExercise)];
    const set = exercise.sets[Number(input.dataset.editSet)];
    const value = input.value === "" ? null : Number(input.value);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > (input.dataset.editField === "reps" ? 500 : 1000))) {
      setStatus("editStatus", "Check the edited reps, seconds and load values.", true);
      return;
    }
    if (input.dataset.editField === "reps" && value !== null && !Number.isInteger(value)) {
      setStatus("editStatus", "Reps and seconds must be whole numbers.", true);
      return;
    }
    set[input.dataset.editField] = value;
  }
  await putOne(STORES.workouts, updated);
  closeWorkoutEditor();
  await refreshAll();
  setStatus("dbStatus", "Saved workout updated without creating a duplicate.");
}

function normalizeWorkout(record) {
  if (!record || typeof record !== "object" || !DAY_KEYS.includes(record.day) || !isISODate(record.date) || !isTimestamp(record.createdAt) || !Array.isArray(record.exercises) || !record.exercises.length) return null;
  const normalized = { ...record };
  delete normalized.id;
  normalized.exercises = [];
  for (const item of record.exercises) {
    if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 200 || typeof item.target !== "string" || item.target.length > 200 || !Array.isArray(item.sets) || !item.sets.length) return null;
    if (item.sessionNote !== undefined && (typeof item.sessionNote !== "string" || item.sessionNote.length > 1000)) return null;
    if (item.effort !== undefined && (typeof item.effort !== "string" || item.effort.length > 100)) return null;
    const normalizedExercise = { ...item, name: item.name, target: item.target, sets: [] };
    for (const set of item.sets) {
      if (!set || !Number.isInteger(Number(set.set)) || Number(set.set) < 1 || Number(set.set) > 50) return null;
      const reps = set.reps === null || set.reps === undefined ? null : Number(set.reps);
      const weight = set.weight === null || set.weight === undefined ? null : Number(set.weight);
      if (reps === null && weight === null) return null;
      if (reps !== null && (!Number.isInteger(reps) || reps < 0 || reps > 500)) return null;
      if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1000)) return null;
      if (set.completed !== undefined && typeof set.completed !== "boolean") return null;
      normalizedExercise.sets.push({ ...set, set: Number(set.set), reps, weight });
    }
    normalized.exercises.push(normalizedExercise);
  }
  return normalized;
}

function normalizeBodyMetric(record) {
  if (!record || typeof record !== "object") return null;
  const normalized = {
    ...record,
    date: record.date,
    weight: record.weight === null || record.weight === undefined ? null : Number(record.weight),
    waist: record.waist === null || record.waist === undefined ? null : Number(record.waist),
    bodyFat: record.bodyFat === null || record.bodyFat === undefined ? null : Number(record.bodyFat),
    notes: record.notes === undefined ? "" : record.notes,
    createdAt: record.createdAt
  };
  delete normalized.id;
  return bodyValidation(normalized) || !isTimestamp(normalized.createdAt) ? null : normalized;
}

function normalizeDraft(record) {
  if (!record || !DAY_KEYS.includes(record.day) || !isISODate(record.date) || !isTimestamp(record.updatedAt) || !record.exercises || typeof record.exercises !== "object") return null;
  if (record.variantId && !ROUTINES.day3.alternatives.some(item => item.id === record.variantId)) return null;
  const normalized = { day: record.day, date: record.date, variantId: record.variantId || null, exercises: {}, updatedAt: record.updatedAt };
  for (const [id, state] of Object.entries(record.exercises)) {
    const definition = definitionById(record.day, id);
    if (!definition || !state || !Array.isArray(state.sets) || state.sets.length > definition.sets || typeof (state.sessionNote || "") !== "string" || (state.sessionNote || "").length > 1000 || typeof (state.effort || "") !== "string" || (state.effort || "").length > 100) return null;
    const normalizedState = { sets: [], sessionNote: state.sessionNote || "", effort: state.effort || "" };
    for (let index = 0; index < state.sets.length; index += 1) {
      const set = state.sets[index];
      const reps = set.reps === null || set.reps === undefined ? null : Number(set.reps);
      const weight = set.weight === null || set.weight === undefined ? null : Number(set.weight);
      if (reps !== null && (!Number.isInteger(reps) || reps < 0 || reps > 500)) return null;
      if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1000)) return null;
      if (typeof set.done !== "boolean") return null;
      normalizedState.sets.push({ set: index + 1, reps, weight, done: set.done });
    }
    normalized.exercises[id] = normalizedState;
  }
  return normalized;
}

function normalizePreference(record) {
  if (!record || typeof record.key !== "string" || record.key.length > 200) return null;
  const key = record.key;
  const value = record.value;
  if (key.startsWith("setup:")) {
    if (typeof value !== "string" || value.length > 1000) return null;
  } else if (key.startsWith("timer:")) {
    if (!value || typeof value.enabled !== "boolean" || !Number.isFinite(Number(value.duration)) || Number(value.duration) < 15 || Number(value.duration) > 1800) return null;
  } else if (key.startsWith("hold:")) {
    if (!value || typeof value.headline !== "string" || value.headline.length > 500 || typeof value.detail !== "string" || value.detail.length > 1000) return null;
  } else if (key === "variant:day3") {
    if (!ROUTINES.day3.alternatives.some(item => item.id === value)) return null;
  } else if (key === "activeTimer") {
    if (!value || !DAY_KEYS.includes(value.day) || typeof value.exerciseId !== "string" || typeof value.exerciseName !== "string" || !Number.isFinite(Number(value.endAt)) || !Number.isFinite(Number(value.duration))) return null;
  } else {
    return null;
  }
  return { key, value };
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
}

function workoutIdentity(record) {
  return `${record.day}|${record.createdAt}`;
}

function bodyIdentity(record) {
  return String(record.createdAt);
}

async function exportData() {
  const [workouts, bodyMetrics, drafts, preferences] = await Promise.all([
    getAll(STORES.workouts),
    getAll(STORES.body),
    getAll(STORES.drafts),
    getAll(STORES.preferences)
  ]);
  const payload = { version: 4, exportedAt: new Date().toISOString(), workouts, bodyMetrics, drafts, preferences };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gym-tracker-backup-${todayISO()}.json`;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setStatus("dbStatus", `Backup prepared: ${workouts.length} workouts, ${bodyMetrics.length} body measurements and ${drafts.length} draft${drafts.length === 1 ? "" : "s"}.`);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function importData(file) {
  const parsed = JSON.parse(await file.text());
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.workouts)) throw new Error("Invalid backup file. Expected a workout backup.");
  if (parsed.bodyMetrics !== undefined && !Array.isArray(parsed.bodyMetrics)) throw new Error("Invalid body-measurement data.");
  if (parsed.drafts !== undefined && !Array.isArray(parsed.drafts)) throw new Error("Invalid draft data.");
  if (parsed.preferences !== undefined && !Array.isArray(parsed.preferences)) throw new Error("Invalid preference data.");
  const [existingWorkouts, existingBody, existingDrafts, existingPreferences] = await Promise.all([
    getAll(STORES.workouts),
    getAll(STORES.body),
    getAll(STORES.drafts),
    getAll(STORES.preferences)
  ]);
  const counts = {
    workouts: { added: 0, skipped: 0, invalid: 0 },
    body: { added: 0, skipped: 0, invalid: 0 },
    drafts: { added: 0, skipped: 0, invalid: 0 },
    preferences: { added: 0, updated: 0, skipped: 0, invalid: 0 }
  };
  const workoutIds = new Set(existingWorkouts.map(workoutIdentity));
  const bodyIds = new Set(existingBody.map(bodyIdentity));
  const draftsByDay = new Map(existingDrafts.map(draft => [draft.day, draft]));
  const preferencesByKey = new Map(existingPreferences.map(preference => [preference.key, preference]));
  const additions = { workouts: [], body: [], drafts: [], preferences: [] };
  for (const candidate of parsed.workouts) {
    const record = normalizeWorkout(candidate);
    if (!record) { counts.workouts.invalid += 1; continue; }
    const identity = workoutIdentity(record);
    if (workoutIds.has(identity)) { counts.workouts.skipped += 1; continue; }
    workoutIds.add(identity);
    additions.workouts.push(record);
    counts.workouts.added += 1;
  }
  for (const candidate of parsed.bodyMetrics || []) {
    const record = normalizeBodyMetric(candidate);
    if (!record) { counts.body.invalid += 1; continue; }
    const identity = bodyIdentity(record);
    if (bodyIds.has(identity)) { counts.body.skipped += 1; continue; }
    bodyIds.add(identity);
    additions.body.push(record);
    counts.body.added += 1;
  }
  for (const candidate of parsed.drafts || []) {
    const record = normalizeDraft(candidate);
    if (!record) { counts.drafts.invalid += 1; continue; }
    const existing = draftsByDay.get(record.day);
    if (existing) {
      counts.drafts.skipped += 1;
      continue;
    }
    draftsByDay.set(record.day, record);
    additions.drafts.push(record);
    counts.drafts.added += 1;
  }
  for (const candidate of parsed.preferences || []) {
    const record = normalizePreference(candidate);
    if (!record) { counts.preferences.invalid += 1; continue; }
    const existing = preferencesByKey.get(record.key);
    if (existing && stableStringify(existing.value) === stableStringify(record.value)) {
      counts.preferences.skipped += 1;
      continue;
    }
    additions.preferences.push(record);
    preferencesByKey.set(record.key, record);
    if (existing) counts.preferences.updated += 1;
    else counts.preferences.added += 1;
  }
  if (Object.values(additions).some(records => records.length)) {
    const transaction = db.transaction(Object.values(STORES), "readwrite");
    additions.workouts.forEach(record => transaction.objectStore(STORES.workouts).add(record));
    additions.body.forEach(record => transaction.objectStore(STORES.body).add(record));
    additions.drafts.forEach(record => transaction.objectStore(STORES.drafts).put(record));
    additions.preferences.forEach(record => transaction.objectStore(STORES.preferences).put(record));
    await transactionDone(transaction);
  }
  await loadLocalState();
  await refreshAll({ selectRecommended: true });
  return counts;
}

function importMessage(counts) {
  return [
    `Workouts: ${counts.workouts.added} added, ${counts.workouts.skipped} skipped, ${counts.workouts.invalid} invalid`,
    `Body: ${counts.body.added} added, ${counts.body.skipped} skipped, ${counts.body.invalid} invalid`,
    `Drafts: ${counts.drafts.added} added, ${counts.drafts.skipped} skipped, ${counts.drafts.invalid} invalid`,
    `Preferences: ${counts.preferences.added} added, ${counts.preferences.updated} updated, ${counts.preferences.skipped} skipped, ${counts.preferences.invalid} invalid`
  ].join(". ") + ".";
}

async function clearData() {
  if (!confirm("Delete all workouts, body measurements, drafts and saved preferences from this browser? Export a backup first if needed.")) return;
  const transaction = db.transaction(Object.values(STORES), "readwrite");
  Object.values(STORES).forEach(store => transaction.objectStore(store).clear());
  await transactionDone(transaction);
  draftCache.clear();
  preferenceCache.clear();
  editingWorkout = null;
  renderTimer();
  await refreshAll({ selectRecommended: true });
  setStatus("dbStatus", "All local data cleared. The baseline will not return after reload.");
}

function switchTab(tabId) {
  document.querySelectorAll(".top-tabs button").forEach(button => button.classList.toggle("active", button.dataset.tab === tabId));
  document.querySelectorAll(".panel").forEach(panel => panel.classList.toggle("active", panel.id === tabId));
}

async function refreshAll({ selectRecommended = false } = {}) {
  await Promise.all([
    renderWorkoutSection(selectRecommended),
    renderProgressSection(),
    renderBodySection(),
    renderHistoryData()
  ]);
}

function seedWorkout() {
  return {
    day: "day1",
    date: "2026-08-20",
    createdAt: "2026-08-22T12:00:00.000Z",
    exercises: [
      { name: "Dumbbell chest press", target: "3 × 6–10", sets: [{ set: 1, reps: 10, weight: 10 }, { set: 2, reps: 10, weight: 10 }, { set: 3, reps: 10, weight: 10 }] },
      { name: "Dumbbell shoulder press", target: "3 × 8–12", sets: [{ set: 1, reps: 8, weight: 7.5 }, { set: 2, reps: 8, weight: 7.5 }, { set: 3, reps: 8, weight: 7.5 }] },
      { name: "Incline dumbbell press", target: "3 × 8–12", sets: [{ set: 1, reps: 8, weight: 7.5 }, { set: 2, reps: 8, weight: 7.5 }, { set: 3, reps: 8, weight: 7.5 }] },
      { name: "Cable triceps pushdown", target: "2 × 10–15", sets: [{ set: 1, reps: 10, weight: 15 }, { set: 2, reps: 15, weight: 20 }, { set: 3, reps: 15, weight: 20 }] },
      { name: "Goblet squat", target: "3 × 8–10", sets: [{ set: 1, reps: 16, weight: 10 }, { set: 2, reps: 12, weight: 10 }, { set: 3, reps: 12, weight: 10 }] }
    ]
  };
}

document.querySelectorAll(".top-tabs button").forEach(button => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});
document.getElementById("saveBodyBtn").addEventListener("click", saveBodyMetric);
document.getElementById("exportBtn").addEventListener("click", exportData);
document.getElementById("clearBtn").addEventListener("click", clearData);
document.getElementById("importFile").addEventListener("change", async event => {
  setStatus("dbStatus", "");
  try {
    if (event.target.files[0]) setStatus("dbStatus", importMessage(await importData(event.target.files[0])));
  } catch (error) {
    setStatus("dbStatus", error.message || "Backup could not be imported.", true);
  }
  event.target.value = "";
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && editingWorkout) closeWorkoutEditor();
});
window.addEventListener("pagehide", () => {
  if (draftCache.has(activeWorkoutDay)) void persistDraft(activeWorkoutDay);
});

(async () => {
  try {
    db = await openDB();
    if (isNewDatabase && (await getAll(STORES.workouts)).length === 0) await addOne(STORES.workouts, seedWorkout());
    await loadLocalState();
    document.getElementById("bodyDate").value = todayISO();
    activeWorkoutDay = nextWorkoutRecommendation(await getAll(STORES.workouts)).day;
    await refreshAll();
    if (getPreference("activeTimer")) startTimerTicker();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  } catch (error) {
    document.getElementById("workoutDay").innerHTML = '<div class="card"><div class="empty">The local database could not be opened. Reload the app and try again.</div></div>';
    console.error(error);
  }
})();
