const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const revision = '1e31cc4dd984adc638db2aa87571618fee1f3e31';
const repository = 'emartinie/HGBibleApp';
const output = path.join(__dirname, 'corpus/reference');
const editionTrailers = {
  'ancient-library/shepherd-hermas/book.json': ' The Shepherd of Hermas Go to the Chronological List',
  'ancient-library/psalms-solomon/book.json': ' Edited and slightly adapted by George Lyons',
};

function cleanEdition(name, bytes) {
  const marker = editionTrailers[name];
  if (!marker) return bytes;
  const book = JSON.parse(bytes);
  const finalVerse = book.chapters.at(-1).verses.at(-1);
  const boundary = finalVerse.text.indexOf(marker);
  if (boundary < 0) throw new Error('Unexpected edition text: ' + name);
  if (book.id === 'psalms-solomon') {
    const navigation = finalVerse.text.indexOf(' What is Wesleyanism?', boundary);
    if (navigation < 0) throw new Error('Missing end of Wesley Center notice');
    book.source.license = 'Wesley Center edition · see reuse notice';
    book.source.reuseNotice = finalVerse.text.slice(boundary, navigation).trim();
  }
  finalVerse.text = finalVerse.text.slice(0, boundary);
  return Buffer.from(JSON.stringify(book, null, 2) + '\n');
}

async function fetchSource(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(response.status + ' from ' + url);
  return Buffer.from(await response.arrayBuffer());
}

async function original(file) {
  return fetchSource('https://raw.githubusercontent.com/' + repository + '/' + revision + '/' + file);
}

async function write(name, data) {
  const file = path.join(output, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

async function main() {
  const treeURL = 'https://api.github.com/repos/' + repository + '/git/trees/' + revision + '?recursive=1';
  const { tree, truncated } = JSON.parse(await fetchSource(treeURL));
  if (truncated || !Array.isArray(tree)) throw new Error('The pinned Git tree is incomplete');
  const group = tree.filter(entry => entry.type === 'blob' && /^data\/ancient-library\/.+\.json$/.test(entry.path));
  if (group.length !== 120) throw new Error('Unexpected Ancient Library file count');
  const sources = [
    ['investigations/topics/content-backlog.json', 'backlog.json'],
    ['data/intertext/nt_ot_quotes.json', 'intertext.json'],
    ...group.map(entry => [entry.path, entry.path.slice('data/'.length)]),
  ];
  const hashes = new Map(tree.map(entry => [entry.path, entry.sha]));
  for (let i = 0; i < sources.length; i += 6) {
    await Promise.all(sources.slice(i, i + 6).map(async ([file, name]) => {
      const existing = await fs.readFile(path.join(output, name)).catch(error => {
        if (error.code !== 'ENOENT') throw error;
      });
      const digest = bytes => createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
      if (existing && !Object.hasOwn(editionTrailers, name) && digest(existing) === hashes.get(file)) return;
      const data = await original(file);
      if (digest(data) !== hashes.get(file)) throw new Error('Source hash mismatch: ' + file);
      JSON.parse(data);
      const edition = cleanEdition(name, data);
      if (!existing?.equals(edition)) await write(name, edition);
    }));
  }

  const [translationSource, listenSource] = await Promise.all([original('js/scripture.js'), original('js/listen.js')]);
  const translation = translationSource.toString('utf8').split('const INTERLINEAR_VERSES = ')[1].split('};')[0] + '}';
  const samples = JSON.parse(translation.replace(/^\s+([a-zA-Z]+):/gm, ' "$1":'));
  const shelf = [...listenSource.toString('utf8').matchAll(/"([\w-]+)": \{\s*title: "([^"]+)",\s*html: \x60([\s\S]*?)\x60/g)]
    .map(([, id, title, html]) => ({ id, title, html: html.trim() }));
  if (Object.keys(samples).length !== 3 || shelf.length !== 2) throw new Error('Unexpected sample reader data');
  await write('samples.json', JSON.stringify({ revision, translation: samples, listen: shelf }, null, 2) + '\n');
  const missingArticle = await original('investigations/two-powers-in-heaven.html');
  await fs.writeFile(path.join(output, '../research/two-powers-in-heaven.json'),
    JSON.stringify({ html: missingArticle.toString('utf8') }) + '\n');
  console.log('Preserved the original research backlog, intertext corpus, 120 Ancient Library files, and legacy sample readers.');
}

if (require.main === module) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { cleanEdition };
