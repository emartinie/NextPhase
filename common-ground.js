const tagline = 'Facts First. Conclusions Yours.';
const verification = new Map([
  ['confirmed', 'Confirmed facts'], ['estimate', 'Attributed estimates'], ['open-question', 'What remains unclear'],
]);
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const timeFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
let index;

function sampleBriefings() {
  index ??= fetch(new URL('./corpus/preparedness/common-ground.json', import.meta.url)).then(async response => {
    if (!response.ok) throw new Error('Briefing index unavailable');
    const data = await response.json();
    if (data.schemaVersion !== 1 || !Array.isArray(data.briefings)) throw new Error('Unsupported briefing index');
    return data.briefings.filter(briefing => briefing.editorial?.status === 'sample' && briefing.editorial.approval === null);
  }).catch(error => { index = undefined; throw error; });
  return index;
}

export function createCommonGroundViews({ node, text, button, row, link, disclosure, open, mountDiscussion }) {
  function time(value, formatter = dateFormat) {
    const item = node('time', formatter.format(new Date(value)));
    item.dateTime = value;
    return item;
  }

  async function show(target, render) {
    target.append(text('Opening The Common Ground…'));
    try {
      const briefings = await sampleBriefings();
      target.replaceChildren();
      render(briefings);
    } catch {
      target.replaceChildren(text('The Common Ground could not load.'), button('Try again', () => {
        target.replaceChildren();
        void show(target, render);
      }));
    }
  }

  function withBriefing(target, id, render) {
    return show(target, briefings => {
      const item = briefings.find(briefing => briefing.id === id);
      if (item) render(item);
      else target.append(text('This briefing is unavailable.'), button('Browse briefings', () => open('commonGround')));
    });
  }

  function citedSection(title, statements, sources) {
    const section = node('section', '', 'common-ground-section');
    const list = node('ul');
    for (const { text: statement, sourceIds } of statements) {
      const item = node('li');
      item.append(text(statement, 'source-copy'));
      const refs = node('div', '', 'common-ground-citations');
      for (const id of sourceIds) {
        const source = sources.get(id);
        if (source) refs.append(link(source.publisher, source.url));
      }
      item.append(refs);
      list.append(item);
    }
    section.append(node('h4', title), list);
    return section;
  }

  return {
    commonGround(target) {
      return show(target, briefings => {
        target.append(text(tagline, 'source-copy'), text('Historical samples for editorial review.'));
        if (!briefings.length) target.append(text('There are no sample briefings available.'));
        for (const item of briefings) {
          target.append(row(item.headline, `Sample · ${dateFormat.format(new Date(item.eventDate))} · Under 3 min`,
            () => open('commonGroundBriefing', { id: item.id })));
        }
      });
    },
    commonGroundBriefing(target, { data }) {
      return withBriefing(target, data.id, item => {
        const article = node('article', '', 'common-ground-briefing');
        const date = text('Historical sample · ', 'eyebrow');
        date.append(time(item.eventDate));
        article.append(date, node('h3', item.headline), text(item.summary, 'source-copy'));
        const sources = new Map(item.sources.map(source => [source.id, source]));
        for (const [status, label] of verification) {
          const claims = item.claims.filter(claim => claim.verification === status);
          if (claims.length) article.append(citedSection(label, claims, sources));
        }
        if (item.implications.length) article.append(citedSection('Practical implications', item.implications, sources));
        const notes = item.sources.map(source => {
          const entry = node('div', '', 'common-ground-source');
          const published = text(`${source.publisher} · `);
          published.append(time(source.date));
          entry.append(link(source.title, source.url), published, text(source.note));
          return entry;
        });
        const audit = node('div', '', 'common-ground-source');
        const updated = text('Last revised ');
        updated.append(time(item.editorial.updatedAt, timeFormat), ' UTC');
        audit.append(updated, text('Sample for review · Pending editorial approval.'));
        for (const revision of item.revisions) {
          const entry = node('div');
          const recorded = text(`Revision ${revision.id} · ${revision.kind} · `);
          recorded.append(time(revision.at, timeFormat), ' UTC');
          entry.append(recorded, text(revision.note, 'source-copy'));
          audit.append(entry);
        }
        article.append(disclosure('Sources and further reading', ...notes), disclosure('Updates and corrections', audit));
        target.append(article, button('Discuss in Fellowship', () => open('briefingDiscussion', { id: item.id })));
      });
    },
    briefingDiscussion(target, { data }) {
      return withBriefing(target, data.id, item => {
        target.append(node('h3', item.headline), text(item.discussionPrompt, 'source-copy'));
        mountDiscussion(target, item, data);
      });
    },
  };
}
