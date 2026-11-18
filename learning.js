
import { getLearningIndex, getLearningArticle, getLearningJourney, webUrl } from './corpus.js';

const progressKey = 'nextphase-learning-paths-v1';
const legacyProgressKey = 'hg:discipleship:v1';
const originalArticles = 'https://github.com/emartinie/HGBibleApp/blob/';

export function articleLocation(value) {
  const [file, ...parts] = String(value ?? '').split('#');
  const name = file.replace(/^\.?\/?(?:articles\/)?/i, '').toLowerCase();
  if (!/^[a-z0-9_-]+\.html$/.test(name)) return { file: '' };
  const fragment = parts.join('#');
  try {
    return { file: name, anchor: decodeURIComponent(fragment) };
  } catch {
    return { file: name, anchor: fragment };
  }
}

function readProgress(id) {
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey));
    if (saved?.version === 1 && saved.journeyId === id) return saved;
    const legacy = JSON.parse(localStorage.getItem(legacyProgressKey));
    if (legacy?.version === 1 && legacy.journeyId === id) return legacy;
  } catch {
    // The journey is usable when saved data is absent or unreadable.
  }
  return {};
}

function saveProgress(id, currentStepIndex, completedSteps) {
  try {
    localStorage.setItem(progressKey, JSON.stringify({ version: 1, journeyId: id, currentStepIndex, completedSteps }));
    return true;
  } catch {
    return false;
  }
}

export function articleUrl(file, anchor) {
  const url = new URL(location.pathname, location.origin);
  const current = new URLSearchParams(location.search);
  for (const key of ['week', 'study', 'face', 'workspace', 'learningFace', 'learningTopic', 'preparednessFace', 'pilot']) if (current.has(key)) url.searchParams.set(key, current.get(key));
  url.searchParams.set('card', 'articles');
  url.searchParams.set('file', file + (anchor ? '#' + encodeURIComponent(anchor) : ''));
  return url.href;
}

export function speechControl(content, article, button, text, { canPause = false } = {}) {
  const status = text('');
  status.setAttribute('role', 'status');
  const speech = window.speechSynthesis;
  if (!speech || typeof window.SpeechSynthesisUtterance !== 'function') {
    return [text('Read aloud is unavailable in this browser.')];
  }

  let reading = null;
  let paused = false;
  let observer;
  const pause = canPause && typeof speech.pause === 'function' && typeof speech.resume === 'function' ? button('Pause reading', () => {
    if (!reading) return;
    paused = !paused;
    if (paused) speech.pause();
    else speech.resume();
    pause.textContent = paused ? 'Resume reading' : 'Pause reading';
    status.textContent = paused ? 'Reading paused.' : 'Reading using your device voice.';
  }) : null;
  if (pause) pause.disabled = true;

  function reset() {
    reading = null;
    paused = false;
    observer?.disconnect();
    start.textContent = 'Read aloud';
    if (pause) {
      pause.disabled = true;
      pause.textContent = 'Pause reading';
    }
  }
  const start = button('Read aloud', () => {
    if (reading) {
      reset();
      speech.cancel();
      status.textContent = 'Reading stopped.';
      return;
    }
    const articleText = (article.querySelector('[data-article-anchor="trustArticle"]') ?? article).innerText;
    const chunks = articleText.trim().match(/[\s\S]{1,260}(?:\s|$)|\S+/g);
    if (!chunks?.length) {
      status.textContent = 'There is no text to read.';
      return;
    }
    const current = { index: 0 };
    reading = current;
    start.textContent = 'Stop reading';
    if (pause) pause.disabled = false;
    status.textContent = 'Reading using your device voice.';
    const dialog = content.closest('dialog');
    observer = new MutationObserver(() => {
      if (!content.isConnected || !dialog?.open) {
        reset();
        speech.cancel();
      }
    });
    if (dialog) observer.observe(dialog, { attributes: true, attributeFilter: ['open'], childList: true, subtree: true });
    speech.cancel();
    function speakNext() {
      if (reading !== current) return;
      if (current.index === chunks.length) {
        reset();
        status.textContent = 'Reading complete.';
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[current.index++]);
      utterance.lang = 'en';
      utterance.rate = .85;
      utterance.onend = speakNext;
      utterance.onerror = () => {
        if (reading !== current) return;
        reset();
        status.textContent = 'The device voice could not read this article.';
      };
      speech.speak(utterance);
    }
    speakNext();
  });
  return pause ? [start, pause, status] : [start, status];
}

