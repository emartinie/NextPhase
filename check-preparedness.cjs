const assert = require('node:assert/strict');
const { checkData, checkMigration } = require('./check-preparedness-migration.cjs');
const fs = require('node:fs/promises');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');

const { createPreviewServer, pagesMount, startPagesCheck } = require('./serve-preparedness.cjs');
const server = createPreviewServer({ mount: pagesMount });

async function run() {
  await checkData();
  const rules = await import('./preparedness-model.js');
  const seed = rules.loadPractice();
  assert.equal(rules.summary(seed).checked.size, 5);
  assert.equal(rules.summary(seed).awaiting, 11);
  assert.equal(rules.summary(seed).acknowledged.size, 2);
  assert.equal(rules.addPracticeEvent(seed, { type: 'check-in', source: 'radio', subject: 'Naomi Clark' }), false);
  assert.deepEqual(rules.compareReadback({ id:'04', recipient:'Miriam', window:'7:00 to 8:00 PM CT' }),
    { id:true, recipient:true, window:true });
  assert.ok(rules.printablePractice().includes('SIMULATED EXERCISE'));

  const url = await startPagesCheck(server);
  const browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined });
  try {
    const phone = await browser.newPage({ ...devices['iPhone 13'], acceptDownloads: true });
    phone.setDefaultTimeout(8000);
    const errors = [];
    const foreignRequests = [];
    phone.on('pageerror', error => errors.push(error.message));
    phone.on('request', request => {
      if (request.url().startsWith('https://')) foreignRequests.push(request.url());
    });
    const tap = name => phone.getByRole('button', { name, exact:true }).click();
    const prep = () => tap('Preparedness');
    const closePreparedness = async () => {
      await tap('Close');
      await phone.locator('dialog').waitFor({ state:'hidden' });
    };
    const role = name => phone.getByLabel('Try a role', { exact:true }).selectOption(name);

    await phone.goto(url + '?face=fellowship&week=6');
    await phone.getByRole('heading',{name:'Study discussion',exact:true}).waitFor();
    await phone.getByLabel('Reply',{exact:true}).fill('Keep this Fellowship draft.');
    await prep();
    const scroll = await phone.locator('#fellowship').evaluate(el => el.scrollTop);
    await phone.getByText('5 checked in · 11 awaiting a check-in', { exact:true }).waitFor();
    await phone.getByText('16 expected · 2 briefing acknowledgments', { exact:true }).waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth),390);
    await tap('Decline practice');
    await phone.getByText('Miriam declined the practice invitation.', { exact:true }).waitFor();
    await tap('Join after all');
    await tap('Acknowledge briefing');
    await phone.getByText('16 expected · 3 briefing acknowledgments', { exact:true }).waitFor();
    await phone.getByText('5 checked in · 11 awaiting a check-in', { exact:true }).waitFor();
    await tap('Check in for this drill');
    await phone.getByText('6 checked in · 10 awaiting a check-in', { exact:true }).waitFor();
    assert.equal(await phone.getByRole('button',{name:'Check-in recorded',exact:true}).isDisabled(), true);

    await tap('Listen');
    await phone.getByLabel('Explore an area', {exact:true}).selectOption('kentucky');
    await phone.getByText('Preferred area · Dickson County, Tennessee',{exact:true}).waitFor();
    assert.ok(await phone.getByRole('link',{name:/Clark County weekly nets/}).count());
    await tap('Hear a practice net');
    await phone.locator('audio[aria-label="Fictional practice net recording"]').evaluate(audio => audio.load());
    await phone.waitForFunction(() => document.querySelector('audio[aria-label="Fictional practice net recording"]')?.duration > 3);
    await phone.getByText('Read the transcript',{exact:true}).click();
    await phone.getByText(/Message zero four for Miriam/).waitFor();
    await tap('Practice a read-back');
    await phone.getByLabel('Message ID', {exact:true}).fill('04');
    await phone.getByLabel('Recipient', {exact:true}).fill('Miriam Ellis');
    const windowField = phone.getByLabel('Pickup window and time zone', {exact:true});
    await windowField.fill('6–8 PM Central');
    await tap('Check my read-back');
    await phone.getByText('Review the fields that need another try.',{exact:true}).waitFor();
    await tap('Open the practice recording');
    await phone.getByRole('heading',{name:'Practice recording',exact:true}).waitFor();
    await tap('Back');
    assert.equal(await windowField.inputValue(),'6–8 PM Central');
    await windowField.fill('7–8 PM Central');
    await tap('Check my read-back');
    await phone.getByText('Your read-back matches the source.',{exact:true}).waitFor();
    await tap('Back');
    await tap('Back');
    assert.equal(await phone.getByLabel('Explore an area',{exact:true}).inputValue(),'kentucky');

    await tap('Group');
    await role('coordinator');
    await tap('Simulate an app outage');
    await phone.getByText('Fallback plan in use',{exact:true}).waitFor();
    await tap('Open fallback plan');
    await phone.getByRole('heading',{name:'Practice plan',exact:true}).waitFor();
    await phone.context().setOffline(true);
    const saved = phone.waitForEvent('download');
    await phone.getByRole('link',{name:'Save practice card',exact:true}).click();
    const download = await saved;
    assert.equal(download.suggestedFilename(),'homegroups-practice-plan.txt');
    assert.match(await fs.readFile(await download.path(),'utf8'),/Fallback|Contingency/i);
    await phone.context().setOffline(false);
    await tap('Back');
    assert.equal(await phone.getByLabel('Try a role',{exact:true}).inputValue(),'coordinator');

    await role('operator');
    const reporter = phone.getByLabel('Practice report for',{exact:true});
    assert.equal(await reporter.locator('option[value="Naomi Clark"]').count(),0);
    await reporter.selectOption('Caleb Hill');
    await tap('Log simulated radio check-in');
    await phone.getByText('7 checked in · 9 awaiting a check-in',{exact:true}).waitFor();
    assert.equal(await reporter.locator('option[value="Caleb Hill"]').count(),0);
    await phone.getByText(/^Exercise log/).click();
    await phone.getByText('Logged an exercise radio check-in for Caleb Hill.',{exact:true}).waitFor();

    await role('coordinator');
    await phone.getByText('Finish and debrief',{exact:true}).click();
    await phone.getByLabel('One improvement for the next drill',{exact:true}).fill('Practice the alternate contact before the outage.');
    await tap('Complete exercise');
    await phone.getByRole('heading',{name:'Exercise debrief',exact:true}).waitFor();
    await phone.getByText('2 read-back attempts · 1 matched the source',{exact:true}).waitFor();
    await closePreparedness();
    assert.equal(await phone.getByLabel('Reply',{exact:true}).inputValue(),'Keep this Fellowship draft.');
    assert.equal(await phone.locator('#fellowship').evaluate(el=>el.scrollTop),scroll);
    assert.equal(await phone.evaluate(()=>document.activeElement.textContent),'Preparedness');
    await phone.reload();
    await prep();
    await phone.getByRole('heading',{name:'Exercise debrief',exact:true}).waitFor();
    await phone.getByText('Practice the alternate contact before the outage.',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    assert.deepEqual(foreignRequests,[]);
    await phone.close();
    await checkMigration(browser, url, devices['iPhone 13']);

    const desktop = await browser.newPage({viewport:{width:1440,height:900}});
    desktop.setDefaultTimeout(8000);
    const click = name => desktop.getByRole('button',{name,exact:true}).click();
    await desktop.goto(url);
    await click('Tools');
    await desktop.getByRole('button',{name:/Preparedness Practice communications/}).click();
    await desktop.getByRole('heading',{name:'Plan and learn',exact:true}).waitFor();
    await click('Open practice plan');
    const newTab = desktop.waitForEvent('popup');
    await desktop.getByRole('link',{name:/Open printable card/}).click();
    const sheet = await newTab;
    await sheet.getByText(/SIMULATED EXERCISE/).waitFor();
    await sheet.emulateMedia({ media:'print' });
    await sheet.getByRole('button',{name:'Print this card'}).waitFor({state:'hidden'});
    await sheet.close();
    await desktop.keyboard.press('Escape');
    await desktop.getByRole('heading',{name:'Plan and learn',exact:true}).waitFor();
    console.log('Preparedness passed: roles, separate counts, audio duration, read-back correction/draft, offline export, simulated radio report, persisted debrief, exact Fellowship return, Study entry and printable view.');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
