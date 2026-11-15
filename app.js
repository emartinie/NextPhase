"use strict";

const $ = id => document.getElementById(id);
const viewport = $("viewport");
const view = $("view");
const rail = $("right-rail");
const dialog = $("excursion");
const body = $("panel-body");
const title = $("panel-title");
const stack = [];
const places = new Map();
const conversations = new Map();
const questionDrafts = new Map();
const replyDrafts = new Map();
const noteDrafts = new Map();
const storageKey = "nextphase-v2";
let model = { joined: ["circle", "research"], saved: [], notes: [], replies: {} };
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (stored && Array.isArray(stored.joined) && Array.isArray(stored.saved) &&
      Array.isArray(stored.notes) && stored.replies && typeof stored.replies === "object") model = stored;
} catch {
  // Keep the demo usable when browser storage is unavailable.
}

let week = curriculum[0];
let activeView = "thread";
let feedFilter = "all";
let notebookFilter = "all";
let frame;
let origin;
let afterClose;

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(model));
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}

function icon(name) {
  return `<svg aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function attrs(spec) {
  return Object.entries(spec).map(([name, value]) => `data-${name}="${escapeHtml(value)}"`).join(" ");
}

function button(label, name, spec, className = "button") {
  return `<button type="button" class="${className}" ${attrs(spec)}>${name ? icon(name) : ""}<span>${escapeHtml(label)}</span></button>`;
}

function iconButton(label, name, spec) {
  return `<button type="button" class="icon-button" aria-label="${escapeHtml(label)}" ${attrs(spec)}>${icon(name)}</button>`;
}

function row(label, detail, name, spec, tone = "blue") {
  return `<button type="button" class="row" ${attrs(spec)}>
    <span class="row-icon ${tone}">${icon(name)}</span>
    <span class="row-label"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></span>
    ${icon("next")}
  </button>`;
}

function heading(label, description = "") {
  return `<header class="view-header"><h1 id="view-title" tabindex="-1">${label}</h1>${description ? `<p>${description}</p>` : ""}</header>`;
}

function passageText(key, interactive = false, selected = 0) {
  const passage = passages[key];
  return `<div class="verses">${passage.lines.map((line, index) => {
    const number = passage.start + index;
    const marker = interactive
      ? `<button type="button" class="verse-number" data-open="verse" data-id="${key}" data-verse="${number}" aria-label="Tools for verse ${number}">${number}</button>`
      : `<sup class="verse-number">${number}</sup>`;
    return `<div class="verse${number === selected ? " selected" : ""}" ${interactive ? `id="verse-${number}"` : ""}>${marker}<p>${escapeHtml(line)}</p></div>`;
  }).join("")}</div>`;
}

function linkedPassage(id) {
  const passage = passages[id];
  return button(passage.title, "book", { open: "scripture", id }, "button reference");
}

function threadView() {
  const passage = passages[week.primary];
  const related = passages[week.related];
  const investigation = investigations[week.investigation];
  const post = posts.find(item => item.id === week.discussion);
  return `<div class="thread-intro">
    <div class="thread-kicker">
      <span class="section-tag"><span></span> THE LIVING THREAD</span>
      ${button(`Week ${week.number} · ${week.name}`, "next", { open: "weeks" }, "button week-switch")}
    </div>
    ${heading(week.title, week.summary)}
  </div>
  <article class="reading" id="reading" aria-labelledby="reading-title">
    <header class="reading-header">
      <div><p class="section-tag">${passage.section} <span class="separator">/</span> KJV</p><h2 id="reading-title">${passage.title}</h2></div>
      ${iconButton("Passage options", "more", { open: "verse", id: week.primary })}
    </header>
    ${passageText(week.primary, true)}
    <div class="reading-footer">
      ${button(related.title, "book", { open: "scripture", id: week.related }, "button reference")}
      ${button("Study tools", "compass", { open: "tools", id: week.primary }, "button subtle")}
    </div>
  </article>
  <section class="connection" id="connections" aria-labelledby="connections-title">
    <div class="connection-mark">${icon("compass")}</div>
    <div class="connection-content">
      <p class="section-tag">FOLLOW THE QUESTION</p>
      <h2 id="connections-title">${week.question}</h2>
      <div class="rows">
        ${row(investigation.title, "Investigation · Evidence and interpretation", "compass", { open: "research", id: week.investigation }, "amber")}
        ${row(post.title, communities[post.community].name, "chat", { open: "discussion", id: post.id }, "green")}
      </div>
    </div>
  </section>
  <section class="connection reflection" id="reflection" aria-labelledby="reflection-title">
    <div class="connection-mark">${icon("note")}</div>
    <div class="connection-content">
      <p class="section-tag">PERSONAL STUDY</p>
      <h2 id="reflection-title">Pause and reflect</h2>
      <p>${week.reflection}</p>
      ${button("Write a note", "note", { open: "note", id: week.primary })}
    </div>
  </section>`;
}

function replyCount(post) {
  return post.replies.length + (model.replies[post.id] || []).length;
}

function feedView() {
  const joined = Object.keys(communities).filter(id => model.joined.includes(id));
  const items = posts.filter(post => joined.includes(post.community) && (feedFilter === "all" || feedFilter === post.community));
  const choices = [["all", "All joined"], ...joined.map(id => [id, communities[id].name])];
  return `${heading("Fellowship", "A shared feed from the communities you follow.")}
    <div class="feed-controls">
      <span class="demo-label">SIMULATED FEED</span>
      ${button("Communities", "plus", { open: "communities" }, "button subtle")}
    </div>
    <div class="filters" role="group" aria-label="Filter Fellowship">${choices.map(([id, label]) => chip(label, id, feedFilter, "feed")).join("")}</div>
    <div class="feed">
      ${items.map(post => `<article class="post">
        <div class="post-byline">
          <span class="avatar ${communities[post.community].color}" aria-hidden="true">${post.initials}</span>
          <div><strong>${post.author}</strong><small>${communities[post.community].name} · ${post.time}</small></div>
        </div>
        <h2>${post.title}</h2>
        <p>${post.text}</p>
        <div class="post-actions">
          ${linkedPassage(post.passage)}
          ${button(replyCount(post) ? `${replyCount(post)} ${replyCount(post) === 1 ? "reply" : "replies"}` : "Discuss", "chat", { open: "discussion", id: post.id }, "button subtle")}
        </div>
      </article>`).join("") || '<p class="empty">Follow a sample community to see its posts here.</p>'}
    </div>`;
}

function chip(label, value, current, type) {
  return `<button type="button" class="chip" data-${type}="${escapeHtml(value)}" aria-pressed="${value === current}">${escapeHtml(label)}</button>`;
}

function notebookView() {
  const notes = model.notes.filter(note => notebookFilter === "all" || note.week === notebookFilter);
  const saved = model.saved.filter(item => notebookFilter === "all" || item.week === notebookFilter);
  return `${heading("Notebook", "Your notes and saved passages on this device.")}
    <div class="filters" role="group" aria-label="Filter notebook">
      ${chip("All weeks", "all", notebookFilter, "notebook")}
      ${curriculum.map(item => chip(item.name, item.id, notebookFilter, "notebook")).join("")}
    </div>
    <section class="notebook-section"><h2>Saved passages</h2>
      <div class="rows">${saved.map(item => {
        const passage = passages[item.passage];
        const detail = curriculum.find(study => study.id === item.week)?.name || "";
        return row(item.verse ? `${passage.book} ${passage.chapter}:${item.verse}` : passage.title, detail, "bookmark", { open: "scripture", id: item.passage, verse: item.verse || "", week: item.week });
      }).join("") || '<p class="empty">Save a passage or verse from the reading tools.</p>'}</div>
    </section>
    <section class="notebook-section"><h2>Notes</h2>
      ${notes.map(item => `<article class="notebook-note">
        <p>${escapeHtml(item.text)}</p>
        ${button(passages[item.passage].title, "book", { open: "scripture", id: item.passage, week: item.week, verse: item.verse || "" }, "button reference")}
      </article>`).join("") || '<p class="empty">Notes you write while studying will appear here.</p>'}
    </section>`;
}

const views = { thread: threadView, fellowship: feedView, notebook: notebookView };
function positionKey() {
  return activeView === "thread" ? week.id : activeView;
}

function renderRail() {
  rail.innerHTML = `<div class="rail-study">
    <p class="section-tag">CURRENT STUDY</p>
    <strong>${week.name}</strong>
    ${button("Change week", "next", { open: "weeks" }, "button subtle")}
  </div>
  <div class="rail-contents">
    <p class="section-tag">IN THIS THREAD</p>
    ${button("Read the passage", "book", { jump: "reading" }, "button rail-link")}
    ${button("Follow the question", "compass", { jump: "connections" }, "button rail-link")}
    ${button("Pause and reflect", "note", { jump: "reflection" }, "button rail-link")}
  </div>`;
}

function renderView() {
  view.innerHTML = views[activeView]();
  document.querySelectorAll("nav [data-view]").forEach(control => {
    if (control.dataset.view === activeView) control.setAttribute("aria-current", "page");
    else control.removeAttribute("aria-current");
  });
  renderRail();
}

function go(viewName, nextWeek = week, jump = "") {
  places.set(positionKey(), viewport.scrollTop);
  const changed = viewName !== activeView || nextWeek.id !== week.id;
  activeView = viewName;
  week = nextWeek;
  if (changed) renderView();
  const target = jump ? $(jump) : $("view-title");
  if (jump) {
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  } else if (changed) {
    target.focus({ preventScroll: true });
    viewport.scrollTop = places.get(positionKey()) || 0;
  }
}

function rerenderView(selector) {
  const top = viewport.scrollTop;
  renderView();
  if (selector) view.querySelector(selector)?.focus({ preventScroll: true });
  viewport.scrollTop = top;
}

function currentStudy(frame) {
  return curriculum.find(item => item.id === frame.week) || week;
}

function currentPassage(frame) {
  return frame.id && passages[frame.id] ? frame.id : currentStudy(frame).primary;
}

function savedIndex(frame) {
  const passage = currentPassage(frame);
  return model.saved.findIndex(item => item.week === frame.week && item.passage === passage && item.verse === (frame.verse || 0));
}

function makeTools(frame) {
  const id = currentPassage(frame);
  const passage = passages[id];
  const study = currentStudy(frame);
  const canRemove = savedIndex(frame) !== -1;
  const details = { id, week: frame.week, verse: frame.verse || "" };
  return `<div class="rows">
    ${row(passage.word + " · " + passage.transliteration, passage.language, "book", { open: "language", ...details }, "violet")}
    ${row(passages[passage.reference].title, "Cross-reference", "flip", { open: "scripture", id: passage.reference, week: frame.week })}
    ${row(investigations[study.investigation].title, "Investigation", "compass", { open: "research", id: study.investigation, week: frame.week }, "amber")}
    ${row(commandments[passage.practice].title, "Commandment · " + commandments[passage.practice].reference, "check", { open: "commandment", id: passage.practice, week: frame.week }, "green")}
    ${row(canRemove ? "Remove bookmark" : frame.verse ? "Save verse" : "Save passage", "Notebook", "bookmark", { action: "save" })}
    ${row("Write a note", "Private to this device", "note", { open: "note", ...details })}
    ${row("Ask Companion", "Scripted study prompts", "spark", { open: "companion", ...details }, "violet")}
  </div>`;
}

function toggleFaces(first, second, value) {
  return `<div class="filters" role="group" aria-label="Panel face">
    ${chip(first, "front", value, "face")}${chip(second, "back", value, "face")}
    ${iconButton("Flip panel", "flip", { action: "flip" })}
  </div>`;
}

function scripturePanel(frame) {
  const passage = passages[frame.id];
  const face = frame.face || "front";
  return [passage.title, "SCRIPTURE EXCURSION · KJV", `${toggleFaces("Read", "Study tools", face)}
    ${face === "front" ? `<div class="excursion-reading">${frame.verse ? `<p class="muted">Opened from verse ${frame.verse}</p>` : ""}${passageText(frame.id, false, frame.verse)}</div>
      <div class="panel-actions">${button("Compare " + passages[passage.reference].title, "flip", { open: "scripture", id: passage.reference, week: frame.week })}</div>` : makeTools(frame)}`];
}

function researchPanel(frame) {
  const research = investigations[frame.id];
  const study = curriculum.find(item => item.id === research.thread);
  const face = frame.face || "front";
  return [research.title, "INVESTIGATION", `${toggleFaces("Evidence", "Interpretation", face)}
    <article class="panel-prose"><p class="section-tag">${research.source}</p>
      <p>${face === "front" ? research.observation : research.interpretation}</p>
    </article>
    <div class="rows">
      ${row(passages[research.passage].title, "Read the text alongside this note", "book", { open: "scripture", id: research.passage, week: study.id })}
      ${row("Discuss this question", "Sample community discussion", "chat", { open: "discussion", id: study.discussion, week: study.id }, "green")}
    </div>`];
}

function discussionPanel(frame) {
  const post = posts.find(item => item.id === frame.id);
  const replies = [...post.replies, ...(model.replies[post.id] || [])];
  const allowed = model.joined.includes(post.community);
  const replyForm = `<form id="reply-form" class="form">
    <label for="reply">Add a simulated reply</label>
    <textarea id="reply" name="reply" maxlength="800" required>${escapeHtml(replyDrafts.get(post.id) || "")}</textarea>
    <button type="submit" class="button primary">Save reply on this device</button>
  </form>`;
  return [post.title, "SAMPLE DISCUSSION · " + communities[post.community].name, `<div class="panel-prose">
    <p class="muted">${post.author} · ${post.time}</p><p>${post.text}</p>
    ${button(passages[post.passage].title, "book", { open: "scripture", id: post.passage, week: post.thread }, "button reference")}
    ${button("Open its Living Thread", "next", { action: "thread-from-panel", week: post.thread }, "button subtle")}
    </div>
    <div class="replies">${replies.map(reply => `<article><strong>${escapeHtml(reply.author)}</strong><p>${escapeHtml(reply.text)}</p></article>`).join("")}</div>
    ${allowed ? replyForm : `<p class="empty">Follow this sample community to try a reply.</p>${button("Manage communities", "plus", { open: "communities" })}`}`];
}

function noteKey(frame) {
  return frame.week + ":" + currentPassage(frame) + ":" + (frame.verse || 0);
}

function notePanel(frame) {
  const passage = passages[currentPassage(frame)];
  return ["New note", passage.title, `<form id="note-form" class="form">
    <label for="note">Note for this reading</label>
    <textarea id="note" name="note" maxlength="1200" required>${escapeHtml(noteDrafts.get(noteKey(frame)) || "")}</textarea>
    <button type="submit" class="button primary">Save note</button>
  </form>`];
}

function companionPanel(frame) {
  const study = currentStudy(frame);
  const passage = passages[currentPassage(frame)];
  const messages = conversations.get(study.id) || [];
  return ["Companion", "SCRIPTED DEMO · " + study.name, `<div class="companion-context">
    ${icon("book")} <span>Reading with you</span> <strong>${passage.title}</strong>
    </div><div class="chat-log" role="log" aria-label="Companion conversation">
      <p class="bubble">What are you noticing in this passage?</p>
      ${messages.map(message => `<p class="bubble${message.mine ? " mine" : ""}">${escapeHtml(message.text)}</p>`).join("")}
    </div>
    <div class="panel-actions">
      ${button("What should I compare?", null, { action: "suggest" }, "button subtle")}
      ${button("Open related passage", "book", { open: "scripture", id: passage.reference, week: study.id }, "button reference")}
      ${button("Word study", "book", { open: "language", id: currentPassage(frame), week: study.id }, "button subtle")}
    </div>
    <form id="question-form" class="question-form">
      <input id="question" aria-label="Ask Companion" placeholder="Ask about this reading…" maxlength="400" required value="${escapeHtml(questionDrafts.get(study.id) || "")}">
      <button type="submit" class="button primary" aria-label="Send question">${icon("send")}</button>
    </form>`];
}

function weeksPanel() {
  return ["Study weeks", "WEEKLY CURRICULUM", `<div class="rows">
    ${curriculum.map(item => row(item.name, `Week ${item.number} · ${item.title}${week.id === item.id ? " · Current" : ""}`, week.id === item.id ? "check" : "book", { action: "select-week", week: item.id })).join("")}
  </div>`];
}

function communitiesPanel() {
  return ["Communities", "SIMULATED FELLOWSHIP", `<p class="muted">Choose which sample communities appear in your feed.</p>
    <div class="rows">${Object.entries(communities).map(([id, group]) => {
      const joined = model.joined.includes(id);
      return `<div class="community-row"><span class="avatar ${group.color}">${group.initials}</span>
        <div><strong>${group.name}</strong><small>${group.description}</small></div>
        <button type="button" class="button subtle" aria-label="${joined ? "Unfollow" : "Follow"} ${group.name}" aria-pressed="${joined}" data-action="join" data-id="${id}">${joined ? "Following" : "Follow"}</button></div>`;
    }).join("")}</div>`];
}

const panels = {
  scripture: scripturePanel,
  research: researchPanel,
  discussion: discussionPanel,
  note: notePanel,
  companion: companionPanel,
  weeks: weeksPanel,
  communities: communitiesPanel,
  tools: frame => ["Study tools", passages[currentPassage(frame)].title, makeTools(frame)],
  verse: frame => {
    const passage = passages[currentPassage(frame)];
    const label = frame.verse ? `${passage.book} ${passage.chapter}:${frame.verse}` : passage.title;
    return [label, "PASSAGE OPTIONS", `${frame.verse ? `<p class="verse-excerpt">${escapeHtml(passage.lines[frame.verse - passage.start])}</p>` : ""}${makeTools(frame)}`];
  },
  language: frame => {
    const passage = passages[frame.id];
    return ["Word study", passage.language, `<article class="panel-prose">
      <p class="original-word" lang="${passage.language.startsWith("Greek") ? "el" : "he"}" dir="auto">${passage.word}</p>
      <h3>${passage.transliteration}</h3><p>${passage.meaning}</p><p>${passage.languageNote}</p></article>
      ${linkedPassage(frame.id)}`];
  },
  commandment: frame => {
    const commandment = commandments[frame.id];
    return [commandment.title, "COMMANDMENTS · " + commandment.reference, `<article class="panel-prose">
      <blockquote>${commandment.verse}</blockquote><p>${commandment.note}</p></article>`];
  },
  search: frame => ["Search", "PASSAGES, INVESTIGATIONS & DISCUSSIONS", `<input id="search" type="search" aria-label="Search sample content" placeholder="Try ‘Noah’ or ‘John’" value="${escapeHtml(frame.query || "")}"><div id="search-results"></div>`],
  menu: frame => ["Quick actions", "LIVING THREAD", `<div class="rows">
    ${row("Change study week", week.name, "book", { open: "weeks" })}
    ${row("Write a note", "For the current passage", "note", { open: "note", id: currentPassage(frame) })}
    ${row("Open study tools", "Cross-references, language and commandments", "compass", { open: "tools", id: currentPassage(frame) }, "amber")}
  </div>`]
};

const searchIndex = [
  ...Object.entries(passages).map(([id, item]) => ({ id, kind: "scripture", label: item.title, terms: item.lines.join(" ") + " " + item.transliteration, detail: "Scripture", icon: "book", tone: "blue", week: curriculum.find(week => [week.primary, week.related].includes(id)).id })),
  ...Object.entries(investigations).map(([id, item]) => ({ id, kind: "research", label: item.title, terms: item.source, detail: "Investigation", icon: "compass", tone: "amber", week: item.thread })),
  ...posts.map(post => ({ id: post.id, kind: "discussion", label: post.title, terms: post.text, detail: "Sample discussion", icon: "chat", tone: "green", week: post.thread }))
];

function renderResults(query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = words.length ? searchIndex.filter(item => {
    const haystack = (item.label + " " + item.terms).toLowerCase();
    return words.every(word => haystack.includes(word));
  }) : searchIndex.filter(item => item.week === week.id).slice(0, 5);
  $("search-results").innerHTML = matches.length ? `<div class="rows">${matches.map(item =>
    row(item.label, item.detail, item.icon, { open: item.kind, id: item.id, week: item.week }, item.tone)
  ).join("")}</div>` : '<p class="empty">No matches in the sample content.</p>';
}

function focusPanel() {
  title.focus({ preventScroll: true });
}

function renderPanel(focus = false) {
  const [heading, context, contents] = panels[frame.kind](frame);
  title.textContent = heading;
  $("panel-context").textContent = context;
  $("panel-back").hidden = stack.length === 0;
  $("panel-expand").hidden = frame.kind === "menu";
  $("panel-expand").setAttribute("aria-label", frame.expanded ? "Collapse panel" : "Expand panel");
  $("panel-expand").setAttribute("aria-pressed", String(Boolean(frame.expanded)));
  $("panel-expand").innerHTML = icon(frame.expanded ? "minus" : "expand");
  dialog.dataset.expanded = String(Boolean(frame.expanded));
  dialog.dataset.mode = frame.kind === "menu" ? "menu" : "panel";
  body.innerHTML = contents;
  if (frame.kind === "search") renderResults(frame.query || "");
  body.scrollTop = frame.top || 0;
  if (focus) focusPanel();
}

function openPanel(spec, trigger) {
  const next = {
    kind: spec.open,
    id: spec.id || "",
    week: spec.week || (dialog.open ? frame.week : week.id),
    verse: Number(spec.verse) || 0,
    expanded: dialog.open && Boolean(frame.expanded)
  };
  if (dialog.open) {
    frame.top = body.scrollTop;
    frame.returnIndex = [...body.querySelectorAll("button")].indexOf(trigger);
    stack.push(frame);
  } else {
    origin = { top: viewport.scrollTop, trigger };
  }
  frame = next;
  renderPanel();
  if (!dialog.open) dialog.showModal();
  focusPanel();
}

function rerenderPanel(focusSelector) {
  frame.top = body.scrollTop;
  renderPanel();
  body.querySelector(focusSelector)?.focus({ preventScroll: true });
}

function goAfterClose(viewName, weekId, jump) {
  const targetWeek = curriculum.find(item => item.id === weekId) || week;
  afterClose = () => go(viewName, targetWeek, jump);
  dialog.close();
}

$("panel-back").addEventListener("click", () => {
  frame = stack.pop();
  renderPanel(true);
  const trigger = body.querySelectorAll("button")[frame.returnIndex];
  trigger?.focus({ preventScroll: true });
  body.scrollTop = frame.top || 0;
});

$("panel-close").addEventListener("click", () => dialog.close());
$("panel-expand").addEventListener("click", () => {
  const top = body.scrollTop;
  frame.expanded = !frame.expanded;
  dialog.dataset.expanded = String(frame.expanded);
  $("panel-expand").setAttribute("aria-label", frame.expanded ? "Collapse panel" : "Expand panel");
  $("panel-expand").setAttribute("aria-pressed", String(frame.expanded));
  $("panel-expand").innerHTML = icon(frame.expanded ? "minus" : "expand");
  body.scrollTop = top;
});

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  const previous = origin;
  const next = afterClose;
  stack.length = 0;
  frame = origin = afterClose = undefined;
  if (previous) {
    (previous.trigger?.isConnected ? previous.trigger : viewport).focus({ preventScroll: true });
    viewport.scrollTop = previous.top;
  }
  next?.();
});

function panelStatus(message) {
  let status = $("panel-status");
  if (!status) {
    status = document.createElement("p");
    status.id = "panel-status";
    status.className = "local-status";
    status.setAttribute("role", "status");
    body.prepend(status);
  }
  status.textContent = message;
}

function savePassage() {
  const index = savedIndex(frame);
  if (index < 0) model.saved.unshift({ week: frame.week, passage: currentPassage(frame), verse: frame.verse });
  else model.saved.splice(index, 1);
  const stored = persist();
  rerenderPanel('[data-action="save"]');
  panelStatus(index < 0 ? stored ? "Saved to Notebook." : "Saved for this visit." : "Bookmark removed.");
}

function respond(question) {
  const study = currentStudy(frame);
  const passage = passages[currentPassage(frame)];
  const related = passages[passage.reference];
  const messages = conversations.get(study.id) || [];
  const answer = /word|hebrew|greek|language/i.test(question)
    ? `In ${passage.title}, look at ${passage.word} (${passage.transliteration}), “${passage.meaning}.” The Word study tool has a short note about this usage.`
    : /compare|question|passage|why|light|promise|noah|abram|genesis|john/i.test(question)
      ? `Compare ${passage.title} with ${related.title}. As you read, ask: ${study.question}`
      : "This scripted demo can offer a comparison or point you to a word study. Try asking what to compare.";
  messages.push({ text: question, mine: true }, { text: answer });
  conversations.set(study.id, messages);
  questionDrafts.delete(study.id);
  rerenderPanel("#question");
  body.scrollTop = body.scrollHeight;
}

const actions = {
  "select-week": control => goAfterClose("thread", control.dataset.week),
  "thread-from-panel": control => goAfterClose("thread", control.dataset.week),
  save: savePassage,
  flip: () => setFace(frame.face === "back" ? "front" : "back"),
  suggest: () => respond("What should I compare?"),
  join: control => {
    const id = control.dataset.id;
    const index = model.joined.indexOf(id);
    if (index < 0) model.joined.push(id);
    else model.joined.splice(index, 1);
    if (!model.joined.includes(feedFilter)) feedFilter = "all";
    const stored = persist();
    if (activeView === "fellowship") rerenderView();
    rerenderPanel(`[data-action="join"][data-id="${id}"]`);
    panelStatus(stored ? "Sample feed updated." : "Sample feed updated for this visit.");
  }
};

function setFace(face) {
  frame.face = face;
  rerenderPanel(`[data-face="${face}"]`);
}

document.addEventListener("click", event => {
  const control = event.target.closest("button");
  if (!control) return;
  const data = control.dataset;
  if (data.open) openPanel(data, control);
  else if (data.view) go(data.view);
  else if (data.jump) go("thread", week, data.jump);
  else if (data.feed) {
    feedFilter = data.feed;
    rerenderView(`[data-feed="${feedFilter}"]`);
  } else if (data.notebook) {
    notebookFilter = data.notebook;
    rerenderView(`[data-notebook="${notebookFilter}"]`);
  } else if (data.face) setFace(data.face);
  else actions[data.action]?.(control);
});

dialog.addEventListener("input", event => {
  const field = event.target;
  if (field.id === "search") {
    frame.query = field.value;
    renderResults(frame.query);
  } else if (field.id === "note") noteDrafts.set(noteKey(frame), field.value);
  else if (field.id === "question") questionDrafts.set(frame.week, field.value);
  else if (field.id === "reply") replyDrafts.set(frame.id, field.value);
});

dialog.addEventListener("submit", event => {
  event.preventDefault();
  const form = event.target;
  const field = form.querySelector("textarea, input");
  const value = field.value.trim();
  if (!value) {
    field.focus();
    return;
  }
  if (form.id === "question-form") {
    respond(value);
  } else if (form.id === "note-form") {
    model.notes.unshift({ text: value, week: frame.week, passage: currentPassage(frame), verse: frame.verse });
    noteDrafts.delete(noteKey(frame));
    field.value = "";
    const stored = persist();
    if (activeView === "notebook") rerenderView();
    panelStatus(stored ? "Note saved to Notebook." : "Note saved for this visit.");
  } else if (form.id === "reply-form") {
    (model.replies[frame.id] ||= []).push({ author: "You · Local demo", text: value });
    replyDrafts.delete(frame.id);
    const stored = persist();
    if (activeView === "fellowship") rerenderView();
    rerenderPanel("#reply");
    panelStatus(stored ? "Demo reply saved on this device." : "Demo reply saved for this visit.");
  }
});

renderView();
