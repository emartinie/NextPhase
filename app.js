"use strict";

const verses = [
  "In the beginning was the Word, and the Word was with God, and the Word was God.",
  "The same was in the beginning with God.",
  "All things were made by him; and without him was not any thing made that was made.",
  "In him was life; and the life was the light of men.",
  "And the light shineth in darkness; and the darkness comprehended it not."
];

const entries = {
  scripture: { title: "John 1:1–5", detail: "Scripture · King James Version", icon: "book", color: "blue" },
  context: { title: "Creation echoes in John", detail: "Research · John 1 and Genesis 1", icon: "compass", color: "purple" },
  discussion: { title: "Light in the darkness", detail: "Fellowship · Reading Circle", icon: "chat", color: "green" }
};
const titles = { home: "Home", study: "Study", fellowship: "Fellowship", explore: "Explore" };
const screen = document.getElementById("screen");
const dialog = document.getElementById("overlay");
const panelTitle = document.getElementById("panel-title");
const panelBody = document.getElementById("panel-body");
const backButton = document.getElementById("panel-back");
const player = document.getElementById("player");
const playback = document.getElementById("playback");
const playerStatus = document.getElementById("player-status");
const toast = document.getElementById("toast");
const speech = window.speechSynthesis;
const canNarrate = Boolean(speech) && typeof SpeechSynthesisUtterance === "function";
const positions = {};
const historyStack = [];
let activeTab;
let panel;
let returnFocus;
let studyFace = "reading";
let fellowshipFilter = "All";
let promptDraft = "";
let noteDraft = "";
let speechRun;
let toastTimer;

const messages = [
  { text: "I’m here as you read. Try asking about John’s opening line or looking up a related passage." }
];
const storageKey = "nextphase-prototype-v1";
let library = { saved: false, notes: [] };
try {
  const previous = JSON.parse(localStorage.getItem(storageKey));
  if (previous && Array.isArray(previous.notes)) library = previous;
} catch {
  // The prototype remains usable when local storage is unavailable.
}

function persistLibrary() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(library));
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function icon(name) {
  return `<svg aria-hidden="true"><use href="#icon-${name}"/></svg>`;
}

function tile(name, color) {
  return `<span class="tile ${color}">${icon(name)}</span>`;
}

function iconButton(label, name, action) {
  return `<button class="icon-button" type="button" data-action="${action}" aria-label="${label}">${icon(name)}</button>`;
}

function row(label, detail, name, color, action) {
  return `<button type="button" class="row" data-action="${action}">
    ${tile(name, color)}<span class="row-copy"><strong>${escapeHtml(label)}</strong>
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</span>${icon("next")}
  </button>`;
}

function entry(key) {
  const item = entries[key];
  return row(item.title, item.detail, item.icon, item.color, key);
}

function group(...rows) {
  return `<div class="group">${rows.join("")}</div>`;
}

function section(title, body, control = "") {
  return `<section class="section"><div class="section-heading"><h2>${title}</h2>${control}</div>${body}</section>`;
}

function inlineAction(label, name, action) {
  return `<button type="button" class="inline-action" data-action="${action}">${icon(name)}${label}</button>`;
}

function saveAction() {
  return iconButton(library.saved ? "Remove saved passage" : "Save passage", library.saved ? "check" : "bookmark", "save");
}

function passage(lines = verses) {
  return `<blockquote class="scripture">
    ${lines.map((verse, i) => `<p><sup>${i + 1}</sup>${verse}</p>`).join("")}
    <cite>John 1:${lines.length === 1 ? "1" : "1–5"} · King James Version</cite>
  </blockquote>`;
}

