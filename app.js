const SUPABASE_URL = "https://znxqhbfdfejuuaxjnaso.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpueHFoYmZkZmVqdXVheGpuYXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwOTA4MjUsImV4cCI6MjA5NjY2NjgyNX0.VVRfSPrbMP99ybMSxxHtDQ_yn1k_vxCxBn8cBOHeKV8";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const STORAGE_KEY = "vocabulary-scene-activities";
const state = {
  activities: [],
  builder: {
    id: null,
    image: "",
    words: [],
    selectedWord: "",
    pendingPoint: null,
    draftPolygon: []
  },
  game: {
    activity: null,
    order: [],
    index: 0,
    score: 0,
    answered: false,
    usedShowMe: false,
    started: false
  }
};

const screens = {
  menu: document.querySelector("#menu-screen"),
  builder: document.querySelector("#builder-screen"),
  gameMenu: document.querySelector("#game-menu-screen"),
  game: document.querySelector("#game-screen"),
  result: document.querySelector("#result-screen")
};

const els = {
  activityCount: document.querySelector("#activity-count"),
  activityList: document.querySelector("#activity-list"),
  playActivityList: document.querySelector("#play-activity-list"),
  activityName: document.querySelector("#activity-name"),
  imageUpload: document.querySelector("#image-upload"),
  wordInput: document.querySelector("#word-input"),
  loadWords: document.querySelector("#load-words"),
  undoPoint: document.querySelector("#undo-point"),
  clearSelected: document.querySelector("#clear-selected"),
  clearBuilder: document.querySelector("#clear-builder"),
  builderWordList: document.querySelector("#builder-word-list"),
  mappedCount: document.querySelector("#mapped-count"),
  selectedWordLabel: document.querySelector("#selected-word-label"),
  builderStatus: document.querySelector("#builder-status"),
  builderStage: document.querySelector("#builder-stage"),
  builderImage: document.querySelector("#builder-image"),
  builderOverlays: document.querySelector("#builder-overlays"),
  emptyBuilder: document.querySelector("#empty-builder"),
  saveActivity: document.querySelector("#save-activity"),
  gameActivityName: document.querySelector("#game-activity-name"),
  gameTitle: document.querySelector("#game-title"),
  scoreValue: document.querySelector("#score-value"),
  progressValue: document.querySelector("#progress-value"),
  feedback: document.querySelector("#feedback"),
  startGame: document.querySelector("#start-game"),
  showMe: document.querySelector("#show-me"),
  gameStage: document.querySelector("#game-stage"),
  gameImage: document.querySelector("#game-image"),
  gameOverlays: document.querySelector("#game-overlays"),
  resultScore: document.querySelector("#result-score"),
  resultDetail: document.querySelector("#result-detail"),
  playAgain: document.querySelector("#play-again")
};

function loadActivities() {
  try {
    state.activities = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").map(normalizeActivity);
  } catch {
    state.activities = [];
  }
}

function persistActivities() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.activities));
}

async function testSupabase() {
  const { data, error } = await supabase
    .from("activities")
    .select("*");

  console.log("DATA:", data);
  console.log("ERROR:", error);
}

testSupabase();

function normalizeActivity(activity) {
  return {
    ...activity,
    words: activity.words.map((word) => ({
      text: word.text,
      targets: normalizeTargets(word)
    }))
  };
}

function normalizeTargets(word) {
  if (Array.isArray(word.targets)) return word.targets;
  if (Array.isArray(word.markers)) return word.markers.map((marker) => markerToPolygon(marker));
  const legacyMarker = word.marker || convertLegacyBox(word.box);
  return legacyMarker ? [markerToPolygon(legacyMarker)] : [];
}

function convertLegacyBox(box) {
  if (!box) return null;
  if (box.x !== undefined && box.y !== undefined) {
    return {
      x: Number((box.x + (box.width / 2)).toFixed(2)),
      y: Number((box.y + (box.height / 2)).toFixed(2)),
      radius: Number((Math.max(box.width, box.height) / 2).toFixed(2))
    };
  }
  if (box.cx !== undefined) {
    return {
      x: box.cx,
      y: box.cy,
      radius: box.radius
    };
  }
  return null;
}

