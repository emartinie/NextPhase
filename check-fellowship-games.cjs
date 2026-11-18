const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');

const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');
const root = __dirname;
const server = createPreviewServer({ mount: pagesMount });

async function checkRules() {
  const rules = await import('./game-rules.js');
  const records = JSON.parse(await fs.readFile(path.join(root, 'corpus/games/bible_questions_with_hints.json'), 'utf8'));
  assert.equal(records.length, 1001);
  const trivia = rules.triviaRound(records);
  assert.equal(new Set(trivia.questions.map(({ question }) => question.trim().toLowerCase())).size, 5);
  assert.ok(trivia.questions.every((question) => question.hint && question.answer));
  assert.equal(rules.scoreTrivia(trivia, true), false);
  for (let i = 0; i < 5; i++) {
    trivia.revealed = true;
    assert.equal(rules.scoreTrivia(trivia, i < 3), true);
  }
  assert.equal(rules.triviaScore(trivia).yours, 3);
  assert.equal(rules.scoreTrivia(trivia, true), false);
  const bingo = rules.bingoRound();
  assert.equal(new Set(bingo.deck).size, 75);
  assert.equal(bingo.yours[12], 0);
  for (const card of [bingo.yours, bingo.theirs]) {
    assert.equal(new Set(card).size, 25);
    card.forEach((number, index) => {
      if (index !== 12) assert.equal(Math.floor((number - 1) / 15), index % 5);
    });
  }
  assert.equal(rules.claimBingo(bingo), false);
  assert.equal(rules.markBingo(bingo, bingo.yours[0]), false);
  const row = bingo.yours.slice(0, 5);
  const canClaim = { ...bingo, calls: row, marks: row, theirs: [...bingo.yours].reverse() };
  assert.equal(rules.claimBingo(canClaim), true);
  assert.equal(canClaim.outcome, 'tie');
  const winner = { ...bingo, calls: row, marks: row, theirs: bingo.theirs.map(value => value ? -value : 0) };
  assert.equal(rules.claimBingo(winner), true);
  assert.equal(winner.outcome, 'you');
  let calls = 0;
  while (rules.drawBingo(bingo)) calls++;
  assert.ok(calls <= 75);
  assert.equal(rules.opponentHasBingo(bingo), true);
  assert.equal(rules.finishBingoTurn(bingo), true);
  assert.equal(bingo.outcome, 'opponent');
}

