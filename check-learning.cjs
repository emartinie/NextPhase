
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');

const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');
const root = __dirname;
const server = createPreviewServer({ mount: pagesMount });

async function checkLanguageLab(phone, url, presentations) {
  await phone.goto(url + '?card=learning');
  await phone.locator('#learning-title').waitFor({ state: 'visible' });
  await phone.getByRole('button', { name: 'Resources', exact: true }).click();
  const dialog = phone.locator('dialog');
  const tap = label => dialog.getByRole('button', { name: label, exact: typeof label === 'string' }).click();
  const glyph = dialog.locator('.alphabet-glyph');
  await tap(/^Language Lab Practice/);
  await dialog.getByRole('heading', { name: 'Hebrew alphabet', exact: true }).waitFor();
  assert.equal(await glyph.textContent(), 'א');
  assert.equal(await dialog.locator('.alphabet-tile').count(), 22);
  await tap('Previous letter');
  assert.equal(await glyph.textContent(), 'ת');
  await tap('Next letter');
  await tap('Choose Kaf');
  assert.equal(await glyph.textContent(), 'כ/ך');
  await tap('Paleo-Hebrew');
  assert.equal(await glyph.textContent(), '𐤊');
  await dialog.getByText('Hebrew writing reference', { exact: true }).click();
  await dialog.getByText('Kaph · K / Kh', { exact: true }).waitFor();
  await tap('Play Alephbet song');
  await phone.waitForFunction(() => {
    const player = document.getElementById('audio');
    return player && player.readyState >= 1 && player.duration > 0 && !player.paused;
  });
  await tap('Greek');
  await dialog.getByRole('heading', { name: 'Greek alphabet', exact: true }).waitFor();
  assert.equal(await dialog.locator('.alphabet-tile').count(), 24);
  assert.equal(await phone.locator('audio').count(), 1);
  assert.ok(await phone.locator('#audio').evaluate(player => player.paused));
  await tap('Choose Sigma');
  assert.equal(await glyph.textContent(), 'Σ σ/ς');
  await dialog.getByText(/Transliteration · s.*Sound · s as in seed/).waitFor();
  const spoken = await phone.evaluate(() => window.learningSpeechCalls.starts);
  const stopped = await phone.evaluate(() => window.learningSpeechCalls.stops);
  await tap('Speak letter');
  assert.equal(await phone.evaluate(() => window.learningSpeechCalls.starts), spoken + 1);
  await tap('Hebrew');
  assert.equal(await phone.evaluate(() => window.learningSpeechCalls.stops), stopped + 1);
  assert.equal(await glyph.textContent(), '𐤊');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 390);
  await tap('Back');
  await dialog.getByRole('heading', { name: 'Learning resources', exact: true }).waitFor();
  await tap(/^Visual Teachings Browse/);
  await dialog.getByRole('heading', { name: presentations[0].title, exact: true }).waitFor();
  assert.equal(await dialog.locator('iframe').count(), 0);
  await tap('Back');
  await dialog.getByRole('heading', { name: 'Learning resources', exact: true }).waitFor();

}

async function checkVisualTeachings(desktop, url, presentations) {
  let requested = 0;
  await desktop.route('https://prezi.com/p/embed/**', route => {
    requested++;
    return route.fulfill({ contentType: 'text/html', body: '<h1>Local test presentation</h1>' });
  });
  await desktop.goto(url + '?card=prezis');
  const viewer = desktop.locator('dialog');
  const choose = name => viewer.getByRole('button', { name, exact: true });
  const heading = name => viewer.getByRole('heading', { name, exact: true }).waitFor();
  await heading(presentations[0].title);
  assert.equal(requested, 0);
  const firstSource = viewer.getByRole('link', { name: /Open in Prezi/ });
  assert.equal(await firstSource.getAttribute('href'), presentations[0].url);
  assert.ok(await choose('Previous presentation').isDisabled());
  await choose('Next presentation').click();
  await heading(presentations.filter(item => item.category === 'Teaching')[1].title);
  await choose('Previous presentation').click();
  await heading(presentations[0].title);
  await choose('Load Prezi player').click();
  await viewer.frameLocator('iframe').getByText('Local test presentation').waitFor();
  assert.equal(requested, 1);
  await viewer.getByLabel('Presentation category', { exact: true }).selectOption('Financial');
  await heading(presentations.find(item => item.category === 'Financial').title);
  assert.equal(await viewer.locator('iframe').count(), 0);
  assert.ok(await choose('Previous presentation').isDisabled());
  assert.ok(await choose('Next presentation').isDisabled());
  await viewer.getByLabel('Presentation category', { exact: true }).selectOption('Language');
  await viewer.getByText('Browse this category', { exact: true }).click();
  assert.equal(await viewer.locator('details .row').count(), 26);
  await choose('Load Prezi player').click();
  await viewer.frameLocator('iframe').getByText('Local test presentation').waitFor();
  await choose('Close').click();
  await viewer.waitFor({ state: 'hidden' });
  await viewer.locator('iframe').waitFor({ state: 'detached' });
  await desktop.goto(url + '?card=greekalphabet');
  await heading('Greek alphabet');
  await desktop.goto(url + '?card=alephbet');
  await heading('Hebrew alphabet');
}