function home() {
  return `<section class="feature">
    <div class="feature-label">${tile("book", "blue")}This week’s study</div>
    <h2>In the Beginning</h2>
    <p>Read Genesis and John side by side.</p>
    <div class="feature-actions">
      <button class="primary" type="button" data-tab="study">Continue study ${icon("arrow")}</button>
      ${saveAction()}
    </div>
  </section>
  ${section("My study", group(
    row("Scripture", "John 1:1–5", "book", "blue", "scripture"),
    row("Research", "Creation echoes in John", "compass", "purple", "context"),
    row("Fellowship", "Reading Circle", "chat", "green", "discussion"),
    row("Listen", "John 1:1–5 read aloud", "headphones", "orange", "listen")
  ), iconButton("Study options", "more", "study-options"))}
  ${section("Your library", group(
    row("Saved & notes", "Passages and personal notes", "bookmark", "gold", "library")
  ))}`;
}

function study() {
  const reading = `<div class="prose">
    <h2>In the Beginning</h2>
    <p>John opens with words that echo the first line of Genesis. Both passages invite the reader to pay attention to what happens when God speaks and light enters the story.</p>
    ${passage(verses.slice(0, 1))}
    ${inlineAction("Open John 1:1–5", "book", "scripture")}
    <h2>Read the passages together</h2>
    <p>Genesis 1 moves from darkness to light through the spoken word. John moves from the Word to life and light. Read both openings slowly and note the order in which those ideas appear.</p>
    ${inlineAction("Open Genesis 1:1–3", "book", "genesis")}
    <h2>For reflection</h2>
    <p>Where does John repeat a word or idea? What does that repetition help you notice about the relationship between life and light?</p>
    ${inlineAction("Open the discussion", "chat", "discussion")}
  </div>`;
  const context = `<div class="prose">
    <h2>Creation echoes in John</h2>
    <p>Notice the shared opening phrase “In the beginning.” Set the two passages side by side and pay attention to where they diverge.</p>
    ${inlineAction("Compare the openings", "compass", "context")}
    <h2>Questions for your group</h2>
    <p>What does each writer put first? How do their images of darkness and light shape the next part of the story?</p>
    ${inlineAction("Add a personal note", "note", "note")}
  </div>`;
  return `<div class="section-heading">
    <div class="chips" role="group" aria-label="Study face">
      <button class="chip" type="button" data-face="reading" aria-pressed="${studyFace === "reading"}">Reading</button>
      <button class="chip" type="button" data-face="context" aria-pressed="${studyFace === "context"}">Context</button>
    </div>
    ${iconButton("Flip study card", "flip", "flip")}
  </div><section class="section">${studyFace === "reading" ? reading : context}</section>`;
}

function fellowship() {
  return `<div class="chips" role="group" aria-label="Fellowship filter">
    ${["All", "Reading Circle", "Prayer"].map(label => `<button type="button" class="chip" data-filter="${label}" aria-pressed="${label === fellowshipFilter}">${label}</button>`).join("")}
  </div>
  ${section("Discussions", group(
    fellowshipFilter !== "Prayer" ? entry("discussion") : "",
    fellowshipFilter !== "Reading Circle" ? row("For our neighbors", "Prayer · 2 reflections", "chat", "purple", "prayer") : ""
  ))}`;
}

function explore() {
  return `${section("Discover", group(
    entry("context"),
    row("Genesis 1:1–3", "Scripture · Creation", "book", "blue", "genesis"),
    row("Read aloud", "John 1:1–5", "headphones", "orange", "listen")
  ))}${section("From your library", group(
    row("Saved & notes", "Your personal study material", "bookmark", "gold", "library")
  ))}`;
}

const screens = { home, study, fellowship, explore };

function renderScreen() {
  screen.innerHTML = `<h1 id="screen-title" tabindex="-1">${titles[activeTab]}</h1>${screens[activeTab]()}`;
}

