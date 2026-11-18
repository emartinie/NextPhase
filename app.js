import {
  currentWeek, schedules, getWeek, WEEK_COUNT, LANGUAGES, ORIENTATIONS, nameKey,
  getWeeklyText, getCommentary, readPassage, webUrl, passageUrl,
} from './corpus.js';
import { fixture, members, loadLocal, saveLocal } from './fellowship.js';
import { mountFellowshipHome } from './fellowship-home.js';
import { createStudyTools } from './study-tools.js';
import { createPeopleViews } from './people.js';
import { initAppearance, bindThemeDiagnostic, createThemeView } from './theme-manager.js';
import { createGameView } from './games.js';
import { createPreparednessViews } from './preparedness.js';
import { createCommonGroundViews } from './common-ground.js';
import { createLibraryViews } from './preparedness-library.js';
import { createMapViews } from './preparedness-map.js';
import { createRadioViews } from './preparedness-radio.js';
import { articleLocation, createLearningViews } from './learning.js';
import { createLearningEnrichment } from './learning-enrichment.js';
import { createTopicalViews } from './learning-topical.js';
import { createReferenceViews } from './learning-references.js';
import { createReferenceLibraryViews } from './reference-library.js';
import { createAncientViews } from './ancient-library.js';
import { calendarCards, calendarFields, calendarRoute, createCalendarViews } from './calendar.js';
import { bindWorkspaceSwipe } from './workspace-swipe.js';

const $ = (id) => document.getElementById(id);
const study = $('study');
const fellowship = $('fellowship');
const dialog = $('dialog');
const panel = $('panel-body');
const audio = $('audio');
const now = new Date();
const requestedPilot = new URLSearchParams(location.search).get('pilot');
const localPreview = ['127.0.0.1', 'localhost'].includes(location.hostname);
const hostedFellowshipPreview = location.protocol === 'https:'
  && /^homegroups-fellowship--iphone-pilot-[a-z0-9]+\.web\.app$/.test(location.hostname);
const pilotMode = localPreview ? requestedPilot
  : hostedFellowshipPreview && requestedPilot === 'firebase' ? 'firebase' : null;
const fellowshipPilot = ['fellowship', 'firebase'].includes(pilotMode);
let stopFellowshipPilot;
let fellowshipHome;
let fellowshipInviteUser;
const cycleWeek = currentWeek(now);
const today = now.getDay() + 1;
const liveYear = now.getFullYear();
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const sessions = new Map();
const frames = [];
const historyFrames = new Map();
const ledger = loadLocal();
let catalog;
let active;
let face = 'study';
let workspace = 'study';
let preparednessFace = 'study';
let learningFace = 'study';
let learningRecent;
let learningResumeSlot;
let learningDiscussionKey;
const learningTopics = new Map();
const learningDiscussions = new Map();
const workspaceOrder = ['study', 'learning', 'preparedness'];
const workspaceSettings = {
  study: { title: 'MainStage', stage: 'stage', front: 'study', back: 'fellowship',
    flipFront: 'Fellowship', flipBack: 'Study', labelFront: 'Study discussion', labelBack: 'Back to study',
    tools: 'tools', toolsLabel: 'Tools', actions: 'fellowshipActions', actionsLabel: 'Fellowship actions' },
  learning: { title: 'Learning Hub', stage: 'learning-stage', front: 'learning-study', back: 'learning-fellowship',
    flipFront: 'Fellowship', flipBack: 'Learning', labelFront: 'Learning Fellowship', labelBack: 'Back to Learning Hub',
    tools: 'learningTools', toolsLabel: 'Resources', actions: 'learningActions', actionsLabel: 'Learning Fellowship actions' },
  preparedness: { title: 'Preparedness', stage: 'preparedness-stage', front: 'preparedness-study', back: 'preparedness-fellowship',
    flipFront: 'Communications', flipBack: 'Preparedness', labelFront: 'Preparedness communications', labelBack: 'Back to preparedness',
    tools: 'preparednessTools', toolsLabel: 'Resources', actions: 'preparednessActions', actionsLabel: 'Communications actions' },
};
let refreshPreparednessView;
let week;
let origin;
let frameSequence = 0;
let pendingClose;
let renderSequence = 0;

function node(tag, content = '', className = '') {
  const item = document.createElement(tag);
  if (content) item.textContent = content;
  if (className) item.className = className;
  return item;
}
const text = (value, style = 'subtle') => node('p', value, style);
function button(label, action, style = 'button') {
  const item = node('button', label, style);
  item.type = 'button';
  item.addEventListener('click', action);
  return item;
}
function link(label, value) {
  const url = webUrl(value);
  if (!url) return node('span', label, 'subtle');
  const item = node('a', label, 'button');
  Object.assign(item, { href: url, target: '_blank', rel: 'noopener noreferrer' });
  return item;
}
function cluster(...items) {
  const bar = node('div', '', 'actions');
  bar.append(...items);
  return bar;
}
function disclosure(label, ...items) {
  const details = node('details');
  const body = node('div', '', 'detail');
  body.append(...items);
  details.append(node('summary', label), body);
  return details;
}
function renderIntro(id, kicker, title, subtitle, theme = '') {
  const intro = node('header', '', 'intro');
  const heading = node('h1', title);
  heading.id = id;
  intro.append(node('p', kicker, 'eyebrow'), heading, text(subtitle, 'portion'));
  if (theme) intro.append(text(theme, 'theme'));
  return intro;
}
function row(label, detail, run) {
  const control = button('', run, 'row');
  const copy = node('span', label);
  if (detail) copy.append(node('small', detail));
  const arrow = node('span', '›');
  arrow.setAttribute('aria-hidden', 'true');
  control.append(copy, arrow);
  return control;
}
function title(label) {
  return label.replaceAll('_', ' ').replace(/^\w/, (first) => first.toUpperCase());
}
function appendData(container, value) {
  if (Array.isArray(value)) {
    const list = node('ul');
    for (const item of value) {
      const li = node('li');
      appendData(li, item);
      list.append(li);
    }
    container.append(list);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (item === null || item === '' || item === undefined) continue;
      const section = node('div');
      section.append(node('h3', title(key)));
      appendData(section, item);
      container.append(section);
    }
  } else if (typeof value === 'string' || typeof value === 'number') {
    const phrase = String(value);
    if (webUrl(phrase)) container.append(link('Open source ↗', phrase));
    else if (/\.(mp3|pdf|html)$/i.test(phrase)) container.append(text(phrase + ' · Local source asset unavailable'));
    else container.append(text(phrase, 'source-copy'));
  }
}
function readRoute() {
  const params = new URL(location.href).searchParams;
  const names = { bereshit: 1, noach: 2, 'lech-lecha': 3 };
  const selected = Number(params.get('week')) || names[params.get('study')];
  return {
    week: Number.isInteger(selected) && selected >= 1 && selected <= WEEK_COUNT ? selected : cycleWeek,
    face: params.get('face') === 'fellowship' ? 'fellowship' : 'study',
    workspace: workspaceOrder.includes(params.get('workspace')) ? params.get('workspace') : 'study',
    learningFace: params.get('learningFace') === 'fellowship' ? 'fellowship' : 'study',
    learningTopic: params.get('learningTopic') || 'learning:general',
    preparednessFace: params.get('preparednessFace') === 'communications' ? 'fellowship' : 'study',
  };
}
function changeRoute(selected, nextFace) {
  if (selected === week && nextFace === face) return;
  const url = new URL(location.href);
  url.searchParams.delete('study');
  if (selected === cycleWeek) url.searchParams.delete('week');
  else url.searchParams.set('week', selected);
  if (nextFace === 'study') url.searchParams.delete('face');
  else url.searchParams.set('face', nextFace);
  history.pushState({ panels: [] }, '', url);
  applyRoute();
}
function dayRow(number = active?.day) {
  return catalog?.daily.find((item) => +item.week === week && +item.day_number === number);
}
const weekLine = () => `Week ${week} · ${active?.row.portion_transliteration ?? 'Weekly study'}`;
const defaultRef = () => dayRow()?.torah_daily_reading || active?.row.torah_reading || 'John 1';
const passage = (ref, source) => open('reader', { ref, source });
const workspaceFace = (id = workspace) => ({ study: face, learning: learningFace, preparedness: preparednessFace })[id];
const currentSurface = () => $(workspaceSettings[workspace][workspaceFace() === 'study' ? 'front' : 'back']);

function selectWorkspace(next) {
  if (!workspaceOrder.includes(next) || next === workspace || !active?.content || dialog.open) return;
  const url = new URL(location.href);
  if (next !== 'study') url.searchParams.set('workspace', next);
  else url.searchParams.delete('workspace');
  history.pushState({ panels: [] }, '', url);
  applyRoute();
}

function showWorkspace(next, nextPreparednessFace, nextLearningFace) {
  workspace = next;
  preparednessFace = nextPreparednessFace;
  learningFace = nextLearningFace;
  $('workspace-track').dataset.workspace = workspace;
  for (const id of workspaceOrder) {
    const settings = workspaceSettings[id];
    const stage = $(settings.stage);
    stage.inert = id !== workspace;
    stage.setAttribute('aria-hidden', String(stage.inert));
    stage.dataset.face = workspaceFace(id);
    const back = workspaceFace(id) === 'fellowship';
    for (const [surface, hidden] of [[settings.front, back], [settings.back, !back]]) {
      $(surface).inert = hidden;
      $(surface).setAttribute('aria-hidden', String(hidden));
    }
  }
  syncNavigation();
  refreshPreparedness();
}

function refreshPreparedness() {
  if (workspace !== 'preparedness' || preparednessFace !== 'fellowship') return;
  const surface = $('preparedness-fellowship');
  const top = surface.scrollTop;
  refreshPreparednessView?.();
  surface.scrollTop = top;
}

