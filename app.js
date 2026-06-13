const SUPABASE_URL = "https://znxqhbfdfejuuaxjnaso.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpueHFoYmZkZmVqdXVheGpuYXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwOTA4MjUsImV4cCI6MjA5NjY2NjgyNX0.VVRfSPrbMP99ybMSxxHtDQ_yn1k_vxCxBn8cBOHeKV8";
const SUPABASE_IMAGE_BUCKET = "scene-images";

const supabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const state = {
  activities: [],
  isLoadingActivities: false,
  activitiesError: "",
  studentQuery: "",
  studentNameQuery: "",
  builder: {
    id: null,
    image: "",
    imageUrl: "",
    imageFile: null,
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
    usedShowMe: false
  }
};

const screens = {
  menu: document.querySelector("#menu-screen"),
  teacherGate: document.querySelector("#teacher-gate-screen"),
  builder: document.querySelector("#builder-screen"),
  gameMenu: document.querySelector("#game-menu-screen"),
  game: document.querySelector("#game-screen"),
  result: document.querySelector("#result-screen")
};

const els = {
  playActivityList: document.querySelector("#play-activity-list"),
  studentSearch: document.querySelector("#student-search"),
  studentNameSearch: document.querySelector("#student-name-search"),
  studentActivityCount: document.querySelector("#student-activity-count"),
  studentLibraryStatus: document.querySelector("#student-library-status"),
  teacherEmail: document.querySelector("#teacher-email"),
  teacherContinue: document.querySelector("#teacher-continue"),
  activityName: document.querySelector("#activity-name"),
  activityCategory: document.querySelector("#activity-category"),
  newCategoryInput: document.querySelector("#new-category-input"),
  activityDescription: document.querySelector("#activity-description"),
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
  showMe: document.querySelector("#show-me"),
  gameStage: document.querySelector("#game-stage"),
  gameImage: document.querySelector("#game-image"),
  gameOverlays: document.querySelector("#game-overlays"),
  resultScore: document.querySelector("#result-score"),
  resultDetail: document.querySelector("#result-detail"),
  playAgain: document.querySelector("#play-again")
};

function normalizeActivity(activity) {
  return {
    id: activity.id,
    name: activity.name,
    category: activity.category || "",
    description: activity.description || "",
    image: activity.image_url,
    words: (activity.words_json || []).map((word) => ({
      text: word.text,
      targets: normalizeTargets(word)
    }))
  };
}

function requireSupabase() {
  if (!supabaseClient) {
    throw new Error("Supabase client failed to load. Refresh the page and try again.");
  }
  return supabaseClient;
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
  if (name === "gameMenu") renderActivityLists();
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

function getAvailableCategories() {
  return [...new Set(
    state.activities
      .map((activity) => (activity.category || "").trim())
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right));
}

function renderCategoryOptions(selectedValue = els.activityCategory.value) {
  const categories = getAvailableCategories();
  const currentValue = (selectedValue || "").trim();
  els.activityCategory.innerHTML = "";

  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = categories.length ? "No category" : "No categories yet";
  els.activityCategory.append(noneOption);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.activityCategory.append(option);
  });

  const createOption = document.createElement("option");
  createOption.value = "__new__";
  createOption.textContent = "Create new category";
  els.activityCategory.append(createOption);

  if (currentValue && !categories.includes(currentValue) && currentValue !== "__new__") {
    els.activityCategory.value = "__new__";
    els.newCategoryInput.value = currentValue;
  } else {
    els.activityCategory.value = currentValue;
    if (els.activityCategory.value !== currentValue) {
      els.activityCategory.value = "";
    }
  }
  toggleNewCategoryField();
}

function renderStudentCategoryFilter() {
  const categories = getAvailableCategories();
  const currentValue = state.studentQuery.trim();
  els.studentSearch.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All categories";
  els.studentSearch.append(allOption);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.studentSearch.append(option);
  });

  els.studentSearch.value = currentValue;
  if (els.studentSearch.value !== currentValue) {
    els.studentSearch.value = "";
    state.studentQuery = "";
  }
}

