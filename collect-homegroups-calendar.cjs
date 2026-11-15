const fs = require('node:fs/promises');
const path = require('node:path');

const revision = '1e31cc4dd984adc638db2aa87571618fee1f3e31';
const base = `https://raw.githubusercontent.com/emartinie/HGBibleApp/${revision}/js/`;

function literal(source, name) {
  const declaration = new RegExp(`\\b${name} = ([\\s\\S]+?[}\\]]);`).exec(source)?.[1];
  if (!declaration) throw new Error('Missing declaration: ' + name);
  // The pinned Calendar script stores some en dashes as misdecoded UTF-8.
  return JSON.parse(declaration.replace(/^(\s*)(\w+):/gm, '$1"$2":')
    .replaceAll('\u00e2\u20ac\u201c', '\u2013'));
}

function dateOf(source, name) {
  const match = new RegExp(`\\b${name}(?:\\s*=|:) new Date\\((\\d+), (\\d+), (\\d+)\\)`).exec(source);
  if (!match) throw new Error('Missing date: ' + name);
  return [match[1], String(Number(match[2]) + 1).padStart(2, '0'), match[3].padStart(2, '0')].join('-');
}

function meditation(source, prefix) {
  return Object.fromEntries(['Title', 'Text', 'Prayer', 'Scripture'].map(field => {
    const pattern = new RegExp(`meditation${field}El\\.textContent = ("[^"\\n]+")`);
    const match = pattern.exec(source);
    if (!match) throw new Error('Missing meditation: ' + prefix + ' / ' + field);
    return [field.toLowerCase(), JSON.parse(match[1])];
  }));
}

async function main() {
  const [calendar, fall, sukkot, omer] = await Promise.all(['calendar', 'fallfeasts', 'sukkotcount', 'omercount'].map(async name => {
    const response = await fetch(base + name + '.js', { signal: AbortSignal.timeout(25_000) });
    if (!response.ok) throw new Error(name + ' source returned ' + response.status);
    return response.text();
  }));
  const bundles = {
    revision,
    models: literal(calendar, 'CALENDAR_MODELS'),
    eventDetails: literal(calendar, 'EVENT_INFO'),
    events: literal(calendar, 'BASE_EVENTS'),
    modelDates: literal(calendar, 'MODEL_DATES'),
    fall: {
      dates: Object.fromEntries(['YOM_TERUAH', 'YOM_KIPPUR', 'SUKKOT', 'SHEMINI'].map(name => [name, dateOf(fall, name)])),
      phases: literal(fall, 'PHASES'),
    },
    sukkot: {
      start: dateOf(sukkot, 'SUKKOT_START'),
      end: dateOf(sukkot, 'SUKKOT_END'),
      positions: literal(sukkot, 'positions'),
      prepare: meditation(sukkot, 'Sukkot preparation'),
      daily: meditation(sukkot.split('// DURING SUKKOT')[1], 'Sukkot day'),
    },
    omer: {
      start: dateOf(omer, 'OMER_START'),
      end: dateOf(omer, 'OMER_END'),
      positions: literal(omer, 'nodePositions'),
      english: literal(omer, 'sefirotEn'),
      hebrew: literal(omer, 'sefirotHe'),
      themes: literal(omer, 'sefirahThemes'),
      prepare: meditation(omer, 'Omer preparation'),
      complete: meditation(omer.split('if (dayNumber > 49) {')[1], 'Omer completion'),
    },
  };
  if (bundles.events.length !== 7 || Object.keys(bundles.models).length !== 3 ||
      Object.values(bundles.modelDates).some(dates => dates.length !== 7) ||
      bundles.sukkot.positions.length !== 7 || bundles.omer.positions.length !== 49) {
    throw new Error('Unexpected legacy Calendar data');
  }
  const output = path.join(__dirname, 'corpus/calendar.json');
  await fs.writeFile(output, JSON.stringify(bundles, null, 2) + '\n');
  console.log('Preserved 3 calendar models, 5 fall phases, and the two count datasets.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