function syncNavigation() {
  const settings = workspaceSettings[workspace];
  const back = workspaceFace() === 'fellowship';
  $('week-button').hidden = workspace !== 'study';
  $('flip').setAttribute('aria-pressed', String(back));
  $('flip').setAttribute('aria-label', back ? settings.labelBack : settings.labelFront);
  $('flip').replaceChildren(document.createTextNode((back ? settings.flipBack : settings.flipFront) + ' '), node('span', '⇄'));
  $('flip').lastChild.setAttribute('aria-hidden', 'true');
  $('tools-button').hidden = back;
  $('tools-button').dataset.open = settings.tools;
  $('tools-button').textContent = settings.toolsLabel;
  $('notes-button').hidden = workspace !== 'study' || back;
  $('fellowship-more').hidden = !back;
  $('fellowship-more').dataset.open = settings.actions;
  $('fellowship-more').setAttribute('aria-label', settings.actionsLabel);
  $('flip').parentElement.setAttribute('aria-label', settings.title + ' navigation');
  const index = workspaceOrder.indexOf(workspace);
  for (const [id, offset] of [['workspace-previous', -1], ['workspace-switch', 1]]) {
    const destination = workspaceSettings[workspaceOrder[index + offset]];
    $(id).hidden = !destination;
    if (destination) {
      const label = 'Go to ' + destination.title + ' workspace';
      $(id).setAttribute('aria-label', label);
      $(id).title = label;
    }
  }
}

async function applyRoute() {
  const target = readRoute();
  if ((target.workspace !== workspace || target.face !== face || target.preparednessFace !== preparednessFace || target.learningFace !== learningFace)
      && currentSurface().contains(document.activeElement)) {
    $('flip').focus({ preventScroll: true });
  }
  showFace(target.face);
  showWorkspace(target.workspace, target.preparednessFace, target.learningFace);
  showLearningDiscussion(target.learningTopic);
  if (week === target.week && active?.content) return;
  const sequence = ++renderSequence;
  if (active?.content) {
    active.scroll = [study.scrollTop, fellowship.scrollTop];
    active.openSections = [...study.querySelectorAll('details[open]')].map((detail) => detail.dataset.section);
  }
  week = target.week;
  if (!sessions.has(week)) sessions.set(week, {
    day: today, row: catalog.weekly.find((item) => +item.week === week), scroll: [0, 0],
    openSections: [], year: liveYear,
  });
  active = sessions.get(week);
  $('week-button').textContent = `Week ${week} ⌄`;
  study.replaceChildren(text('Opening the weekly study…', 'loading'));
  fellowship.replaceChildren(text('Opening study discussion…', 'loading'));
  try {
    const content = await getWeek(week);
    if (sequence !== renderSequence) return;
    active.content = content;
    renderStudy();
    renderFellowship();
    [study.scrollTop, fellowship.scrollTop] = active.scroll;
  } catch {
    if (sequence !== renderSequence) return;
    study.replaceChildren(text('The weekly study could not load.', 'loading'), button('Try again', applyRoute));
    fellowship.replaceChildren(text('The weekly study could not load.', 'loading'));
  }
}

function showFace(next) {
  face = next;
  $('stage').dataset.face = face;
  const back = face === 'fellowship';
  study.inert = back;
  study.setAttribute('aria-hidden', String(back));
  fellowship.inert = !back;
  fellowship.setAttribute('aria-hidden', String(!back));
  syncNavigation();
  if (back && workspace === 'study') void fellowshipHome?.load();
}

const gamesAvailable = () => workspace === 'study' && !fellowshipPilot && face === 'fellowship' && active?.year === liveYear && Boolean(active?.content);

function renderStudy() {
  const { row: data, content } = active;
  const inner = node('article', '', 'sheet');
  const theme = catalog.themes.get(week) || data.theme_title;
  const portion = [data.portion_transliteration, data.title_hebrew].filter(Boolean).join(' · ');
  inner.append(renderIntro('study-title', week === cycleWeek ? `This week · ${week} / 52` : `Weekly study · ${week} / 52`,
    data.title_english || content.english, portion, theme));
  const daily = node('section', '', 'today');
  const selection = dayRow();
  const progress = node('div', '', 'progress');
  progress.setAttribute('aria-hidden', 'true');
  for (let day = 1; day <= 7; day++) progress.append(node('span', '', day <= active.day ? 'past' : ''));
  daily.append(node('p', (week === cycleWeek && active.day === today ? 'Today · ' : '') + dayNames[active.day - 1], 'eyebrow'),
    node('h2', selection?.torah_daily_reading || 'Daily reading unavailable'),
    cluster(button('Read passage', () => passage(defaultRef(), dayRow()?.sefaria_bilingual_link), 'button primary'),
      button('Daily schedule', () => open('days'), 'quiet')),
    progress, text(`Day ${active.day} of 7 · Torah reading`));
  if (week === cycleWeek && active.day === today) {
    daily.append(button('Calendar', () => open('calendar'), 'quiet today-calendar'));
  }
  inner.append(daily);

  const stack = node('div', '', 'stack');
  const referenceRows = [['Torah', data.torah_reading], ['Prophets / Writings', data.haftarah_prophets_writings], ['New Testament', data.new_testament]];
  const references = node('div', '', 'references');
  for (const [area, ref] of referenceRows) {
    if (!ref || /^none\b/i.test(ref)) continue;
    const line = node('div', '', 'ref-row');
    line.append(text(area), button(ref, () => passage(ref), 'button'));
    references.append(line);
  }
  const weekSources = cluster(...Object.entries(LANGUAGES).map(([language, label]) =>
    button(label, () => open('weeklyText', { language }), 'quiet')));
  if (data.tlv_link) weekSources.append(link('TLV ↗', data.tlv_link));
  if (data.companion_reading_source_url) weekSources.append(link('Companion reading ↗', data.companion_reading_source_url));
  if (data.apocrypha_link) weekSources.append(link('Apocrypha ↗', data.apocrypha_link));
  stack.append(disclosure('Weekly Scripture', references, weekSources));
  const context = content.intro?.instructions ? text(content.intro.instructions, 'source-copy') : text('Explore the weekly teaching and outlined readings.');
  stack.append(disclosure('Study guide', ...(content.intro?.summary ? [text(content.intro.summary, 'source-copy')] : []), context,
    row('Chapter outlines', 'Browse sections and open a reference', () => open('outline')),
    row('Commentary', 'Weekly notes and source article', () => open('commentary')),
    row('Teaching & resources', 'Deeper learning, children, languages and Psalms', () => open('resources'))));
  const slug = nameKey(data.portion_transliteration);
  stack.append(disclosure('Listen', row('Scripture audio', 'Source recordings grouped by section', () => open('listen')),
    ORIENTATIONS.includes(slug)
      ? row('Weekly orientation', 'HomeGroups audio · plays in the dock', () => playAudio('./corpus/assets/' + slug + '.mp3', 'Weekly orientation · ' + data.portion_transliteration))
      : text('The source has no bundled weekly orientation for this portion.')));
  [...stack.children].forEach((item, index) => {
    item.dataset.section = String(index);
    item.open = active.openSections.includes(item.dataset.section);
  });
  inner.append(stack, text('Weekly cycle based on the HomeGroups reading schedule.', 'meta'));
  study.replaceChildren(inner);
}

const preparednessSections = {
  preparedness: 'workspace', prepLibrary: 'library', prepDocument: 'document', prepRadio: 'radio',
  prepMap: 'map', prepPrayer: 'prayer', prepResearch: 'research', prepContacts: 'contacts',
  commonGround: 'briefings', commonGroundBriefing: 'briefing', briefingDiscussion: 'briefing-discussion',
};
const preparednessRoutes = Object.fromEntries(Object.entries(preparednessSections).map(([type, section]) => [section, type]));
const legacyPreparedness = { beready: 'prepLibrary', amateurradio: 'prepRadio', radiomap: 'prepMap', prayermap: 'prepPrayer' };
const learningCards = { learning: 'learning', learningPaths: 'discipleship', learningJourney: 'discipleship',
  learningArticles: 'articles', learningArticle: 'articles', languageLab: 'language-lab', visualTeachings: 'prezis',
  topicalTeachings: 'teachings', jesus: 'jesus', origins: 'origins', assessments: 'quizzes',
  referenceLibrary: 'reference-library', referenceResource: 'reference-resource', dictionary: 'dictionary', dictionaryEntry: 'dictionary-entry', referenceCommentary: 'reference-commentary',
  sourcesLibrary: 'sources', research: 'investigations', article: 'investigations', researchBacklog: 'investigations',
  intertext: 'intertext-quotes', translation: 'scripture', listenShelf: 'listen', listenArticle: 'listen',
  ancientLibrary: 'ancient-library', ancientDetail: 'ancient-library', ancientRead: 'ancient-library' };
const referenceFields = { referenceLibrary: ['ref', 'q', 'view'], referenceResource: ['id', 'ref', 'entry', 'q', 'view'], dictionary: ['ref', 'q', 'view'], dictionaryEntry: ['id', 'ref'], referenceCommentary: ['ref'], research: ['ref'], article: ['id', 'file', 'anchor'], intertext: ['from'], translation: ['ref'],
  listenArticle: ['id'], ancientDetail: ['book'], ancientRead: ['book', 'work', 'volume', 'chapter', 'verse', 'q'] };
const panelParameters = ['card', 'covenant', 'id', 'ref', 'book', 'chapter', 'section', 'zone', 'folder', 'category', 'view', 'file', 'journey', 'language',
  'from', 'work', 'volume', 'verse', 'q', 'entry', 'anchor', 'video', 'debate', ...calendarFields];
const studyCards = { law: 'commandments', covenant: 'commandments', commandment: 'commandments', nt: 'nt', sefaria: 'sefaria',
  people: 'people', person: 'people', teaching: 'people', debate: 'people', themeManager: 'theme' };
