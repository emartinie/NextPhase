const CATALOG = './corpus/people/';
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
let catalogRequest;

function loadCatalog() {
  if (!catalogRequest) {
    catalogRequest = Promise.all(['scholars.json', 'teaching-archive.json'].map(async (file) => {
      const response = await fetch(CATALOG + file);
      if (!response.ok) throw new Error('Could not load ' + file);
      return response.json();
    })).then(([profiles, archive]) => {
      const teachers = archive.teachers
        .filter((teacher) => teacher.enabled && !teacher.placeholder && teacher.videos?.length)
        .map((teacher) => ({ ...teacher, category: 'Teacher', kind: 'teacher' }));
      const debates = archive.debates.filter((debate) => debate.enabled && VIDEO_ID.test(debate.youtubeId));
      const byVideo = new Map();
      for (const teacher of teachers) {
        for (const { youtubeId } of teacher.videos) {
          if (!byVideo.has(youtubeId)) byVideo.set(youtubeId, new Set());
          byVideo.get(youtubeId).add(teacher.id);
        }
      }
      return {
        people: [...profiles.scholars.map((person) => ({ ...person, kind: 'scholar' })), ...teachers]
          .sort((left, right) => left.name.localeCompare(right.name)),
        debates,
        byVideo,
        editorialNote: profiles.editorialNote,
      };
    }).catch((error) => {
      catalogRequest = null;
      throw error;
    });
  }
  return catalogRequest;
}