async function run() {
  await checkRules();
  const url = await startPagesCheck(server);
  const browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined });
  try {
    const phone = await browser.newPage({ ...devices['iPhone 13'] });
    phone.setDefaultTimeout(8000);
    const errors = [];
    phone.on('pageerror', error => errors.push(error.message));
    await phone.route('**/bible_questions_with_hints.json', route => route.fulfill({ json: Array.from({ length: 5 }, (_, index) =>
      ({ id: index + 1, question: 'Test question ' + (index + 1), hint: 'Genesis 1:1', answer: 'Source answer ' + (index + 1) })) }));
    const tap = (name) => phone.getByRole('button', { name, exact: true }).click();
    const dialog = phone.locator('dialog');
    const goGames = async () => { await tap('Fellowship actions'); await phone.getByRole('button', { name: /^Invite to Game/ }).click(); };
    const send = async (member, type) => {
      await phone.getByLabel('Participant').selectOption(member);
      await phone.getByLabel('Game', {exact:true}).selectOption(type);
      await tap('Send demo invitation');
      await phone.getByText(/Invitation pending/).waitFor();
    };
    await phone.goto(url + '?face=fellowship&week=6');
    await phone.getByText('Try the local discussion demo', { exact: true }).click();
    const reply = phone.locator('#fellowship').getByLabel('Reply', { exact:true });
    await reply.fill('This Fellowship draft should survive.');
    await goGames();
    const fellowshipTop = await phone.locator('#fellowship').evaluate(el => el.scrollTop);
    await phone.getByText(/Local demo · invitations and turns/).waitFor();
    await send('miriam', 'trivia');
    await tap('Decline invite');
    await phone.getByText(/Miriam Ellis declined/).waitFor();
    await tap('Back to invitations');
    await phone.getByRole('button', {name:/Miriam Ellis Declined/}).waitFor();

    await send('daniel', 'trivia');
    await tap('Accept invite');
    await phone.getByText('Question 1 of 5', {exact:true}).waitFor();
    await tap('Show hint');
    await tap('Read hint · Genesis 1:1');
    await phone.locator('[data-reference="Genesis 1:1"]').waitFor();
    await phone.goBack();
    await phone.getByText('Question 1 of 5', {exact:true}).waitFor();
    await phone.getByLabel('Your answer (optional)').fill('My guess');
    await tap('Reveal answer');
    await phone.getByText('Your answer · My guess', {exact:true}).waitFor();
    await tap('I got it right');
    await phone.getByText('Question 2 of 5', {exact:true}).waitFor();
    await tap('Close');
    await dialog.waitFor({state:'hidden'});
    assert.equal(await reply.inputValue(),'This Fellowship draft should survive.');
    assert.equal(await phone.locator('#fellowship').evaluate(el => el.scrollTop),fellowshipTop);
    assert.equal(await phone.evaluate(() => document.activeElement.id), 'fellowship-more');
    await phone.reload();
    await goGames();
    await phone.getByRole('button', {name:/Daniel Brooks In progress/}).click();
    await phone.getByText('Question 2 of 5', {exact:true}).waitFor();
    for (let round=2; round<=5; round++) {
      await tap('Reveal answer');
      await tap(round === 2 ? 'I missed it' : 'I got it right');
    }
    await phone.locator('.game-result').waitFor();
    const score = await phone.locator('.game-score').textContent();
    assert.match(score, /^You 4 · Daniel Brooks [0-5]$/);
    await phone.getByText('Review the five answers', {exact:true}).click();
    assert.equal(await phone.locator('.game-recap li').count(),5);
    await tap('Back to invitations');
    await phone.getByRole('button', {name:/Daniel Brooks Completed/}).waitFor();

    await send('miriam', 'bingo');
    await tap('Accept invite');
    await phone.getByText('Ready to draw', {exact:true}).waitFor();
    assert.equal(await phone.locator('.game-board .game-cell').count(), 25);
    assert.equal(await phone.locator('button.game-cell:disabled').count(), 24);
    if (process.env.NEXTPHASE_SCREENSHOTS) await phone.screenshot({path:path.join(process.env.NEXTPHASE_SCREENSHOTS,'nextphase-fellowship-bingo.png')});
    for (let round=0; round<75; round++) {
      if (await phone.locator('.game-result').count()) break;
      const draw = phone.getByRole('button',{name:'Draw next number',exact:true});
      if (await draw.count()) await draw.click();
      const toMark = phone.locator('button.game-cell:enabled[aria-pressed=false]');
      while (await toMark.count()) {
        const square = toMark.first();
        const index = await square.getAttribute('data-cell');
        await square.click();
        assert.equal(await phone.locator('[data-cell="' + index + '"]').getAttribute('aria-pressed'),'true');
      }
      const claim = phone.getByRole('button',{name:'Call Bingo',exact:true});
      const finish = phone.getByRole('button',{name:'Finish turn',exact:true});
      if (await claim.isEnabled()) await claim.click();
      else if (await finish.count()) await finish.click();
    }
    await phone.locator('.game-result').waitFor();
    assert.match(await phone.locator('.game-result').textContent(),/Bingo/);
    const callHistory = phone.locator('details').filter({ hasText: /^Call history/ });
    const labels = (await callHistory.locator('p').textContent()).split(' · ');
    assert.equal(new Set(labels).size,labels.length);
    await tap('Close');
    await tap('Fellowship actions');
    await phone.getByRole('button', { name: /^Discussion archives/ }).click();
    await phone.getByRole('button',{name:/Year archive/}).click();
    await phone.getByText('View sample archive', { exact: true }).click();
    await phone.getByText('Archive · Read only',{exact:true}).waitFor();
    assert.equal(await phone.getByRole('button',{name:'Invite to Game',exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    await phone.close();

    const desktop = await browser.newPage({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
    desktop.setDefaultTimeout(8000);
    await desktop.goto(url + '?week=7');
    await desktop.locator('#study-title').waitFor();
    assert.equal(await desktop.getByRole('button',{name:'Invite to Game',exact:true}).count(),0);
    await desktop.getByRole('button',{name:'Study discussion',exact:true}).click();
    await desktop.getByRole('button',{name:'Fellowship actions',exact:true}).click();
    await desktop.getByRole('button',{name:/^Invite to Game/}).click();
    await desktop.getByRole('heading',{name:'Invite someone',exact:true}).waitFor();
    assert.equal(await desktop.getByRole('heading',{name:'Your invitations',exact:true}).count(),0);
    await desktop.keyboard.press('Escape');
    await desktop.getByRole('dialog', { name: 'Fellowship actions' }).waitFor();
    await desktop.keyboard.press('Escape');
    await desktop.locator('dialog').waitFor({state:'hidden'});
    await desktop.goto(url + '?face=fellowship&game=invite');
    await desktop.getByRole('heading',{name:'Invite someone',exact:true}).waitFor();
    await desktop.getByRole('button',{name:'Close',exact:true}).click();
    await desktop.locator('dialog').waitFor({state:'hidden'});
    assert.equal(await desktop.evaluate(() => document.activeElement.id), 'fellowship-more');
    assert.equal(new URL(desktop.url()).searchParams.get('face'), 'fellowship');
    console.log('Passed game rules and phone-sized/desktop Chromium: decline and accept, Trivia completion and hint excursion, Bingo completion and unique calls, resume after reload, archive boundary and Fellowship scroll, draft and focus restoration.');
  } finally {
    await browser.close();
    server.close();
  }
}
run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