const studyCardFields = {
  covenant: ['covenant'], commandment: ['id'], sefaria: ['ref'],
  person: ['id'], teaching: ['id', 'video'], debate: ['debate'],
};
function excursionUrl(type, data) {
  const url = new URL(location.href);
  if (isLearningResource(type)) url.searchParams.set('workspace', workspace);
  if (Object.hasOwn(calendarCards, type)) {
    for (const key of panelParameters) url.searchParams.delete(key);
    url.searchParams.set('card', calendarCards[type]);
    for (const key of calendarFields) if (data[key]) url.searchParams.set(key, data[key]);
    return url;
  }
  if (Object.hasOwn(preparednessSections, type)) {
    for (const key of panelParameters) url.searchParams.delete(key);
    url.searchParams.set('card', 'preparedness');
    url.searchParams.set('section', preparednessSections[type]);
    for (const key of ['id', 'zone', 'folder', 'category']) {
      if (data[key]) url.searchParams.set(key, data[key]);
    }
    if (data.initial) url.searchParams.set('view', data.initial);
    return url;
  }
  if (Object.hasOwn(learningCards, type)) {
    url.searchParams.set('workspace', workspace);
    for (const key of panelParameters) url.searchParams.delete(key);
    url.searchParams.set('card', learningCards[type]);
    if (type === 'learningArticle' && data.file) {
      url.searchParams.set('file', data.file + (data.anchor ? '#' + encodeURIComponent(data.anchor) : ''));
    }
    if (type === 'learningJourney' && data.journey) url.searchParams.set('journey', data.journey);
    if (type === 'languageLab' && data.language) url.searchParams.set('language', data.language);
    if (type === 'researchBacklog') url.searchParams.set('view', 'backlog');
    for (const field of referenceFields[type] ?? []) if (data[field]) url.searchParams.set(field, data[field]);
    return url;
  }
  if (!Object.hasOwn(studyCards, type)) return url;
  for (const key of panelParameters) url.searchParams.delete(key);
  url.searchParams.set('card', studyCards[type]);
  const fields = type === 'nt' ? (data.ref ? ['ref'] : ['book', 'chapter']) : studyCardFields[type] ?? [];
  for (const field of fields) if (data[field]) url.searchParams.set(field, data[field]);
  return url;
}
async function openLinkedStudyCard() {
  const url = new URL(location.href);
  const { searchParams } = url;
  const card = searchParams.get('card');
  let type;
  let data = {};
  if (card === 'preparedness' || Object.hasOwn(legacyPreparedness, card)) {
    const section = searchParams.get('section');
    type = card === 'preparedness' ? (Object.hasOwn(preparednessRoutes, section) ? preparednessRoutes[section] : 'preparedness') :
      legacyPreparedness[card];
    data = Object.fromEntries(['id', 'zone', 'folder', 'category'].map(key => [key, searchParams.get(key) || '']));
    data.initial = searchParams.get('view') || 'plan';
  } else if (Object.values(calendarCards).includes(card)) {
    const route = await calendarRoute(card, searchParams);
    if (url.href !== location.href || frames.length) return;
    ({ type, data } = route);
  } else if (card === 'learning') {
    type = 'learning';
  } else if (card === 'language-lab' || card === 'alephbet' || card === 'greekalphabet') {
    type = 'languageLab';
    data = { language: card === 'greekalphabet' || (card === 'language-lab' && searchParams.get('language') === 'greek') ? 'greek' : 'hebrew' };
  } else if (card === 'prezis') {
    type = 'visualTeachings';
  } else if (card === 'teachings') {
    type = 'topicalTeachings';
  } else if (card === 'quizzes') {
    type = 'assessments';
  } else if (['reference-library', 'reference-resource', 'dictionary', 'dictionary-entry', 'reference-commentary'].includes(card)) {
    type = { 'reference-library': 'referenceLibrary', 'reference-resource': 'referenceResource', dictionary: 'dictionary', 'dictionary-entry': 'dictionaryEntry', 'reference-commentary': 'referenceCommentary' }[card];
    data = Object.fromEntries(['id', 'ref', 'q', 'view', 'entry'].map(key => [key, searchParams.get(key) || '']));
  } else if (card === 'sources') {
    type = 'sourcesLibrary';
    data = { ref: searchParams.get('ref') || '' };
  } else if (card === 'investigations') {
    const id = searchParams.get('id');
    const [file, legacyAnchor] = (searchParams.get('file') ?? '').split('#', 2);
    type = id || file ? 'article' : searchParams.get('view') === 'backlog' ? 'researchBacklog' : 'research';
    data = { id, file, ref: searchParams.get('ref'), anchor: searchParams.get('anchor') || legacyAnchor || url.hash.slice(1) };
    url.hash = '';
  } else if (card === 'intertext-quotes') {
    type = 'intertext';
    data = { from: searchParams.get('from') };
  } else if (card === 'scripture' || card === 'interlinear') {
    type = 'translation';
    data = { ref: searchParams.get('ref') };
  } else if (card === 'listen') {
    const id = searchParams.get('id');
    type = id ? 'listenArticle' : 'listenShelf';
    data = { id };
  } else if (card === 'ancient-library') {
    data = Object.fromEntries(['book', 'work', 'volume', 'chapter', 'verse', 'q'].map(key => [key, searchParams.get(key)]));
    data.verse ||= /^#al-verse-([\w-]+)$/.exec(url.hash)?.[1];
    type = data.book ? data.chapter ? 'ancientRead' : 'ancientDetail' : 'ancientLibrary';
    url.hash = '';
  } else if (card === 'jesus' || card === 'origins') {
    type = card;
  } else if (card === 'discipleship') {
    const journey = searchParams.get('journey');
    type = journey ? 'learningJourney' : 'learningPaths';
    data = { journey };
  } else if (card === 'articles') {
    const file = searchParams.get('file');
    type = file ? 'learningArticle' : 'learningArticles';
    if (file) {
      data = articleLocation(file.includes('#') ? file : file + url.hash);
      url.hash = '';
    }
  } else if (['people', 'scholars', 'missler'].includes(card)) {
    const id = searchParams.get('id') || (card === 'missler' ? 'chuck-missler' : '');
    const video = searchParams.get('video');
    const debate = searchParams.get('debate');
    type = debate ? 'debate' : id && video ? 'teaching' : id ? 'person' : 'people';
    data = debate ? { debate } : { id, video };
  } else if (card === 'theme') {
    type = 'themeManager';
  } else if (card === 'commandments') {
    const covenant = searchParams.get('covenant');
    const id = searchParams.get('id');
    type = id ? 'commandment' : covenant ? 'covenant' : 'law';
    data = id ? { id } : covenant ? { covenant } : {};
  } else if (card === 'nt') {
    type = 'nt';
    data = { ref: searchParams.get('ref') || '', book: searchParams.get('book') || '', chapter: Number(searchParams.get('chapter')) || 1 };
  } else if (card === 'sefaria') {
    type = 'sefaria';
    data = { ref: searchParams.get('ref') || '' };
  }
  if (!type) return;
  if ((card === 'preparedness' && type !== 'prepPrayer')
      || ['beready', 'amateurradio', 'radiomap'].includes(card)) {
    searchParams.set('workspace', 'preparedness');
  }
  if (type === 'learning' || (isLearningResource(type) && !searchParams.has('workspace'))) {
    searchParams.set('workspace', 'learning');
  }
  for (const key of panelParameters) searchParams.delete(key);
  history.replaceState({ panels: [] }, '', url);
  await applyRoute();
  if (type === 'calendarEvent') open('calendar', { model: data.model });
  open(type, data);
}