export function createPeopleViews({ node, text, button, link, cluster, row, disclosure, open }) {
  function itemList(title, items) {
    if (!items?.length) return null;
    const list = node('ul');
    for (const item of items) list.append(node('li', item));
    return subsection(title, list);
  }

  function subsection(title, ...items) {
    const section = node('section', '', 'people-section');
    section.append(node('h4', title), ...items);
    return section;
  }

  function profile(target, person) {
    target.append(node('p', person.category, 'eyebrow'), node('h3', person.name, 'people-title'));
    if (person.who || person.overview) target.append(text(person.who || person.overview, 'source-copy'));
    if (person.whyHelpful) target.append(subsection('Why read their work?', text(person.whyHelpful, 'source-copy')));
    if (person.startWith?.length) {
      const startingPoints = person.startWith.map(({ title, reason }) => {
        const item = node('article', '', 'people-start');
        item.append(node('strong', title), text(reason, 'source-copy'));
        return item;
      });
      target.append(subsection('Start here', ...startingPoints));
    }
    const fields = [['Study topics', person.helpfulFor || person.expertise], ['Important works', person.writings]];
    for (const [title, items] of fields) {
      const section = itemList(title, items);
      if (section) target.append(section);
    }
    const research = node('div', '', 'people-stack');
    for (const value of [person.title, person.tradition, person.overview]) {
      if (value) research.append(text(value, 'source-copy'));
    }
    const details = [
      ['Research method and fields', person.expertise], ['Languages and textual work', person.languages],
      ['Research strengths', person.strengths], ['Limitations and cautions', person.limitations],
      ['Notable contributions', person.contributions], ['Areas of agreement and disagreement', person.comparisons],
    ];
    for (const [title, items] of details) {
      const section = itemList(title, items);
      if (section) research.append(section);
    }
    if (person.influence) research.append(subsection('Influence', text(person.influence, 'source-copy')));
    if (research.childElementCount) target.append(disclosure('Background and research', research));
    if (person.sources?.length) {
      const sources = cluster(...person.sources.map(({ label, url }) => link(label + ' ↗', url)));
      target.append(subsection('Sources and further reading', sources));
    }
  }

  function archive(target, person, byVideo) {
    const title = person.seriesTitle || person.archiveTitle;
    if (person.id === 'chuck-missler') target.append(text('Koinonia House teaching archive', 'source-copy'));
    if (person.attribution) target.append(text(person.attribution));
    const media = node('div', '', 'rows');
    person.videos.forEach((video, index) => {
      const shared = byVideo.get(video.youtubeId)?.size > 1;
      if (!VIDEO_ID.test(video.youtubeId)) return;
      media.append(row(video.title, shared ? 'YouTube · Shared archive entry' : 'YouTube video',
        () => open('teaching', { id: person.id, video: String(index + 1) })));
    });
    if (person.id === 'chuck-missler') {
      target.append(subsection('Start here', row(person.videos[0].title, title,
        () => open('teaching', { id: person.id, video: '1' }))));
    }
    target.append(subsection('Teaching archive', text(title, 'source-copy'),
      text('Shared archive entries appear under more than one teacher in the HomeGroups source. Check the video for its presenter.'), media));
  }

  function videoView(target, video, credit = '') {
    target.append(node('h3', video.title, 'people-title'));
    if (credit) target.append(text(credit));
    if (video.description) target.append(text(video.description, 'source-copy'));
    const player = node('div', '', 'people-player');
    const play = button('Load YouTube player', () => {
      const frame = node('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + video.youtubeId + '?rel=0&autoplay=0';
      frame.title = video.title + ' · YouTube player';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allow = 'encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.tabIndex = 0;
      player.replaceChildren(frame);
      frame.focus({ preventScroll: true });
    });
    player.append(play);
    target.append(player, cluster(link('Watch on YouTube ↗', 'https://www.youtube.com/watch?v=' + video.youtubeId)));
  }

  return {
    async people(target) {
      const { people, debates, editorialNote } = await loadCatalog();
      const search = node('input');
      search.type = 'search';
      search.placeholder = 'Name, subject or work';
      const label = node('label', 'Search teachers and scholars');
      label.append(search);
      const groups = [['All', 'all'], ['Teachers', 'teacher'], ['Scholars', 'scholar']];
      let selected = 'all';
      const filters = cluster(...groups.map(([name, kind]) => {
        const control = button(name, () => { selected = kind; render(); }, 'pill');
        control.dataset.kind = kind;
        return control;
      }));
      filters.setAttribute('role', 'group');
      filters.setAttribute('aria-label', 'Contributor type');
      const list = node('div', '', 'rows');
      const status = text('');
      status.setAttribute('role', 'status');
      function render() {
        const query = search.value.trim().toLowerCase();
        const matches = people.filter((person) => {
          if (selected !== 'all' && selected !== person.kind) return false;
          const keywords = [person.name, person.category, person.title, person.tradition, person.overview,
            person.who, person.whyHelpful, person.seriesTitle, person.archiveTitle, ...(person.expertise ?? []),
            ...(person.helpfulFor ?? []), ...(person.writings ?? []), ...(person.videos ?? []).map(({ title }) => title)];
          return keywords.join(' ').toLowerCase().includes(query);
        });
        for (const control of filters.children) control.setAttribute('aria-pressed', String(control.dataset.kind === selected));
        status.textContent = matches.length ? matches.length + (matches.length === 1 ? ' profile' : ' profiles') : 'No matching profiles';
        list.replaceChildren(...matches.map((person) => row(person.name,
          person.kind === 'teacher' ? 'Teacher · Teaching archive' : person.category,
          () => open('person', { id: person.id }))));
      }
      search.addEventListener('input', render);
      target.append(label, filters, status, list);
      if (debates.length) target.append(subsection('Debates', ...debates.map((item) =>
        row(item.title, item.participants, () => open('debate', { debate: item.id })))));
      if (editorialNote) target.append(disclosure('About the directory', text(editorialNote)));
      render();
    },
    async person(target, { data }) {
      const { people, byVideo } = await loadCatalog();
      const person = people.find(({ id }) => id === data.id);
      if (!person) {
        target.append(text('This profile could not be found.'), button('Browse teachers and scholars', () => open('people')));
        return;
      }
      profile(target, person);
      if (person.kind === 'teacher') archive(target, person, byVideo);
    },
    async teaching(target, { data }) {
      const { people, byVideo } = await loadCatalog();
      const person = people.find(({ id }) => id === data.id);
      const video = person?.videos?.[Number(data.video) - 1];
      if (!video || !VIDEO_ID.test(video.youtubeId)) {
        target.append(text('This teaching could not be found.'), button('Browse teachers and scholars', () => open('people')));
        return;
      }
      const shared = byVideo.get(video.youtubeId)?.size > 1;
      videoView(target, video, 'Listed in the ' + person.name + ' archive.' +
        (shared ? ' This entry also appears in another archive.' : ''));
      target.append(button('Open contributor profile', () => open('person', { id: person.id }), 'quiet'));
    },
    async debate(target, { data }) {
      const { debates } = await loadCatalog();
      const video = debates.find(({ id }) => id === data.debate);
      if (video) videoView(target, video, video.participants);
      else target.append(text('This debate could not be found.'), button('Browse teachers and scholars', () => open('people')));
    },
  };
}
