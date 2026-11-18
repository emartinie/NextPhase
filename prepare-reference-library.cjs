const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const keyOf = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function verseTable(root) {
  const names = JSON.parse(fs.readFileSync(path.join(root, 'corpus/kjv/books.json')));
  const verses = [null];
  const books = names.map(name => {
    const key = keyOf(name);
    const source = JSON.parse(fs.readFileSync(path.join(root, 'corpus/kjv', key + '.json')));
    const chapters = source.chapters.map(chapter => {
      for (let i = 0; i < chapter.verses.length; i++) {
        const verse = chapter.verses[i];
        assert.equal(verse.verse, i + 1, 'Non-contiguous KJV verse numbering');
        verses.push({ book: name, key, chapter: chapter.chapter, verse: verse.verse,
          ref: `${name} ${chapter.chapter}:${verse.verse}` });
      }
      return chapter.verses.length;
    });
    return { name, key, chapters };
  });
  assert.equal(verses.length - 1, 31102, 'Unexpected source versification');
  assert.equal(verses[30706].ref, 'Revelation of John 1:8');
  return { books, verses };
}

function indexedRecords(data, index, { commentary = false } = {}) {
  assert.equal(index.length % 8, 0, 'Index must contain pairs of 32-bit offsets');
  const records = [];
  let cursor = 0;
  for (let i = 0; i < index.length / 8; i++) {
    const start = index.readUInt32LE(i * 8);
    const body = index.readUInt32LE(i * 8 + 4);
    if (start === 0xffffffff && body === 0xffffffff) continue;
    const unlabelled = !commentary && start === 0xffffffff;
    assert.equal(unlabelled ? body : start, cursor, 'Unindexed or overlapping source bytes');
    assert.ok(body <= data.length && (unlabelled || body > start), 'Invalid source offset');
    if (!unlabelled) assert.equal(data[body - 1], 0, 'Missing headword separator');
    let end = data.indexOf(0, body);
    if (end === -1) end = data.length;
    const title = unlabelled ? `Unlabelled source fragment (index slot ${i + 1})` : data.subarray(start, body - 1).toString('latin1');
    if (commentary) assert.equal(title.toUpperCase(), (i + 1).toString(16).toUpperCase(), 'Verse ordinal mismatch');
    records.push({ id: i, title, ...(unlabelled ? { unlabelled: true } : {}), raw: data.subarray(body, end).toString('latin1') });
    cursor = Math.min(end + 1, data.length);
  }
  assert.equal(cursor, data.length, 'Trailing unindexed source bytes');
  return records;
}

