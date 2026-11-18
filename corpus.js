const ROOT = './corpus/';
const START = Date.parse('2024-10-19T00:00:00Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const cache = new Map();

export const WEEK_COUNT = 52;
export const LANGUAGES = { english: 'English', hebrew: 'Hebrew', greek: 'Greek' };
export const ORIENTATIONS = ['bechukotai', 'behar', 'emor', 'kedoshim', 'nasso'];
export const nameKey = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export function currentWeek(date = new Date()) {
  const elapsed = +date - START;
  return elapsed < 0 ? 1 : (Math.floor(elapsed / WEEK_MS) + 2) % WEEK_COUNT + 1;
}

export function readCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      field += char;
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if (char === '\n' && !quoted) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (row.length || field) rows.push([...row, field.replace(/\r$/, '')]);
  const headers = rows.shift();
  headers[0] = headers[0].replace(/^\uFEFF/, '');
  return rows.filter((values) => values[0]).map((values) =>
    Object.fromEntries(headers.map((key, index) => [key, (values[index] ?? '').trim()])));
}

function load(path, text = false) {
  if (!cache.has(path)) {
    const pending = fetch(ROOT + path).then((response) => {
      if (!response.ok) throw Object.assign(new Error(path), { status: response.status });
      return text ? response.text() : response.json();
    }).catch((error) => {
      cache.delete(path);
      throw error;
    });
    cache.set(path, pending);
  }
  return cache.get(path);
}

export async function schedules() {
  const [weekly, daily, themes] = await Promise.all([
    load('homegroups_weekly_reading_schedule.csv', true).then(readCsv),
    load('homegroups_daily_reading_schedule.csv', true).then(readCsv),
    load('homegroups_weekly_theme_titles.json'),
  ]);
  return {
    weekly: weekly.filter((row) => +row.week <= WEEK_COUNT),
    extra: weekly.filter((row) => +row.week > WEEK_COUNT),
    daily,
    themes: new Map(themes.weeks.map((row) => [+row.week, row.theme_title])),
  };
}

export const getWeek = (week) => load(`data/week${week}.json`);
export const getCommentary = (week, suffix = '') => load(`commentary/week${week}${suffix}.json`);
export const getCalendar = () => load('research/calendar.json');
export const getCalendarSchedules = () => load('calendar.json');
export const getLearningIndex = () => load('learning/index.json');
export const getLearningArticle = (file) => load('learning/articles/' + file.replace(/\.html$/, '.json'));
export const getLearningJourney = (file) => load('learning/journeys/' + file);
export const getAlphabetLab = () => load('learning/alphabets.json');
export const getVisualTeachings = () => load('learning/presentations.json');
export const getTopicalTeachings = () => load('learning/topical.json');
export const getAssessmentQuestions = () => load('learning/nt-questions.json');
export const getResearch = () => load('research/index.json');
export const getResearchBacklog = () => load('reference/backlog.json');
export const getIntertext = () => load('reference/intertext.json');
export const getReferenceSamples = () => load('reference/samples.json');
export const getReferenceDirectory = () => load('reference/resource-directory.json');
export function getFunctionalReferenceData(file = 'catalog.json') {
  if (!/^[a-z0-9][a-z0-9/-]*\.json$/.test(file)) throw new Error('Invalid reference path');
  return load('reference/derived/v2/' + file);
}

export function getReferenceLibraryData(file) {
  if (!/^(?:catalog\.json|easton\/index\.json|easton\/chunks\/\d{1,2}\.json|easton\/passages\/[a-z]{2,32}\.json|wesley\/[a-z]{2,32}\/\d{1,3}\.json)$/.test(file)) {
    throw new Error('Invalid reference resource path');
  }
  return load('reference/derived/v1/' + file);
}
export const getAncientCatalog = () => load('reference/ancient-library/catalog.json');
export const getAncientText = (book, file = 'book.json') => load('reference/ancient-library/' + book + '/' + file);
export const getArticle = (id) => load(`research/${id}.json`);

export async function getWeeklyText(row, language) {
  const path = row[`${language}_week_page`];
  if (!/^scripture\/(english|hebrew|greek)\/week\d+\.html$/.test(path)) return null;
  const filename = path.replace(/\.html$/, '.json');
  try {
    return await load(filename);
  } catch (error) {
    if (error.status !== 404) throw error;
    const padded = String(row.week).padStart(2, '0');
    const alternate = filename.replace(/week\d+/, `week${filename.includes(`week${padded}.`) ? +row.week : padded}`);
    if (alternate !== filename) return load(alternate);
    throw error;
  }
}