function open(type, data = {}, restoredFrame) {
  if (!active?.content || pendingClose) return;
  if (type === 'learning') {
    const enter = () => { selectWorkspace('learning'); changeLearningFace('study'); };
    if (frames.length) closePanels(enter);
    else enter();
    return;
  }
  if (type === 'preparedness') {
    const enter = () => {
      selectWorkspace('preparedness');
      changePreparednessFace(data.initial === 'group' ? 'fellowship' : 'study');
      if (['plan', 'listen'].includes(data.initial)) {
        $('preparedness-study').querySelector(`[data-view="${data.initial}"]`)?.click();
      }
    };
    if (frames.length) closePanels(enter);
    else enter();
    return;
  }
  if (type === 'briefingDiscussion') data = { ...data, year: active.year, week };
  if (!frames.length) origin = { opener: document.activeElement === document.body ? $('tools-button') : document.activeElement, view: currentSurface(), top: currentSurface().scrollTop };
  else saveFrame(frames.at(-1));
  const frame = restoredFrame ?? { id: ++frameSequence, type, data, top: 0, expanded: type === 'games' || type === 'preparedness' };
  frames.push(frame);
  historyFrames.set(frame.id, frame);
  history.pushState({ panels: frames.map(({ id }) => id) }, '', excursionUrl(type, data));
  if (!dialog.open) dialog.showModal();
  renderPanel(frame);
}
function saveFrame(frame) {
  frame.top = panel.scrollTop;
  frame.content = [...panel.childNodes];
  frame.focus = panel.contains(document.activeElement) ? document.activeElement : null;
  frame.onLeave?.();
}
function closePanels(after) {
  if (!frames.length || pendingClose) return;
  pendingClose = after ?? (() => {});
  history.go(-frames.length);
}
function backPanel() {
  if (frames.length && !pendingClose) history.back();
}
window.addEventListener('popstate', () => {
  const matchingRoute = readRoute();
  const ids = matchingRoute.week === week && matchingRoute.face === face
    && matchingRoute.workspace === workspace && matchingRoute.preparednessFace === preparednessFace && matchingRoute.learningFace === learningFace
    ? history.state?.panels ?? [] : [];
  if (frames.length) saveFrame(frames.at(-1));
  if (ids.length && ids.every((id) => historyFrames.has(id))) {
    if (!origin) origin = { opener: document.activeElement, view: currentSurface(), top: currentSurface().scrollTop };
    frames.splice(0, frames.length, ...ids.map((id) => historyFrames.get(id)));
    if (!dialog.open) dialog.showModal();
    renderPanel(frames.at(-1));
  } else if (dialog.open) {
    frames.length = 0;
    dialog.close();
    origin?.opener?.focus({ preventScroll: true });
    if (origin?.view) origin.view.scrollTop = origin.top;
    origin = null;
  }
  const after = pendingClose;
  pendingClose = null;
  if (after) after();
  else if (catalog) applyRoute();
  refreshPreparedness();
});
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  backPanel();
});
$('back').addEventListener('click', backPanel);
$('close').addEventListener('click', () => closePanels());
$('expand').addEventListener('click', () => {
  const frame = frames.at(-1);
  if (!frame) return;
  frame.expanded = !frame.expanded;
  sizePanel(frame);
});
function sizePanel(frame) {
  const full = studyCards[frame.type] === 'commandments' || Object.hasOwn(preparednessSections, frame.type) ||
    ['learningArticle', 'learningJourney', 'languageLab', 'visualTeachings', 'jesus', 'origins', 'assessments',
      'article', 'researchBacklog', 'intertext', 'ancientRead', 'listenArticle', 'dictionaryEntry', 'referenceCommentary'].includes(frame.type);
  dialog.dataset.workspace = String(full);
  dialog.dataset.expanded = String(full || frame.expanded);
  $('expand').hidden = full;
  $('expand').setAttribute('aria-pressed', String(frame.expanded));
  $('expand').textContent = frame.expanded ? 'Shrink' : 'Expand';
}
const panelNames = {
  weeks: 'Choose week', days: 'Daily schedule', tools: 'Study tools', reader: 'Passage reader',
  themeManager: 'Theme Manager',
  verse: 'Passage tools', weeklyText: 'Weekly Scripture', outline: 'Chapter outlines',
  commentary: 'Weekly commentary', resources: 'Teaching & resources', listen: 'Scripture audio',
  research: 'Investigations', article: 'Investigation', calendar: 'Calendar studies',
  calendarEvent: 'Appointed time', fallFeasts: 'Fall Feasts', sukkotCount: 'Sukkot Count',
  omerCount: 'Omer Count', sacredTime: 'Sacred Time and Biblical History',
  learningTools: 'Learning resources', learningActions: 'Learning Fellowship actions', learningConversations: 'Learning conversations',
  learning: 'Learning Hub', learningPaths: 'Learning Paths', learningJourney: 'Learning Path',
  learningArticles: 'Articles', learningArticle: 'Article',
  languageLab: 'Language Lab', visualTeachings: 'Visual Teachings',
  topicalTeachings: 'Topical Teachings', jesus: 'Who Is Jesus?', origins: 'Origins',
  originsDetail: 'Origins notes', assessments: 'Assessments',
  referenceLibrary: 'Reference Library', referenceResource: 'Reference resource', dictionary: 'Bible dictionary', dictionaryEntry: 'Dictionary entry', referenceCommentary: 'Passage commentary',
  sourcesLibrary: 'Sources Library', researchBacklog: 'Research backlog',
  intertext: 'Intertext Explorer', translation: 'Translation Explorer',
  listenShelf: 'Listen', listenArticle: 'Listen',
  ancientLibrary: 'Ancient Library', ancientDetail: 'Ancient Library', ancientRead: 'Ancient Library reader',
  games: 'Invite to Game', preparedness: 'Emergency Preparedness & Communications', practiceListen: 'Practice recording',
  preparednessTools: 'Preparedness resources', preparednessActions: 'Communications actions',
  practicePlan: 'Practice plan', practiceReadback: 'Practice a read-back',
  prepLibrary: 'Be Ready library', prepDocument: 'Catalog record', prepRadio: 'Amateur radio resources',
  prepMap: 'Radio Network Map', prepPrayer: 'Prayer Map', prepResearch: 'Preparedness research', prepContacts: 'Practice contact log',
  commonGround: 'The Common Ground', commonGroundBriefing: 'The Common Ground', briefingDiscussion: 'Fellowship discussion',
  note: 'Personal notes', private: 'Private conversations', dm: 'Private conversation',
  conversationInvite: 'Invite to conversation',
  fellowshipActions: 'Fellowship actions', fellowshipInvitations: 'Invitations', conversationInvitation: 'Conversation invitation',
  archive: 'Discussion archives', alignment: 'Interlinear', attach: 'Attach a passage',
  law: 'Covenants & Commandments', covenant: 'Covenant', commandment: 'Commandment',
  nt: 'New Testament Notes', sefaria: 'Hebrew Library · Sefaria',
  people: 'Teachers & Scholars', person: 'Contributor profile', teaching: 'Teaching', debate: 'Debate',
};
function activeFrame(frame) {
  return dialog.open && frames.at(-1) === frame;
}
function renderPanel(frame) {
  $('panel-title').textContent = panelNames[frame.type];
  $('panel-kicker').textContent = frame.type === 'themeManager' ? 'Appearance' : frame.type === 'dm' ? 'Local simulation' :
    frame.type === 'briefingDiscussion' ? 'Preparedness · Fellowship' :
    frame.type === 'prepPrayer' ? 'Community' : Object.hasOwn(preparednessSections, frame.type) ? 'Preparedness workspace' :
    Object.hasOwn(calendarCards, frame.type) ? 'Calendar' :
    Object.hasOwn(learningCards, frame.type) || frame.type === 'originsDetail' ? 'Learning resources' : weekLine();
  $('back').hidden = frames.length < 2;
  $('learning-discuss').hidden = !isLearningResource(frame.type);
  sizePanel(frame);
  panel.replaceChildren(...(frame.content ?? []));
  if (!frame.content || frame.retry) {
    frame.retry = false;
    const target = node('div', '', 'panel-content');
    panel.replaceChildren(target);
    Promise.resolve().then(() => views[frame.type](target, frame)).then(() => {
      if (activeFrame(frame)) rememberLearning(frame);
    }).catch(() => {
      target.replaceChildren(text('This source could not be opened.'), button('Try again', () => {
        if (!activeFrame(frame)) return;
        frame.content = null;
        renderPanel(frame);
      }));
    });
  }
  frame.refresh?.();
  if (frame.content) rememberLearning(frame);
  panel.scrollTop = frame.top;
  const focus = frame.focus?.isConnected ? frame.focus : $('panel-title');
  focus.focus({ preventScroll: true });
}
setInterval(() => frames.at(-1)?.refresh?.(), 60_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) frames.at(-1)?.refresh?.();
});

function setDay(day) {
  active.openSections = [...study.querySelectorAll('details[open]')].map((detail) => detail.dataset.section);
  const oldTop = study.scrollTop;
  const trigger = document.activeElement;
  active.day = day;
  renderStudy();
  [...study.querySelectorAll('.today button')].find((item) => item.textContent === trigger?.textContent)
    ?.focus({ preventScroll: true });
  study.scrollTop = oldTop;
}
function renderReferenceForm(container, reference, go, label = 'Scripture reference') {
  const form = node('form');
  const input = node('input');
  input.required = true;
  input.maxLength = 180;
  input.value = reference;
  const field = node('label', label);
  field.append(input);
  const submit = node('button', label === 'Passage to attach' ? 'Attach Scripture' : 'Open passage', 'button primary');
  form.append(field, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (input.value.trim()) go(input.value.trim());
  });
  container.append(form);
  return input;
}

const allowed = new Set('article section div span p h1 h2 h3 h4 h5 h6 b strong i em u s small sup sub ul ol li hr br table thead tbody tr th td blockquote pre code bdi bdo a details summary'.split(' '));
const ignored = new Set('script style iframe object embed link meta title head noscript template svg canvas input form button img audio video'.split(' '));
function importLegacy(html, options = {}) {
  // A template keeps the source inert. Rebuild text and reviewed tags with no copied event handlers or resources.
  const template = node('template');
  template.innerHTML = html;
  const root = node('article', '', 'legacy-text');
  function transfer(from, to) {
    for (const original of from.childNodes) {
      if (original.nodeType === Node.TEXT_NODE) {
        to.append(document.createTextNode(original.textContent));
      } else if (original.nodeType === Node.ELEMENT_NODE && original.localName === 'img' && options.image) {
        const imageLink = options.image(original);
        if (imageLink) to.append(imageLink);
      } else if (original.nodeType === Node.ELEMENT_NODE && original.localName === 'button' && options.button) {
        const control = options.button(original);
        if (control) to.append(control);
      } else if (original.nodeType === Node.ELEMENT_NODE && !ignored.has(original.localName)) {
        if (!allowed.has(original.localName)) {
          transfer(original, to);
          continue;
        }
        const copied = node(original.localName);
        options.decorate?.(original, copied);
        if (original.localName === 'a' && options.anchor) {
          options.anchor(original, copied);
        } else if (original.localName === 'a' && webUrl(original.getAttribute('href'))) {
          Object.assign(copied, { href: webUrl(original.getAttribute('href')), target: '_blank', rel: 'noopener noreferrer' });
        }
        if (original.classList.contains('scripture-box')) copied.className = 'scripture-box';
        if (['ltr', 'rtl', 'auto'].includes(original.dir)) copied.dir = original.dir;
        if (/^[a-z-]{2,12}$/i.test(original.lang)) copied.lang = original.lang;
        transfer(original, copied);
        to.append(copied);
      }
    }
  }
  transfer(template.content, root);
  return root;
}

function playAudio(url, label) {
  const source = url.startsWith('./corpus/assets/') ? url : webUrl(url);
  if (!source) return;
  $('player').hidden = false;
  $('playing').textContent = label;
  $('audio-status').textContent = source.startsWith('./') ? 'HomeGroups recording' : 'External recording';
  if (audio.getAttribute('src') !== source) audio.src = source;
  audio.play().catch(() => {
    if (!audio.error && audio.getAttribute('src') === source) $('audio-status').textContent = 'Use Play to start the recording.';
  });
}
audio.addEventListener('error', () => {
  if (audio.hasAttribute('src')) $('audio-status').textContent = 'This recording is unavailable.';
});
$('stop-audio').addEventListener('click', () => {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  $('player').hidden = true;
});

