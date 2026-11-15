import { getCalendar, getCalendarSchedules } from './corpus.js';

export const calendarCards = {
  calendar: 'calendar', calendarEvent: 'calendar', fallFeasts: 'fallfeasts',
  sukkotCount: 'sukkotcount', omerCount: 'omercount', sacredTime: 'sacred-time-prototype',
};
export const calendarFields = ['model', 'event', 'date', 'phase', 'countDay'];
const calendarTypes = Object.fromEntries(Object.entries(calendarCards)
  .filter(([type]) => type !== 'calendarEvent').map(([type, card]) => [card, type]));
const legacy = 'https://github.com/emartinie/HGBibleApp/blob/1e31cc4dd984adc638db2aa87571618fee1f3e31/js/';
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });
const weekdayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' });
const dateKey = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  .map(value => String(value).padStart(2, '0')).join('-');
const formatDate = date => dateFormat.format(new Date(date + 'T12:00:00'));
const label = value => String(value ?? 'Not specified').replaceAll('_', ' ').replace(/^\w/, first => first.toUpperCase());

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function daysBetween(start, end) {
  return (Date.parse(end) - Date.parse(start)) / 86400000;
}

export function nextSabbath(now) {
  const days = (5 - now.getDay() + 7) % 7;
  return addDays(now, days || (now.getHours() >= 18 ? 7 : 0));
}

export function countDay(now, start) {
  const evening = now.getHours() * 60 + now.getMinutes() >= 19 * 60 + 30;
  const effective = dateKey(addDays(now, evening ? 1 : 0));
  // Subtract calendar dates in UTC so changes in the device's clock offset don't skip a day.
  return daysBetween(start, effective) + 1;
}

function modelFor(schedules, model) {
  if (Object.hasOwn(schedules.models, model)) return model;
  try {
    const saved = localStorage.getItem('preferredCalendarType');
    if (Object.hasOwn(schedules.models, saved)) return saved;
  } catch {}
  return 'Hillel';
}

function eventsFor(schedules, model) {
  return schedules.events.map(([id, title, summary], index) => {
    const [start, display] = schedules.modelDates[model][index];
    return { id, title, summary, start, display };
  });
}

export async function calendarRoute(card, params) {
  let type = calendarTypes[card];
  if (!Object.hasOwn(calendarTypes, card)) return null;
  const data = Object.fromEntries(calendarFields.map(field => [field, params.get(field)]));
  if (card === 'calendar' && (data.event || data.date)) {
    // Resolve a date-only bookmark against the selected legacy model.
    try {
      const schedules = await getCalendarSchedules();
      data.model = modelFor(schedules, data.model);
      const event = eventsFor(schedules, data.model).find(item => data.event
        ? item.id === data.event : item.start.slice(0, 10) === data.date);
      if (event) {
        type = 'calendarEvent';
        data.event = event.id;
        data.date = event.start.slice(0, 10);
      }
    } catch {
      // The main panel exposes its normal retry when the source cannot load.
    }
  }
  return { type, data };
}

const seasons = [
  ['PRE', '', 'Preparation'], ['TERUAH', 'YOM_TERUAH', 'Yom Teruah'],
  ['KIPPUR', 'YOM_KIPPUR', 'Yom Kippur'], ['SUKKOT', 'SUKKOT', 'Sukkot'],
  ['COMPLETE', 'SHEMINI', 'Shemini Atzeret / completion'],
];

const lenses = [
  ['Disputed or needs review', ['needs_review', 'disputed', 'historical_disputed', 'uncertain']],
  ['Theological association', ['thematic_association']],
  ['Historical reconstruction', ['historical_reconstruction', 'historical_consensus']],
  ['Tradition', ['strong_tradition', 'traditional', 'traditional_association']],
  ['Explicit biblical date', ['explicit_biblical_date', 'fixed_hebrew_date', 'relative_biblical_date']],
];

function certaintyValues(entry) {
  return [entry.chronology_confidence, entry.hebrew_date?.certainty, entry.traditional_year?.certainty,
    entry.gregorian_date?.certainty, entry.date_type, entry.status,
    ...(entry.traditions ?? []).map(item => item.certainty),
    ...(entry.viewpoints ?? []).map(item => item.certainty)].filter(Boolean);
}

function sourceLens(entry) {
  const values = certaintyValues(entry);
  return lenses.find(([, keys]) => keys.some(key => values.includes(key)))?.[0] ?? 'Uncertain or undated';
}

function dateSummary(entry) {
  return entry.hebrew_date?.display || entry.gregorian_date?.display || entry.traditional_year?.label || 'Undated';
}