function markerToPolygon(marker) {
  const segments = 16;
  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (Math.PI * 2 * index) / segments;
    points.push({
      x: Number((marker.x + (Math.cos(angle) * marker.radius)).toFixed(2)),
      y: Number((marker.y + (Math.sin(angle) * marker.radius)).toFixed(2))
    });
  }
  return { type: "polygon", points };
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  if (name === "menu" || name === "gameMenu") renderActivityLists();
}

function parseWords(text) {
  return [...new Set(text.split(/\n|,/).map((word) => word.trim()).filter(Boolean))];
}

function getMappedWords() {
  return state.builder.words.filter((word) => word.targets.length);
}

function setBuilderStatus(message) {
  els.builderStatus.textContent = message;
}

function renderActivityLists() {
  els.activityCount.textContent = String(state.activities.length);
  renderActivityList(els.activityList, false);
  renderActivityList(els.playActivityList, true);
}

function renderActivityList(target, playOnly) {
  target.innerHTML = "";

  if (!state.activities.length) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent = "No activities saved yet.";
    target.append(empty);
    return;
  }

  state.activities.forEach((activity) => {
    const card = document.createElement("article");
    card.className = "activity-card";
    card.innerHTML = `
      <strong>${escapeHtml(activity.name)}</strong>
      <p>${activity.words.length} words mapped</p>
      <div class="activity-card-actions"></div>
    `;

    const actions = card.querySelector(".activity-card-actions");
    actions.append(makeButton("Play", "mini-button", () => openGame(activity.id)));
    if (!playOnly) {
      actions.append(
        makeButton("Edit", "mini-button", () => editActivity(activity.id)),
        makeButton("Delete", "mini-button danger", () => deleteActivity(activity.id))
      );
    }
    target.append(card);
  });
}

function makeButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function resetBuilder() {
  state.builder = { id: null, image: "", words: [], selectedWord: "", pendingPoint: null, draftPolygon: [] };
  els.activityName.value = "";
  els.imageUpload.value = "";
  els.wordInput.value = "";
  els.builderImage.src = "";
  els.emptyBuilder.classList.remove("hidden");
  els.builderStage.classList.add("empty");
  renderBuilderWords();
  renderBuilderOverlays();
  setBuilderStatus("Upload an image and load words to begin.");
}

function editActivity(id) {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return;

  state.builder = {
    id: activity.id,
    image: activity.image,
    words: structuredClone(activity.words),
    selectedWord: activity.words[0]?.text || "",
    pendingPoint: null,
    draftPolygon: []
  };

  els.activityName.value = activity.name;
  els.wordInput.value = activity.words.map((word) => word.text).join("\n");
  setBuilderImage(activity.image);
  renderBuilderWords();
  renderBuilderOverlays();
  showScreen("builder");
}

function deleteActivity(id) {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return;

  if (confirm(`Delete "${activity.name}"?`)) {
    state.activities = state.activities.filter((item) => item.id !== id);
    persistActivities();
    renderActivityLists();
  }
}

function setBuilderImage(src) {
  state.builder.image = src;
  els.builderImage.src = src;
  els.emptyBuilder.classList.add("hidden");
  els.builderStage.classList.remove("empty");
}

function renderBuilderWords() {
  els.builderWordList.innerHTML = "";

  state.builder.words.forEach((word) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `word-item ${word.text === state.builder.selectedWord ? "active" : ""} ${word.targets.length ? "mapped" : ""}`;
    item.innerHTML = `<strong>${escapeHtml(word.text)}</strong><span>${getTargetLabel(word.targets)}</span>`;
    item.addEventListener("click", () => {
      state.builder.selectedWord = word.text;
      state.builder.pendingPoint = null;
      state.builder.draftPolygon = [];
      renderBuilderWords();
      renderBuilderOverlays();
      setBuilderStatus(getBuilderInstruction(word.text));
    });
    els.builderWordList.append(item);
  });

  const mappedCount = getMappedWords().length;
  els.mappedCount.textContent = `${mappedCount} mapped`;
  els.selectedWordLabel.textContent = state.builder.selectedWord || "No word selected";
}

function syncOverlayToImage(stage, image, layer) {
  if (!image.src) return;
  const rect = getImageRect(stage, image);
  Object.assign(layer.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  });
}

function getImageRect(stage, image) {
  const stageRect = stage.getBoundingClientRect();
  const imageRect = image.getBoundingClientRect();
  return {
    left: imageRect.left - stageRect.left,
    top: imageRect.top - stageRect.top,
    width: imageRect.width,
    height: imageRect.height
  };
}