async function checkTopicalTeachings(phone, url) {
  await phone.goto(url + '?card=learning');
  await phone.locator('#learning-title').waitFor({ state: 'visible' });
  await phone.getByRole('button', { name: 'Resources', exact: true }).click();
  const dialog = phone.locator('dialog');
  const tap = name => dialog.getByRole('button', { name, exact: typeof name === 'string' }).click();
  const heading = name => dialog.getByRole('heading', { name, exact: true }).waitFor();
  await tap(/^Topical Teachings/);
  await tap(/^Who Is Jesus\? Read/);
  await heading('Jesus: Son of man');
  await dialog.getByText('Jump to a section', { exact: true }).click();
  await tap('Family');
  assert.equal(await phone.evaluate(() => document.activeElement.textContent), 'He Had a Human Family');
  await tap('Read aloud');
  await tap('Pause reading');
  assert.equal(await phone.evaluate(() => window.learningSpeechCalls.pauses), 1);
  await tap('Resume reading');
  assert.equal(await phone.evaluate(() => window.learningSpeechCalls.resumes), 1);
  await dialog.getByRole('link', { name: 'Who Is Jesus?', exact: true }).click();
  await phone.waitForURL(/card=articles&file=who_is_jesus.html/);
  await phone.waitForFunction(() => window.learningSpeechCalls.stops === 2);
  await tap('Back');
  await heading('Jesus: Son of man');
  assert.equal(await phone.evaluate(() => document.activeElement.textContent.trim()), 'Who Is Jesus?');
  await tap('Back');
  await tap(/^Origins Explore/);
  await heading('Origins');
  const info = dialog.getByRole('button', { name: 'Learn more: Creation / Design Perspective', exact: true });
  await info.click();
  await heading('Creation / Design Perspective');
  await tap('Back');
  assert.equal(await phone.evaluate(() => document.activeElement.getAttribute('aria-label')),
    'Learn more: Creation / Design Perspective');
  assert.equal(await dialog.getByRole('link', { name: /British Museum/ }).getAttribute('href'),
    'https://www.britishmuseum.org/collection');
  await tap('Quick overview');
  await heading('Origins Overview');
  await tap('Back');
  await dialog.getByText('Further reading and audio were planned for this topic.', { exact: true }).waitFor();
  await tap('Back');
  await tap('Back');
  await dialog.getByRole('heading', { name: 'Learning resources', exact: true }).waitFor();
}

async function checkAssessments(page, url, questions) {
  await page.goto(url + '?card=quizzes');
  const dialog = page.locator('dialog');
  const tap = name => dialog.getByRole('button', { name, exact: true }).click();
  const book = dialog.getByLabel('Book', { exact: true });
  const chapter = dialog.getByLabel('Chapter', { exact: true });
  const answer = dialog.locator('.assessment-answer');
  const firstSet = questions.filter(item => item.source === '1corinthians-ch1');
  await dialog.getByRole('heading', { name: questions[0].question, exact: true }).waitFor();
  assert.equal(await book.locator('option').count(), 16);
  assert.equal(await book.inputValue(), '1 Corinthians');
  assert.equal(await chapter.inputValue(), '1');
  assert.ok(await dialog.getByRole('button', { name: 'Previous question', exact: true }).isDisabled());
  assert.ok(await answer.isHidden());
  await tap('Reveal answer');
  await answer.getByText('No answer was supplied for this question.', { exact: true }).waitFor();
  await tap('Next question');
  await dialog.getByRole('heading', { name: questions[1].question, exact: true }).waitFor();
  assert.ok(await answer.isHidden());
  await tap('Reveal answer');
  await answer.getByText(questions[1].answer, { exact: true }).waitFor();
  await tap('Read chapter');
  await dialog.locator('.verse').first().waitFor();
  assert.equal(await dialog.getByLabel('Scripture reference', { exact: true }).inputValue(), '1 Corinthians 1');
  await tap('Back');
  await dialog.getByText('Question 2 of ' + firstSet.length, { exact: true }).waitFor();
  assert.ok(await answer.isVisible());
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Read chapter');
  await book.selectOption('Colossians');
  assert.equal(await chapter.inputValue(), '1');
  await chapter.selectOption('2');
  const colossians = questions.filter(item => item.source === 'collosians-ch2');
  await dialog.getByRole('heading', { name: colossians[0].question, exact: true }).waitFor();
  for (let index = 1; index < colossians.length; index++) await tap('Next question');
  assert.ok(await dialog.getByRole('button', { name: 'Next question', exact: true }).isDisabled());
  assert.equal(await dialog.getByRole('progressbar').getAttribute('max'), String(colossians.length));
}