function toggleNewCategoryField() {
  const shouldShow = els.activityCategory.value === "__new__";
  els.activityCategory.classList.toggle("hidden", shouldShow);
  els.newCategoryInput.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    els.newCategoryInput.value = "";
    return;
  }
  els.newCategoryInput.focus();
  els.newCategoryInput.select();
}

function renderActivityLists() {
  const filteredStudentActivities = getFilteredStudentActivities();
  els.studentActivityCount.textContent = String(filteredStudentActivities.length);
  renderActivityList(els.playActivityList, filteredStudentActivities, true);
  updateStudentLibraryStatus(filteredStudentActivities.length);
  renderCategoryOptions();
  renderStudentCategoryFilter();
}

function getFilteredStudentActivities() {
  const categoryQuery = state.studentQuery.trim().toLowerCase();
  const nameQuery = state.studentNameQuery.trim().toLowerCase();

  return state.activities.filter((activity) => {
    const matchesCategory = !categoryQuery || (activity.category || "").toLowerCase() === categoryQuery;
    const matchesName = !nameQuery || activity.name.toLowerCase().includes(nameQuery);
    return matchesCategory && matchesName;
  });
}

function updateStudentLibraryStatus(matchCount) {
  if (state.isLoadingActivities) {
    els.studentLibraryStatus.textContent = "Loading levels...";
    return;
  }

  if (state.activitiesError) {
    els.studentLibraryStatus.textContent = state.activitiesError;
    return;
  }

  const hasCategoryFilter = Boolean(state.studentQuery.trim());
  const hasNameFilter = Boolean(state.studentNameQuery.trim());

  if (!hasCategoryFilter && !hasNameFilter) {
    els.studentLibraryStatus.textContent = `Browse ${state.activities.length} saved level${state.activities.length === 1 ? "" : "s"}.`;
    return;
  }

  const filterParts = [];
  if (hasCategoryFilter) filterParts.push(state.studentQuery.trim());
  if (hasNameFilter) filterParts.push(state.studentNameQuery.trim());
  els.studentLibraryStatus.textContent = `${matchCount} level${matchCount === 1 ? "" : "s"} for ${filterParts.join(" • ")}.`;
}

