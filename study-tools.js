import { nameKey, webUrl } from './corpus.js';

const DATA = './corpus/study-tools/';
const FILTERS = ['All', 'Positive', 'Negative', 'Sacrifices', 'Justice', 'Temple', 'Priests', 'Agriculture', 'Dietary', 'Business'];
const NT_BOOKS = {
  Matthew: 'mathew', Mark: null, Luke: null, John: null, Acts: 'acts', Romans: 'romans',
  '1 Corinthians': '1corinthians', '2 Corinthians': '2corinthians', Galatians: 'galatians',
  Ephesians: 'ephesians', Philippians: 'philippians', Colossians: 'colossians',
  '1 Thessalonians': null, '2 Thessalonians': null, '1 Timothy': '1timothy', '2 Timothy': '2timothy',
  Titus: null, Philemon: 'philemon', Hebrews: 'hebrews', James: 'james', '1 Peter': '1peter',
  '2 Peter': '2peter', '1 John': '1john', '2 John': '2john', '3 John': '3john',
  Jude: 'jude', Revelation: 'revelation',
};
const NT_ALIASES = {
  mt:'Matthew', matt:'Matthew', mk:'Mark', lk:'Luke', jn:'John', ac:'Acts', rom:'Romans',
  cor:'Corinthians', gal:'Galatians', eph:'Ephesians', phil:'Philippians', col:'Colossians',
  thess:'Thessalonians', tim:'Timothy', tit:'Titus', phm:'Philemon', heb:'Hebrews', he:'Hebrews',
  jas:'James', pet:'Peter', pe:'Peter', rev:'Revelation', revelationofjohn:'Revelation',
};
const NT_SECTIONS = {
  objectives:'Objectives', summary:'Summary', outline:'Outline', wordsToPonder:'Words to ponder', reviewQuestions:'Review questions',
};
const sourceUrls = {
  commandments: 'https://github.com/emartinie/HGBibleApp/tree/1e31cc4dd984adc638db2aa87571618fee1f3e31/data/commandments',
  covenants: 'https://github.com/emartinie/HGBibleApp/tree/1e31cc4dd984adc638db2aa87571618fee1f3e31/data/covenants',
  nt: 'https://github.com/emartinie/HGBibleApp/tree/1e31cc4dd984adc638db2aa87571618fee1f3e31/data/nt',
};
const requests = new Map();

function load(path) {
  if (!requests.has(path)) {
    const request = fetch(DATA + path).then((response) => {
      if (!response.ok) throw new Error('Could not load ' + path);
      return response.json();
    }).catch((error) => {
      requests.delete(path);
      throw error;
    });
    requests.set(path, request);
  }
  return requests.get(path);
}

export function getNTReference(ref) {
  const parsed = /^(?:(1|2|3|III|II|I)\s*)?([a-z][a-z .]*?)\s*(\d+)(?=[\s:.,–—-]|$)/i.exec(ref?.trim() ?? '');
  if (!parsed) return null;
  const number = ({ I: '1', II: '2', III: '3' }[parsed[1]?.toUpperCase()] || parsed[1]);
  const slug = nameKey(parsed[2]);
  const key = nameKey((number ?? '') + (NT_ALIASES[slug] ?? slug));
  const book = Object.keys(NT_BOOKS).find((name) => nameKey(name) === key);
  return book ? { book, chapter: +parsed[3], ref } : null;
}

function commandEntries(records) {
  const occurrences = new Map();
  return records.map((record) => {
    const id = String(record.id);
    const occurrence = (occurrences.get(id) ?? 0) + 1;
    occurrences.set(id, occurrence);
    return { ...record, recordKey: occurrence === 1 ? id : id + '-' + occurrence };
  });
}
const commandments = () => load('commandments/commandments.json').then(commandEntries);

function matchesFilter(record, filter) {
  if (filter === 'All') return true;
  if (filter === 'Positive' || filter === 'Negative') return record.type === filter.toLowerCase();
  if (filter === 'Business') return /Loans|Business/.test(record.category);
  if (filter === 'Priests') return /Priest/.test(record.category);
  return record.category.includes(filter);
}