function omerDay(omer, day) {
  const outer = Math.floor((day - 1) / 7);
  const inner = (day - 1) % 7;
  const a = omer.english[inner], b = omer.english[outer];
  const focus = omer.themes[a], week = omer.themes[b];
  const weeks = Math.floor(day / 7), remainder = day % 7;
  const parts = [weeks && `${weeks} week${weeks === 1 ? '' : 's'}`,
    remainder && `${remainder} day${remainder === 1 ? '' : 's'}`].filter(Boolean);
  return {
    title: `Day ${day} of 49`,
    count: `${weeks ? day + ' days · ' : ''}${parts.join(' and ')} · Week ${outer + 1}, Day ${inner + 1}`,
    hebrew: `הַיּוֹם ${day} לָעוֹמֶר · ${omer.hebrew[inner]} שב${omer.hebrew[outer]}`,
    meditation: {
      title: `${a} within ${b} — ${focus.title} within ${week.title}`,
      text: `${focus.meditation} How should ${focus.title.toLowerCase()} be shaped by ${week.title.toLowerCase()} today?`,
      prayer: `Prayer: ${focus.prayer} Let ${a.toLowerCase()} be rightly formed within ${b.toLowerCase()}.`,
      scripture: `Scripture thought: ${focus.scripture}`,
    },
  };
}

