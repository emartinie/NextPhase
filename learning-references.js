import { getArticle, getResearch, getResearchBacklog, getIntertext, getReferenceSamples } from './corpus.js';
import { speechControl } from './learning.js';

const searchText = value => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const sourceRoot = 'https://github.com/emartinie/HGBibleApp/blob/1e31cc4dd984adc638db2aa87571618fee1f3e31/';
const pageSize = 40;

function witnessText(value) {
  const match = /^((?:[1-3]\s*)?[A-Za-z][A-Za-z. ]*?)\s+(\d+:\d+(?:[-,]\d+)*)\s+([\s\S]*)$/.exec(value ?? '');
  if (match) return { book: match[1], ref: match[1] + ' ' + match[2], text: match[3] };
  const jude = /^Jude (\d+)\s+([\s\S]*)$/.exec(value ?? '');
  return jude ? { book: 'Jude', ref: 'Jude 1:' + jude[1], text: jude[2] } :
    { book: '', ref: '', text: value ?? '' };
}

export function createReferenceViews({ node, text, button, row, cluster, disclosure, link, open, importLegacy, defaultRef }) {
  let publishedIndex;
  const published = async () => (await getResearch()).investigations.filter(item => item.publicationStatus === 'published');

  function searchField(label) {
    const field = node('label', label);
    const input = node('input');
    input.type = 'search';
    field.append(input);
    return [field, input];
  }

  function selectField(label, options) {
    const field = node('label', label);
    const picker = node('select');
    picker.setAttribute('aria-label', label);
    picker.append(...options.map(([key, value]) => new Option(value, key)));
    field.append(picker);
    return [field, picker];
  }

  function viewArticle(id) {
    return open('article', { id });
  }

  function indexArticles(entries) {
    if (!publishedIndex) {
      publishedIndex = Promise.all(entries.map(async item => {
        try {
          const { html } = await getArticle(item.id);
          const body = importLegacy(html).textContent;
          return searchText([item.title, JSON.stringify(item.relationships), body].join(' '));
        } catch {
          return null;
        }
      })).then(values => {
        if (values.includes(null)) publishedIndex = undefined;
        return values;
      });
    }
    return publishedIndex;
  }

  return {
    sourcesLibrary(target) {
      const metrics = text('Compare New Testament and Hebrew Scripture witnesses.');
      getIntertext().then(entries => {
        const lxx = entries.filter(entry => entry.ot?.lxx?.text).length;
        const mt = entries.filter(entry => entry.ot?.masoretic?.text).length;
        metrics.textContent = entries.length + ' comparisons · ' + lxx + ' Septuagint and ' + mt + ' Masoretic witnesses';
      }).catch(() => {});
      target.append(
        row('Hebrew Library', 'Read Hebrew and English in Sefaria', () => open('sefaria', { ref: defaultRef() })),
        row('New Testament Notes', 'Browse the original chapter notes', () => open('nt')),
        row('Translation Explorer', 'English, Hebrew and Greek sample verses', () => open('translation')),
        row('Intertext Explorer', 'Compare the original quotation dataset', () => open('intertext')),
        metrics,
        row('Ancient Library', 'Browse works, historical context and editions', () => open('ancientLibrary')),
        disclosure('Lost and non-canonical sources', cluster(
          button('Biblical References', () => viewArticle('biblical-references-to-non-canonical-and-lost-sources')),
          button('NT Sources', () => viewArticle('non-canonical-sources-quoted-or-echoed-in-the-new-testament')),
        )),
        row('Articles', 'Browse the original collection', () => open('learningArticles')),
        row('Investigations', 'Find published research or browse the backlog', () => open('research')),
      );
    },

    async research(target, { data }) {
      const entries = await published();
      const [field, input] = searchField('Search investigations');
      const results = node('div', '', 'rows');
      const status = text('');
      status.setAttribute('role', 'status');
      const ref = data.ref || defaultRef();
      let sequence = 0;
      async function update() {
        const version = ++sequence;
        const query = searchText(input.value);
        if (query) status.textContent = 'Searching published investigations…';
        const index = query ? await indexArticles(entries) : null;
        if (version !== sequence) return;
        const matches = query ? entries.filter((item, i) =>
          (index[i] ?? searchText(item.title + ' ' + JSON.stringify(item.relationships))).includes(query)) : entries;
        results.replaceChildren(...matches.map(item => row(item.title,
          item.reviewStatus === 'unreviewed' ? 'HomeGroups · Unreviewed' : 'HomeGroups investigation',
          () => viewArticle(item.id))));
        status.textContent = matches.length ? matches.length + (matches.length === 1 ? ' published investigation' : ' published investigations') :
          'No investigations match this search.';
        if (index?.includes(null)) status.textContent += ' Some article texts could not be searched.';
      }
      input.addEventListener('input', update);
      target.append(text('From Scripture · ' + ref), field,
        cluster(button('Search this reference', () => { input.value = ref; update(); }, 'quiet'),
          button('Research backlog', () => open('researchBacklog'))), status, results);
      await update();
    },

    async article(target, { data }) {
      const entries = await published();
      const selected = entries.find(item => item.id === (data.id || data.item?.id) || item.file === data.file);
      if (!selected) {
        target.append(text('This investigation is unavailable in the published collection.'), button('Browse Investigations', () => open('research')));
        return;
      }
      const item = await getArticle(selected.id);
      const body = importLegacy(item.html, {
        decorate(original, copy) {
          const anchor = original.id || original.getAttribute('name');
          if (anchor) copy.dataset.researchAnchor = anchor;
        },
      });
      target.append(node('h3', selected.title), body);
      const anchor = [...body.querySelectorAll('[data-research-anchor]')].find(element => element.dataset.researchAnchor === data.anchor);
      if (anchor) requestAnimationFrame(() => {
        if (anchor.isConnected) anchor.scrollIntoView({ block: 'start' });
      });
    },

    async researchBacklog(target) {
      const { topics, categories, roadmap } = await getResearchBacklog();
      const [field, input] = searchField('Search the research backlog');
      const [categoryField, picker] = selectField('Topic category', [
        ['', 'All categories'], ...categories.map(item => [item.id, item.title]),
      ]);
      const list = node('div', '', 'rows');
      const status = text('');
      status.setAttribute('role', 'status');
      let visible = pageSize;
      function render() {
        const query = searchText(input.value);
        const filtered = topics.filter(topic => (!picker.value || topic.categoryId === picker.value) &&
          searchText([topic.id, topic.title, topic.category, topic.subcategory, ...(topic.tags ?? [])].join(' ')).includes(query));
        const shown = filtered.slice(0, visible);
        status.textContent = filtered.length.toLocaleString() + (filtered.length === 1 ? ' topic' : ' topics') + ' · showing ' + shown.length;
        list.replaceChildren(...shown.map(topic => {
          const entry = node('div', '', 'reference-entry');
          entry.append(node('h3', topic.title), text([topic.id, topic.category, topic.status].filter(Boolean).join(' · ')));
          return entry;
        }));
        more.hidden = shown.length >= filtered.length;
      }
      function filter() { visible = pageSize; render(); }
      const more = button('Show more topics', () => { visible += pageSize; render(); });
      input.addEventListener('input', filter);
      picker.addEventListener('change', filter);
      const agenda = node('ol', '', 'reference-roadmap');
      agenda.append(...roadmap.map(entry => node('li', entry.title + ' · ' + entry.topicId)));
      target.append(text('This is the original planning backlog. Voting and private suggestions require the HomeGroups account system.'),
        field, categoryField, disclosure('Research roadmap', agenda), status, list, more,
        link('View pinned backlog source ↗', sourceRoot + 'investigations/topics/content-backlog.json'));
      render();
    },

    async intertext(target, { data }) {
      const entries = (await getIntertext()).map(entry => ({ ...entry, witness: witnessText(entry.nt?.text),
        fallback: witnessText(entry.ot?.masoretic?.text || entry.ot?.lxx?.text).ref }));
      const books = [...new Set(entries.map(item => item.witness.book).filter(Boolean))];
      const [bookField, picker] = selectField('New Testament book', [['', 'All books'], ...books.map(book => [book, book])]);
      const [field, input] = searchField('Find a New Testament reference');
      input.value = data.from ?? '';
      const list = node('div', '', 'rows');
      const status = text('');
      status.setAttribute('role', 'status');
      let visible = pageSize;
      let expanded = Boolean(input.value);
      function witness(label, value) {
        const block = node('div', '', 'reference-witness');
        block.append(node('h4', label + (value?.ref ? ' · ' + value.ref : '')),
          text(value?.text || 'No witness text is supplied for this entry.', 'source-copy'));
        return block;
      }
      function render() {
        const query = searchText(input.value);
        const filtered = entries.filter(item => (!picker.value || item.witness.book === picker.value) &&
          searchText(item.witness.ref || item.nt?.text).includes(query));
        const shown = filtered.slice(0, visible);
        list.replaceChildren(...shown.map(item => {
          const entry = node('div', '', 'reference-entry');
          const details = disclosure('Hebrew Scripture witnesses',
            node('h4', 'New Testament witness'), text(item.witness.text || 'No New Testament text is supplied for this entry.', 'source-copy'),
            witness('Masoretic witness', item.ot?.masoretic), witness('Septuagint witness', item.ot?.lxx));
          details.open = expanded;
          entry.append(node('h3', item.witness.ref || item.fallback || 'Source comparison'), details);
          if (item.witness.ref) entry.append(button('Open passage', () => open('reader', { ref: item.witness.ref }), 'quiet'));
          return entry;
        }));
        status.textContent = filtered.length + ' comparisons · showing ' + shown.length;
        more.hidden = shown.length >= filtered.length;
      }
      function filter() { visible = pageSize; render(); }
      const expand = button('Expand shown witnesses', () => {
        expanded = !expanded;
        expand.textContent = expanded ? 'Collapse shown witnesses' : 'Expand shown witnesses';
        list.querySelectorAll('details').forEach(details => { details.open = expanded; });
      });
      if (expanded) expand.textContent = 'Collapse shown witnesses';
      const columns = button('Side-by-side layout', () => {
        const side = list.classList.toggle('reference-columns');
        columns.setAttribute('aria-pressed', String(side));
      });
      columns.setAttribute('aria-pressed', 'false');
      const more = button('Show more comparisons', () => { visible += pageSize; render(); });
      picker.addEventListener('change', filter);
      input.addEventListener('input', filter);
      target.append(bookField, field, cluster(expand, columns), status, list, more);
      render();
    },

    async translation(target, { data }) {
      const { translation } = await getReferenceSamples();
      const [field, input] = searchField('Passage reference');
      const [sampleField, picker] = selectField('Original translation samples', [
        ['', 'Choose a sample'], ...Object.keys(translation).map(ref => [ref, ref]),
      ]);
      const results = node('div', '', 'rows');
      const form = node('form');
      form.append(field, node('button', 'Compare verse', 'button primary'));
      input.value = data.ref || Object.keys(translation)[0];
      function render() {
        const suppliedRef = input.value.trim();
        const first = suppliedRef.split(/\s*[-–]\s*/)[0];
        const ref = Object.keys(translation).find(key => searchText(key) === searchText(first));
        const entry = ref ? translation[ref] : null;
        picker.value = ref ?? '';
        results.replaceChildren();
        if (!entry) {
          results.append(text('The original collection has no sample for this reference.'));
          if (suppliedRef) results.append(button('Open passage', () => open('reader', { ref: suppliedRef })));
          return;
        }
        results.append(node('h3', ref));
        const witnesses = [
          ['English', 'en', entry.english], ['Hebrew', 'he', entry.hebrew],
          ['Hebrew transliteration', 'en', entry.transliteration], ['Greek', 'grc', entry.greek],
          ['Greek transliteration', 'en', entry.greekTranslit],
        ];
        for (const [label, lang, value] of witnesses) {
          if (!value) continue;
          const paragraph = text(value, 'source-copy');
          paragraph.lang = lang;
          if (lang === 'he') paragraph.dir = 'rtl';
          const part = node('div', '', 'reference-entry');
          part.append(node('h4', label), paragraph);
          results.append(part);
        }
        results.append(button('Open passage', () => open('reader', { ref: suppliedRef })));
      }
      form.addEventListener('submit', event => { event.preventDefault(); render(); });
      picker.addEventListener('change', () => { if (picker.value) { input.value = picker.value; render(); } });
      target.append(text('Three original verse samples with separate language and transliteration blocks.'), form, sampleField, results);
      render();
    },

    async listenShelf(target) {
      const { listen } = await getReferenceSamples();
      target.append(...listen.map(item => row(item.title, '', () => open('listenArticle', { id: item.id }))));
    },

    async listenArticle(target, { data }) {
      const { listen } = await getReferenceSamples();
      const item = listen.find(entry => entry.id === data.id);
      if (!item) {
        target.append(text('This Listen entry is unavailable.'), button('Open Listen', () => open('listenShelf')));
        return;
      }
      const body = importLegacy(item.html);
      const content = node('div', '', 'learning-article');
      content.append(cluster(...speechControl(content, body, button, text, { canPause: true })), body);
      target.append(content);
    },
  };
}