function eventToPercent(event, stage, image) {
  const stageRect = stage.getBoundingClientRect();
  const imageRect = getImageRect(stage, image);
  const x = clamp(((event.clientX - stageRect.left - imageRect.left) / imageRect.width) * 100, 0, 100);
  const y = clamp(((event.clientY - stageRect.top - imageRect.top) / imageRect.height) * 100, 0, 100);
  return { x, y };
}

function isPointerInsideImage(event, stage, image) {
  const stageRect = stage.getBoundingClientRect();
  const imageRect = getImageRect(stage, image);
  const localX = event.clientX - stageRect.left;
  const localY = event.clientY - stageRect.top;
  return (
    localX >= imageRect.left &&
    localX <= imageRect.left + imageRect.width &&
    localY >= imageRect.top &&
    localY <= imageRect.top + imageRect.height
  );
}

function createMarkerElement(marker, label = "", variant = "") {
  const points = markerToPolygon(marker).points;
  return createPolygonElement(points, variant);
}

function createShapeSvg() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "shape-svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  return svg;
}

function createPolygonElement(points, variant = "") {
  const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon.setAttribute("class", `shape-polygon ${variant}`.trim());
  polygon.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
  return polygon;
}

function createDraftPolygonElements(points) {
  const fragment = document.createDocumentFragment();
  if (points.length >= 3) {
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("class", "shape-draft-polygon");
    polygon.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
    fragment.append(polygon);
  } else if (points.length > 1) {
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("class", "shape-polyline");
    polyline.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
    fragment.append(polyline);
  }
  points.forEach((point) => {
    const vertex = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    vertex.setAttribute("class", "shape-vertex");
    vertex.setAttribute("cx", String(point.x));
    vertex.setAttribute("cy", String(point.y));
    vertex.setAttribute("r", "0.75");
    fragment.append(vertex);
  });

  if (points.length >= 3) {
    const firstPoint = points[0];
    const closingVertex = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    closingVertex.setAttribute("class", "shape-vertex");
    closingVertex.setAttribute("cx", String(firstPoint.x));
    closingVertex.setAttribute("cy", String(firstPoint.y));
    closingVertex.setAttribute("r", "1.2");
    fragment.append(closingVertex);
  }
  return fragment;
}

function renderBuilderOverlays() {
  syncOverlayToImage(els.builderStage, els.builderImage, els.builderOverlays);
  els.builderOverlays.innerHTML = "";
  const svg = createShapeSvg();
  els.builderOverlays.append(svg);

  state.builder.words.forEach((word) => {
    if (!word.targets.length) return;
    const isSelected = word.text === state.builder.selectedWord;
    word.targets.forEach((target, index) => {
      const variant = isSelected ? "correct" : "";
      svg.append(createPolygonElement(target.points, variant));
    });
  });

  if (state.builder.draftPolygon.length) {
    svg.append(createDraftPolygonElements(state.builder.draftPolygon));
  }
}

function getTargetLabel(targets) {
  if (!targets.length) return "Needs shape";
  if (targets.length === 1) {
    return "1 polygon shape";
  }
  return `${targets.length} shapes marked`;
}

function addPolygonPoint(point) {
  if (state.builder.draftPolygon.length >= 3 && isNearFirstPolygonPoint(point)) {
    finishPolygonShape();
    return;
  }
  state.builder.draftPolygon.push({
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2))
  });
  renderBuilderOverlays();
  setBuilderStatus(`Polygon points for "${state.builder.selectedWord}": ${state.builder.draftPolygon.length}.`);
}

function isNearFirstPolygonPoint(point) {
  const firstPoint = state.builder.draftPolygon[0];
  if (!firstPoint) return false;
  const dx = point.x - firstPoint.x;
  const dy = point.y - firstPoint.y;
  return Math.sqrt((dx * dx) + (dy * dy)) <= 2.5;
}

function finishPolygonShape() {
  const selected = state.builder.words.find((word) => word.text === state.builder.selectedWord);
  if (!selected || state.builder.draftPolygon.length < 3) {
    setBuilderStatus("Add at least 3 points, then click the first point to close the polygon.");
    return;
  }
  selected.targets.push({
    type: "polygon",
    points: structuredClone(state.builder.draftPolygon)
  });
  state.builder.draftPolygon = [];
  renderBuilderWords();
  renderBuilderOverlays();
  setBuilderStatus(`Added polygon ${selected.targets.length} for "${selected.text}".`);
}

