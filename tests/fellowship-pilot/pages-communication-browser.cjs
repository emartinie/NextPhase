// Real application and reader on the Pages origin; synthetic services only.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { createPreviewServer, startPagesCheck, pagesMount } = require('../../serve-preparedness.cjs');
const fixture = require('./firebase-browser.cjs');

async function main() {
  const server = createPreviewServer({ mount: pagesMount });
  const local = await startPagesCheck(server);
  const origin = 'https://emartinie.github.io';
  const contexts = [], errors = [], configRequests = [];
  let browser;
  const surface = page => page.locator('.communication-surface');
  const field = page => surface(page).getByRole('textbox', { name: 'Message', exact: true });
  async function open(uid, { configStatus = 200, authError = null } = {}) {
    const context = await browser.newContext({ viewport: { width: 375, height: 481 } });
    contexts.push(context);
    await context.addInitScript(({ uid, names, authError }) => {
      window.__testAuthChoice = uid; window.__testNames = names; window.__testAuthError = authError;
    }, { uid, names: fixture.accounts, authError });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('__testStore', async ({ op, ref, uid, data }) => {
      try { return await fixture.backend(op, ref, uid, data); }
      catch (error) { return { error: error.message, code: error.code }; }
    });
    await context.route('**/*', async route => {
      const address = new URL(route.request().url());
      if (address.origin === origin) {
        if (address.pathname === '/NextPhase/fellowship-web-config.json') {
          configRequests.push(address.href);
          return route.fulfill({ status: configStatus, contentType: 'application/json', body: JSON.stringify({
            projectId: 'homegroups-fellowship', authDomain: 'homegroups-fellowship.firebaseapp.com', apiKey: 'synthetic', appId: 'synthetic',
          }) });
        }
        assert.ok(!address.pathname.startsWith('/__/'), 'Pages cannot serve reserved Firebase Hosting endpoints');
        const response = await fetch(new URL(address.pathname + address.search, new URL(local).origin));
        return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
      }
      const auth = fixture.authSdk.replace('export async function signInWithPopup() {',
        "export async function signInWithPopup() { if(window.__testAuthError)throw Object.assign(new Error('Synthetic sign-in rejection'),{code:window.__testAuthError});");
      const source = { 'firebase-app.js': fixture.appSdk, 'firebase-auth.js': auth, 'firebase-firestore.js': fixture.storeSdk }[address.pathname.split('/').at(-1)];
      return address.hostname === 'www.gstatic.com' && source ? route.fulfill({ contentType: 'text/javascript', body: source }) : route.abort();
    });
    await page.goto(origin + '/NextPhase/?week=8'); // No preview query parameter.
    await page.locator('#study .today').waitFor();
    assert.equal(await page.locator('#study h1').innerText(), 'He Sent');
    await page.getByRole('button', { name: 'Open communications', exact: true }).click();
    assert.equal(await surface(page).getByText('Signed-in conversations are available in the HomeGroups Fellowship preview.', { exact: true }).count(), 0);
    return page;
  }
  async function signIn(page) {
    await surface(page).getByRole('button', { name: 'Sign in with Google', exact: true }).click();
    await surface(page).getByRole('button', { name: 'Family', exact: true }).waitFor();
    await surface(page).getByRole('button', { name: 'Family', exact: true }).click();
  }
  try {
    console.log('Pages check: starting browser.');
    browser = await chromium.launch({ executablePath: process.env.NEXTPHASE_CHROME || undefined,
      args: ['--disable-gpu', '--renderer-process-limit=2', '--disable-gpu-shader-disk-cache', '--disk-cache-size=1048576'] });
    const sender = await open('miriam'), recipient = await open('ruth');
    console.log('Pages check: two independent synthetic sessions opened.');
    await signIn(sender); await signIn(recipient);
    await field(sender).fill('Pages Family connection check');
    await surface(sender).getByRole('button', { name: 'Send reply', exact: true }).click();
    await surface(recipient).getByText('Pages Family connection check', { exact: true }).waitFor();
    assert.ok(fixture.posts.get('groups/household-pilot/studyThreads/household').some(post => post.data.body === 'Pages Family connection check'));
    await surface(sender).locator('.conversation-attachment > summary').click();
    await surface(sender).getByLabel('Scripture reference (optional)', { exact: true }).fill('Ezekiel 37');
    await surface(sender).getByRole('button', { name: 'Send reply', exact: true }).click();
    await surface(recipient).getByRole('button', { name: 'Ezekiel 37', exact: true }).click();
    await recipient.locator('#dialog .verse').first().waitFor();
    await recipient.locator('#close').click();
    await field(recipient).fill('Retain this Pages draft');
    await recipient.getByRole('button', { name: 'Sidepark communications', exact: true }).click();
    await recipient.getByRole('button', { name: 'Reopen communications', exact: true }).click();
    assert.equal(await field(recipient).inputValue(), 'Retain this Pages draft');
    await sender.context().close(); await recipient.context().close();
    console.log('Pages check: persisted message, Scripture and reader/draft return passed.');
    const outsider = await open('outsider'); await signIn(outsider);
    await surface(outsider).getByText('This account does not have access to Family conversation.', { exact: false }).waitFor();
    assert.equal(await field(outsider).isVisible(), false);
    assert.equal(await surface(outsider).locator('.message').count(), 0);
    await outsider.context().close();
    const domain = await open('miriam', { authError: 'auth/unauthorized-domain' });
    await surface(domain).getByRole('button', { name: 'Sign in with Google', exact: true }).click();
    await surface(domain).getByText('Google sign-in is not enabled for this website address yet. Please contact HomeGroups.', { exact: true }).waitFor();
    assert.equal(await surface(domain).locator('.message').count(), 0);
    await domain.context().close();
    const failed = await open('miriam', { configStatus: 503 });
    await surface(failed).getByText('Could not connect to HomeGroups Fellowship. Please reload to try again.', { exact: true }).waitFor();
    await failed.getByRole('button', { name: 'Sidepark communications', exact: true }).click();
    await failed.getByRole('button', { name: 'Read passage', exact: true }).click();
    await failed.locator('#dialog .verse').first().waitFor();
    assert.ok(configRequests.length >= 5);
    assert.deepEqual(errors, []);
    console.log('Passed Pages-origin communication: same-origin web config without preview flags, two synthetic members exchanging saved Family messages and Scripture, reader return/draft continuity, outsider denial, unauthorized-domain feedback and public reading despite config failure. No real Firebase calls or records.');
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
