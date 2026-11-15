import { getAssessmentQuestions, getTopicalTeachings } from './corpus.js';
import { articleLocation, articleUrl, speechControl } from './learning.js';

const chapterBooks = {
  '1corinthians': '1 Corinthians', '2corinthians': '2 Corinthians',
  '1peter': '1 Peter', '2peter': '2 Peter', '1timothy': '1 Timothy', '2timothy': '2 Timothy',
  '2thessalonians': '2 Thessalonians', acts: 'Acts', collosians: 'Colossians', ephesians: 'Ephesians',
  galatians: 'Galatians', james: 'James', philipians: 'Philippians', revelation: 'Revelation',
  romans: 'Romans', titus: 'Titus',
};

function groupQuestions(questions) {
  const books = new Map();
  for (const question of questions) {
    const match = /^(.+)-ch(\d+)$/i.exec(question.source);
    const book = chapterBooks[match?.[1].toLowerCase()] ?? question.source;
    const chapter = match?.[2] ?? '';
    if (!books.has(book)) books.set(book, new Map());
    const chapters = books.get(book);
    if (!chapters.has(chapter)) chapters.set(chapter, []);
    chapters.get(chapter).push(question);
  }
  return books;
}

export function createTopicalViews({ node, text, button, row, cluster, disclosure, open, importLegacy }) {
  function labeledSelect(label) {
    const field = node('label', label);
    const select = node('select');
    select.setAttribute('aria-label', label);
    field.append(select);
    return [field, select];
  }

  return {
    topicalTeachings(target) {
      target.append(
        row('Who Is Jesus?', 'Read Jesus: Son of man', () => open('jesus')),
        row('Origins', 'Explore the perspectives and original archive links', () => open('origins')),
      );
    },

    async jesus(target) {
      const { jesus } = await getTopicalTeachings();
      const article = importLegacy(jesus.reading, {
        decorate(original, copy) {
          if (original.id) copy.dataset.teachingAnchor = original.id;
        },
        anchor(original, copy) {
          const destination = new URLSearchParams(original.getAttribute('href'));
          const { file, anchor } = articleLocation(destination.get('file'));
          if (destination.get('card') !== 'articles' || !file) return;
          copy.href = articleUrl(file, anchor);
          copy.addEventListener('click', event => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            open('learningArticle', { file, anchor });
          });
        },
      });
      const spots = new Map([...article.querySelectorAll('[data-teaching-anchor]')]
        .map(section => [section.dataset.teachingAnchor, section]));
      const content = node('div', '', 'learning-article');
      const sections = cluster(...jesus.sections.map(({ id, label }) => button(label, () => {
        const section = spots.get(id);
        if (!section) return;
        const heading = section.querySelector('h3') ?? section;
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: 'start' });
      }, 'pill')));
      content.append(node('h3', 'Jesus: Son of man'), text(jesus.introduction, 'source-copy'),
        cluster(...speechControl(content, article, button, text, { canPause: true })),
        disclosure('Jump to a section', sections), article);
      target.append(content);
    },

    async origins(target) {
      const { origins, originsNotes } = await getTopicalTeachings();
      target.append(importLegacy(origins, {
        button(original) {
          const action = original.getAttribute('onclick');
          if (action === 'goDeeperOrigins()') return text('Further reading and audio were planned for this topic.');
          const key = /^openOriginsInfo\('(\w+)'\)$/.exec(action ?? '')?.[1];
          if (!key || !Object.hasOwn(originsNotes, key)) return null;
          const { title, html } = originsNotes[key];
          const label = key === 'overview' ? 'Quick overview' : 'Learn more';
          const control = button(label, () => open('originsDetail', { title, html }));
          control.setAttribute('aria-label', key === 'overview' ? label : label + ': ' + title);
          return control;
        },
      }));
    },

    originsDetail(target, { data }) {
      target.append(node('h3', data.title), importLegacy(data.html));
    },

    async assessments(target) {
      const books = groupQuestions(await getAssessmentQuestions());
      if (!books.size) {
        target.append(text('The question bank is empty.'));
        return;
      }
      const [bookField, bookPicker] = labeledSelect('Book');
      const [chapterField, chapterPicker] = labeledSelect('Chapter');
      bookPicker.append(...[...books.keys()].map(book => new Option(book, book)));
      const pickers = node('div', '', 'assessment-pickers');
      pickers.append(bookField, chapterField);
      let index = 0;
      const status = text('');
      status.setAttribute('role', 'status');
      const progress = node('progress');
      progress.setAttribute('aria-label', 'Position in the chapter set');
      const question = node('h3');
      const answer = node('div', '', 'assessment-answer');
      answer.id = 'assessment-answer';
      answer.hidden = true;
      const reveal = button('Reveal answer', () => {
        answer.hidden = !answer.hidden;
        reveal.setAttribute('aria-expanded', String(!answer.hidden));
        reveal.textContent = answer.hidden ? 'Reveal answer' : 'Hide answer';
      }, 'button primary');
      reveal.setAttribute('aria-controls', answer.id);
      const chapterLink = button('Read chapter', () => open('reader', { ref: bookPicker.value + ' ' + chapterPicker.value }));
      const previous = button('Previous question', () => { index--; render(); });
      const next = button('Next question', () => { index++; render(); });
      const source = text('');

      function render() {
        const items = books.get(bookPicker.value).get(chapterPicker.value);
        const item = items[index];
        progress.max = items.length;
        progress.value = index + 1;
        status.textContent = 'Question ' + (index + 1) + ' of ' + items.length;
        question.textContent = item.question;
        answer.replaceChildren(node('strong', 'Original answer'),
          text(item.answer.trim() || 'No answer was supplied for this question.', 'source-copy'));
        answer.hidden = true;
        reveal.textContent = 'Reveal answer';
        reveal.setAttribute('aria-expanded', 'false');
        source.textContent = 'Source · ' + bookPicker.value + (chapterPicker.value ? ' ' + chapterPicker.value : '');
        source.title = item.source;
        chapterLink.hidden = !chapterPicker.value || !Object.values(chapterBooks).includes(bookPicker.value);
        previous.disabled = index === 0;
        next.disabled = index >= items.length - 1;
      }

      function chooseBook() {
        chapterPicker.replaceChildren(...[...books.get(bookPicker.value).keys()].map(chapter =>
          new Option(chapter ? 'Chapter ' + chapter : 'Chapter unavailable', chapter)));
        index = 0;
        render();
      }
      bookPicker.addEventListener('change', chooseBook);
      chapterPicker.addEventListener('change', () => { index = 0; render(); });
      target.append(text('Practice questions from the original New Testament Notes. Recall an answer, then reveal the source answer to check yourself.'),
        pickers, progress, status, question, cluster(reveal, chapterLink), answer,
        source, cluster(previous, next));
      chooseBook();
    },
  };
}