async function checkReferenceTools(phone, url) {
  const dialog = phone.locator('dialog');
  const tap = name => dialog.getByRole('button', { name, exact: typeof name === 'string' }).click();
  await phone.goto(url + '?card=sources');
  await dialog.getByText(/310 comparisons/).waitFor();
  await tap(/^Investigations Find published/);
  const search = dialog.getByLabel('Search investigations', { exact: true });
  await dialog.getByText('17 published investigations', { exact: true }).waitFor();
  await search.fill('three angels, with god distinguished');
  await tap(/^Two Powers in Heaven/);
  await dialog.getByRole('heading', { name: 'Three angels, with God distinguished' }).waitFor();
  await phone.waitForURL(/card=investigations&id=two-powers-in-heaven/);
  await tap('Back');
  assert.equal(await search.inputValue(), 'three angels, with god distinguished');
  await tap('Research backlog');
  await dialog.getByText('1,940 topics · showing 40', { exact: true }).waitFor();
  await tap('Show more topics');
  await dialog.getByText('1,940 topics · showing 80', { exact: true }).waitFor();
  const backlog = dialog.getByLabel('Search the research backlog', { exact: true });
  await backlog.fill('TOP-0001');
  await dialog.getByRole('heading', { name: 'How the Hebrew Bible Became the Hebrew Bible' }).waitFor();
  await dialog.getByLabel('Topic category').selectOption('scripture-text-and-canon');
  await dialog.getByText('1 topic · showing 1', { exact: true }).waitFor();
  await dialog.getByText('Research roadmap', { exact: true }).click();
  await dialog.getByText('Biblical References to Non-Canonical and Lost Sources · TOP-0033', { exact: true }).waitFor();

  await phone.goto(url + '?card=intertext-quotes&from=Matthew%201%3A23');
  await dialog.getByRole('heading', { name: 'Matthew 1:23', exact: true }).waitFor();
  await dialog.getByRole('heading', { name: 'Septuagint witness', exact: true }).waitFor();
  await tap('Open passage');
  await dialog.locator('.verse').first().waitFor();
  await tap('Back');
  await dialog.getByRole('heading', { name: 'Masoretic witness', exact: true }).waitFor();
  await dialog.getByLabel('New Testament book').selectOption('Jude');
  await dialog.getByLabel('Find a New Testament reference').fill('');
  await dialog.getByRole('heading', { name: 'Jude 1:9', exact: true }).waitFor();
  await phone.goto(url + '?card=scripture&ref=Matthew%2026%3A2');
  await dialog.getByRole('heading', { name: 'Greek transliteration', exact: true }).waitFor();
  await dialog.getByLabel('Passage reference').fill('Genesis 1:1');
  await tap('Compare verse');
  await dialog.getByText('The original collection has no sample for this reference.', { exact: true }).waitFor();
  await phone.goto(url + '?card=listen&id=hanukkah-trust');
  await dialog.getByRole('heading', { name: 'A Note on Trust, Hanukkah, and What I Believe' }).waitFor();
  await tap('Read aloud');
  await tap('Pause reading');
  await tap('Resume reading');
  await tap('Stop reading');
}