const ALIASES = {
  gen: 'Genesis', ge: 'Genesis', gn: 'Genesis',
  ex: 'Exodus', exo: 'Exodus', exod: 'Exodus',
  lev: 'Leviticus', lv: 'Leviticus', num: 'Numbers', nu: 'Numbers',
  deut: 'Deuteronomy', de: 'Deuteronomy', dt: 'Deuteronomy',
  josh: 'Joshua', jos: 'Joshua', judg: 'Judges', jdg: 'Judges',
  ru: 'Ruth', sam: 'Samuel', sa: 'Samuel', ki: 'Kings', kgs: 'Kings', k: 'Kings',
  chr: 'Chronicles', chron: 'Chronicles', ch: 'Chronicles',
  neh: 'Nehemiah', est: 'Esther', ps: 'Psalms', psa: 'Psalms', psalm: 'Psalms',
  prov: 'Proverbs', pr: 'Proverbs', eccl: 'Ecclesiastes', ecc: 'Ecclesiastes',
  song: 'Song of Solomon', sos: 'Song of Solomon', songofsongs: 'Song of Solomon',
  isa: 'Isaiah', is: 'Isaiah', jer: 'Jeremiah', lam: 'Lamentations', ezek: 'Ezekiel', ezk: 'Ezekiel',
  dan: 'Daniel', hos: 'Hosea', obad: 'Obadiah', ob: 'Obadiah', jon: 'Jonah', mic: 'Micah',
  nah: 'Nahum', hab: 'Habakkuk', zeph: 'Zephaniah', hag: 'Haggai', zech: 'Zechariah', mal: 'Malachi',
  mt: 'Matthew', matt: 'Matthew', mk: 'Mark', mrk: 'Mark', lk: 'Luke', jn: 'John', joh: 'John',
  act: 'Acts', rom: 'Romans', cor: 'Corinthians', gal: 'Galatians', eph: 'Ephesians',
  phil: 'Philippians', php: 'Philippians', col: 'Colossians', thess: 'Thessalonians',
  thes: 'Thessalonians', tim: 'Timothy', tit: 'Titus', phlm: 'Philemon', phm: 'Philemon',
  heb: 'Hebrews', jas: 'James', jam: 'James', pet: 'Peter', pe: 'Peter',
  rev: 'Revelation of John', revelation: 'Revelation of John',
};

function findBook(raw, books) {
  const normalized = raw.trim().replace(/^(1|2|3|III|II|I)(?=\s|[a-z])\s*/i,
    (match, number) => {
      // Roman prefixes in the corpus include a space. Avoid consuming the I in Isaiah.
      if (/^i+$/i.test(number) && !/\s/.test(match)) return match;
      return ({ 1: 'I', 2: 'II', 3: 'III' }[number] ?? number.toUpperCase()) + ' ';
    });
  const parts = /^(III |II |I )(.+)$/.exec(normalized);
  const prefix = parts?.[1] ?? '';
  const base = parts?.[2] ?? normalized;
  const key = nameKey(prefix + (ALIASES[nameKey(base)] ?? base));
  return books.find((name) => nameKey(name) === key);
}

export async function readPassage(input) {
  if (input.length > 180) throw new Error('Use a shorter passage reference.');
  const books = await load('kjv/books.json');
  const groups = [];
  let lastBook;
  let previousChapter;
  let precedingDelimiter = '';
  for (const raw of input.replace(/[–—−]/g, '-').split(/([;,])/).filter((part) => part.trim())) {
    if (raw === ',' || raw === ';') {
      precedingDelimiter = raw;
      continue;
    }
    const match = /^(?:((?:[1-3]\s*)?[a-z][a-z .']*?)\s*)?(\d+)(?::(\d+))?(?:\s*-\s*(\d+)(?::(\d+))?)?$/i.exec(raw.trim());
    if (!match) throw new Error(`Could not read “${raw.trim()}”. Try Genesis 1:1–5 or John 1.`);
    const [, bookInput, start, first, end, last] = match;
    const book = bookInput ? findBook(bookInput, books) : lastBook;
    if (!book) throw new Error(`No bundled KJV book matches “${bookInput ?? raw.trim()}”.`);
    const source = await load(`kjv/${nameKey(book)}.json`);
    const singleChapter = source.chapters.length === 1;
    const continuation = !bookInput && precedingDelimiter === ',' && previousChapter;
    const implicitVerse = !first && (singleChapter || continuation && !last);
    const chapter = singleChapter && implicitVerse ? 1 : implicitVerse ? previousChapter : +start;
    const verse = implicitVerse ? +start : first ? +first : null;
    const endChapter = last || (!verse && end) ? +end : chapter;
    const endVerse = last ? +last : end && verse ? +end : verse && !end ? verse : null;
    const firstChapter = source.chapters.find((item) => item.chapter === chapter);
    const finalChapter = source.chapters.find((item) => item.chapter === endChapter);
    if (!firstChapter || !finalChapter || endChapter < chapter ||
        (verse !== null && !firstChapter.verses.some((item) => item.verse === verse)) ||
        (endVerse !== null && !finalChapter.verses.some((item) => item.verse === endVerse)) ||
        (chapter === endChapter && endVerse !== null && endVerse < verse)) {
      throw new Error(`The exact range “${raw.trim()}” is unavailable in this KJV edition. Check the reference or use the scheduled source.`);
    }
    const chapters = source.chapters.filter((item) => item.chapter >= chapter && item.chapter <= endChapter)
      .map((item) => ({
        chapter: item.chapter,
        verses: item.verses.filter(({ verse: number }) =>
          (item.chapter > chapter || verse === null || number >= verse) &&
          (item.chapter < endChapter || endVerse === null || number <= endVerse)),
      }));
    groups.push({ book, chapters, label: raw.trim() });
    lastBook = book;
    previousChapter = endChapter;
  }
  if (!groups.length) throw new Error('Enter a Scripture reference.');
  return groups;
}

export function webUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    url.protocol = 'https:';
    return url.href;
  } catch {
    return '';
  }
}

export const passageUrl = (reference) => `https://www.biblegateway.com/passage/?version=KJV&search=${encodeURIComponent(reference)}`;



