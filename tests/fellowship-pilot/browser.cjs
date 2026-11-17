const assert = require('node:assert/strict');
const { chromium, devices } = require(process.env.NEXTPHASE_PLAYWRIGHT || 'playwright');
const { startPilot } = require('./server.cjs');

async function run() {
  const pilot = await startPilot();
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.NEXTPHASE_CHROME || undefined,
      args: ['--disable-gpu', '--renderer-process-limit=2', '--disk-cache-size=1048576', '--media-cache-size=1048576'],
    });
    const origin = new URL(pilot.url).origin;
    const pageErrors = [];
    const externalRequests = [];
    const open = async (options = {}, url = pilot.url) => {
      const page = await browser.newPage(options);
      page.setDefaultTimeout(9000);
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.route('**/*', route => {
        const requested = route.request().url();
        if (new URL(requested).origin === origin) return route.continue();
        externalRequests.push(requested);
        return route.abort();
      });
      await page.goto(url);
      return page;
    };
    const choose = async (page, name) => {
      await page.getByRole('button', { name, exact: true }).click();
      await page.getByText('Signed in as ' + name + '.', { exact: true }).waitFor();
    };
    const send = async (page, reply) => {
      const field = page.getByRole('textbox', { name: 'Reply' });
      await field.fill(reply);
      await page.getByRole('button', { name: 'Post reply' }).click();
      await page.getByText('Reply posted.', { exact: true }).waitFor();
    };

    const miriam = await open(devices['iPhone 13']);
    const daniel = await open();
    const outsider = await open();
    await choose(miriam, 'Miriam Ellis');
    await choose(daniel, 'Daniel Brooks');
    await choose(outsider, 'Outside Tester');
    await outsider.getByText('This weekly discussion is for group members only.').waitFor();
    assert.equal(await outsider.getByRole('textbox', { name: 'Reply' }).count(), 0);

    const first = 'Which verse stayed with you this week?';
    const reply = 'The promise to be with Jacob.';
    await send(miriam, first);
    await daniel.locator('#fellowship .message').filter({ hasText: 'Miriam Ellis' }).getByText(first, { exact: true }).waitFor();
    await send(daniel, reply);
    await miriam.locator('#fellowship .message').filter({ hasText: 'Daniel Brooks' }).getByText(reply, { exact: true }).waitFor();
    assert.equal(await outsider.locator('#fellowship .message').count(), 0);
    await miriam.reload();
    await miriam.getByText('Signed in as Miriam Ellis.').waitFor();
    await miriam.getByText(reply, { exact: true }).waitFor();

    assert.equal(await daniel.getByText('Invite a member', { exact: true }).count(), 0);
    await miriam.getByText('Invite a member', { exact: true }).click();
    await miriam.getByRole('button', { name: 'Create invite link' }).click();
    const invite = miriam.getByRole('textbox', { name: 'Invitation link' });
    await invite.waitFor();
    const inviteUrl = await invite.inputValue();
    assert.equal(new URL(inviteUrl).origin, origin);
    assert.match(new URL(inviteUrl).hash, /^#invite=[a-f0-9]{32}$/);
    await daniel.goto(inviteUrl);
    await daniel.getByRole('button', { name: 'Accept invitation' }).click();
    await daniel.getByText('This account can’t accept the invitation.', { exact: false }).waitFor();
    await outsider.getByRole('button', { name: 'Sign out' }).click();
    await outsider.getByRole('button', { name: 'Outside Tester' }).waitFor();
    await outsider.goto(inviteUrl);
    await outsider.getByText('Choose the test identity that received the invitation.').waitFor();
    await choose(outsider, 'Outside Tester');
    assert.equal(await outsider.getByRole('textbox', { name: 'Reply' }).count(), 0);
    await outsider.getByRole('button', { name: 'Accept invitation' }).click();
    await outsider.getByText('Invitation accepted. You joined as Outside Tester.', { exact: true }).waitFor();
    await outsider.getByText(first, { exact: true }).waitFor();
    assert.equal(new URL(outsider.url()).hash, '');
    const newReply = 'Thanks for having me in the group.';
    await send(outsider, newReply);
    await miriam.locator('#fellowship .message').filter({ hasText: 'Outside Tester' }).getByText(newReply, { exact: true }).waitFor();

    await miriam.getByRole('button', { name: 'Sign out' }).click();
    await miriam.getByRole('button', { name: 'Miriam Ellis' }).waitFor();
    assert.equal(await miriam.locator('#fellowship .message').count(), 0);

    const normalUrl = new URL(pilot.url);
    normalUrl.searchParams.delete('pilot');
    const demo = await open({}, normalUrl.href);
    await demo.getByRole('button', { name: 'Fellowship actions' }).click();
    await demo.getByRole('button', { name: /^Invite to Game/ }).waitFor();
    await demo.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await demo.getByText('Try the local discussion demo', { exact: true }).click();
    await demo.getByRole('button', { name: 'Post demo reply' }).waitFor();
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(externalRequests, []);
    console.log('Passed phone-sized and desktop Fellowship: replies updated across sessions, a one-time invitation let its recipient join and reply, and the normal demo stayed available.');
  } finally {
    if (browser) await browser.close();
    await pilot.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