function decodeText(raw, verses, onIssue = () => {}) {
  const segments = [];
  const serials = new Set();
  const clean = value => value.replace(/[\x05-\x07]/g, '').replace(/\r\n?/g, '\n');
  let start = 0;
  for (const match of raw.matchAll(/\x03([^\x03]*)\x03/g)) {
    if (match.index > start) segments.push(clean(raw.slice(start, match.index)));
    const parsed = /^([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(match[1]);
    const first = parsed ? parseInt(parsed[1], 16) : 0;
    const last = parsed ? parseInt(parsed[2] || parsed[1], 16) : 0;
    if (first > 0 && last >= first && last < verses.length) {
      const a = verses[first], b = verses[last];
      const ref = first === last ? a.ref : a.book === b.book
        ? a.chapter === b.chapter ? `${a.ref}-${b.verse}` : `${a.ref}-${b.chapter}:${b.verse}`
        : `${a.ref}; ${b.ref}`;
      // Cross-book ranges are kept as explicit endpoints, never fabricated as a contiguous reader range.
      segments.push({ ref, ...(a.book !== b.book ? { endpointsOnly: true } : {}) });
      for (let n = first; n <= last; n++) serials.add(n);
    } else {
      segments.push({ unresolved: match[1] });
      onIssue(match[1]);
    }
    start = match.index + match[0].length;
  }
  if (start < raw.length) segments.push(clean(raw.slice(start)));
  for (const part of segments) if (typeof part === 'string') {
    assert.ok(!/[\x00-\x08\x0b-\x1f]/.test(part), 'Unrecognized legacy control marker');
  }
  return { segments, serials: [...serials] };
}

function prepare(root = __dirname) {
  const { books, verses } = verseTable(root);
  const reference = path.join(root, 'corpus/reference');
  const output = path.join(reference, 'derived/v1');
  const resources = [
    { id: 'easton', title: "Easton's Bible Dictionary", kind: 'dictionary',
      files: ['dictionaries/easton/Easton.dt0', 'dictionaries/easton/Easton.dt4', 'dictionaries/easton/Easton.dt7'] },
    { id: 'wesley', title: "John Wesley's Notes on the Old and New Testaments", kind: 'commentary',
      files: ['commentaries/john-wesley/JWN.ct0', 'commentaries/john-wesley/JWN.ct4', 'commentaries/john-wesley/JWN.ct7'] },
  ];
  const pending = new Map();
  const issues = [];
  const json = (file, value) => pending.set(file, JSON.stringify(value) + '\n');
  for (const resource of resources) {
    const original = resource.files.map(file => {
      const bytes = fs.readFileSync(path.join(reference, file));
      return { path: file, bytes: bytes.length, sha256: hash(bytes) };
    });
    const records = indexedRecords(fs.readFileSync(path.join(reference, resource.files[1])),
      fs.readFileSync(path.join(reference, resource.files[2])), { commentary: resource.kind === 'commentary' });
    const counts = { entries: records.length, citationLinks: 0, unresolvedReferences: 0,
      emptyIndexSlots: original[2].bytes / 8 - records.length,
      unlabelledEntries: records.filter(r => r.unlabelled).length };
    const decoded = records.map(record => {
      if (record.unlabelled) issues.push({ resource: resource.id, entry: record.id, title: record.title,
        reason: 'Source index supplies a body offset but no headword offset. Text retained separately; no attribution to a neighbouring entry inferred.' });
      const value = decodeText(record.raw, verses, token => {
        issues.push({ resource: resource.id, entry: record.id, title: record.title, token,
          reason: 'Invalid or reversed verse-ordinal range; preserved without a guessed link.' });
        counts.unresolvedReferences++;
      });
      counts.citationLinks += value.segments.filter(s => typeof s !== 'string' && s.ref).length;
      return { id: record.id, title: record.title, ...(record.unlabelled ? { unlabelled: true } : {}), ...value };
    });
    if (resource.kind === 'dictionary') {
      const byBook = Object.fromEntries(books.map(book => [book.key, {}]));
      for (const entry of decoded) for (const serial of entry.serials) {
        const verse = verses[serial];
        (byBook[verse.key][`${verse.chapter}:${verse.verse}`] ??= []).push(entry.id);
      }
      json('easton/index.json', { entries: decoded.map(({ id, title, unlabelled }) => ({ id, title, ...(unlabelled ? { unlabelled } : {}) })), chunkSize: 100 });
      const chunks = new Map();
      for (const { serials, ...entry } of decoded) {
        const chunk = Math.floor(entry.id / 100);
        if (!chunks.has(chunk)) chunks.set(chunk, []);
        chunks.get(chunk).push(entry);
      }
      for (const [chunk, entries] of chunks) json(`easton/chunks/${chunk}.json`, entries);
      for (const book of books) json(`easton/passages/${book.key}.json`, byBook[book.key]);
    } else {
      assert.equal(fs.statSync(path.join(reference, resource.files[2])).size / 8, verses.length - 1);
      const byChapter = new Map();
      for (const entry of decoded) {
        const verse = verses[entry.id + 1];
        const key = `${verse.key}/${verse.chapter}`;
        if (!byChapter.has(key)) byChapter.set(key, []);
        byChapter.get(key).push({ verse: verse.verse, ref: verse.ref, segments: entry.segments });
      }
      for (const book of books) for (let chapter = 1; chapter <= book.chapters.length; chapter++) {
        json(`wesley/${book.key}/${chapter}.json`, { book: book.name, chapter,
          entries: byChapter.get(`${book.key}/${chapter}`) || [] });
      }
      counts.unannotatedVerses = verses.length - 1 - records.length;
    }
    resource.sourceFiles = original;
    resource.counts = counts;
    delete resource.files;
  }
  const catalog = { schemaVersion: 1, books, resources, notes: [
    'Derived from supplied originals; no external text was substituted.',
    'Only legacy emphasis/font control markers are removed; text and paragraph breaks are retained.',
    'Legacy font-coded original-language fragments are retained as supplied; original-script reconstruction is unverified.',
    'Passage citations use validated 1-based KJV verse ordinals; invalid ranges remain visible as unresolved source references.',
    'Authored dictionary and commentary content is distinct from Scripture and HomeGroups editorial content.',
    'This conversion does not establish reuse permissions for any other uploaded resource.',
  ] };
  json('catalog.json', catalog);
  json('validation.json', { schemaVersion: 1, expectedVerseCount: verses.length - 1,
    sourceByteCoverage: 'All dictionary and commentary text records accounted for by their supplied indexes.', issues });
  for (const [file, value] of pending) {
    const dest = path.join(output, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, value, 'utf8');
  }
  return { resources: resources.map(({ id, counts }) => ({ id, ...counts })),
    files: pending.size, bytes: [...pending.values()].reduce((sum, value) => sum + Buffer.byteLength(value), 0), issues };
}

if (require.main === module) console.log(JSON.stringify(prepare(), null, 2));
module.exports = { prepare, verseTable, indexedRecords, decodeText };
