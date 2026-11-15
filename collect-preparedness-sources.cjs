
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const out = 'corpus/preparedness/';
const legacy = 'https://raw.githubusercontent.com/emartinie/HGBibleApp/1e31cc4dd984adc638db2aa87571618fee1f3e31/';
const drive = 'https://drive.google.com';
const rootFolder = drive + '/drive/folders/0ByBj5IHFJFzvUVk4U1pGenczLUE';
const section = 'investigations/topic%20list%20for%20writing.md';

async function get(url) {
  const { stdout } = await exec('curl', ['-fsSL', '--max-time', '15', url], { maxBuffer: 4_000_000 });
  return stdout;
}

function unescapeHtml(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, key) => {
    if (key.startsWith('#')) {
      const code = Number(key.slice(1).replace(/^x/i, '0x'));
      return code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return entities[key] ?? match;
  }).normalize('NFC');
}

function itemName(value) {
  return value.normalize('NFC').trim().toLocaleLowerCase('en-US');
}

function folderName(value) {
  return itemName(value.replace(/^\d+\s*-\s*/, ''));
}

async function entries(url) {
  const folder = new URL(url);
  const list = new URL('/embeddedfolderview', drive);
  list.searchParams.set('id', folder.pathname.split('/').at(-1));
  if (folder.searchParams.has('resourcekey')) list.searchParams.set('resourcekey', folder.searchParams.get('resourcekey'));
  const html = await get(list.href);
  const rows = html.matchAll(/class="flip-entry-info"><a href="([^"]+)"[\s\S]*?class="flip-entry-title">([^<]*)</g);
  return [...rows].map(([, href, title]) => ({ href: unescapeHtml(href), title: unescapeHtml(title) }))
    .filter(({ href }) => /^https:\/\/drive\.google\.com\/(?:file\/d|drive\/folders)\//.test(href));
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(out + 'be-ready-catalog.json', 'utf8'));
  const folders = Object.keys(catalog.folderMap);
  const files = new Map();
  for (const file of catalog.files) {
    const index = file.path.lastIndexOf('\\');
    const key = file.path.slice(0, index);
    if (!files.has(key)) files.set(key, []);
    files.get(key).push(file);
  }
  const result = { root: rootFolder, documentUrls: {}, folderUrls: {}, archiveLinks: {} };
  const failures = [];
  async function visit(path, url) {
    if (path) result.folderUrls[path] = url;
    let rows;
    try {
      rows = await entries(url);
    } catch (error) {
      failures.push([path, error.message.split('\n').at(-2)]);
      if (!path) throw error;
      return;
    }
    const archives = rows.filter(row => row.href.includes('/file/d/') && /\.(rar|zip|7z|tar|gz)$/i.test(row.title));
    if (archives.length) result.archiveLinks[path] = archives;
    for (const file of files.get(path) ?? []) {
      const matches = rows.filter(row => row.href.includes('/file/d/') && itemName(row.title) === itemName(file.name));
      if (matches.length === 1) result.documentUrls[file.id] = matches[0].href;
    }
    const children = folders.filter(folder => folder !== '.' && (folder.includes('\\') ? folder.slice(0, folder.lastIndexOf('\\')) : '') === path);
    await Promise.all(children.map(async folder => {
      const leaf = folder.split('\\').at(-1);
      const matches = rows.filter(row => row.href.includes('/drive/folders/') && folderName(row.title) === folderName(leaf));
      if (matches.length === 1) await visit(folder, matches[0].href);
    }));
  }

  const original = await get(legacy + section);
  const titles = original.split(/\r?\n/).flatMap((line, index) => {
    const match = /^(\d+)\.\s+\*\*(.*?)\*\*$/.exec(line);
    return match && +match[1] >= 1824 && +match[1] <= 1859 ?
      [{ id: +match[1], title: match[2], line: index + 1 }] : [];
  });
  if (titles.length !== 36) throw Error('Unexpected research section length');
  await visit('', rootFolder);
  const sorted = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a < b ? -1 : a === b ? 0 : 1));
  result.documentUrls = sorted(result.documentUrls);
  result.folderUrls = sorted(result.folderUrls);
  result.archiveLinks = sorted(result.archiveLinks);
  if (!Object.keys(result.folderUrls).length) throw Error('The legacy folder listing returned no matched folders');
  await fs.writeFile(out + 'be-ready-source-links.json', JSON.stringify(result, null, 2) + '\n');
  await fs.writeFile(out + 'research-backlog.json', JSON.stringify(titles, null, 2) + '\n');
  console.log(Object.keys(result.documentUrls).length + ' document title matches, ' +
    Object.keys(result.folderUrls).length + ' matched folders, ' + titles.length + ' research titles.');
  if (failures.length) console.log('Unavailable source folders:', failures);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