function posts(key) {
  return ledger.posts[key] ?? [];
}
function threadKey(year = active.year) {
  return `group:${year}:${week}`;
}
function post(author, body, ref = '') {
  const item = node('article', '', 'message');
  item.append(node('strong', author), text(body, 'source-copy'));
  if (ref) item.append(button(ref, () => passage(ref)));
  return item;
}
function composer(host, key, addPost, isPrivate = false) {
  const form = node('form');
  const label = node('label', isPrivate ? 'Message' : 'Reply');
  const field = node('textarea');
  const draft = ledger.drafts[key] ??= {};
  field.value = draft.body ?? '';
  field.maxLength = 1600;
  label.append(field);
  const status = text('Prototype data · stored on this device.', 'form-caption');
  const attachment = node('div');
  function updateAttachment() {
    attachment.replaceChildren();
    if (draft.ref) attachment.append(text('Attached · ' + draft.ref),
      button('Remove attachment', () => {
        delete draft.ref;
        saveLocal(ledger);
        updateAttachment();
      }, 'quiet'));
  }
  updateAttachment();
  field.addEventListener('input', () => {
    draft.body = field.value;
    if (!saveLocal(ledger)) status.textContent = 'Storage is unavailable. This draft is kept for this session.';
  });
  const submit = node('button', isPrivate ? 'Save demo message' : 'Post demo reply', 'button primary');
  form.append(label, attachment, cluster(button('Attach Scripture', () => open('attach', { draft, updateAttachment })), submit), status);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = field.value.trim();
    if (!message && !draft.ref) {
      field.focus();
      return;
    }
    const item = { body: message, ref: draft.ref ?? '' };
    (ledger.posts[key] ??= []).push(item);
    draft.body = '';
    delete draft.ref;
    field.value = '';
    updateAttachment();
    const saved = saveLocal(ledger);
    addPost(item);
    status.textContent = saved ? 'Saved on this device.' : 'Saved for this session only.';
  });
  host.append(form);
}

function renderFellowship() {
  stopFellowshipPilot?.();
  fellowshipInviteUser = null;
  fellowshipHome?.close();
  const { row: data, year } = active;
  const selectedWeek = week;
  const archive = year !== liveYear;
  const inner = node('article', '', 'sheet');
  inner.append(renderIntro('fellowship-title', archive ? `Discussion archive · ${year}` : '', 'Fellowship',
    `Week ${week} · ${data.portion_transliteration} · ${data.title_english}`));
  const section = node('section', '', 'thread-card fellowship-conversation');
  section.tabIndex = -1;
  section.setAttribute('aria-label', 'Weekly conversation');
  const discussionTitle = archive ? 'Discussion archive' : selectedWeek === cycleWeek ? 'This week’s discussion' : `Week ${selectedWeek} discussion`;
  section.append(node('h2', discussionTitle));
  fellowshipHome = archive ? null : mountFellowshipHome(inner, {
    node, text, button, link, cluster,
    inviteConversation: (marker, snapshot) => open('conversationInvite', { marker, snapshot, week: selectedWeek }),
  });
  const links = cluster(
    link('Conversations', 'https://homegroups.org/?card=fellowship-live&view=messages'),
    link('Communities', 'https://homegroups.org/?card=fellowship-live&view=explore'),
    button('Invitations', () => open('fellowshipInvitations')),
  );
  links.classList.add('fellowship-links');
  const mount = () => {
    inner.append(section, links);
    fellowship.replaceChildren(inner);
    if (face === 'fellowship' && workspace === 'study') void fellowshipHome?.load();
  };
  if (fellowshipPilot) {
    mount();
    if (pilotMode === 'firebase') {
      import('./fellowship-firebase.js').then(({ mountFirebaseFellowship }) => {
        if (section.isConnected) stopFellowshipPilot = mountFirebaseFellowship(section, {
          node, text, button, year, week: selectedWeek,
          configPath: hostedFellowshipPreview ? '/__/firebase/init.json' : './__fellowship-firebase/config',
          setInviteUser(user) { if (section.isConnected) fellowshipInviteUser = user; },
        });
      }).catch(() => {
        if (section.isConnected) section.append(text('Could not open the Firebase sign-in preview.'));
      });
      return;
    }
    import('./fellowship-pilot.js').then(({ mountLocalFellowship }) => {
      if (!section.isConnected) return;
      stopFellowshipPilot = mountLocalFellowship(section, {
        node, text, button, cluster, year, week: selectedWeek,
      });
      if (new URLSearchParams(location.hash.slice(1)).has('invite')) section.scrollIntoView({ block: 'start' });
    }).catch(() => {
      if (section.isConnected) section.append(text('Could not open the local Fellowship pilot.'));
    });
    return;
  }
  if (archive) section.append(button(`Return to ${liveYear}`, () => selectYear(liveYear), 'quiet'));
  else {
    section.append(text('What stood out to you in the reading? Bring a question or share what you noticed.'));
    section.append(link('Open weekly conversation', localPreview
      ? `http://localhost:8770/NextPhase/?pilot=firebase&face=fellowship&week=${selectedWeek}`
      : `https://homegroups.org/?card=fellowship-live&view=home&week=${selectedWeek}`));
  }
  const group = fixture(year, week, liveYear, cycleWeek, data.portion_transliteration, data.torah_reading);
  const key = threadKey();
  const messages = node('div');
  const demo = node('div', '', 'thread-card');
  demo.append(node('p', archive ? 'Sample archive' : 'Fellowship demo', 'eyebrow'));
  if (group) {
    demo.append(node('h3', group.name));
    messages.append(post('Miriam Ellis', group.opening, group.reference), post('Daniel Brooks', group.reply));
  } else {
    demo.append(node('h3', 'No discussion yet'), text(archive
      ? 'There is no sample discussion for this year and study.'
      : 'Start a local discussion for this year’s study.'));
  }
  for (const item of posts(key)) messages.append(post('You · Demo', item.body, item.ref));
  demo.append(messages);
  if (!archive) composer(demo, key, (item) => messages.append(post('You · Demo', item.body, item.ref)));
  else demo.append(text('Archive · Read only'));
  section.append(disclosure(archive ? 'View sample archive' : 'Try the local discussion demo', demo));
  mount();
}

function selectYear(year) {
  active.year = year;
  renderFellowship();
  fellowship.scrollTop = 0;
  if (face === 'fellowship') $('fellowship-title')?.setAttribute('tabindex', '-1');
  if (face === 'fellowship') $('fellowship-title')?.focus({ preventScroll: true });
}

function isLearningResource(type) {
  return type !== 'learning' && (Object.hasOwn(learningCards, type) || ['people', 'person', 'teaching', 'debate'].includes(type));
}

function learningDescriptor(frame, title) {
  const data = {};
  for (const field of ['journey', 'file', 'id', 'ref', 'book', 'chapter', 'language', 'from', 'anchor', 'work', 'volume', 'verse', 'q', 'entry', 'view', 'video', 'debate']) {
    const value = field === 'id' ? frame.data?.id ?? frame.data?.item?.id : frame.data?.[field];
    if (value !== '' && (typeof value === 'string' || typeof value === 'number')) data[field] = value;
  }
  return { key: 'learning:' + frame.type + ':' + JSON.stringify(data), type: frame.type, data,
    title: title || panelNames[frame.type] };
}

function learningLabel(frame) {
  if (frame.type === 'referenceCommentary') return 'Wesley · ' + frame.data.ref;
  if (frame.type === 'referenceResource' && !frame.data.entry && frame.data.ref) return (panel.querySelector('h3')?.textContent || 'Reference Library') + ' · ' + frame.data.ref;
  if (['referenceResource', 'dictionaryEntry', 'learningJourney', 'learningArticle', 'article', 'ancientDetail', 'ancientRead', 'person', 'teaching', 'debate'].includes(frame.type)) {
    return panel.querySelector('h3')?.textContent || panelNames[frame.type];
  }
  return panelNames[frame.type];
}

function rememberLearning(frame) {
  if (!isLearningResource(frame.type)) return;
  const descriptor = learningDescriptor(frame, learningLabel(frame));
  learningRecent = { ...descriptor, frame };
  ledger.learning.recent = descriptor;
  saveLocal(ledger);
  renderLearningResume();
}

function resumeLearning(activity = learningRecent) {
  if (!activity) return;
  const resume = async () => {
    if (activity.journey) {
      const journey = activity.journey;
      history.pushState({ panels: [] }, '', journey.url);
      await applyRoute();
      for (const saved of journey.frames) open(saved.type, saved.data, saved);
      origin = journey.origin;
    } else open(activity.type, activity.data, activity.frame);
  };
  if (frames.length) closePanels(resume);
  else resume();
}

function renderLearningResume() {
  if (!learningResumeSlot) return;
  learningResumeSlot.replaceChildren();
  if (learningRecent) learningResumeSlot.append(row('Continue learning', learningRecent.title, () => resumeLearning()));
}