export function createLearningViews({ node, text, button, row, cluster, disclosure, link, open, importLegacy }) {
  function showArticle(file, anchor = '') {
    open('learningArticle', { file, anchor });
  }

  return {
    learning(target) {
      target.append(
        row('Learning Paths', 'Guided reading, reflection, and progress', () => open('learningPaths')),
        row('Articles', 'Browse or search the original collection', () => open('learningArticles')),
        row('Language Lab', 'Practice the Hebrew and Greek alphabets', () => open('languageLab')),
        row('Visual Teachings', 'Browse the original Prezi presentations', () => open('visualTeachings')),
        row('Topical Teachings', 'Who Is Jesus? and Origins', () => open('topicalTeachings')),
        row('Assessments', 'Practice questions from New Testament Notes', () => open('assessments')),
        row('Teachers & Scholars', 'Profiles, teaching archives and debates', () => open('people')),
        row('Sources Library', 'Compare witnesses and browse the Ancient Library', () => open('sourcesLibrary')),
        row('Listen', 'Read or hear the original sample shelf', () => open('listenShelf')),
        row('Investigations', 'Search published HomeGroups research', () => open('research')));
    },

    async learningArticles(target) {
      const { articles } = await getLearningIndex();
      const field = node('label', 'Search articles');
      const search = node('input');
      search.type = 'search';
      search.placeholder = 'Article title';
      field.append(search);
      const status = text('', 'source-copy');
      status.setAttribute('role', 'status');
      const results = node('div', '', 'rows');
      function render() {
        const query = search.value.trim().toLowerCase();
        const matches = articles.filter(({ title, file }) => (title + ' ' + file).toLowerCase().includes(query));
        status.textContent = matches.length ? matches.length + (matches.length === 1 ? ' article' : ' articles') : 'No matching articles.';
        results.replaceChildren(...matches.map(({ title, file }) => row(title, '', () => showArticle(file))));
      }
      search.addEventListener('input', render);
      target.append(field, status, results);
      render();
    },

    async learningArticle(target, { data }) {
      const { articles, revision } = await getLearningIndex();
      const selected = articles.find(item => item.file === data.file);
      if (!selected) {
        target.append(text('This article is not in the migrated catalog.'),
          button('Browse Articles', () => open('learningArticles')));
        return;
      }
      const { html } = await getLearningArticle(selected.file);
      const content = node('div', '', 'learning-article');
      const body = importLegacy(html, {
        decorate(original, copy) {
          const named = original.id || (original.localName === 'a' ? original.getAttribute('name') : '');
          if (named) copy.dataset.articleAnchor = named;
          if (original.localName === 'td' || original.localName === 'th') {
            for (const span of ['colspan', 'rowspan']) {
              const value = Number(original.getAttribute(span));
              if (Number.isInteger(value) && value > 1 && value <= 100) copy.setAttribute(span, String(value));
            }
          }
        },
        anchor(original, copy) {
          const href = original.getAttribute('href');
          if (!href) return;
          const destination = articleLocation(href.startsWith('#') ? selected.file + href : href);
          if (destination.file && articles.some(item => item.file === destination.file)) {
            copy.href = articleUrl(destination.file, destination.anchor);
            copy.addEventListener('click', event => {
              if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              showArticle(destination.file, destination.anchor);
            });
            return;
          }
          const value = webUrl(href) || (href.startsWith('//') ? webUrl('https:' + href) : '');
          if (value) Object.assign(copy, { href: value, target: '_blank', rel: 'noopener noreferrer' });
          else if (/^mailto:[^\s]+$/i.test(href)) copy.href = href;
        },
        image(original) {
          const source = webUrl(original.getAttribute('src'));
          return source ? link((original.getAttribute('alt')?.trim() || 'Original article image') + ' ↗', source) : null;
        },
      });
      const source = link('Source article ↗', originalArticles + revision + '/articles/' + selected.file);
      content.append(node('h3', selected.title), cluster(source,
        ...(html.includes('SpeechSynthesisUtterance') ? speechControl(content, body, button, text) : [])), body);
      target.append(content);
      if (data.anchor) {
        const anchor = [...body.querySelectorAll('[data-article-anchor]')].find(item => item.dataset.articleAnchor === data.anchor);
        requestAnimationFrame(() => {
          if (!content.isConnected || !anchor) return;
          anchor.tabIndex = -1;
          anchor.focus({ preventScroll: true });
          anchor.scrollIntoView({ block: 'start' });
        });
      }
    },

    async learningPaths(target) {
      const { journeys } = await getLearningIndex();
      const future = journeys.filter(journey => !journey.available).map(journey => {
        const item = node('li', journey.title);
        return item;
      });
      const list = node('ul', '', 'learning-prompts');
      list.append(...future);
      target.append(text('Choose a guided series. Your place is saved in this browser.'),
        ...journeys.filter(journey => journey.available).map(({ title, id }) =>
          row(title, 'Read, reflect, and continue where you left off', () => open('learningJourney', { journey: id }))),
        disclosure('Other paths in the original index', text('The legacy chooser marks these paths unavailable.'), list));
    },

    async learningJourney(target, { data }) {
      const index = await getLearningIndex();
      const entry = index.journeys.find(item => item.id === data.journey);
      if (!entry?.available) {
        target.append(text(entry ? entry.title + ' is unavailable in the original app.' : 'This path is not in the original index.'),
          button('Browse Learning Paths', () => open('learningPaths')));
        return;
      }
      const journey = await getLearningJourney(entry.file);
      const steps = journey.steps ?? [];
      if (!steps.length) {
        target.append(text('No steps were found for this path.'));
        return;
      }

      const saved = readProgress(entry.id);
      const completed = new Set((Array.isArray(saved.completedSteps) ? saved.completedSteps : [])
        .filter(id => steps.some(step => step.id === id)));
      let current = Number.isInteger(saved.currentStepIndex) ? Math.min(steps.length - 1, Math.max(0, saved.currentStepIndex)) : 0;
      let reviewing = false;
      let confirming = false;
      const progress = node('progress');
      progress.max = steps.length;
      progress.setAttribute('aria-label', 'Journey completion');
      const progressText = text('', 'source-copy');
      progressText.setAttribute('role', 'status');
      const status = text('');
      status.setAttribute('role', 'status');
      const main = node('section', '', 'learning-stack');

      function persist(message = '') {
        const ok = saveProgress(entry.id, current, [...completed]);
        status.textContent = ok ? message : 'Browser storage is unavailable. Progress lasts for this view.';
      }
      function update(focus = true) {
        persist();
        render(focus);
      }
      function stepTo(i) {
        current = i;
        update();
      }
      function markComplete() {
        completed.add(steps[current].id);
        if (completed.size < steps.length) {
          const next = steps.findIndex((step, index) => index > current && !completed.has(step.id));
          current = next >= 0 ? next : steps.findIndex(step => !completed.has(step.id));
        }
        update();
      }
      function restart() {
        completed.clear();
        current = 0;
        reviewing = false;
        confirming = false;
        update();
      }
      function render(focus) {
        progress.value = completed.size;
        progressText.textContent = completed.size + ' of ' + steps.length + ' steps completed';
        const finished = completed.size === steps.length;
        const step = steps[current];
        const heading = node('h3', finished && !reviewing ? 'Journey complete' : step.title);
        heading.tabIndex = -1;
        main.replaceChildren();
        if (finished && !reviewing) {
          main.append(heading, text('All steps are complete. Revisit any teaching or reflection.'),
            button('Review steps', () => {
              reviewing = true;
              stepTo(0);
            }, 'button primary'));
        } else {
          const prompts = node('ul', '', 'learning-prompts');
          prompts.append(...(step.reflection ?? []).map(prompt => node('li', prompt)));
          const previous = button('Previous step', () => stepTo(current - 1));
          const next = button('Next step', () => stepTo(current + 1));
          previous.disabled = current === 0;
          next.disabled = current === steps.length - 1;
          main.append(text('Step ' + (current + 1) + ' of ' + steps.length +
            (completed.has(step.id) ? ' · Completed' : ''), 'eyebrow'), heading, text(step.summary, 'source-copy'));
          if (step.content) main.append(importLegacy(step.content));
          if (step.article) {
            const { file, anchor } = articleLocation(step.article);
            main.append(button('Open the full teaching', () => showArticle(file, anchor)));
          }
          if (prompts.children.length) main.append(disclosure('Reflection prompts', prompts));
          main.append(cluster(previous, next, finished ?
            button('View completion', () => { reviewing = false; render(true); }, 'button primary') :
            button(completed.has(step.id) ? 'Continue' :
              current === steps.length - 1 && completed.size === steps.length - 1 ? 'Complete journey' : 'Complete & continue',
            markComplete, 'button primary')));
        }
        if (confirming) {
          const heading = node('h4', 'Restart this path?');
          heading.tabIndex = -1;
          main.append(heading, text('This clears saved completion and returns to step 1.'),
            cluster(button('Restart and clear progress', restart), button('Keep progress', () => { confirming = false; render(true); })));
          if (focus) heading.focus();
        } else {
          if (completed.size || current > 0) main.append(button('Restart path', () => { confirming = true; render(true); }, 'quiet'));
          if (focus) heading.focus();
        }
      }

      target.append(node('h3', journey.title), text(journey.description, 'source-copy'),
        text([journey.category, journey.difficulty, journey.estimatedTime].filter(Boolean).join(' · ')),
        progress, progressText, status, main);
      persist();
      render(false);
    },
  };
}