export function createCalendarViews({ node, text, button, row, cluster, disclosure, link, open, passage, supplemental, updateUrl }) {
  function field(caption, choices) {
    const select = node('select');
    select.setAttribute('aria-label', caption);
    for (const [value, title] of choices) {
      select.append(Object.assign(node('option', title), { value }));
    }
    const wrapper = node('label', caption);
    wrapper.append(select);
    return { wrapper, select };
  }

  function progress(value, max, name) {
    const meter = node('progress', '', 'calendar-progress');
    Object.assign(meter, { value, max });
    meter.setAttribute('aria-label', name);
    return meter;
  }

  function meditation(data, previousTitle) {
    const body = [text(data.text, 'source-copy'), text(data.prayer), text(data.scripture)];
    if (data.title !== previousTitle) body.unshift(node('h3', data.title));
    return body;
  }

  function passageLinks(refs) {
    return cluster(...refs.map(ref => button(ref, () => passage(ref.replaceAll('–', '-')))));
  }

  function constellation(positions, dayLabel, choose) {
    const map = node('div', '', 'calendar-constellation');
    map.classList.add(positions.length === 7 ? 'constellation-feast' : 'constellation-omer');
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'polyline');
    const points = positions.map(([x, y]) => [5 + x * .89, 4 + y * .9]);
    path.setAttribute('points', points.map(point => point.join(',')).join(' '));
    svg.append(path);
    map.append(svg);
    const controls = points.map(([x, y], index) => {
      const control = button(String(index + 1), () => choose(index + 1), 'count-star');
      control.style.left = x + '%';
      control.style.top = y + '%';
      control.title = dayLabel(index + 1);
      control.setAttribute('aria-label', control.title);
      // The companion select provides keyboard access to every day without 49 tab stops.
      control.tabIndex = -1;
      map.append(control);
      return control;
    });
    return {
      map,
      update(selected, current) {
        controls.forEach((control, index) => {
          control.setAttribute('aria-pressed', String(index + 1 === selected));
          control.classList.toggle('count-elapsed', index + 1 < current);
          if (index + 1 === current) control.setAttribute('aria-current', 'date');
          else control.removeAttribute('aria-current');
        });
      },
    };
  }

  async function countView(target, frame, key, days) {
    const data = (await getCalendarSchedules())[key];
    const isOmer = key === 'omer';
    const dayLabel = day => isOmer ? `Day ${day} · ${data.english[(day - 1) % 7]} within ${data.english[Math.floor((day - 1) / 7)]}` : `Day ${day}`;
    const last = isOmer ? 'Completion' : 'Feast count complete';
    const options = [['', 'Follow the 2026 count'], ['0', 'Preparation'],
      ...Array.from({ length: days }, (_, index) => [String(index + 1), dayLabel(index + 1)]), [String(days + 1), last]];
    const { wrapper, select } = field('Review the count', options);
    const status = text('');
    const detail = node('section', '', 'calendar-feature');
    detail.setAttribute('aria-live', 'polite');
    let previous;
    function choose(value) {
      frame.data.countDay = String(value);
      updateUrl(frame);
      refresh();
    }
    const graphic = constellation(data.positions, dayLabel, choose);
    const visual = disclosure('Constellation', graphic.map);
    visual.open = true;
    function refresh() {
      const actual = countDay(new Date(), data.start);
      const reading = options.some(([id]) => id === frame.data.countDay) ? frame.data.countDay : '';
      if (previous === `${actual}/${reading}`) return;
      previous = `${actual}/${reading}`;
      const selected = reading === '' ? Math.max(0, Math.min(days + 1, actual)) : Number(reading);
      select.value = reading;
      status.textContent = actual < 1 ? `${1 - actual} day${actual === 0 ? '' : 's'} until the 2026 count starts.` :
        actual > days ? 'The 2026 count is complete.' : `2026 reference count · Day ${actual} of ${days}`;
      graphic.update(selected, actual);
      if (selected === 0 || selected > days) {
        const title = selected === 0 ? 'Preparation' : last;
        const content = selected === 0 ? data.prepare : data.complete;
        detail.replaceChildren(node('h3', title), progress(selected ? days : 0, days, 'Count progress'));
        if (content) detail.append(...meditation(content, title));
        return;
      }
      const content = isOmer ? omerDay(data, selected) : {
        title: `Day ${selected} of Sukkot`, count: 'Dwelling · Joy · Presence', hebrew: 'חג הסוכות',
        meditation: data.daily,
      };
      const hebrew = text(content.hebrew, 'source-copy');
      Object.assign(hebrew, { lang: 'he', dir: 'rtl' });
      detail.replaceChildren(node('h3', content.title), text(content.count), hebrew,
        progress(selected, days, 'Count progress'), ...meditation(content.meditation));
    }
    select.addEventListener('change', () => choose(select.value));
    target.append(text(`2026 source window · ${formatDate(data.start)} – ${formatDate(data.end)}`, 'source-copy'),
      text('The count advances at 7:30 PM on the device clock. Use the day selector to review any stage.'),
      status, wrapper, detail, visual, link('Original counter ↗', legacy + (isOmer ? 'omercount' : 'sukkotcount') + '.js'));
    if (!isOmer) target.append(row('Fall Feasts', 'Shemini Atzeret and the rest of the season', () => open('fallFeasts')));
    frame.refresh = refresh;
    refresh();
  }

  function researchEntry(entry) {
    const article = node('div', '', 'calendar-research-entry');
    const facts = node('dl', '', 'calendar-facts');
    const entries = {
      'Hebrew date': entry.hebrew_date?.display,
      'Gregorian alignment': entry.gregorian_date?.display,
      'Traditional year': entry.traditional_year?.label,
      'Date type': label(entry.date_type), 'Chronology confidence': label(entry.chronology_confidence), 'Status': label(entry.status),
      'Categories': entry.category?.map(label).join(', '), 'Themes': entry.themes?.map(label).join(', '),
      'Related appointed times': entry.related_appointed_times?.join(', '), 'Related events': entry.related_events?.join(', '),
    };
    for (const [key, value] of Object.entries(entries)) if (value) {
      const fact = node('div');
      fact.append(node('dt', key), node('dd', value));
      facts.append(fact);
    }
    const sources = node('div', '', 'calendar-source-list');
    for (const date of [entry.hebrew_date, entry.gregorian_date, entry.traditional_year]) {
      if (date?.source_note) sources.append(text(`${label(date.certainty)} · ${date.source_note}`));
    }
    for (const item of [...(entry.traditions ?? []), ...(entry.viewpoints ?? []), ...(entry.source_notes ?? [])]) {
      sources.append(node('h4', item.name || item.label),
        text(item.tradition || item.summary || item.note, 'source-copy'));
      if (item.certainty || item.source_note) sources.append(text([item.certainty && label(item.certainty), item.source_note].filter(Boolean).join(' · ')));
      if (item.url) sources.append(link('Open source ↗', item.url));
    }
    article.append(text(entry.description, 'source-copy'), facts, passageLinks(entry.scripture_refs ?? []));
    if (sources.childElementCount) article.append(node('h4', 'Sources and viewpoints'), sources);
    return article;
  }

  return {
    async calendar(target, frame) {
      const data = await getCalendarSchedules();
      const today = text('');
      const sabbath = text('', 'source-copy');
      const upcoming = node('section', '', 'calendar-feature');
      const list = node('div', '', 'rows');
      const description = text('');
      const count = text('');
      let model = modelFor(data, frame.data.model);
      const models = Object.keys(data.models).map(name => button(name, () => {
        model = name;
        Object.assign(frame.data, { model, event: null, date: null });
        try { localStorage.setItem('preferredCalendarType', model); } catch {}
        updateUrl(frame);
        refresh();
      }, 'pill'));
      let renderedModel, renderedNext;
      function refresh() {
        const now = new Date();
        today.textContent = weekdayFormat.format(now);
        sabbath.textContent = 'Friday evening, ' + dateFormat.format(nextSabbath(now));
        const events = eventsFor(data, model);
        const next = events.find(item => new Date(item.start) > now);
        if (next) {
          const minutes = Math.floor((new Date(next.start) - now) / 60000);
          const hours = Math.floor(minutes / 60);
          count.textContent = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h away` : `${hours}h ${minutes % 60}m away`;
        }
        if (renderedModel === model && renderedNext === next?.id) return;
        renderedModel = model;
        renderedNext = next?.id;
        for (const control of models) control.setAttribute('aria-pressed', String(control.textContent === model));
        description.textContent = data.models[model];
        const show = item => open('calendarEvent', { model, event: item.id, date: item.start.slice(0, 10) });
        upcoming.replaceChildren(next ? node('h3', 'Next appointed time') : node('h3', '2026 reference cycle complete'));
        if (next) upcoming.append(row(next.title, next.display, () => show(next)), count);
        else upcoming.append(text('The full schedule remains available for study and comparison.'));
        list.replaceChildren(...events.map(item => {
          const control = row(item.title, `${formatDate(item.start.slice(0, 10))} · ${item.summary}`, () => show(item));
          if (item.id === next?.id) control.setAttribute('aria-current', 'date');
          return control;
        }));
      }
      const schedule = disclosure('2026 appointed times', list);
      schedule.open = true;
      const extra = node('div', '', 'rows');
      for (const item of supplemental()) {
        const readings = node('div', '', 'rows');
        for (const ref of [item.torah_reading, item.haftarah_prophets_writings, item.new_testament].filter(Boolean)) {
          readings.append(row(ref, 'Supplemental schedule reference', () => passage(ref)));
        }
        extra.append(disclosure(item.title_english || item.portion_transliteration || `Supplemental study ${item.week}`, readings));
      }
      target.append(today, node('h3', 'Next Sabbath'), sabbath, text('The reference rolls forward at 6 PM Friday. Sunset varies by location.'),
        node('h3', 'Appointed times · 2026'), cluster(...models), description, upcoming, schedule,
        row('Fall Feasts', 'Review the stages of the fall feast cycle', () => open('fallFeasts')),
        row('Sukkot Count', 'Seven days of reflection', () => open('sukkotCount')),
        row('Omer Count', 'Forty-nine days of reflection toward Shavuot', () => open('omerCount')),
        row('Sacred Time and Biblical History', 'Explore the research timeline and its sources', () => open('sacredTime')),
        disclosure('Supplemental studies', text('These portions sit outside the regular 52-week study schedule.'), extra),
        link('Original calendar ↗', legacy + 'calendar.js'));
      frame.refresh = refresh;
      refresh();
    },
    async calendarEvent(target, { data }) {
      const schedules = await getCalendarSchedules();
      const model = modelFor(schedules, data.model);
      const event = eventsFor(schedules, model).find(item => item.id === data.event);
      if (!event) {
        target.append(text('This appointed time could not be found.'), button('Open Calendar', () => open('calendar', { model })));
        return;
      }
      const detail = schedules.eventDetails[event.id];
      target.append(node('h3', detail.title), text(`${model} · ${formatDate(event.start.slice(0, 10))}`, 'source-copy'),
        text(event.display), text(detail.body, 'source-copy'), passageLinks(detail.scripture.split('; ')),
        link('Original calendar ↗', legacy + 'calendar.js'));
    },
    async fallFeasts(target, frame) {
      const { dates, phases } = (await getCalendarSchedules()).fall;
      const detail = node('section', '', 'calendar-feature');
      detail.setAttribute('aria-live', 'polite');
      const sequence = node('ol', '', 'calendar-phases');
      function choose(phase) {
        frame.data.phase = phase;
        updateUrl(frame);
        refresh();
      }
      const controls = seasons.map(([id, date, display]) => {
        const item = node('li');
        const control = row(display, date ? formatDate(dates[date]) : 'Before ' + formatDate(dates.YOM_TERUAH), () => choose(id));
        item.append(control);
        sequence.append(item);
        return [id, control];
      });
      const follow = button('Follow the 2026 cycle', () => choose(''), 'pill');
      let rendered;
      function refresh() {
        const today = dateKey(new Date());
        const actual = seasons.findLast(([, boundary]) => !boundary || dates[boundary] <= today)[0];
        const selected = Object.hasOwn(phases, frame.data.phase) ? frame.data.phase : '';
        const phase = selected || actual;
        if (rendered === `${today}/${selected}`) return;
        rendered = `${today}/${selected}`;
        follow.setAttribute('aria-pressed', String(!selected));
        const content = phases[phase];
        const hebrew = text(content.hebrew, 'source-copy');
        Object.assign(hebrew, { lang: 'he', dir: 'rtl' });
        const upcoming = seasons.find(([, date]) => dates[date] > today);
        const countdown = [];
        if (!selected && upcoming) {
          const [, date, display] = upcoming;
          const days = daysBetween(today, dates[date]);
          countdown.push(text(`${days} day${days === 1 ? '' : 's'} until ${display.split(' / ')[0]}`));
        }
        detail.replaceChildren(node('h3', content.title), hebrew, text(content.meta), text(content.detail, 'source-copy'),
          text('Current phase · ' + content.current + ' / Next · ' + content.next), ...countdown,
          progress(content.progress, 100, 'Feast cycle progress'), ...meditation({
            title: content.meditationTitle, text: content.meditationText,
            prayer: 'Prayer: ' + content.meditationPrayer, scripture: 'Scripture thought: ' + content.meditationScripture,
          }, content.title));
        for (const [id, control] of controls) {
          if (id === phase) control.setAttribute('aria-current', 'true');
          else control.removeAttribute('aria-current');
        }
      }
      target.append(text('2026 Fall Feasts uses its own reference dates.'), cluster(follow), sequence, detail,
        row('Sukkot Count', 'Explore the seven days of the feast', () => open('sukkotCount')),
        link('Original Fall Feasts ↗', legacy + 'fallfeasts.js'));
      frame.refresh = refresh;
      refresh();
    },
    sukkotCount: (target, frame) => countView(target, frame, 'sukkot', 7),
    omerCount: (target, frame) => countView(target, frame, 'omer', 49),
    async sacredTime(target) {
      const { metadata, entries } = await getCalendar();
      const search = Object.assign(node('input'), { type: 'search', placeholder: 'Creation, Passover, Temple, Sinai' });
      const searchLabel = node('label', 'Search Sacred Time');
      searchLabel.append(search);
      const unique = selector => [...new Set(entries.flatMap(selector))].sort().map(value => [value, label(value)]);
      const category = field('Category', [['', 'All categories'], ...unique(entry => entry.category ?? [])]);
      const theme = field('Theme', [['', 'All themes'], ...unique(entry => entry.themes ?? [])]);
      const certainty = field('Certainty', [['', 'All certainty labels'], ...unique(certaintyValues)]);
      const status = text('');
      status.setAttribute('role', 'status');
      const results = node('div', '', 'calendar-results');
      const openEntries = new Set();
      let timeline = true;
      const timelineButton = button('Timeline', () => { timeline = true; refresh(); }, 'pill');
      const listButton = button('List', () => { timeline = false; refresh(); }, 'pill');
      const clear = button('Clear filters', () => {
        for (const control of [search, category.select, theme.select, certainty.select]) control.value = '';
        refresh();
      });
      function refresh() {
        const query = search.value.trim().toLowerCase();
        const matching = entries.filter(entry =>
          (!category.select.value || entry.category?.includes(category.select.value)) &&
          (!theme.select.value || entry.themes?.includes(theme.select.value)) &&
          (!certainty.select.value || certaintyValues(entry).includes(certainty.select.value)) &&
          (!query || JSON.stringify(entry).toLowerCase().includes(query)));
        timelineButton.setAttribute('aria-pressed', String(timeline));
        listButton.setAttribute('aria-pressed', String(!timeline));
        results.classList.toggle('calendar-timeline', timeline);
        status.textContent = `${matching.length} of ${entries.length} entries`;
        results.replaceChildren(...matching.map(entry => {
          const details = disclosure(entry.title, researchEntry(entry));
          details.firstElementChild.append(node('small', [dateSummary(entry), sourceLens(entry)].join(' · ')));
          details.open = openEntries.has(entry.id);
          details.addEventListener('toggle', () => {
            if (details.open) openEntries.add(entry.id);
            else openEntries.delete(entry.id);
          });
          return details;
        }));
        if (!matching.length) results.append(text('No entries match these filters.'));
      }
      search.addEventListener('input', refresh);
      for (const control of [category, theme, certainty]) control.select.addEventListener('change', refresh);
      const filters = node('div', '', 'calendar-filters');
      filters.append(category.wrapper, theme.wrapper, certainty.wrapper);
      target.append(text(metadata.editorial_warning), searchLabel, filters, cluster(timelineButton, listButton, clear),
        status, results, link('Original research view ↗', legacy + 'sacred-time-prototype.js'));
      refresh();
    },
  };
}