function clearSelectedMarkers() {
  const selected = state.builder.words.find((word) => word.text === state.builder.selectedWord);
  if (!selected) return;
  selected.targets = [];
  state.builder.pendingPoint = null;
  state.builder.draftPolygon = [];
  renderBuilderWords();
  renderBuilderOverlays();
  setBuilderStatus(`Cleared shapes for "${selected.text}".`);
}

function undoPolygonPoint() {
  if (!state.builder.draftPolygon.length) {
    setBuilderStatus("No polygon point to undo.");
    return false;
  }
  state.builder.draftPolygon.pop();
  renderBuilderOverlays();
  setBuilderStatus(state.builder.draftPolygon.length
    ? `Polygon points for "${state.builder.selectedWord}": ${state.builder.draftPolygon.length}.`
    : `Polygon cleared for "${state.builder.selectedWord}".`);
  return true;
}

function saveActivity() {
  const name = els.activityName.value.trim();
  const mapped = getMappedWords();

  if (!name) return alert("Please name the activity.");
  if (!state.builder.image) return alert("Please upload an image.");
  if (!state.builder.words.length) return alert("Please add vocabulary words.");
  if (mapped.length !== state.builder.words.length) return alert("Please finish at least one polygon for every word.");

  const activity = {
    id: state.builder.id || crypto.randomUUID(),
    name,
    image: state.builder.image,
    words: structuredClone(state.builder.words)
  };

  const existingIndex = state.activities.findIndex((item) => item.id === activity.id);
  if (existingIndex >= 0) state.activities[existingIndex] = activity;
  else state.activities.unshift(activity);

  persistActivities();
  renderActivityLists();
  showScreen("menu");
}

function openGame(id) {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return;

  const firstWord = activity.words[0]?.text || "Ready?";
  state.game = {
    activity,
    order: structuredClone(activity.words),
    index: 0,
    score: 0,
    answered: false,
    usedShowMe: false,
    started: false
  };

  els.gameImage.src = activity.image;
  els.gameActivityName.textContent = activity.name;
  els.gameTitle.textContent = firstWord;
  els.feedback.textContent = "Press Start to begin.";
  els.feedback.className = "feedback";
  updateGameStats();
  els.gameOverlays.innerHTML = "";
  showScreen("game");
}

function startGame() {
  if (!state.game.activity) return;
  state.game.index = 0;
  state.game.score = 0;
  state.game.answered = false;
  state.game.usedShowMe = false;
  state.game.started = true;
  showCurrentWord();
}

function getCurrentWord() {
  return state.game.order[state.game.index];
}

function showCurrentWord() {
  const word = getCurrentWord();
  if (!word) return finishGame();

  syncOverlayToImage(els.gameStage, els.gameImage, els.gameOverlays);
  els.gameTitle.textContent = word.text;
  els.feedback.textContent = "Click the matching object in the picture.";
  els.feedback.className = "feedback";
  els.gameOverlays.innerHTML = "";
  updateGameStats();
}

function updateGameStats() {
  const total = state.game.order.length;
  const current = total ? Math.min(state.game.index + 1, total) : 0;
  els.scoreValue.textContent = String(state.game.score);
  els.progressValue.textContent = `${current}/${total}`;
}

function showGamePolygon(points, variant) {
  syncOverlayToImage(els.gameStage, els.gameImage, els.gameOverlays);
  els.gameOverlays.innerHTML = "";
  const svg = createShapeSvg();
  svg.append(createPolygonElement(points, variant));
  els.gameOverlays.append(svg);
}