function changeTab(tab, focus = true) {
  if (tab === activeTab) return;
  if (activeTab) positions[activeTab] = screen.scrollTop;
  activeTab = tab;
  renderScreen();
  screen.scrollTop = positions[tab] || 0;
  document.querySelectorAll(".tab-bar [data-tab]").forEach(button => {
    if (button.dataset.tab === tab) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (focus) document.getElementById("screen-title").focus({ preventScroll: true });
}

function companionContent() {
  return `<div id="conversation" class="conversation" role="log" aria-label="Companion conversation">
    ${messages.map(message => `<p class="bubble ${message.mine ? "mine" : ""}">${escapeHtml(message.text)}</p>`).join("")}
  </div>
  <div class="chips">
    <button class="chip" type="button" data-action="companion-context">Why “in the beginning”?</button>
    <button class="chip" type="button" data-action="scripture">Open John 1</button>
  </div>
  <form id="companion-form" class="prompt-form">
    <input name="prompt" aria-label="Ask the demo Companion" placeholder="Ask the demo Companion…" value="${escapeHtml(promptDraft)}" maxlength="400" required>
    <button class="primary" type="submit" aria-label="Send to Companion">${icon("send")}</button>
  </form>`;
}

const panels = {
  actions: () => ["Quick actions", group(
    row("Add a note", "Keep a thought from this study", "note", "gold", "note"),
    row("Open Scripture", "John 1:1–5", "book", "blue", "scripture"),
    row("Open Companion", "", "spark", "purple", "companion"),
    row("Listen", "Read John 1 aloud", "headphones", "orange", "listen")
  )],
  "study-options": () => ["Study options", group(
    row(library.saved ? "Remove saved passage" : "Save John 1:1–5", "", "bookmark", "gold", "save"),
    row("Add a note", "", "note", "blue", "note"),
    row("Compare with Genesis", "", "flip", "purple", "context")
  )],
  scripture: () => ["John 1:1–5", `<div class="prose">${passage()}</div>
    <div class="chips">${inlineAction("Creation context", "compass", "context")}
    ${inlineAction("Listen", "headphones", "listen")}${saveAction()}</div>`],
  genesis: () => ["Genesis 1:1–3", `<div class="prose"><blockquote class="scripture">
    <p><sup>1</sup>In the beginning God created the heaven and the earth.</p>
    <p><sup>2</sup>And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.</p>
    <p><sup>3</sup>And God said, Let there be light: and there was light.</p>
    <cite>Genesis 1:1–3 · King James Version</cite>
  </blockquote></div>${inlineAction("Open John 1:1–5", "book", "scripture")}`],
  context: () => ["Creation echoes in John", `<div class="prose">
    <p>John begins with the same opening phrase as Genesis. Genesis tells of God creating and speaking light into darkness. John introduces the Word, through whom all things were made, and connects life with light.</p>
    <h3>A detail to look for</h3><p>Try marking each mention of beginning, light and darkness. Where does John add something new?</p>
  </div><div class="chips">${inlineAction("Genesis 1:1–3", "book", "genesis")}${inlineAction("John 1:1–5", "book", "scripture")}</div>`],
  discussion: () => ["Light in the darkness", `<div class="prose">
    <p class="muted">Reading Circle · Sample discussion</p>
    <h3>Mara H.</h3><p>I hadn’t noticed how quickly John moves from creation to life. What stood out to you when you read these verses with Genesis?</p>
    <h3>Daniel R.</h3><p>The light keeps shining even with the darkness still there. That’s the line I took into the week.</p>
  </div><div class="chips">${inlineAction("Read John 1:1–5", "book", "scripture")}${inlineAction("Keep a private note", "note", "note")}</div>`],
  prayer: () => ["For our neighbors", `<div class="prose">
    <p class="muted">Prayer · Sample discussion</p>
    <h3>Nadia S.</h3><p>Our group is praying for the families moving into the apartment complex this week.</p>
    <h3>Sam T.</h3><p>I’m praying for chances to offer a meal or help someone get settled.</p>
  </div>${inlineAction("Keep a private note", "note", "note")}`],
  library: () => ["Saved & notes", `${library.saved ? group(entry("scripture")) : '<p class="empty">Save a passage to find it here.</p>'}
    ${library.notes.map(note => `<p class="bubble note">${escapeHtml(note)}</p>`).join("")}
    ${inlineAction("Add a note", "note", "note")}`],
  note: () => ["New note", `<form id="note-form" class="form">
    <label for="note-input">Note for this study</label>
    <textarea id="note-input" name="note" rows="4" maxlength="1200" required>${escapeHtml(noteDraft)}</textarea>
    <button class="primary" type="submit">Save on this device</button>
  </form>`],
  search: () => ["Search", `<input id="search-input" type="search" aria-label="Search this prototype" placeholder="Try John, Genesis, or light"><div id="search-results"></div>`],
  companion: () => ["Companion", companionContent()]
};

function renderPanel(focus = true) {
  const [title, body] = panels[panel.key]();
  panelTitle.textContent = title;
  panelBody.innerHTML = body;
  dialog.dataset.placement = ["actions", "study-options"].includes(panel.key) ? "menu" : "sheet";
  backButton.hidden = historyStack.length === 0;
  if (panel.key === "search") {
    document.getElementById("search-input").value = panel.query || "";
    renderSearch(panel.query || "");
  }
  panelBody.scrollTop = panel.scroll || 0;
  if (focus) panelTitle.focus({ preventScroll: true });
}

function openPanel(key, opener) {
  if (dialog.open) {
    if (key === panel.key) return;
    panel.scroll = panelBody.scrollTop;
    historyStack.push(panel);
  } else {
    returnFocus = opener;
  }
  panel = { key };
  renderPanel(false);
  if (!dialog.open) dialog.showModal();
  panelTitle.focus({ preventScroll: true });
}

function previousPanel() {
  panel = historyStack.pop();
  renderPanel();
}

function renderSearch(query) {
  const normalized = query.trim().toLowerCase();
  const matches = Object.keys(entries).filter(key =>
    [entries[key].title, entries[key].detail].join(" ").toLowerCase().includes(normalized)
  ).map(entry);
  if ("genesis 1:1–3 scripture creation".includes(normalized)) {
    matches.push(row("Genesis 1:1–3", "Scripture · Creation", "book", "blue", "genesis"));
  }
  document.getElementById("search-results").innerHTML = matches.length
    ? group(...matches)
    : '<p class="empty">No matching passages or discussions.</p>';
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toastTimer = setTimeout(() => { toast.textContent = ""; }, 3200);
}

function updatePlayback(label, iconName, status) {
  playback.setAttribute("aria-label", label);
  playback.innerHTML = icon(iconName);
  playerStatus.textContent = status;
}

function stopPlayer() {
  speechRun = undefined;
  speech?.cancel();
  player.hidden = true;
  updatePlayback("Play reading", "play", canNarrate ? "Read aloud" : "Read aloud unavailable");
}

function togglePlayback() {
  if (speechRun && speech.paused) {
    speech.resume();
    updatePlayback("Pause reading", "pause", "Reading aloud");
    return;
  }
  if (speechRun) {
    speech.pause();
    updatePlayback("Resume reading", "play", "Paused");
    return;
  }
  const utterance = new SpeechSynthesisUtterance(verses.join(" "));
  utterance.lang = "en-US";
  utterance.rate = .9;
  speechRun = utterance;
  function finish(status) {
    if (speechRun !== utterance) return;
    speechRun = undefined;
    updatePlayback("Play reading", "play", status);
  }
  utterance.onend = () => finish("Read aloud");
  utterance.onerror = () => finish("Voice unavailable · Tap to retry");
  updatePlayback("Pause reading", "pause", "Reading aloud");
  speech.speak(utterance);
}

function respondToCompanion(question) {
  const contextQuestion = /beginning|genesis|creat|word/i.test(question);
  const lightQuestion = /light|dark/i.test(question);
  const answer = contextQuestion
    ? "John’s first words echo Genesis 1. Genesis opens with God creating, and John introduces the Word through whom creation came to be. Open John 1 and choose Creation context to compare the passages."
    : lightQuestion
      ? "John 1:4–5 connects life with light, then describes the light shining in darkness. Open the passage and look at what each verse adds."
      : "This demo has prepared notes on John 1, creation, and light. Try asking about one of those topics.";
  messages.push({ text: question, mine: true }, { text: answer });
  promptDraft = "";
  renderPanel(false);
  document.querySelector("#companion-form input").focus({ preventScroll: true });
  panelBody.scrollTop = panelBody.scrollHeight;
}

function toggleSaved(button) {
  library.saved = !library.saved;
  const persisted = persistLibrary();
  if (panel?.key === "study-options") {
    renderPanel();
  } else {
    button.setAttribute("aria-label", library.saved ? "Remove saved passage" : "Save passage");
    button.innerHTML = icon(library.saved ? "check" : "bookmark");
  }
  const message = library.saved ? "Passage saved" : "Passage removed";
  // A modal covers the app-level toast, so announce changes inside it.
  if (dialog.open) {
    let status = document.getElementById("panel-status");
    if (!status) {
      status = document.createElement("p");
      status.id = "panel-status";
      status.className = "muted";
      status.setAttribute("role", "status");
      panelBody.append(status);
    }
    status.textContent = persisted ? message : message + " for this visit";
  } else {
    notify(persisted ? message : message + " for this visit");
  }
}

function refreshScreen(focusSelector) {
  const top = screen.scrollTop;
  renderScreen();
  screen.scrollTop = top;
  screen.querySelector(focusSelector)?.focus({ preventScroll: true });
}

document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const { tab, face, filter, action } = button.dataset;
  if (tab) {
    changeTab(tab);
  } else if (face || action === "flip") {
    studyFace = face || (studyFace === "reading" ? "context" : "reading");
    refreshScreen(face ? `[data-face="${studyFace}"]` : '[data-action="flip"]');
  } else if (filter) {
    fellowshipFilter = filter;
    refreshScreen(`[data-filter="${filter}"]`);
  } else if (action === "listen") {
    if (dialog.open) dialog.close();
    player.hidden = false;
    if (canNarrate && !speechRun) togglePlayback();
    const playerControl = canNarrate ? playback : player.querySelector('[data-action="stop-player"]');
    playerControl.focus({ preventScroll: true });
  } else if (action === "stop-player") {
    stopPlayer();
    document.querySelector(".companion-launch").focus({ preventScroll: true });
  } else if (action === "save") {
    toggleSaved(button);
  } else if (action === "companion-context") {
    respondToCompanion("Why does John start with “in the beginning”?");
  } else if (Object.hasOwn(panels, action)) {
    openPanel(action, button);
  }
});

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});
document.getElementById("panel-close").addEventListener("click", () => dialog.close());
backButton.addEventListener("click", previousPanel);
dialog.addEventListener("close", () => {
  historyStack.length = 0;
  panel = undefined;
  if (document.activeElement === document.body || dialog.contains(document.activeElement)) {
    const destination = returnFocus?.isConnected ? returnFocus : document.getElementById("screen-title");
    destination.focus({ preventScroll: true });
  }
  returnFocus = undefined;
});
dialog.addEventListener("input", event => {
  const field = event.target;
  if (field.id === "search-input") {
    panel.query = field.value;
    renderSearch(panel.query);
  }
  if (field.name === "prompt") promptDraft = field.value;
  if (field.name === "note") noteDraft = field.value;
});
dialog.addEventListener("submit", event => {
  event.preventDefault();
  const form = event.target;
  const field = form.elements.namedItem(form.id === "note-form" ? "note" : "prompt");
  const value = field.value.trim();
  if (!value) {
    field.focus();
    return;
  }
  if (form.id === "companion-form") {
    respondToCompanion(value);
  } else {
    library.notes.push(value);
    const persisted = persistLibrary();
    noteDraft = "";
    panel = { key: "library" };
    renderPanel();
    const status = document.createElement("p");
    status.className = "muted";
    status.setAttribute("role", "status");
    status.textContent = persisted ? "Note saved on this device" : "Note saved for this visit";
    panelBody.prepend(status);
  }
});

playback.addEventListener("click", togglePlayback);
if (!canNarrate) {
  playback.disabled = true;
  playerStatus.textContent = "Read aloud unavailable";
}
window.addEventListener("pagehide", stopPlayer);
changeTab("home", false);
