
import {
  catalogSource, researchSource, researchGroups, featured,
  searchCatalog, catalogLocation, publicEditions, getPreparednessAsset,
} from './preparedness-resources.js';

const pageSize = 24;
const count = value => value.toLocaleString('en-US');

export function createLibraryViews({ node, text, button, cluster, disclosure, link, open }) {
  const loadCatalog = () => Promise.all([
    getPreparednessAsset('be-ready-catalog.json'), getPreparednessAsset('be-ready-source-links.json'),
  ]);

  return {
    async prepLibrary(target, { data }) {
      const loading = text('Loading the Be Ready catalog…');
      loading.setAttribute('role', 'status');
      target.append(loading);
      const [catalog, sources] = await loadCatalog();
      const folders = Object.keys(catalog.folderMap).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      let category = featured.some(item => item[2] === data.category) ? data.category : '';
      let page = 0;
      const search = node('input');
      search.type = 'search';
      search.placeholder = 'Title, author, or keyword';
      const searchField = node('label', 'Search the catalog');
      searchField.append(search);
      const folderField = node('label', 'Browse by folder');
      const folder = node('select');
      folder.setAttribute('aria-label', 'Browse by folder');
      folder.append(new Option('All folders', ''),
        ...folders.map(path => new Option((path === '.' ? 'Top-level files' : path.replaceAll('\\', ' › ')) +
          ' (' + searchCatalog(catalog.files, { folder: path }).length + ')', path)));
      if (folders.includes(data.folder)) folder.value = data.folder;
      folderField.append(folder);
      const subjects = cluster(...featured.map(([name, , id]) => {
        const choice = button(name, () => {
          category = category === id ? '' : id;
          update();
        }, 'pill');
        choice.dataset.category = id;
        return choice;
      }));
      const resultLabel = text('', 'source-copy');
      resultLabel.setAttribute('role', 'status');
      resultLabel.tabIndex = -1;
      const results = node('ul', '', 'prep-list');
      const pager = cluster();
      function turn(step) {
        page += step;
        render();
        resultLabel.focus();
      }
      function render() {
        for (const choice of subjects.children) choice.setAttribute('aria-pressed', String(choice.dataset.category === category));
        const matches = searchCatalog(catalog.files, { query: search.value, folder: folder.value, category });
        const start = page * pageSize;
        const label = matches.length === 1 ? ' record' : ' records';
        resultLabel.textContent = matches.length ? count(matches.length) + label + ' · Showing ' + (start + 1) + '–' +
          Math.min(start + pageSize, matches.length) :
          (folder.value && !searchCatalog(catalog.files, { folder: folder.value }).length ? 'This folder is listed but has no indexed PDFs.' : 'No matching records.');
        results.replaceChildren(...matches.slice(start, start + pageSize).map(file => {
          const entry = node('li');
          const control = button(file.name, () => open('prepDocument', { id: file.id }), 'prep-row');
          control.append(node('small', file.path.split('\\').slice(0, -1).join(' › ') || 'Top-level file'));
          entry.append(control);
          return entry;
        }));
        pager.replaceChildren();
        if (page > 0) pager.append(button('Previous records', () => turn(-1)));
        if (start + pageSize < matches.length) pager.append(button('Next records', () => turn(1)));
      }
      function update() {
        page = 0;
        render();
      }
      search.addEventListener('input', update);
      folder.addEventListener('change', update);
      const shelf = featured.map(([name, title, id, url]) => {
        const entry = node('section', '', 'prep-resource');
        entry.append(node('strong', title), cluster(button('Browse ' + name, () => {
          category = id;
          search.value = '';
          folder.value = '';
          update();
          resultLabel.focus();
        }), link('Related public reference ↗', url)));
        return entry;
      });
      const skipped = node('ul', '', 'prep-list');
      for (const entry of catalog.skippedPDFs) skipped.append(node('li', entry));
      target.replaceChildren(
        text(count(catalog.files.length) + ' original catalog records across ' + folders.length +
          ' folder entries. Select a record for its original metadata and available source links.'),
        disclosure('Original featured shelf', text('These featured labels were themes. The original card provided no matching PDF links.'),
          ...shelf, text('Original motto · Two is one, and one is none. By failing to prepare, you are preparing to fail.')),
        searchField, folderField, subjects, resultLabel, results, pager,
        disclosure('Catalog sources and ' + catalog.skippedPDFs.length + ' skipped PDFs',
          text('The source index did not extract these files. Their paths are preserved separately from the 1,061 indexed records.'),
          skipped, cluster(link('Original Drive folder ↗', sources.root),
            link('Pinned index source ↗', catalogSource))),
      );
      render();
    },

    async prepDocument(target, { data }) {
      const [catalog, sources] = await loadCatalog();
      const file = catalog.files.find(item => item.id === data.id);
      if (!file) {
        target.append(text('This record ID is absent from the pinned catalog.'), button('Browse Be Ready', () => open('prepLibrary')));
        return;
      }
      const match = catalogLocation(file, sources);
      const direct = sources.documentUrls[file.id];
      const edition = publicEditions[file.path];
      const metadata = node('dl', '', 'prep-plan');
      const fields = [
        ['Catalog path', file.path], ['Original source', file.source], ['Indexed title', file.pdfTitle],
        ['Indexed author', file.pdfAuthor], ['Pages', file.pdfPages], ['File size', file.size ? count(file.size) + ' bytes' : null],
        ['File modified', file.modified?.slice(0, 10)], ['Record ID', file.id],
      ];
      for (const [label, value] of fields) {
        if (value) metadata.append(node('dt', label), node('dd', String(value)));
      }
      target.append(node('h3', file.name), metadata,
        node('h3', 'Source access'),
        text(direct ? 'The legacy Drive folder lists the same filename. Access is controlled by the source host.' :
          'The index has no article text or direct PDF URL. Use the original source links below.'),
        cluster(...(direct ? [link('Open matching source file ↗', direct)] : []),
          link(match.folder ? 'Open matched source folder ↗' : 'Open original library folder ↗', match.url),
          button('Browse Be Ready catalog', () => open('prepLibrary'))));
      if (edition) target.append(text(edition.note), link('Read the public edition ↗', edition.url),
        link('Current USDA canning guidance ↗', 'https://nchfp.uga.edu/resources/publications_usda/P20'));
      if (match.archives.length) {
        target.append(text('The source folder lists these archives. Their contents and download permissions were not checked.'));
        for (const archive of match.archives) target.append(link(archive.title + ' ↗', archive.href));
      }
    },

    async prepResearch(target) {
      const topics = await getPreparednessAsset('research-backlog.json');
      const field = node('label', 'Find a research topic');
      const search = node('input');
      search.type = 'search';
      field.append(search);
      const status = text('', 'source-copy');
      status.setAttribute('role', 'status');
      const results = node('div', '', 'prep-stack');
      const sections = researchGroups.map(([start, end, name]) => {
        const list = node('ul', '', 'prep-list');
        const group = disclosure(name, list);
        results.append(group);
        return { start, end, list, group };
      });
      function render() {
        const query = search.value.toLowerCase().trim();
        const matches = topics.filter(topic => (topic.id + ' ' + topic.title).toLowerCase().includes(query));
        status.textContent = matches.length + ' of ' + topics.length + ' research topics';
        for (const { start, end, list, group } of sections) {
          const visible = matches.filter(topic => topic.id >= start && topic.id <= end);
          list.replaceChildren(...visible.map(topic => {
            const item = node('li');
            item.append(link(topic.id + ' · ' + topic.title + ' ↗', researchSource + '#L' + topic.line));
            return item;
          }));
          group.hidden = !visible.length;
          if (query) group.open = true;
        }
      }
      sections[0].group.open = true;
      search.addEventListener('input', render);
      target.append(text('The original backlog covers prayer, local radio, preparedness plans, and mutual aid. These are research titles awaiting development.'),
        field, status, results, link('Original research section ↗', researchSource + '#L1905-L1943'));
      render();
    },
  };
}
