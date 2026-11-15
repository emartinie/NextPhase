import { getAncientCatalog, getAncientText } from './corpus.js';
import { speechControl } from './learning.js';

const inApp = item => /^In-app (?:reader|collection) available$/.test(item.status);
const lower = value => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

function chapterAddress(book, work, volume, chapter, verse, q) {
  const url = new URL(location.pathname, location.origin);
  const current = new URLSearchParams(location.search);
  for (const key of ['week', 'study', 'face']) if (current.has(key)) url.searchParams.set(key, current.get(key));
  for (const [key, value] of Object.entries({ card: 'ancient-library', book, work, volume, chapter, verse, q })) {
    if (value) url.searchParams.set(key, value);
  }
  return url.href;
}

export function createAncientViews({ node, text, row, button, cluster, disclosure, link, open }) {
  function picker(label, values, initial, action) {
    const field = node('label', label);
    const select = node('select');
    select.setAttribute('aria-label', label);
    select.append(...values.map(([id, title]) => new Option(title, id)));
    select.value = initial;
    select.addEventListener('change', () => action(select.value, select));
    field.append(select);
    return [field, select];
  }

  function unavailable(target) {
    target.append(text('This item has no available local text.'), button('Browse Ancient Library', () => open('ancientLibrary')));
  }

  return {
    async ancientLibrary(target) {
      const { items, categories } = await getAncientCatalog();
      const results = node('div', '', 'rows');
      const status = text('');
      status.setAttribute('role', 'status');
      const [field, category] = picker('Library category',
        [['', 'All categories'], ...categories.map(item => [item.id, item.title])], '', render);
      const searchField = node('label', 'Find a work');
      const search = node('input');
      search.type = 'search';
      searchField.append(search);
      search.addEventListener('input', render);
      function render() {
        const visible = items.filter(item => (!category.value || item.category === category.value) &&
          lower(item.title + ' ' + item.description).includes(lower(search.value)));
        results.replaceChildren(...visible.map(item => row(item.title, item.status,
          () => open('ancientDetail', { book: item.id }))));
        status.textContent = visible.length + ' catalog entries';
      }
      target.append(field, searchField, status, results);
      render();
    },

    async ancientDetail(target, { data }) {
      const { items, categories } = await getAncientCatalog();
      const item = items.find(entry => entry.id === data.book);
      if (!item) return unavailable(target);
      const category = categories.find(entry => entry.id === item.category);
      target.append(node('h3', item.title), text(item.status, 'eyebrow'), text(item.description, 'source-copy'),
        text('Estimated writing date · ' + item.date),
        ...(item.purpose ? [text(item.purpose, 'source-copy')] : []),
        ...(item.edition ? [text('Edition · ' + item.edition)] : []),
        ...(category?.notice ? [text(category.notice)] : []),
        cluster(
          ...(inApp(item) ? [button('Begin reading', () => open('ancientRead', { book: item.id, chapter: '1', work: item.defaultWork }), 'button primary')] : []),
          ...(item.sourceUrl ? [link((item.sourceName || 'Source edition') + ' ↗', item.sourceUrl)] : []),
        ));
    },

    async ancientRead(target, { data }) {
      const catalog = await getAncientCatalog();
      const item = catalog.items.find(entry => entry.id === data.book);
      if (!item || !inApp(item)) return unavailable(target);
      const manifest = await getAncientText(item.id);
      const work = manifest.works?.find(record => record.id === data.work) ?? manifest.works?.[0];
      const volume = work?.volumes?.find(record => record.id === data.volume) ?? work?.volumes?.[0];
      const file = volume?.file ?? work?.file;
      const edition = file ? await getAncientText(item.id, file) : manifest;
      const chapters = edition.chapters ?? [];
      if (!chapters.length) return unavailable(target);
      const chaptersByNumber = new Map(chapters.map((chapter, i) => [String(chapter.number), i]));
      const requested = chapters.findIndex(chapter => data.work &&
        chapter.divisionId === data.work && String(chapter.localChapter) === String(data.chapter));
      let index = requested >= 0 ? requested : chaptersByNumber.get(String(data.chapter)) ?? 0;

      const content = node('div', '', 'learning-article');
      const readHost = node('div', '', 'learning-stack');
      const verseList = node('article', '', 'ancient-verses');
      const header = node('h3');
      header.tabIndex = -1;
      const context = node('div', '', 'learning-stack');
      const source = edition.source;
      const sourceLinks = [source, ...(edition.externalSources ?? [])].filter((entry, i, all) =>
        entry?.url && all.findIndex(candidate => candidate?.url === entry.url) === i);
      const editionDetails = disclosure('About this edition',
        text([edition.translator ?? edition.translation, edition.originalPublication].filter(Boolean).join(' · ')),
        text(edition.authorityNotice ?? manifest.authorityNotice ?? ''),
        ...(source?.reuseNotice ? [text(source.reuseNotice, 'source-copy')] : []),
        ...sourceLinks.map(entry => link((entry.name ?? 'Source edition') + ' ↗', entry.url)));
      const controls = node('div', '', 'learning-stack');
      if (work) {
        const [field] = picker('Work', manifest.works.map(entry => [entry.id, entry.title]), work.id,
          (id, select) => {
            select.value = work.id;
            open('ancientRead', { book: item.id, work: id, chapter: '1' });
          });
        controls.append(field);
      }
      if (work?.volumes) {
        const [field] = picker('Volume', work.volumes.map(entry => [entry.id, entry.title]), volume.id,
          (id, select) => {
            select.value = volume.id;
            open('ancientRead', { book: item.id, work: work.id, volume: id, chapter: '1' });
          });
        controls.append(field);
      }
      const [chapterField, chapterPicker] = picker('Chapter', chapters.map(chapter => [
        String(chapter.number),
        chapter.divisionTitle ? chapter.divisionTitle + ' ' + chapter.localChapter : 'Chapter ' + (chapter.sourceChapter ?? chapter.number),
      ]), String(chapters[index].number), value => visit(chaptersByNumber.get(value)));
      controls.append(chapterField);
      const previous = button('Previous chapter', () => visit(index - 1));
      const next = button('Next chapter', () => visit(index + 1));
      const linkText = node('input');
      linkText.type = 'url';
      linkText.readOnly = true;
      linkText.hidden = true;
      linkText.setAttribute('aria-label', 'Chapter link');
      const copyStatus = text('');
      copyStatus.setAttribute('role', 'status');

      function address(verse) {
        const chapter = chapters[index];
        // Divided standalone books use local chapter numbers inside each testament.
        const standaloneDivision = !work && chapter.divisionId;
        return chapterAddress(item.id, work?.id || standaloneDivision, volume?.id,
          standaloneDivision ? chapter.localChapter : chapter.number, verse, search.value.trim());
      }

      async function copyChapter() {
        const url = address();
        try {
          await navigator.clipboard.writeText(url);
          copyStatus.textContent = 'Chapter link copied.';
        } catch {
          linkText.value = url;
          linkText.hidden = false;
          linkText.select();
          copyStatus.textContent = 'Select and copy the chapter link.';
        }
      }

      function focusVerse(number) {
        const verse = [...verseList.children].find(line => line.dataset.verse === String(number));
        if (!verse) return;
        verse.focus({ preventScroll: true });
        verse.scrollIntoView({ block: 'start' });
      }

      function visit(position, verse, initial = false) {
        if (!chapters[position]) return;
        index = position;
        const chapter = chapters[index];
        chapterPicker.value = String(chapter.number);
        header.textContent = (chapter.divisionTitle || volume?.title || work?.title || item.title) +
          ' · Chapter ' + (chapter.localChapter ?? chapter.sourceChapter ?? chapter.number);
        const division = edition.divisions?.find(entry => entry.id === chapter.divisionId);
        const date = work?.estimatedDate || division?.estimatedDate || item.date;
        const purpose = work?.purpose || division?.purpose || item.purpose;
        context.replaceChildren(...(date ? [text('Estimated writing date · ' + date)] : []),
          ...(purpose ? [text(purpose, 'source-copy')] : []));
        previous.disabled = index === 0;
        next.disabled = index >= chapters.length - 1;
        copyStatus.textContent = '';
        linkText.hidden = true;
        const reading = node('div', '', 'learning-stack');
        verseList.replaceChildren(...chapter.verses.map(line => {
          const paragraph = node('p', '', 'ancient-verse');
          const anchor = node('a', String(line.number), 'eyebrow');
          anchor.href = address(line.number);
          anchor.setAttribute('aria-label', 'Verse ' + line.number);
          anchor.addEventListener('click', event => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            history.replaceState(history.state, '', address(line.number));
            focusVerse(line.number);
          });
          paragraph.append(anchor, node('span', line.text));
          paragraph.dataset.verse = String(line.number);
          paragraph.tabIndex = -1;
          return paragraph;
        }));
        reading.append(cluster(...speechControl(reading, verseList, button, text, { canPause: true })), verseList);
        readHost.replaceChildren(reading);
        if (target.isConnected && location.search.includes('card=ancient-library')) history.replaceState(history.state, '', address(verse));
        if (verse) requestAnimationFrame(() => { if (target.isConnected) focusVerse(verse); });
        else if (!initial) header.focus();
      }

      const searchField = node('label', 'Search this volume or work');
      const search = node('input');
      search.type = 'search';
      search.value = data.q ?? '';
      searchField.append(search);
      const searchStatus = text('');
      searchStatus.setAttribute('role', 'status');
      const results = node('div', '', 'rows');
      function findMatches() {
        const query = lower(search.value);
        results.replaceChildren();
        searchStatus.textContent = '';
        if (!query) return;
        let count = 0;
        for (let i = 0; i < chapters.length; i++) {
          const chapter = chapters[i];
          for (const verse of chapter.verses) {
            if (!lower(verse.text).includes(query)) continue;
            if (++count > 100) break;
            results.append(row((chapter.divisionTitle ?? 'Chapter') + ' ' +
              (chapter.localChapter ?? chapter.number) + ':' + verse.number,
            verse.text.replace(/\s+/g, ' ').slice(0, 120), () => visit(i, verse.number)));
          }
          if (count > 100) break;
        }
        searchStatus.textContent = count > 100 ? 'Showing the first 100 matches.' : count + ' matches';
      }
      search.addEventListener('input', findMatches);
      const searchDetails = disclosure('Search this text', searchField, searchStatus, results);
      searchDetails.open = Boolean(search.value);
      content.append(text(item.title, 'eyebrow'), header, context, editionDetails, controls,
        cluster(previous, next, button('Copy chapter link', copyChapter)), copyStatus, linkText,
        searchDetails, readHost);
      target.append(content);
      visit(index, data.verse, true);
      findMatches();
    },
  };
}