function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const xi = polygon[current].x;
    const yi = polygon[current].y;
    const xj = polygon[previous].x;
    const yj = polygon[previous].y;
    const intersects = ((yi > point.y) !== (yj > point.y))
      && (point.x < (((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.00001)) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function isTargetHit(point, target) {
  return isPointInPolygon(point, target.points);
}

function handleGameClick(event) {
  const word = getCurrentWord();
  if (!word || state.game.answered || !state.game.started) return;

  const point = eventToPercent(event, els.gameStage, els.gameImage);
  const matchedTarget = word.targets.find((target) => isTargetHit(point, target));
  if (matchedTarget) {
    if (!state.game.usedShowMe) state.game.score += 1;
    els.feedback.textContent = "Correct.";
    els.feedback.className = "feedback good";
    showGamePolygon(matchedTarget.points, "correct");
    state.game.answered = true;
    updateGameStats();
    setTimeout(nextWord, 900);
    return;
  }

  els.feedback.textContent = "Try again.";
  els.feedback.className = "feedback bad";
}

function nextWord() {
  state.game.index += 1;
  state.game.answered = false;
  state.game.usedShowMe = false;
  showCurrentWord();
}

function showCurrentAnswer() {
  const word = getCurrentWord();
  if (!word || !state.game.started) return;

  state.game.usedShowMe = true;
  state.game.answered = true;
  els.feedback.textContent = "Here it is. No point for this word.";
  els.feedback.className = "feedback";
  showGamePolygon(word.targets[0].points, "show");
  setTimeout(nextWord, 1400);
}

function getBuilderInstruction(wordText) {
  if (!wordText) return "Select a word to begin.";
  return `Click around "${wordText}", then click the first point to close it.`;
}

function finishGame() {
  const total = state.game.order.length;
  const percent = total ? Math.round((state.game.score / total) * 100) : 0;
  els.resultScore.textContent = `${percent}%`;
  els.resultDetail.textContent = `You found ${state.game.score} of ${total} words.`;
  showScreen("result");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "menu") showScreen("menu");
  if (action === "builder") {
    resetBuilder();
    showScreen("builder");
  }
  if (action === "game-menu") showScreen("gameMenu");
});

document.addEventListener("keydown", (event) => {
  const isUndoShortcut = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z";
  if (!isUndoShortcut) return;

  if (!screens.builder.classList.contains("active")) return;
  if (!state.builder.selectedWord) return;
  if (document.activeElement !== els.builderStage) return;

  const undone = undoPolygonPoint();
  if (undone) event.preventDefault();
});

els.imageUpload.addEventListener("change", () => {
  const file = els.imageUpload.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => setBuilderImage(reader.result));
  reader.readAsDataURL(file);
});

els.loadWords.addEventListener("click", () => {
  const oldTargets = new Map(state.builder.words.map((word) => [word.text.toLowerCase(), structuredClone(word.targets)]));
  state.builder.words = parseWords(els.wordInput.value).map((text) => ({
    text,
    targets: oldTargets.get(text.toLowerCase()) || []
  }));
  state.builder.selectedWord = state.builder.words[0]?.text || "";
  state.builder.pendingPoint = null;
  state.builder.draftPolygon = [];
  renderBuilderWords();
  renderBuilderOverlays();
  setBuilderStatus(state.builder.words.length ? getBuilderInstruction(state.builder.selectedWord) : "Add one word per line.");
});

els.undoPoint.addEventListener("click", () => {
  undoPolygonPoint();
});
els.clearSelected.addEventListener("click", clearSelectedMarkers);
els.clearBuilder.addEventListener("click", resetBuilder);
els.saveActivity.addEventListener("click", saveActivity);
els.startGame.addEventListener("click", startGame);
els.showMe.addEventListener("click", showCurrentAnswer);
els.playAgain.addEventListener("click", () => {
  if (state.game.activity) openGame(state.game.activity.id);
});

els.builderStage.addEventListener("click", (event) => {
  if (!state.builder.image || !state.builder.selectedWord) return;
  if (!isPointerInsideImage(event, els.builderStage, els.builderImage)) return;
  els.builderStage.focus();
  const point = eventToPercent(event, els.builderStage, els.builderImage);
  addPolygonPoint(point);
});

els.gameStage.addEventListener("click", handleGameClick);

els.builderImage.addEventListener("load", () => {
  syncOverlayToImage(els.builderStage, els.builderImage, els.builderOverlays);
  renderBuilderOverlays();
});

els.gameImage.addEventListener("load", () => {
  syncOverlayToImage(els.gameStage, els.gameImage, els.gameOverlays);
});

window.addEventListener("resize", () => {
  renderBuilderOverlays();
  syncOverlayToImage(els.gameStage, els.gameImage, els.gameOverlays);
});

loadActivities();
renderActivityLists();