async function checkAncientLibrary(desktop, url) {
  await desktop.goto(url + '?card=ancient-library');
  const library = desktop.locator('dialog');
  const click = name => library.getByRole('button', { name, exact: typeof name === 'string' }).click();
  await library.getByText('18 catalog entries', { exact: true }).waitFor();
  await click(/^1 Enoch In-app reader/);
  await click('Begin reading');
  await library.getByRole('heading', { name: '1 Enoch · Chapter 1', exact: true }).waitFor();
  await click('Next chapter');
  await library.getByRole('heading', { name: '1 Enoch · Chapter 2', exact: true }).waitFor();
  await desktop.waitForURL(/chapter=2/);
  await library.getByText('Search this text', { exact: true }).click();
  await library.getByLabel('Search this volume or work', { exact: true }).fill('blessing of Enoch');
  await click(/^Chapter 1:1/);
  await desktop.waitForURL(/verse=1/);
  await desktop.waitForFunction(() => document.activeElement.dataset.verse === '1');
  await desktop.goto(url + '?card=ancient-library&book=josephus&work=antiquities&volume=book-2&chapter=1#al-verse-1');
  await library.locator('[data-verse="1"]').first().waitFor();
  assert.equal(await library.getByLabel('Volume', { exact: true }).inputValue(), 'book-2');
  await library.getByLabel('Volume', { exact: true }).selectOption('book-3');
  await desktop.waitForURL(/volume=book-3/);
  await library.getByRole('heading', { name: 'Book 3 · Chapter 1', exact: true }).waitFor();
  await click('Back');
  await library.getByRole('heading', { name: 'Book 2 · Chapter 1', exact: true }).waitFor();
  assert.equal(await library.getByLabel('Volume', { exact: true }).inputValue(), 'book-2');
  await desktop.goto(url + '?card=ancient-library&book=shepherd-hermas&chapter=101&verse=3');
  const lastHermas = library.locator('[data-verse="3"]');
  await lastHermas.waitFor();
  assert.match(await lastHermas.textContent(), /back again to my house/);
  assert.doesNotMatch(await lastHermas.textContent(), /Go to the Chronological List|buy the CD/i);
  await desktop.goto(url + '?card=ancient-library&book=psalms-solomon&chapter=18&verse=4');
  const lastPsalm = library.locator('[data-verse="4"]');
  await lastPsalm.waitFor();
  assert.match(await lastPsalm.textContent(), /command of His servants/);
  assert.doesNotMatch(await lastPsalm.textContent(), /Wesley Center|What is Wesleyanism/);
  await library.getByText('About this edition', { exact: true }).click();
  await library.getByText(/Copyright 2000 by the Wesley Center for Applied Theology/).waitFor();
}

