
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execute = promisify(execFile);
const revision = '1e31cc4dd984adc638db2aa87571618fee1f3e31';
const remote = 'https://raw.githubusercontent.com/emartinie/HGBibleApp/' + revision + '/';
const output = path.join(__dirname, 'corpus', 'learning');

async function readBytes(source) {
  const { stdout } = await execute('curl', ['-fsSL', '--max-time', '25', remote + source], {
    encoding: 'buffer', maxBuffer: 2_000_000,
  });
  return stdout;
}

async function read(source) {
  const stdout = await readBytes(source);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(stdout);
  } catch {
    return new TextDecoder('windows-1252').decode(stdout);
  }
}

function write(file, data) {
  return fs.writeFile(path.join(output, file), JSON.stringify(data) + '\n');
}

async function enrich() {
  const [hebrewSource, hebrewCard, greekSource, catalog, song] = await Promise.all([
    read('js/alephbet.js'), read('cards/alephbet.html'), read('js/greekalphabet.js'),
    read('data/prezis.json'), readBytes('assets/sounds/heart-and-soul.mp3'),
  ]);
  const paleoSource = hebrewSource.split('const paleoMap = {')[1].split('};')[0];
  const paleo = new Map([...paleoSource.matchAll(/"([^"]+)": "([^"]+)"/g)].map(([, letter, sign]) => [letter, sign]));
  const writing = [...hebrewCard.matchAll(/<div class="hebrew">([^<]+)<\/div>\s*<div class="name">([^<]+)<\/div>\s*<div class="sound">([^<]+)<\/div>/g)]
    .map(([, letter, name, sound]) => ({ letter, name, sound }));
  const hebrew = [...hebrewSource.matchAll(/\{ letter: "([^"]+)", name: "([^"]+)", sound: "([^"]+)" \}/g)]
    .map(([, letter, name, sound]) => ({ letter, name, sound, paleo: paleo.get(letter.split('/')[0]) }));
  const greek = [...greekSource.matchAll(/\{ upper: "([^"]+)", lower: "([^"]+)", name: "([^"]+)", translit: "([^"]+)", sound: "([^"]+)" \}/g)]
    .map(([, upper, lower, name, translit, sound]) => ({ upper, lower, name, translit, sound }));
  const { meta, prezis } = JSON.parse(catalog);
  const presentations = prezis.map(({ title, category, embed }) => {
    const link = /<iframe\s+src="(https:\/\/prezi\.com\/p\/embed\/[A-Za-z0-9_-]+\/)"/.exec(embed);
    if (!link) throw new Error('Unexpected Prezi source for ' + title);
    return { title, category, url: link[1] };
  });
  if (hebrew.length !== 22 || hebrew.some(letter => !letter.paleo) || writing.length !== 22 ||
      greek.length !== 24 || presentations.length !== 75 || song.length !== 293125) {
    throw new Error('Unexpected alphabet or presentation source');
  }
  await fs.mkdir(output, { recursive: true });
  await Promise.all([
    write('alphabets.json', { revision, hebrew, writing, greek }),
    write('presentations.json', { revision, meta, presentations }),
    fs.writeFile(path.join(output, 'alephbet-song.mp3'), song),
  ]);
  console.log('Bundled 22 Hebrew letters, 24 Greek letters, the Hebrew song, and 75 Visual Teachings.');
}

function topicalSnapshot(jesusCard, originsCard, originsScript) {
  const reading = /<article id="jesusReaderArticle"[^>]*>([\s\S]*?)<\/article>/.exec(jesusCard)?.[1];
  const introduction = /<p class="jesus-subtitle">\s*([\s\S]*?)<\/p>/.exec(jesusCard)?.[1].replace(/\s+/g, ' ').trim();
  const sections = [...jesusCard.matchAll(/<a class="jesus-chip" href="#(\w+)">([^<]+)<\/a>/g)]
    .map(([, id, label]) => ({ id, label }));
  const origins = /(<details class="orientation-block[\s\S]*?<\/footer>)/.exec(originsCard)?.[1];
  const originsNotes = Object.fromEntries([...originsScript.matchAll(/(\w+): \{\s*title: "([^"]+)",\s*content: \x60([\s\S]*?)\x60/g)]
    .map(([, key, title, html]) => [key, { title, html: html.trim() }]));
  if (!reading || !introduction || sections.length !== 6 || !origins || Object.keys(originsNotes).length !== 5) {
    throw new Error('Unexpected topical teaching source');
  }
  return { jesus: { introduction, sections, reading: reading.trim() }, origins, originsNotes };
}

async function collectTopical() {
  const [jesusCard, originsCard, originsScript, bank] = await Promise.all([
    read('cards/jesus.html'), read('cards/origins.html'), read('js/origins.js'),
    read('data/quizzes/nt_questions.json'),
  ]);
  const topics = topicalSnapshot(jesusCard, originsCard, originsScript);
  const questions = JSON.parse(bank);
  if (questions.length !== 2144 || new Set(questions.map(item => item.source)).size !== 140 ||
      questions.some(item => typeof item.question !== 'string' || typeof item.answer !== 'string')) {
    throw new Error('Unexpected New Testament question source');
  }
  await fs.mkdir(output, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(output, 'topical.json'), JSON.stringify({ revision, ...topics }, null, 2) + '\n'),
    fs.writeFile(path.join(output, 'nt-questions.json'), '[\n' + questions.map(item => JSON.stringify(item)).join(',\n') + '\n]\n'),
  ]);
  console.log('Bundled two topical teachings and ' + questions.length + ' New Testament questions.');
}

async function main() {
  if (process.argv.includes('--topical-only')) return collectTopical();
  if (process.argv.includes('--enrichment-only')) return enrich();
  const [articleSource, journeySource] = await Promise.all([read('js/articles.js'), read('js/discipleship.js')]);
  const articleIndex = articleSource.split('const ARTICLES = [')[1].split('];')[0];
  const journeyIndex = journeySource.split('const JOURNEY_INDEX = [')[1].split('];')[0];
  const articles = [...articleIndex.matchAll(/\{\s*title: "([^"]+)", file: "([a-zA-Z0-9_-]+\.html)"\s*\}/g)].map(
    ([, title, legacyFile]) => ({ title, file: legacyFile.toLowerCase(), legacyFile }),
  );
  const entries = [...journeyIndex.matchAll(/id: "([^"]+)",\s*title: "([^"]+)",\s*file: "data\/journeys\/([^"]+)",\s*available: (true|false)/g)].map(
    ([, id, title, file, available]) => ({ id, title, file, available: available === 'true' }),
  );
  if (articles.length !== 32 || entries.length !== 5) throw new Error('Unexpected legacy index length');
  await fs.mkdir(path.join(output, 'articles'), { recursive: true });
  await fs.mkdir(path.join(output, 'journeys'), { recursive: true });
  const files = [
    ...articles.map(({ file }) => ['articles/' + file, 'articles/' + file.replace(/\.html$/, '.json')]),
    ...entries.map(({ file }) => ['data/journeys/' + file, 'journeys/' + file]),
    ['data/journeys/matthew-5-7-core.json', 'journeys/matthew-5-7-core.json'],
    ['data/journeys/statenotes.txt', 'journeys/statenotes.json'],
  ];
  for (let start = 0; start < files.length; start += 8) {
    await Promise.all(files.slice(start, start + 8).map(async ([source, target]) => {
      const content = await read(source);
      const data = source.startsWith('articles/') ? { html: content } :
        source.endsWith('.json') ? JSON.parse(content) : { notes: content };
      await write(target, data);
    }));
  }
  await write('index.json', { revision, articles, journeys: entries });
  await enrich();
  await collectTopical();
  console.log('Bundled ' + articles.length + ' articles, ' + entries.length + ' indexed journeys, and two supporting files.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