function sefariaRef(value) {
  const url = webUrl(value);
  if (!url) return String(value ?? '').trim();
  const parsed = new URL(url);
  if (!['www.sefaria.org', 'sefaria.org'].includes(parsed.hostname)) return '';
  try { return decodeURIComponent(parsed.pathname.slice(1)).replaceAll('_', ' '); }
  catch { return ''; }
}
const sefariaUrl = (ref) => 'https://www.sefaria.org/' + encodeURIComponent(ref.replaceAll(' ', '_'));
const splitReferences = (value) => Array.isArray(value) ? value : value ? [value] : [];

export function createStudyTools({ node, text, button, link, cluster, disclosure, row, open, passage, safeText }) {
  function refs(references, kind = 'scripture') {
    const group = cluster();
    for (const entry of splitReferences(references)) {
      const value = typeof entry === 'string' ? entry : entry.reference || entry.ref || entry.url || entry.sefariaRef;
      if (!value) continue;
      const label = entry.label || (kind === 'sefaria' ? sefariaRef(value) : value);
      if (kind === 'sefaria') {
        const ref = sefariaRef(value);
        if (ref) group.append(button(label, () => open('sefaria', { ref, url: webUrl(value) })));
        else if (webUrl(value)) group.append(link(label || 'Open source ↗', value));
      } else if (kind === 'nt') {
        group.append(button(label, () => open('nt', { ref: value })));
      } else {
        group.append(button(label, () => passage(value)));
      }
    }
    return group;
  }

  function sourceLinks(links) {
    const actions = cluster();
    for (const item of links ?? []) {
      if (typeof item?.url !== 'string') continue;
      if (item.url.startsWith('?card=ancient-library')) {
        const query = new URLSearchParams(item.url.slice(1));
        const data = Object.fromEntries(['book', 'work', 'volume', 'chapter', 'verse', 'q']
          .filter(key => query.has(key)).map(key => [key,query.get(key)]));
        const view = data.book ? data.chapter ? 'ancientRead' : 'ancientDetail' : 'ancientLibrary';
        actions.append(button(item.label, () => open(view,data)));
      } else if (webUrl(item.url)) {
        const ref = /^https?:\/\/(?:www\.)?sefaria\.org\//i.test(item.url) ? sefariaRef(item.url) : '';
        actions.append(ref ? button(item.label, () => open('sefaria', { ref, url: item.url })) : link(item.label || 'Open source ↗', item.url));
      }
    }
    return actions;
  }

  function claims(items, kind = 'scripture') {
    const content = node('div', '', 'law-items');
    for (const item of items ?? []) {
      const section = node('div', '', 'law-item');
      if (typeof item === 'string') {
        section.append(refs(item, kind));
      } else {
        if (item.title || item.label) section.append(node('h4', item.title || item.label));
        if (item.classification) section.append(text(item.classification.description || item.classification));
        if (item.summary) section.append(text(item.summary, 'source-copy'));
        if (item.references || item.reference) section.append(refs(item.references || item.reference, kind));
      }
      content.append(section);
    }
    return content;
  }

  function appendSection(host, name, body, opened = false) {
    if (!body.childElementCount) return;
    const section = disclosure(name, body);
    section.open = opened;
    host.append(section);
  }

  function comparison(item) {
    const area = node('div', '', 'law-items');
    area.append(refs(item.reference));
    for (const [label, value] of [['Setting', item.literarySetting], ['Speaker or narrator', item.speakerOrNarrator],
      ['Tablet context', item.tabletContext], ['Repeated themes', item.repeatedThemes?.join(' · ')],
      ['Distinctive themes', item.distinctiveThemes?.join(' · ')], ['Notes', Array.isArray(item.notes) ? item.notes.join(' · ') : item.notes]]) {
      if (value) area.append(node('h4', label), text(value, 'source-copy'));
    }
    if (item.structuralSections?.length) area.append(node('h4', 'Structure'), claims(item.structuralSections));
    if (item.observations?.length) area.append(node('h4', 'Observations'), claims(item.observations));
    area.append(sourceLinks(item.sourceLinks));
    return disclosure(item.title, area);
  }

  return {
    async law(target, { data }) {
      const [covenants, records] = await Promise.all([load('covenants/covenants.json'), commandments()]);
      const heading = node('p', 'Browse the covenant records or search the commandments.', 'subtle');
      const covenantRows = node('div', '', 'law-covenants rows');
      for (const item of covenants) {
        covenantRows.append(row(item.shortTitle || item.title, item.classification?.status === 'disputed' ? 'Proposed · Disputed' : '', () => open('covenant', { covenant: item.id })));
      }
      const showCovenants = disclosure('Covenants', covenantRows);
      showCovenants.open = true;
      const explorer = node('section', '', 'law-items');
      const label = node('label', 'Search commandments');
      const search = node('input');
      search.type = 'search';
      search.placeholder = 'Code, title, reference, category or theme';
      search.value = data.query || '';
      label.append(search);
      const results = node('div', '', 'rows');
      const count = text('');
      count.setAttribute('role', 'status');
      let filter = 'All';
      let limit = 36;
      const filters = cluster(...FILTERS.map((name) => {
        const control = button(name, () => {
          filter = name;
          limit = 36;
          display();
        }, 'pill');
        control.setAttribute('aria-pressed', String(name === filter));
        return control;
      }));
      filters.setAttribute('aria-label', 'Commandment filters');
      filters.setAttribute('role', 'group');

      function display() {
        const value = search.value.toLowerCase().trim();
        const matches = records.filter((item) =>
          matchesFilter(item, filter) && [item.code, item.title, item.reference, item.category, ...(item.themes ?? [])]
            .join(' ').toLowerCase().includes(value));
        for (const control of filters.children) control.setAttribute('aria-pressed', String(control.textContent === filter));
        count.textContent = matches.length + ' of ' + records.length + ' source records';
        const rows = matches.slice(0, limit).map((item) =>
          row(item.code + ' · ' + item.title, item.reference, () => open('commandment', { id: item.recordKey })));
        results.replaceChildren(...rows);
        more.hidden = matches.length <= limit;
        if (!matches.length) results.append(text('No commandments match these filters.'));
      }

      const more = button('Show more commandments', () => {
        const firstNew = limit;
        limit += 36;
        display();
        results.children[firstNew]?.focus();
      });
      search.addEventListener('input', () => {
        limit = 36;
        display();
      });
      explorer.append(node('h3', 'Commandment explorer'), label, filters, count, results, more);
      target.append(heading, showCovenants, explorer, link('HomeGroups source records ↗', sourceUrls.commandments));
      display();
    },

    async commandment(target, { data }) {
      const requires = await Promise.all([commandments(), load('covenants/commandment-associations.json'), load('covenants/covenants.json')]);
      const [records, associations, covenants] = requires;
      const record = records.find((item) => item.recordKey === data.id);
      if (!record) {
        target.append(text('This commandment ID was not found.'), button('Browse commandments', () => open('law')));
        return;
      }
      target.append(node('p', [record.code, record.category, record.type].filter(Boolean).join(' · '), 'eyebrow'), node('h3', record.title));
      if (record.commentary) target.append(text(record.commentary, 'source-copy'));
      if (record.reference) target.append(node('h4', 'Scripture'), refs(record.reference));
      if (record.themes?.length) target.append(node('h4', 'Themes'), text(record.themes.join(' · ')));
      appendSection(target, 'New Testament Notes', refs(record.nt_links, 'nt'), true);
      appendSection(target, 'Hebrew Library · Sefaria', refs(record.sefaria_links, 'sefaria'), true);
      const related = node('div', '', 'rows');
      for (const rule of associations.filter((item) => String(item.commandmentId) === String(record.id))) {
        const covenant = covenants.find((item) => item.id === rule.covenantId);
        if (covenant) related.append(row(covenant.title, rule.basisReferences?.join(' · '), () => open('covenant', { covenant: covenant.id })));
      }
      appendSection(target, 'Related covenants', related);
    },

    async covenant(target, { data }) {
      const [covenants, records, comparisons, associations] = await Promise.all([
        load('covenants/covenants.json'), commandments(), load('covenants/comparison-texts.json'), load('covenants/commandment-associations.json'),
      ]);
      const covenant = covenants.find((item) => item.id === data.covenant);
      if (!covenant) {
        target.append(text('This covenant ID was not found.'), button('Browse covenants', () => open('law')));
        return;
      }
      target.append(node('h3', covenant.title), text(covenant.summary, 'source-copy'));
      if (covenant.classification) target.append(text(covenant.classification.status + ' · ' + covenant.classification.description));
      const facts = node('dl', '', 'law-facts');
      for (const [label, value] of [['Parties', covenant.parties?.join(', ')], ['Mediator', covenant.mediator],
        ['Duration', covenant.duration?.description], ['Also known as', covenant.aliases?.join(', ')]]) {
        if (value) facts.append(node('dt', label), node('dd', value));
      }
      if (covenant.duration?.references?.length) {
        const duration = node('dd');
        duration.append(refs(covenant.duration.references));
        facts.append(node('dt', 'Duration references'), duration);
      }
      if (facts.childElementCount) target.append(facts);
      appendSection(target, 'Primary covenant passages', claims(covenant.scriptureRange), true);
      for (const item of covenant.detailSections ?? []) appendSection(target, item.title, claims([item]));
      for (const [label, items] of [['Covenant signs', covenant.covenantSign], ['Promises', covenant.promises],
        ['Obligations', covenant.obligations], ['Blessings', covenant.blessings], ['Curses and consequences', covenant.curses],
        ['Timeline', covenant.timelineEvents], ['Interpretation notes', covenant.fulfillmentNotes]]) {
        appendSection(target, label, claims(items));
      }
      const related = node('div', '', 'rows');
      for (const association of associations.filter((item) => item.covenantId === covenant.id)) {
        const record = records.find((item) => item.recordKey === String(association.commandmentId));
        if (!record) continue;
        const item = node('div', '', 'law-item');
        item.append(row(record.code + ' · ' + record.title, association.basisReferences?.join(' · '),
          () => open('commandment', { id: record.recordKey })));
        if (association.notes) item.append(text(association.notes));
        related.append(item);
      }
      appendSection(target, 'Related commandments', related);
      const compare = node('div', '', 'law-items');
      if (covenant.comparisonIntro) compare.append(text(covenant.comparisonIntro, 'source-copy'));
      for (const item of comparisons.filter((item) => covenant.comparisonTexts?.includes(item.id))) compare.append(comparison(item));
      appendSection(target, 'Passage comparisons', compare);
      appendSection(target, 'New Testament Notes', claims(covenant.ntReferences, 'nt'), true);
      appendSection(target, 'Hebrew Library · Sefaria', refs(covenant.sefariaLinks, 'sefaria'), true);
      const ancient = node('div', '', 'law-items');
      for (const item of Object.values(covenant.relatedSources ?? {}).flat()) {
        ancient.append(node('h4', [item.author, item.work, item.location].filter(Boolean).join(' · ')),
          text(item.summary, 'source-copy'));
        if (item.topics?.length) ancient.append(text(item.topics.join(' · ')));
        ancient.append(sourceLinks(item.externalLinks));
      }
      appendSection(target, 'Ancient sources', ancient);
      target.append(link('HomeGroups covenant records ↗', sourceUrls.covenants));
    },

    async nt(target, { data }) {
      const parsed = data.book ? data : getNTReference(data.ref);
      if (!data.ref && !parsed) {
        const shelf = node('div', '', 'rows');
        for (const [book, file] of Object.entries(NT_BOOKS)) {
          shelf.append(row(book, file ? 'Chapter notes' : 'Scripture only · Notes unavailable', () => open('nt', { book, chapter: 1 })));
        }
        target.append(text('Choose a book to browse its available HomeGroups notes.'), shelf);
        return;
      }
      const label = data.ref || parsed?.book + ' ' + parsed?.chapter;
      target.append(node('h3', label), cluster(button('Read cited Scripture', () => passage(label)),
        button('Browse NT books', () => open('nt'), 'quiet')));
      if (!parsed || !Object.hasOwn(NT_BOOKS, parsed.book) || !NT_BOOKS[parsed.book]) {
        target.append(text('HomeGroups notes are unavailable for this reference. The Scripture reader remains available.'));
        return;
      }

      const notes = await load('nt/' + NT_BOOKS[parsed.book] + '.json');
      const selected = notes.chapters?.[parsed.chapter];
      const chapters = Object.keys(notes.chapters ?? {}).map(Number);
      const chooser = node('label', 'Chapter');
      const select = node('select');
      if (!selected) {
        const missing = node('option', parsed.chapter + ' · Unavailable');
        missing.value = parsed.chapter;
        select.append(missing);
      }
      for (const chapter of chapters) {
        const option = node('option', String(chapter));
        option.value = chapter;
        select.append(option);
      }
      select.value = parsed.chapter;
      select.addEventListener('change', () => open('nt', { book: parsed.book, chapter: Number(select.value) }));
      chooser.append(select);
      target.append(chooser);

      if (notes.introduction?.rawText) target.append(disclosure('Book introduction', text(notes.introduction.rawText, 'law-prose')));
      if (!selected) target.append(text('There are no chapter notes at this reference.'));
      else {
        const fields = Object.entries(NT_SECTIONS).filter(([field]) => selected[field]?.trim());
        for (const [field, title] of fields) {
          const section = disclosure(title, text(selected[field], 'law-prose'));
          section.open = field === 'summary';
          target.append(section);
        }
        if (selected.rawText?.trim()) {
          const section = disclosure('Chapter study notes', text(selected.rawText, 'law-prose'));
          section.open = !fields.length;
          target.append(section);
        }
      }
      target.append(link('HomeGroups NT Notes source ↗', sourceUrls.nt));
      try {
        const quoted = await load('intertext/nt_ot_quotes.json');
        const witnesses = node('div', '', 'rows');
        for (const quote of quoted) {
          const nt = getNTReference(quote.nt?.text);
          if (nt?.book !== parsed.book || nt.chapter !== parsed.chapter) continue;
          const raw = quote.ot?.masoretic?.text || quote.ot?.lxx?.text;
          const match = /^(.+?\s+\d+:\d+(?:[–-]\d+)?)/.exec(raw ?? '');
          if (!match) continue;
          witnesses.append(row(match[1], 'Hebrew Library · Cited witness', () => open('sefaria', { ref: match[1] })));
        }
        appendSection(target, 'Hebrew Scripture witnesses', witnesses);
      } catch {
        target.append(text('The linked witness index is temporarily unavailable.'));
      }
    },

    async sefaria(target, { data }) {
      const ref = sefariaRef(data.ref).slice(0, 180);
      const input = node('input');
      const form = node('form');
      const label = node('label', 'Sefaria reference');
      input.value = ref;
      input.required = true;
      input.maxLength = 180;
      label.append(input);
      form.append(label, node('button', 'Open reference', 'button primary'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (input.value.trim()) open('sefaria', { ref: input.value.trim() });
      });
      target.append(form);
      if (!ref) {
        target.append(text('Enter a passage or source reference, such as Exodus 20 or Mishnah Avot 1:1.'));
        return;
      }
      target.append(link('Open in Sefaria ↗', data.url || sefariaUrl(ref)));
      const status = text('Loading cited text from Sefaria…');
      status.setAttribute('role', 'status');
      target.append(status);
      const api = new URL('https://www.sefaria.org/api/v3/texts/' + encodeURIComponent(ref.replaceAll(' ', '_')));
      api.searchParams.append('version', 'source');
      api.searchParams.append('version', 'english');
      api.searchParams.set('return_format', 'text_only');
      let payload;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      try {
        const response = await fetch(api, { credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error('Sefaria returned ' + response.status);
        payload = await response.json();
        if (payload.error || !payload.versions?.length) throw new Error('No versions returned');
      } catch {
        status.textContent = 'The cited text is unavailable in this panel. The original reference is still available through Sefaria.';
        return;
      } finally {
        clearTimeout(timer);
      }

      status.textContent = payload.ref || ref;
      for (const version of payload.versions) {
        const segments = (Array.isArray(version.text) ? version.text.flat(Infinity) : [version.text]).filter((value) => typeof value === 'string' && value.trim());
        if (!segments.length) continue;
        const reading = node('section', '', 'law-items');
        const language = version.language === 'he' || version.actualLanguage === 'he' ? 'Hebrew' : version.language === 'en' ? 'English' : version.language;
        reading.append(node('h4', [language, version.versionTitle].filter(Boolean).join(' · ')));
        const content = node('div', '', 'law-prose');
        if (version.direction === 'rtl' || language === 'Hebrew') content.dir = 'rtl';
        if (language === 'Hebrew') content.lang = 'he';
        for (const line of segments) content.append(text(safeText(line), 'source-copy'));
        reading.append(content);
        target.append(reading);
      }
      if (target.lastChild === status) status.textContent = 'Sefaria returned the reference without readable text. Open the original source above.';
    },
  };
}