async function run() {
  const local = file => path.join(root, 'corpus', 'learning', file);
  const index = JSON.parse(await fs.readFile(local('index.json'), 'utf8'));
  const reference = file => path.join(root, 'corpus', 'reference', file);
  const backlog = JSON.parse(await fs.readFile(reference('backlog.json'), 'utf8'));
  assert.deepEqual([backlog.topics.length, backlog.categories.length, backlog.roadmap.length], [1940, 25, 15]);
  assert.equal(JSON.parse(await fs.readFile(reference('intertext.json'), 'utf8')).length, 310);
  const library = JSON.parse(await fs.readFile(reference('ancient-library/catalog.json'), 'utf8'));
  assert.equal(library.items.length, 18);
  const manifests = await fs.readdir(reference('ancient-library'), { recursive: true });
  assert.equal(manifests.filter(file => file.endsWith('.json')).length, 120);
  const topics = JSON.parse(await fs.readFile(local('topical.json'), 'utf8'));
  assert.equal(topics.jesus.sections.length, 6);
  assert.equal(Object.keys(topics.originsNotes).length, 5);
  const questions = JSON.parse(await fs.readFile(local('nt-questions.json'), 'utf8'));
  assert.equal(questions.length, 2144);
  assert.equal(new Set(questions.map(question => question.id)).size, 2144);
  assert.equal(new Set(questions.map(question => question.source)).size, 140);
  assert.equal(questions.filter(question => !question.answer.trim()).length, 2);
  const alphabet = JSON.parse(await fs.readFile(local('alphabets.json'), 'utf8'));
  assert.equal(alphabet.hebrew.length, 22);
  assert.equal(alphabet.writing.length, 22);
  assert.equal(alphabet.greek.length, 24);
  assert.ok(alphabet.hebrew.every(letter => letter.paleo));
  const song = await fs.readFile(local('alephbet-song.mp3'));
  assert.equal(createHash('sha1').update('blob ' + song.length + '\0').update(song).digest('hex'),
    'abd8c4eae27aca2bc6161590a039b1e64d8b5090');
  const { presentations } = JSON.parse(await fs.readFile(local('presentations.json'), 'utf8'));
  assert.equal(presentations.length, 75);
  assert.equal(new Set(presentations.map(item => item.url)).size, 73);
  assert.deepEqual(Object.fromEntries(['Teaching', 'Community', 'Financial', 'Language'].map(category =>
    [category, presentations.filter(item => item.category === category).length])),
  { Teaching: 23, Community: 25, Financial: 1, Language: 26 });
  assert.equal(index.articles.length, 32);
  assert.equal(new Set(index.articles.map(article => article.file)).size, 32);
  let speechControls = 0;
  for (const article of index.articles) {
    const data = JSON.parse(await fs.readFile(local('articles/' + article.file.replace('.html', '.json')), 'utf8'));
    assert.ok(data.html.trim().length > 500, article.file);
    if (data.html.includes('SpeechSynthesisUtterance')) speechControls++;
  }
  assert.equal(speechControls, 4);
  assert.deepEqual(index.journeys.filter(journey => journey.available).map(journey => journey.id), ['who-was-paul']);
  const ds = JSON.parse(await fs.readFile(local('journeys/who-was-paul.json'), 'utf8'));
  assert.equal(ds.steps.length, 10);
  assert.equal(new Set(ds.steps.map(step => step.id)).size, 10);
  assert.ok(ds.steps.every(step => step.reflection.length));
  assert.ok(ds.steps.every(step => index.articles.some(article => article.file === step.article)));
  const url = await startPagesCheck(server);
  const browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined,
    args: ['--disable-gpu', '--disk-cache-size=1048576', '--media-cache-size=1048576'] });
  try {
    const phone = await browser.newPage({ ...devices['iPhone 13'] });
    phone.setDefaultTimeout(8000);
    const errs = [];
    const foreign = [];
    phone.on('pageerror', error => errs.push(error.message));
    phone.on('request', req => { if (req.url().startsWith('https://')) foreign.push(req.url()); });
    await phone.addInitScript(() => {
      window.learningSpeechCalls = { starts: 0, stops: 0, pauses: 0, resumes: 0 };
      window.speechSynthesis.speak = () => { window.learningSpeechCalls.starts++; };
      window.speechSynthesis.cancel = () => { window.learningSpeechCalls.stops++; };
      window.speechSynthesis.pause = () => { window.learningSpeechCalls.pauses++; };
      window.speechSynthesis.resume = () => { window.learningSpeechCalls.resumes++; };
    });
    const dialog = phone.locator('dialog');
    const tap = async name => {
      const scope = await dialog.isVisible() ? dialog : phone;
      await scope.getByRole('button', { name, exact: typeof name === 'string' }).click();
    };
    const heading = name => dialog.getByRole('heading', { name, exact: true }).waitFor();
    const copy = text => dialog.getByText(text, { exact: true }).waitFor();
    await phone.goto(url + '?week=6');
    await phone.locator('#study-title').waitFor();
    await tap('Tools');
    await tap(/^Learning Hub/);
    await phone.locator('#learning-title').waitFor({ state: 'visible' });
    await tap('Resources');
    await heading('Learning resources');
    await tap(/^Articles Browse or search/);
    await copy('32 articles');
    const articlesSearch = dialog.getByLabel('Search articles', { exact: true });
    await articlesSearch.fill('prodigal');
    await copy('1 article');
    await tap(/^The Prodigal Son$/);
    await phone.waitForURL(/file=the_prodigal_son.html/);
    await dialog.locator('.learning-article .legacy-text').waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth), 390);
    await tap('Back');
    assert.equal(await articlesSearch.inputValue(), 'prodigal');
    assert.equal(await phone.evaluate(() => document.activeElement.textContent), 'The Prodigal Son›');

    await tap('Back');
    await tap(/^Learning Paths Guided/);
    await dialog.getByText('Other paths in the original index', { exact: true }).click();
    for (const name of ['Learn to Pray', '27 Things', 'Ladder of Jacob', 'Yeshua Red Letter Patterns']) await copy(name);
    await tap(/^Who Was Paul\? Read/);
    await heading(ds.steps[0].title);
    await copy('0 of 10 steps completed');
    await dialog.getByText('Reflection prompts', { exact: true }).click();
    await copy(ds.steps[0].reflection[0]);
    await tap('Open the full teaching');
    await phone.waitForURL(/card=articles&file=who_was_paul.html/);
    await dialog.locator('.legacy-text [data-article-anchor="trustArticle"]').waitFor();
    await tap('Read aloud');
    await copy('Reading using your device voice.');
    assert.equal(await phone.evaluate(() => window.learningSpeechCalls.starts), 1);
    await tap('Back');
    await heading(ds.steps[0].title);
    await copy(ds.steps[0].reflection[0]);
    assert.equal(await phone.evaluate(() => document.activeElement.textContent), 'Open the full teaching');
    await phone.waitForFunction(() => window.learningSpeechCalls.stops === 2);

    await tap('Next step');
    await heading(ds.steps[1].title);
    await tap('Complete & continue');
    await heading(ds.steps[2].title);
    await copy('1 of 10 steps completed');
    await phone.reload();
    await heading(ds.steps[2].title);
    await copy('1 of 10 steps completed');
    for (let i = 2; i < 10; i++) {
      await heading(ds.steps[i].title);
      await tap('Complete & continue');
    }
    await heading(ds.steps[0].title);
    await copy('9 of 10 steps completed');
    await tap('Complete & continue');
    await heading('Journey complete');
    await copy('10 of 10 steps completed');
    await tap('Review steps');
    await heading(ds.steps[0].title);
    await copy('Step 1 of 10 · Completed');
    await tap('Next step');
    await heading(ds.steps[1].title);
    await tap('Restart path');
    await heading('Restart this path?');
    await tap('Keep progress');
    await copy('10 of 10 steps completed');
    await tap('Restart path');
    await tap('Restart and clear progress');
    await heading(ds.steps[0].title);
    await copy('0 of 10 steps completed');
    await tap('Close');
    await dialog.waitFor({ state: 'hidden' });
    assert.match(phone.url(), /week=6/);
    assert.equal(await phone.evaluate(() => document.querySelector('#stage').dataset.face), 'study');
    assert.deepEqual(errs, []);
    assert.deepEqual(foreign, []);
    await phone.goto(url + '?card=articles&file=who_was_paul.html');
    await tap('Read aloud');
    await tap('Close');
    await phone.waitForFunction(() => window.learningSpeechCalls.stops === 2);

    await checkLanguageLab(phone, url, presentations);
    await checkTopicalTeachings(phone, url);
    await checkAssessments(phone, url, questions);
    await checkReferenceTools(phone, url);
    await phone.close();

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    desktop.setDefaultTimeout(8000);
    await desktop.goto(url + '?card=articles&file=the_Book_of_revelation_hebrew_roots.html');
    await desktop.getByRole('heading', { name: 'The Hebrew Roots of Revelation', exact: true }).waitFor();
    await desktop.waitForURL(/the_book_of_revelation_hebrew_roots.html/);
    assert.ok(await desktop.locator('.learning-article a[href*="wp.com"]').count() > 0);
    assert.equal(await desktop.locator('.learning-article script, .learning-article img, .learning-article iframe').count(), 0);
    await desktop.goto(url + '?card=articles&file=who_was_paul.html%23trustArticle');
    await desktop.waitForFunction(() => document.activeElement?.dataset.articleAnchor === 'trustArticle');
    await desktop.reload();
    await desktop.waitForFunction(() => document.activeElement?.dataset.articleAnchor === 'trustArticle');
    await desktop.goto(url + '?card=discipleship&journey=learn-to-pray');
    await desktop.getByText('Learn to Pray is unavailable in the original app.', { exact: true }).waitFor();
    await desktop.goto(url + '?card=articles&file=unavailable.html');
    await desktop.getByText('This article is not in the migrated catalog.', { exact: true }).waitFor();
    await desktop.keyboard.press('Escape');
    await desktop.locator('dialog').waitFor({ state: 'hidden' });
    await checkVisualTeachings(desktop, url, presentations);
    await checkAssessments(desktop, url, questions);
    await checkAncientLibrary(desktop, url);
    await desktop.close();
  } finally {
    await browser.close();
  }
  console.log('Learning passed on phone-sized and desktop Chromium: original assets, Learning Paths, alphabets, presentation controls, topical teachings, assessments, full-text research and backlog, intertext, sample verses, Listen, and Ancient Library chapter, verse, and volume navigation.');
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