function renderActivityList(target, activities, playOnly) {
  target.innerHTML = "";

  if (state.isLoadingActivities) {
    const loading = document.createElement("p");
    loading.className = playOnly ? "library-empty" : "helper-text";
    loading.textContent = "Loading activities...";
    target.append(loading);
    return;
  }

  if (state.activitiesError) {
    const error = document.createElement("p");
    error.className = playOnly ? "library-empty" : "helper-text";
    error.textContent = state.activitiesError;
    target.append(error);
    return;
  }

  if (!activities.length) {
    const empty = document.createElement("p");
    empty.className = playOnly ? "library-empty" : "helper-text";
    empty.textContent = playOnly && (state.studentQuery.trim() || state.studentNameQuery.trim())
      ? "No levels match those filters."
      : "No activities saved yet.";
    target.append(empty);
    return;
  }

  activities.forEach((activity) => {
    const card = document.createElement("article");
    card.className = `activity-card ${playOnly ? "play-card" : ""}`.trim();

    if (activity.image) {
      const media = document.createElement("div");
      media.className = "activity-card-media";
      const image = document.createElement("img");
      image.src = activity.image;
      image.alt = "";
      media.append(image);
      card.append(media);
    }

    const content = document.createElement("div");
    content.className = "activity-card-body";

    const title = document.createElement("strong");
    title.textContent = activity.name;
    const detail = document.createElement("p");
    detail.textContent = `${activity.words.length} words mapped`;
    if (playOnly) {
      if (activity.category) {
        const categoryMeta = document.createElement("span");
        categoryMeta.className = "play-card-meta";
        categoryMeta.textContent = activity.category;
        content.append(categoryMeta);
      }
      const meta = document.createElement("span");
      meta.className = "play-card-meta";
      meta.textContent = `${activity.words.length} words`;
      content.append(meta);
    }

    content.append(title, detail);

    if (playOnly && activity.description) {
      const description = document.createElement("p");
      description.className = "play-card-description";
      description.textContent = activity.description;
      content.append(description);
    }

    const actions = document.createElement("div");
    actions.className = "activity-card-actions";
    actions.append(makeButton("Play", "mini-button", () => openGame(activity.id)));
    if (!playOnly) {
      actions.append(
        makeButton("Edit", "mini-button", () => editActivity(activity.id)),
        makeButton("Delete", "mini-button danger", () => deleteActivity(activity.id))
      );
    }
    content.append(actions);
    card.append(content);
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
  state.builder = { id: null, image: "", imageUrl: "", imageFile: null, words: [], selectedWord: "", pendingPoint: null, draftPolygon: [] };
  els.activityName.value = "";
  els.activityCategory.value = "";
  els.newCategoryInput.value = "";
  els.activityDescription.value = "";
  els.imageUpload.value = "";
  els.wordInput.value = "";
  els.builderImage.src = "";
  els.emptyBuilder.classList.remove("hidden");
  els.builderStage.classList.add("empty");
  renderCategoryOptions("");
  renderBuilderWords();
  renderBuilderOverlays();
  setBuilderStatus("Upload an image and load words to begin.");
}

function openTeacherEntry() {
  showScreen("teacherGate");
}

function openStudentEntry() {
  state.studentQuery = "";
  state.studentNameQuery = "";
  els.studentSearch.value = "";
  els.studentNameSearch.value = "";
  showScreen("gameMenu");
}

function openTeacherBuilder() {
  resetBuilder();
  showScreen("builder");
}

function editActivity(id) {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return;

  state.builder = {
    id: activity.id,
    image: activity.image,
    imageUrl: activity.image,
    imageFile: null,
    words: structuredClone(activity.words),
    selectedWord: activity.words[0]?.text || "",
    pendingPoint: null,
    draftPolygon: []
  };

  els.activityName.value = activity.name;
  renderCategoryOptions(activity.category || "");
  els.newCategoryInput.value = "";
  els.activityDescription.value = activity.description || "";
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
    deleteActivityRemote(id);
  }
}

function setBuilderImage(src, imageUrl = state.builder.imageUrl, imageFile = state.builder.imageFile) {
  state.builder.image = src;
  state.builder.imageUrl = imageUrl;
  state.builder.imageFile = imageFile;
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
  saveActivityRemote();
}

async function uploadSceneImage(file) {
  const client = requireSupabase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const fileName = `${Date.now()}-${safeName}`;
  const filePath = `activities/${fileName}`;
  const { error: uploadError } = await client.storage
    .from(SUPABASE_IMAGE_BUCKET)
    .upload(filePath, file, { upsert: false });

  if (uploadError) throw new Error(`Image upload failed for bucket "${SUPABASE_IMAGE_BUCKET}": ${uploadError.message}`);

  const { data } = client.storage
    .from(SUPABASE_IMAGE_BUCKET)
    .getPublicUrl(filePath);

  if (!data?.publicUrl) throw new Error("Image upload failed: no public URL returned.");
  return data.publicUrl;
}

async function loadActivities() {
  state.isLoadingActivities = true;
  state.activitiesError = "";
  renderActivityLists();

  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from("activities")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });

    state.isLoadingActivities = false;

    if (error) {
      state.activities = [];
      state.activitiesError = `Could not load activities: ${error.message}`;
      renderActivityLists();
      return;
    }

    state.activities = (data || []).map(normalizeActivity);
    renderActivityLists();
  } catch (error) {
    state.isLoadingActivities = false;
    state.activities = [];
    state.activitiesError = error.message || "Could not load activities.";
    renderActivityLists();
  }
}

async function persistActivities(activity) {
  const client = requireSupabase();
  const payload = {
    name: activity.name,
    category: activity.category,
    description: activity.description,
    image_url: activity.image,
    words_json: activity.words,
    published: true
  };

  if (activity.id) {
    const { error } = await client
      .from("activities")
      .update(payload)
      .eq("id", activity.id);
    if (error) throw new Error(`Could not update activity: ${error.message}`);
    return activity.id;
  }

  const { data, error } = await client
    .from("activities")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(`Could not save activity: ${error.message}`);
  return data.id;
}