function showLearningDiscussion(key = 'learning:general') {
  const slot = $('learning-discussion');
  if (!slot) return;
  const topic = learningTopics.get(key) || learningTopics.get('learning:general');
  if (!topic || learningDiscussionKey === topic.key) return;
  const surface = $('learning-fellowship');
  const previous = learningDiscussions.get(learningDiscussionKey);
  if (previous) previous.top = surface.scrollTop;
  let discussion = learningDiscussions.get(topic.key);
  if (!discussion) {
    const card = node('section', '', 'thread-card');
    card.setAttribute('aria-label', 'Learning conversation');
    card.append(node('h2', topic.title), text('Local Fellowship demo · Replies stay in this browser.'));
    if (topic.type !== 'learning') card.append(button('Return to resource', () => resumeLearning(learningTopics.get(topic.key)), 'quiet'));
    const replies = node('div');
    const empty = text('Bring a question, share a discovery, or ask to work through this together.');
    if (!posts(topic.key).length) replies.append(empty);
    for (const reply of posts(topic.key)) replies.append(post('You · Local', reply.body, reply.ref));
    card.append(replies);
    composer(card, topic.key, reply => {
      empty.remove();
      replies.append(post('You · Local', reply.body, reply.ref));
    });
    discussion = { card, top: 0 };
    learningDiscussions.set(topic.key, discussion);
  }
  learningDiscussionKey = topic.key;
  slot.replaceChildren(discussion.card);
  surface.scrollTop = discussion.top;
}

function enterLearningDiscussion(topic) {
  learningTopics.set(topic.key, topic);
  ledger.learning.topics = [...learningTopics.values()].filter(item => item.type !== 'learning')
    .map(({ key, title, type, data }) => ({ key, title, type, data }));
  saveLocal(ledger);
  const enter = () => {
    const url = new URL(location.href);
    url.searchParams.set('workspace', 'learning');
    url.searchParams.set('learningFace', 'fellowship');
    if (topic.key === 'learning:general') url.searchParams.delete('learningTopic');
    else url.searchParams.set('learningTopic', topic.key);
    history.pushState({ panels: [] }, '', url);
    applyRoute();
  };
  if (frames.length) closePanels(enter);
  else enter();
}

function renderLearningWorkspace() {
  learningTopics.set('learning:general', { key: 'learning:general', title: 'Learning together', type: 'learning', data: {} });
  for (const saved of ledger.learning.topics) {
    if (!saved || !isLearningResource(saved.type)) continue;
    const topic = learningDescriptor({ type: saved.type, data: saved.data }, saved.title);
    learningTopics.set(topic.key, topic);
  }
  if (ledger.learning.recent && isLearningResource(ledger.learning.recent.type)) {
    const saved = ledger.learning.recent;
    learningRecent = learningDescriptor({ type: saved.type, data: saved.data }, saved.title);
  }
  const front = node('article', '', 'sheet learning-sheet');
  front.append(renderIntro('learning-title', '', 'Learning Hub', 'Explore, practice, and continue learning.'));
  learningResumeSlot = node('div', '', 'learning-resume');
  const resources = node('div', '', 'rows');
  views.learning(resources);
  front.append(learningResumeSlot, resources);
  $('learning-study').replaceChildren(front);
  renderLearningResume();
  const back = node('article', '', 'sheet learning-sheet');
  back.append(renderIntro('learning-fellowship-title', '', 'Learning together', 'Learning Hub · Fellowship'));
  const discussion = node('div');
  discussion.id = 'learning-discussion';
  back.append(discussion);
  $('learning-fellowship').replaceChildren(back);
  showLearningDiscussion(readRoute().learningTopic);
}

function changeLearningFace(next) {
  if (learningFace === next || !active?.content || dialog.open) return;
  const url = new URL(location.href);
  if (next === 'fellowship') url.searchParams.set('learningFace', 'fellowship');
  else url.searchParams.delete('learningFace');
  history.pushState({ panels: [] }, '', url);
  applyRoute();
}

function renderPreparednessWorkspace() {
  const front = node('article', '', 'sheet preparedness-sheet');
  front.append(renderIntro('preparedness-title', '', 'Preparedness', 'Emergency Preparedness & Communications'));
  views.preparedness(front, { data: { surface: 'front', initial: 'plan' } });
  $('preparedness-study').replaceChildren(front);

  const back = node('article', '', 'sheet preparedness-sheet');
  back.append(renderIntro('communications-title', '', 'Communications', 'Preparedness · Fellowship'));
  refreshPreparednessView = views.preparedness(back, { data: { surface: 'back' } });
  const conversation = node('section', '', 'thread-card');
  conversation.setAttribute('aria-label', 'Preparedness conversation');
  conversation.append(node('h2', 'Preparedness conversation'),
    text('Local Fellowship demo · Replies stay in this browser.'));
  const key = 'preparedness:conversation';
  const replies = node('div');
  const empty = text('Share a question or a preparation you’d like to practice together.');
  if (!posts(key).length) replies.append(empty);
  for (const reply of posts(key)) replies.append(post('You · Local', reply.body, reply.ref));
  conversation.append(replies);
  composer(conversation, key, reply => {
    empty.remove();
    replies.append(post('You · Local', reply.body, reply.ref));
  });
  back.append(conversation);
  $('preparedness-fellowship').replaceChildren(back);
}

function changePreparednessFace(next) {
  if (preparednessFace === next || !active?.content || dialog.open) return;
  const url = new URL(location.href);
  if (next === 'fellowship') url.searchParams.set('preparednessFace', 'communications');
  else url.searchParams.delete('preparednessFace');
  history.pushState({ panels: [] }, '', url);
  applyRoute();
}

