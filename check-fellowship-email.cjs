const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createFirebasePreview } = require('./tests/fellowship-pilot/firebase-preview.cjs');
const { emailOnFile } = require('./collect-fellowship-map.cjs');
const { createConversationEmail, createFirebaseAuthorizer, createResendDelivery, emailRoute, reviewRoute } = require('./fellowship-email.cjs');

async function run() {
  assert.equal(emailOnFile({ description: 'Email: invitee@example.test<br>Comments: Anyone is welcome.' }), 'invitee@example.test');
  assert.equal(emailOnFile({ description: 'Comments: invitee@example.test' }), '');
  assert.equal(emailOnFile({ description: 'Email: a@example.test\nEmail: b@example.test' }), '');
  const accountRequests = [];
  const authorize = createFirebaseAuthorizer('test-key', '2026-week-07', async (url, options) => {
    accountRequests.push(url);
    if (url.includes('accounts:lookup')) {
      const { idToken } = JSON.parse(options.body);
      if (idToken === 'forged') return new Response(null, { status: 400 });
      return Response.json({ users: [{ localId: 'test-sender', emailVerified: idToken !== 'unverified',
        email: 'sender@example.test', displayName: 'Test Sender' }] });
    }
    assert.ok(url.endsWith('/groups/pilot-group/studyThreads/2026-week-07'));
    return new Response(null, { status: options.headers.Authorization === 'Bearer member' ? 200 : 403 });
  });
  const messages = [];
  let providerAccepts = false;
  const deliver = createResendDelivery('sandbox-key', 'fellowship@example.test', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    const key = options.headers['Idempotency-Key'];
    assert.match(key, /^[a-f0-9]{64}$/);
    messages.push({ key, ...JSON.parse(options.body) });
    return providerAccepts ? Response.json({ id: 'fake-acceptance' }) : new Response(null, { status: 500 });
  });
  const snapshot = 'e'.repeat(64);
  const recipients = ['first@example.test', '', 'first@example.test', 'second@example.test', 'third@example.test', 'fourth@example.test'];
  const studies = new Map([[7, { reading: 'Genesis 28:10-32:3' }]]);
  const handler = createConversationEmail({ snapshot, recipients, studies, authorize, deliver, reviewUrl: 'https://example.test/fellowship/' });
  const server = createFirebasePreview({ projectId: 'homegroups-fellowship' }, 0, handler);
  try {
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function send(payload, token = 'member', requestOrigin = origin) {
      const response = await fetch(`${origin}/NextPhase${emailRoute}`, {
        method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ snapshot, marker: 0, week: 7, ...payload }),
      });
      const body = await response.json();
      assert.deepEqual(Object.keys(body), ['code']);
      return [response.status, body.code];
    }
    async function respond(token, decision) {
      const response = await fetch(`${origin}/NextPhase${reviewRoute}`, {
        method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, decision }),
      });
      return [response.status, await response.json()];
    }
    function emailToken(message) {
      const link = new URL(message.text.split('\n').at(-1));
      assert.equal(link.searchParams.get('face'), 'fellowship');
      return /^#conversation-invite=([a-f0-9]{64})$/.exec(link.hash)?.[1];
    }
    assert.deepEqual(await send({}, ''), [401, 'sign-in']);
    assert.deepEqual(await send({}, 'member', 'https://untrusted.example.test'), [403, 'forbidden']);
    assert.deepEqual(await send({}, 'forged'), [403, 'forbidden']);
    assert.deepEqual(await send({}, 'unverified'), [403, 'forbidden']);
    assert.deepEqual(await send({}, 'outsider'), [403, 'forbidden']);
    assert.deepEqual(await send({ to: 'attacker@example.test' }), [400, 'invalid']);
    assert.deepEqual(await send({ week: 53 }), [400, 'invalid']);
    assert.deepEqual(await send({ snapshot: 'stale' }), [409, 'refresh-map']);
    assert.deepEqual(await send({ marker: 1 }), [404, 'no-address']);
    assert.deepEqual(messages, []);
    assert.deepEqual(await send({}), [502, 'mail-unavailable']);
    providerAccepts = true;
    const requests = await Promise.all([send({}), send({ marker: 2 })]);
    assert.deepEqual(requests.map(result => result[0]).sort(), [202, 409]);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].key, messages[1].key);
    assert.deepEqual(messages[1].to, ['first@example.test']);
    assert.equal(messages[1].reply_to, undefined);
    assert.match(messages[1].text, /Genesis 28:10-32:3/);
    assert.equal(emailToken(messages[0]), emailToken(messages[1]));
    const first = emailToken(messages[1]);
    assert.deepEqual(await respond(first), [200, { code: 'pending', sender: 'Test Sender', week: 7, reading: 'Genesis 28:10-32:3' }]);
    assert.equal((await respond(first, 'accept'))[1].code, 'accepted');
    assert.deepEqual(await respond(first, 'decline'), [200, { code: 'accepted' }]);
    assert.deepEqual(await send({ marker: 3 }), [202, 'accepted']);
    const second = emailToken(messages[2]);
    assert.equal((await respond(second, 'decline'))[1].code, 'declined');
    assert.deepEqual(await respond(second, 'accept'), [200, { code: 'declined' }]);
    assert.deepEqual(await respond('0'.repeat(64)), [410, { code: 'unavailable' }]);
    assert.deepEqual(await send({ marker: 4 }), [202, 'accepted']);
    assert.deepEqual(await send({ marker: 5 }), [429, 'daily-limit']);
    assert.equal(messages.length, 4);
    assert.ok(accountRequests.some(url => url.includes('firestore.googleapis.com')));
    console.log('Fellowship email passed: private lookup, group access, safe retry, consent links, one-time decisions and daily limit.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