async function saveActivityRemote() {
  const name = els.activityName.value.trim();
  const selectedCategory = els.activityCategory.value.trim();
  const category = selectedCategory === "__new__"
    ? els.newCategoryInput.value.trim()
    : selectedCategory;
  const description = els.activityDescription.value.trim();
  const mapped = getMappedWords();

  if (!name) return alert("Please name the activity.");
  if (selectedCategory === "__new__" && !category) return alert("Please enter a new category name.");
  if (!state.builder.image) return alert("Please upload an image.");
  if (!state.builder.words.length) return alert("Please add vocabulary words.");
  if (mapped.length !== state.builder.words.length) return alert("Please finish at least one polygon for every word.");

  const originalLabel = els.saveActivity.textContent;
  els.saveActivity.disabled = true;
  els.saveActivity.textContent = "Saving...";
  setBuilderStatus("Saving activity...");

  try {
    let imageUrl = state.builder.imageUrl;
    if (state.builder.imageFile) {
      imageUrl = await uploadSceneImage(state.builder.imageFile);
    }

    if (!imageUrl) throw new Error("Please upload an image before saving.");

    const activity = {
      id: state.builder.id,
      name,
      category,
      description,
      image: imageUrl,
      words: structuredClone(state.builder.words)
    };

    activity.id = await persistActivities(activity);
    state.builder.id = activity.id;
    state.builder.imageUrl = imageUrl;
    const normalizedActivity = normalizeActivity({
      id: activity.id,
      name: activity.name,
      category: activity.category,
      description: activity.description,
      image_url: activity.image,
      words_json: activity.words
    });
    const existingIndex = state.activities.findIndex((item) => item.id === normalizedActivity.id);
    if (existingIndex >= 0) state.activities[existingIndex] = normalizedActivity;
    else state.activities.unshift(normalizedActivity);
    renderActivityLists();
    showScreen("teacherGate");
    setBuilderStatus("Activity saved.");
    loadActivities();
  } catch (error) {
    const message = error.message || "Could not save activity.";
    setBuilderStatus(message);
    alert(message);
  } finally {
    els.saveActivity.disabled = false;
    els.saveActivity.textContent = originalLabel;
  }
}

async function deleteActivityRemote(id) {
  try {
    const client = requireSupabase();
    const { error } = await client
      .from("activities")
      .delete()
      .eq("id", id);

    if (error) {
      state.activitiesError = `Could not delete activity: ${error.message}`;
      renderActivityLists();
      return;
    }

    state.activities = state.activities.filter((item) => item.id !== id);
    renderActivityLists();
  } catch (error) {
    state.activitiesError = error.message || "Could not delete activity.";
    renderActivityLists();
  }
}

function openGame(id) {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return;

  state.game = {
    activity,
    order: structuredClone(activity.words),
    index: 0,
    score: 0,
    answered: false,
    usedShowMe: false
  };

  els.gameImage.src = activity.image;
  els.gameActivityName.textContent = activity.name;
  updateGameStats();
  els.gameOverlays.innerHTML = "";
  showScreen("game");
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
  if (!word || state.game.answered) return;

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
  if (!word) return;

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

  if (action === "home" || action === "menu") showScreen("menu");
  if (action === "teacher-entry") openTeacherEntry();
  if (action === "student-entry" || action === "game-menu") openStudentEntry();
  if (action === "builder") {
    openTeacherBuilder();
  }
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
  reader.addEventListener("load", () => {
    setBuilderImage(reader.result, state.builder.imageUrl, file);
    setBuilderStatus("Image selected. It will upload to Supabase when you save the activity.");
  });
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
els.studentSearch.addEventListener("change", () => {
  state.studentQuery = els.studentSearch.value;
  renderActivityLists();
});
els.studentNameSearch.addEventListener("input", () => {
  state.studentNameQuery = els.studentNameSearch.value;
  renderActivityLists();
});
els.activityCategory.addEventListener("change", toggleNewCategoryField);
els.teacherContinue.addEventListener("click", openTeacherBuilder);
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