const views = {
  themeManager: createThemeView({ node, text, button, cluster }),
  learningTools(target) { views.learning(target); },
  learningActions(target) {
    const topic = learningTopics.get(learningDiscussionKey);
    if (topic?.type !== 'learning' && topic) target.append(row('Return to resource', topic.title, () => resumeLearning(topic)));
    target.append(row('Learning conversations', 'Questions and discoveries by resource', () => open('learningConversations')));
    if (!fellowshipPilot) target.append(row('Private conversations', 'Existing local Fellowship demo', () => open('private')));
  },
  learningConversations(target) {
    for (const topic of learningTopics.values()) {
      const count = posts(topic.key).length;
      const detail = count ? count + (count === 1 ? ' local reply' : ' local replies') : 'Start a local conversation';
      target.append(row(topic.title, detail, () => enterLearningDiscussion(topic)));
    }
  },
  preparednessTools(target) {
    target.append(
      row('Radio Network Map', 'Repeaters and geographic resources', () => open('prepMap')),
      row('Be Ready library', '1,061 original catalog records', () => open('prepLibrary')),
      row('Amateur radio resources', 'Licensing, listening and references', () => open('prepRadio')),
      row('The Common Ground', 'Sourced briefing samples', () => open('commonGround')),
      row('Research backlog', 'Original preparedness research', () => open('prepResearch')),
      row('Prayer Map', 'Prayer and community geography', () => open('prepPrayer')));
  },
  preparednessActions(target) {
    target.append(
      row('Practice plan', 'The existing exercise and fallback plan', () => open('practicePlan')),
      row('Practice a read-back', 'Log the fictional message', () => open('practiceReadback')),
      row('Radio Network Map', 'Explore published resources', () => open('prepMap')),
      row('The Common Ground', 'Read and discuss a briefing', () => open('commonGround')));
    if (!fellowshipPilot) target.append(row('Private conversations', 'Existing local Fellowship demo', () => open('private')));
  },
  fellowshipActions(target) {
    if (gamesAvailable()) target.append(row('Invite to Game', 'Fellowship activity', () => open('games', { scope: threadKey() })));
    target.append(row('Discussion archives', 'Previous study years', () => open('archive')));
    if (!fellowshipPilot) target.append(row('Private conversations', 'Local demo', () => open('private')));
  },
  fellowshipInvitations(target) {
    target.append(text('Open the link in a Fellowship invitation email to accept or decline.'));
    if (localPreview) target.append(button('Try a sample invitation', () => open('conversationInvitation', { sample: true })));
  },
  async conversationInvitation(target, { data }) {
    const status = text('Opening the invitation…');
    status.setAttribute('role', 'status');
    target.append(status);
    const sample = data.sample ? { code: 'pending', sender: members[0].name, reading: active.row.torah_reading, week } : null;
    if (sample) target.prepend(text('Local invitation demo', 'eyebrow'));

    async function respond(decision) {
      if (sample) {
        if (decision && sample.code === 'pending') sample.code = decision === 'accept' ? 'accepted' : 'declined';
        return sample;
      }
      const response = await fetch(new URL('./__fellowship-email/respond', location.href), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: data.token, decision }),
      });
      return response.json();
    }

    const choices = cluster();
    const choice = (label, decision, style) => button(label, async () => {
      for (const control of choices.querySelectorAll('button')) control.disabled = true;
      try { display(await respond(decision)); }
      catch {
        status.textContent = 'Could not save your choice. Please try again.';
        for (const control of choices.querySelectorAll('button')) control.disabled = false;
      }
    }, style);
    function display(result) {
      if (result.code === 'pending') {
        status.textContent = `${result.sender} invited you to discuss ${result.reading} from Week ${result.week}.`;
        choices.replaceChildren(choice('Accept', 'accept', 'button primary'), choice('Decline', 'decline', 'quiet'));
        return;
      }
      choices.replaceChildren();
      if (result.code === 'accepted') {
        status.textContent = sample ? 'Invitation accepted.' : 'Invitation accepted. Private messaging is still being set up.';
        if (sample) choices.append(button('Open demo conversation', () => open('dm', { member: members[0] }), 'button primary'));
      } else if (result.code === 'declined') status.textContent = 'Invitation declined.';
      else status.textContent = 'This invitation is unavailable. It may have expired.';
    }
    target.append(choices);
    try { display(await respond()); }
    catch { status.textContent = 'This invitation could not be opened.'; }
  },
  async conversationInvite(target, frame) {
    const user = fellowshipInviteUser;
    if (!user) {
      target.append(text(pilotMode === 'firebase' ? 'Sign in with Google in Weekly conversation, then try the invitation again.'
        : 'Use the signed-in Fellowship preview to email an invitation.'));
      if (localPreview && pilotMode !== 'firebase') target.append(link('Open signed-in preview',
        'http://localhost:8770/NextPhase/?pilot=firebase&face=fellowship&week=7'));
      return;
    }
    const status = text('Requesting your email invitation…');
    status.setAttribute('role', 'status');
    target.append(status);
    const messages = {
      accepted: 'The email service accepted your invitation. The recipient can accept or decline from the email.',
      'no-address': 'There is no usable email address on file for this listing.',
      'sign-in': 'Sign in to Fellowship again and try the invitation.',
      forbidden: 'Email invitations are available to signed-in members of the pilot group.',
      'refresh-map': 'Refresh the map before inviting this member.',
      'already-requested': 'You already requested an invitation to this member today.',
      'daily-limit': 'You reached today’s email invitation limit.',
      configuration: 'Email sending has not been configured for this preview.',
    };
    try {
      const token = await user.getIdToken();
      if (!activeFrame(frame)) {
        status.textContent = 'Invitation canceled before the email request.';
        return;
      }
      const response = await fetch(new URL('./__fellowship-email/invite', location.href), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(frame.data),
      });
      const result = await response.json().catch(() => ({}));
      const code = [404, 405].includes(response.status) && !result.code ? 'configuration' : result.code;
      status.textContent = messages[code] ?? 'The email service could not confirm your invitation. Try again later.';
    } catch {
      status.textContent = 'The email service could not confirm your invitation. Try again later.';
    }
  },
  ...createPeopleViews({ node, text, button, link, cluster, row, disclosure, open }),
  games: createGameView({ node, text, button, cluster, row, disclosure, members, passage }),
  ...createPreparednessViews({ node, text, button, cluster, disclosure, link, open }),
  ...createCommonGroundViews({ node, text, button, row, link, disclosure, open, mountDiscussion(target, item, context) {
    const key = `briefing:${context.year}:${context.week}:${item.id}`;
    target.append(text('Local Fellowship discussion · Replies stay in this browser.'));
    if (frames.at(-2)?.type !== 'commonGroundBriefing') {
      target.append(button('Read the briefing', () => open('commonGroundBriefing', { id: item.id }), 'quiet'));
    }
    const replies = node('div');
    for (const reply of posts(key)) replies.append(post('You · Local', reply.body, reply.ref));
    target.append(replies);
    composer(target, key, reply => replies.append(post('You · Local', reply.body, reply.ref)));
  } }),
  ...createLibraryViews({ node, text, button, cluster, disclosure, link, open }),
  ...createMapViews({ node, text, button, cluster, disclosure, link, open }),
  ...createRadioViews({ node, text, button, cluster, disclosure, link, open }),
  ...createLearningViews({ node, text, button, row, cluster, disclosure, link, open, importLegacy }),
  ...createLearningEnrichment({ node, text, button, row, cluster, disclosure, link }),
  ...createTopicalViews({ node, text, button, row, cluster, disclosure, open, importLegacy }),
  ...createReferenceViews({ node, text, button, row, cluster, disclosure, link, open, importLegacy, defaultRef }),
  ...createReferenceLibraryViews({ node, text, button, row, cluster, disclosure, link, open, defaultRef, updateUrl(frame) {
    if (activeFrame(frame)) {
      history.replaceState(history.state, '', excursionUrl(frame.type, frame.data));
      rememberLearning(frame);
    }
  } }),
  ...createAncientViews({ node, text, button, row, cluster, disclosure, link, open }),
  ...createCalendarViews({ node, text, button, row, cluster, disclosure, link, open, passage,
    supplemental: () => catalog.extra, updateUrl(frame) {
      if (activeFrame(frame)) history.replaceState(history.state, '', excursionUrl(frame.type, frame.data));
    },
  }),
  ...createStudyTools({
    node, text, button, link, cluster, disclosure, row, open, passage,
    safeText: (html) => importLegacy(html).textContent,
  }),
  weeks(target) {
    const list = node('div', '', 'rows');
    const select = (chosen) => closePanels(() => changeRoute(chosen, face));
    const previous = button('Previous week', () => select(week - 1), 'quiet');
    previous.disabled = week === 1;
    const next = button('Next week', () => select(week + 1), 'quiet');
    next.disabled = week === WEEK_COUNT;
    target.append(cluster(button('This week', () => {
      closePanels(() => {
        if (face === 'fellowship' && week === cycleWeek) selectYear(liveYear);
        changeRoute(cycleWeek, face);
      });
    }, 'button primary'), previous, next));
    for (const item of catalog.weekly) {
      const option = row(`${item.week} · ${item.portion_transliteration}`, item.title_english + (+item.week === cycleWeek ? ' · Current' : ''),
        () => select(+item.week));
      if (+item.week === week) option.setAttribute('aria-current', 'true');
      list.append(option);
    }
    target.append(list);
  },
  days(target) {
    const list = node('div', '', 'rows');
    for (let day = 1; day <= 7; day++) {
      const item = dayRow(day);
      const option = row(`${dayNames[day - 1]} · Day ${day}`, item?.torah_daily_reading ?? 'No source row',
        () => closePanels(() => setDay(day)));
      if (day === active.day) option.setAttribute('aria-current', 'true');
      list.append(option);
    }
    target.append(list);
  },
  tools(target) {
    target.append(text('Start with this week’s reading, or enter another passage.'),
      row('Passage reader', defaultRef(), () => passage(defaultRef(), dayRow()?.sefaria_bilingual_link)),
      row('Covenants & Commandments', 'Browse covenants and search the commandments', () => open('law')),
      row('New Testament Notes', 'Browse available book and chapter notes', () => open('nt')),
      row('Hebrew Library', 'Open a cited source in Sefaria', () => open('sefaria', { ref: defaultRef() })),
      row('Teachers & Scholars', 'Profiles, teaching archives and debates', () => open('people')),
      row('Sources Library', 'Compare witnesses and browse reference works', () => open('sourcesLibrary')),
      row('Investigations', 'Search published HomeGroups research', () => open('research')),
      row('Weekly commentary', 'Study the selected portion', () => open('commentary')),
      row('Learning Hub', 'Guided paths and the article collection', () => open('learning')),
      row('Prayer Map', 'Explore prayer and community geography', () => open('prepPrayer')),
      row('Calendar studies', 'Appointed times and supplemental portions', () => open('calendar')),
      row('Personal notes', 'Saved on this device', () => open('note')));
  },
  async reader(target, { data }) {
    const { ref, source } = data;
    renderReferenceForm(target, ref, (value) => passage(value));
    target.append(cluster(button('Use this week’s reading', () => passage(defaultRef(), dayRow()?.sefaria_bilingual_link), 'quiet'),
      link('KJV source ↗', passageUrl(ref)), ...(source ? [link('Scheduled bilingual source ↗', source)] : [])));
    const place = node('div', '', 'reader-list');
    place.append(text('Loading KJV passage…'));
    target.append(place);
    try {
      const groups = await readPassage(ref);
      const result = document.createDocumentFragment();
      for (const group of groups) {
        result.append(node('h3', group.book));
        for (const chapter of group.chapters) {
          for (const line of chapter.verses) {
            const location = `${group.book} ${chapter.chapter}:${line.verse}`;
            const verse = node('div', '', 'verse');
            verse.dataset.reference = location;
            const control = button(`${chapter.chapter}:${line.verse}`, () => open('verse', { ref: location }));
            control.setAttribute('aria-label', 'Passage tools for ' + location);
            verse.append(control, text(line.text, 'verse-text'));
            result.append(verse);
          }
        }
      }
      place.replaceChildren(result);
    } catch (error) {
      place.replaceChildren(text(error.message), button('Open English weekly source', () => open('weeklyText', { language: 'english' })));
    }
  },
  verse(target, { data }) {
    target.append(node('h3', data.ref),
      row('Open nearby chapter', 'Read the wider passage', () => passage(data.ref.split(':')[0])),
      row('Reference Library', 'Explore reference material for this verse', () => open('referenceLibrary', { ref: data.ref })),
      row('Word study', 'Hebrew & Greek · KJV word links', () => open('referenceResource', { id: 'bibles-kjv', ref: data.ref, view: 'words' })),
      row('Cross-references', 'Follow related Scripture passages', () => open('referenceResource', { id: 'cross-references-bcdxrefs', ref: data.ref })),
      row('Translation Explorer', 'Check the original sample set', () => open('translation', { ref: data.ref })),
      row('Intertext Explorer', 'Find quotation witnesses', () => open('intertext', { from: data.ref })),
      row('Interlinear sources', 'Original-language help', () => open('alignment', { ref: data.ref })));
    if (face === 'study') {
      target.append(row('Personal note', 'Save with this reference', () => open('note', { ref: data.ref })),
        row('Investigations', 'Search with this passage in view', () => open('research', { ref: data.ref })));
    }
  },
  alignment(target, { data }) {
    target.append(text('Validated word alignment is unavailable in this build. Read the original-language weekly source or open the selected verse on Bible Hub.'));
    const [book, chapter, verse] = data.ref.match(/^(.+?)\s+(\d+):(\d+)$/)?.slice(1) ?? [];
    if (book) {
      const slug = book.toLowerCase().replace(/^iii\s+/, '3 ').replace(/^ii\s+/, '2 ').replace(/^i\s+/, '1 ')
        .replace('revelation of john', 'revelation').replace('song of solomon', 'songs').replaceAll(' ', '_');
      target.append(link('Bible Hub interlinear ↗', `https://biblehub.com/interlinear/${slug}/${chapter}-${verse}.htm`));
    }
    target.append(cluster(button('Hebrew weekly source', () => open('weeklyText', { language: 'hebrew' })),
      button('Greek weekly source', () => open('weeklyText', { language: 'greek' }))));
  },
  async weeklyText(target, { data }) {
    const { language } = data;
    const options = cluster(...Object.entries(LANGUAGES).map(([id, label]) => {
      const option = button(label, () => open('weeklyText', { language: id }), 'pill');
      option.setAttribute('aria-pressed', String(id === language));
      option.disabled = id === language;
      return option;
    }));
    target.append(options, text(LANGUAGES[language] + ' · HomeGroups weekly source text'));
    const result = await getWeeklyText(active.row, language);
    target.append(result?.html ? importLegacy(result.html) : text('This language source is unavailable for the selected week.'));
  },
  outline(target) {
    const outlines = active.content.sections?.chapter_outlines ?? active.content.chapter_outlines;
    if (!outlines) target.append(text('The selected week has no source outline.'));
    for (const [category, entries] of Object.entries(outlines ?? {})) {
      const body = node('div', '', 'rows');
      for (const entry of Array.isArray(entries) ? entries : [entries]) {
        if (typeof entry !== 'string' || !entry.includes('|')) {
          appendData(body, entry);
          continue;
        }
        const [ref, label] = entry.split('|').map((part) => part.trim());
        body.append(row(label, ref, () => passage(ref)));
      }
      target.append(disclosure(category, body));
    }
  },
  async commentary(target) {
    const content = active.content;
    for (const key of ['commentary', 'commentary2']) {
      const note = content[key] ?? content.sections?.[key];
      if (note) {
        const body = node('div');
        appendData(body, note);
        target.append(disclosure(key === 'commentary' ? 'Weekly notes' : 'Supplemental notes', body));
      }
    }
    const weekId = week;
    try {
      const item = await getCommentary(weekId);
      target.append(importLegacy(item.html));
    } catch (error) {
      if (error.status !== 404) throw error;
      target.append(text('The source has no standalone commentary article for this week.'));
    }
    for (const suffix of ['b']) {
      if (![21, 22].includes(weekId)) continue;
      try {
        const item = await getCommentary(weekId, suffix);
        target.append(disclosure('Additional source article', importLegacy(item.html)));
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }
  },
  resources(target) {
    const content = active.content;
    const teaching = cluster(...['cOhQVzntlWj', 'cOhQe1ntIfR', 'cOhQePntIj4'].map((id, index) =>
      link('Part ' + (index + 1) + ' ↗', 'https://go.screenpal.com/player/' + id)));
    target.append(disclosure('MainStage teaching videos', text('Links retained from the production MainStage shell. Weekly applicability varies.'), teaching));
    const available = Object.keys(content).concat(Object.keys(content.sections ?? {}));
    const exclude = new Set(['intro', 'sections', 'audio_playlist', 'scripture_text', 'chapter_outlines',
      'commentary', 'commentary2', 'english', 'hebrew', 'transliteration', 'week', 'title', 'subtitle', 'first_verse']);
    for (const key of new Set(available.filter((item) => !exclude.has(item)))) {
      const data = content[key] ?? content.sections?.[key];
      if (!data) continue;
      const body = node('div');
      appendData(body, data);
      target.append(disclosure(title(key), body));
    }
    if (content.first_verse?.text && !/insert first/i.test(content.first_verse.text)) {
      const body = node('div');
      appendData(body, content.first_verse);
      target.append(disclosure('First verse', body));
    }
    if (!target.childElementCount) target.append(text('This week has no supplemental editorial content.'));
  },
  listen(target) {
    const playlist = active.content.sections?.audio_playlist ?? active.content.audio_playlist ?? [];
    const local = node('div', '', 'rows');
    const field = node('label', 'Recording language');
    const select = node('select');
    for (const [id, label] of Object.entries(LANGUAGES)) {
      const choice = node('option', label);
      choice.value = id;
      select.append(choice);
    }
    field.append(select);
    function renderTracks() {
      const language = select.value;
      const legacyField = { english: 'src', hebrew: 'heb', greek: 'grk' }[language];
      local.replaceChildren();
      for (const track of playlist) {
        const source = webUrl(track[legacyField]);
        if (!source) continue;
        if (language !== 'english' && /audio\.esv|esvbible\.org/i.test(source)) continue;
        const label = track.label || 'Source recording';
        if (/\.mp3(?:[?#]|$)/i.test(source) && !source.includes(',')) {
          local.append(row(label, 'External · Verify passage in source', () => playAudio(source, label + ' · ' + LANGUAGES[language])));
        } else {
          local.append(link(label + ' · Open provider ↗', source));
        }
      }
      if (!local.childElementCount) local.append(text('No matching source recording was found.'));
    }
    select.addEventListener('change', renderTracks);
    target.append(field, text('Some historical recordings are generic, mismatched, or unavailable. Use weekly Scripture for the assigned text.'), local);
    renderTracks();
  },
  note(target, { data }) {
    const ref = data.ref || defaultRef();
    const key = String(week);
    const draftKey = 'note:' + key + ':' + ref;
    const draft = ledger.drafts[draftKey] ??= {};
    const form = node('form');
    const label = node('label', 'Note for ' + ref);
    const field = node('textarea');
    field.value = draft.body ?? '';
    field.maxLength = 2400;
    label.append(field);
    const status = text('Personal notes are saved on this browser.');
    const list = node('div', '', 'notes-list');
    function display() {
      list.replaceChildren(...(ledger.notes[key] ?? []).map((note) => post(note.ref, note.body)));
    }
    field.addEventListener('input', () => {
      draft.body = field.value;
      if (!saveLocal(ledger)) status.textContent = 'Storage is unavailable. Draft is kept for this session.';
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!field.value.trim()) return;
      (ledger.notes[key] ??= []).unshift({ ref, body: field.value.trim() });
      field.value = '';
      delete draft.body;
      status.textContent = saveLocal(ledger) ? 'Note saved on this device.' : 'Note saved for this session only.';
      display();
    });
    form.append(label, node('button', 'Save note', 'button primary'), status);
    target.append(form, list);
    display();
  },
  private(target) {
    target.append(text('Simulated member directory · There is no delivery or account connection.'));
    for (const member of members) {
      target.append(row(member.name, 'Wednesday HomeGroup', () => open('dm', { member })));
    }
  },
  dm(target, { data }) {
    const { member } = data;
    const key = `private:${liveYear}:${week}:${member.id}`;
    const messages = node('div');
    messages.append(post(member.name + ' · Sample', member.hello));
    for (const item of posts(key)) messages.append(post('You · Demo', item.body, item.ref));
    target.append(node('h3', member.name), text('Opened from ' + weekLine()), messages);
    composer(target, key, (item) => messages.append(post('You · Demo', item.body, item.ref)), true);
  },
  archive(target) {
    const years = new Set([liveYear, liveYear - 1, ...Object.keys(ledger.posts).filter((key) => key.startsWith('group:')).map((key) => +key.split(':')[1])]);
    target.append(text('Open previous discussions for the selected weekly study. Change Week in the header to browse another portion.'));
    for (const year of [...years].sort((a, b) => b - a)) {
      const item = row(String(year), year === liveYear ? 'Current discussion year' : 'Year archive',
        () => closePanels(() => selectYear(year)));
      if (year === active.year) item.setAttribute('aria-current', 'true');
      target.append(item);
    }
  },
  attach(target, { data }) {
    const status = text('Open the passage to verify its reference before attaching.');
    renderReferenceForm(target, data.draft.ref ?? defaultRef(), async (ref) => {
      const attachmentFrame = frames.at(-1);
      try {
        await readPassage(ref);
        if (!activeFrame(attachmentFrame)) return;
        data.draft.ref = ref;
        saveLocal(ledger);
        data.updateAttachment();
        backPanel();
      } catch (error) {
        status.textContent = error.message;
      }
    }, 'Passage to attach');
    target.append(status);
  },
};

for (const control of document.querySelectorAll('[data-open]')) {
  control.addEventListener('click', () => open(control.dataset.open));
}
$('flip').addEventListener('click', () => {
  if (workspace === 'learning') changeLearningFace(learningFace === 'study' ? 'fellowship' : 'study');
  else if (workspace === 'preparedness') changePreparednessFace(preparednessFace === 'study' ? 'fellowship' : 'study');
  else if (active?.content) changeRoute(week, face === 'study' ? 'fellowship' : 'study');
});
function moveWorkspace(direction) {
  selectWorkspace(workspaceOrder[workspaceOrder.indexOf(workspace) + direction]);
}
$('workspace-previous').addEventListener('click', () => moveWorkspace(-1));
$('workspace-switch').addEventListener('click', () => moveWorkspace(1));
bindWorkspaceSwipe($('workspaces'), moveWorkspace);
$('learning-discuss').addEventListener('click', () => {
  const frame = frames.at(-1);
  if (!frame || !isLearningResource(frame.type)) return;
  const topic = { ...learningDescriptor(frame, learningLabel(frame)), frame };
  if (frame.type === 'referenceResource') {
    saveFrame(frame);
    const url = new URL(location.href);
    for (const field of panelParameters) url.searchParams.delete(field);
    topic.journey = { url: url.href, frames: [...frames], origin };
  }
  enterLearningDiscussion(topic);
});

async function boot() {
  try {
    catalog = await schedules();
    history.replaceState({ panels: [] }, '', location.href);
    await applyRoute();
    if (!active?.content) return;
    renderPreparednessWorkspace();
    renderLearningWorkspace();
    const url = new URL(location.href);
    const reviewToken = /^#conversation-invite=([a-f0-9]{64})$/.exec(url.hash)?.[1];
    if (reviewToken) {
      url.hash = '';
      history.replaceState({ panels: [] }, '', url);
      open('conversationInvitation', { token: reviewToken });
    } else if (gamesAvailable() && url.searchParams.get('game') === 'invite') {
      url.searchParams.delete('game');
      history.replaceState({ panels: [] }, '', url);
      $('fellowship-more').focus({ preventScroll: true });
      open('games', { scope: threadKey() });
    } else {
      await openLinkedStudyCard();
    }
  } catch {
    study.replaceChildren(text('The weekly schedule could not load.', 'loading'), button('Try again', boot));
  }
}
initAppearance();
bindThemeDiagnostic(() => {
  if (frames.at(-1)?.type === 'themeManager') backPanel();
  else open('themeManager', { diagnostic: true });
});
boot();
