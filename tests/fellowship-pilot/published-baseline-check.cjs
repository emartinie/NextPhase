// Execute only against the loopback demo-project emulator, never live Firebase.
const assert = require('node:assert/strict');
const path = require('node:path');
const { startEmulator, testToken, group, thread, archive } = require('./emulator.cjs');

async function main() {
  const emulator = await startEmulator({ rulesFile: path.join(__dirname, 'published-baseline.rules') });
  const { request, seed, seedPilot, read, send } = emulator.db;
  const allowed = value => assert.equal(value.status, 200, JSON.stringify(value.data));
  const denied = value => assert.equal(value.status, 403, JSON.stringify(value.data));
  try {
    await seedPilot();
    for (const uid of ['ruth', 'ezra']) await seed(`${group}/members/${uid}`, { role: { stringValue: 'member' } });
    for (const uid of ['miriam', 'daniel', 'ruth', 'ezra']) {
      const token = testToken(uid);
      denied(await request(`/${group}/members/${uid}`, token));
      denied(await request(`/${group}/profiles/${uid}`, token));
      allowed(await request(`/${thread}`, token));
      allowed(await send(thread, `baseline-${uid}`, token, uid, 'Shared Scripture\n\n[Scripture: John 1:1–5]'));
    }
    const replies = await read(thread, testToken('daniel'));
    allowed(replies);
    assert.equal(replies.data.filter(row => row.document).length, 4);
    for (const token of [undefined, testToken('outsider')]) {
      denied(await request(`/${thread}`, token));
      denied(await read(thread, token));
      denied(await send(thread, 'unauthorized', token, 'outsider', 'Not allowed'));
    }
    denied(await send(thread, 'spoof', testToken('miriam'), 'daniel', 'Forged author'));
    denied(await send(thread, 'blank', testToken('miriam'), 'miriam', '   '));
    denied(await send(thread, 'oversized', testToken('miriam'), 'miriam', 'x'.repeat(1601)));
    denied(await request(`/${thread}/messages/baseline-miriam`, testToken('miriam'), 'PATCH', {
      fields: { body: { stringValue: 'Overwrite a confirmed message' } },
    }));
    denied(await request(`/${thread}/messages/baseline-miriam`, testToken('miriam'), 'DELETE'));
    denied(await send(archive, 'archive-write', testToken('miriam'), 'miriam', 'Archive is read-only'));
    denied(await read(thread, testToken('miriam'), 51));
    denied(await request(`/${group}/members/outsider`, testToken('outsider'), 'PATCH', {
      fields: { role: { stringValue: 'member' } },
    }));
    await seed('groups/other-community/studyThreads/current', { open: { booleanValue: true } });
    denied(await read('groups/other-community/studyThreads/current', testToken('miriam')));
    allowed(await request(`/${group}/members/ezra`, 'owner', 'DELETE'));
    denied(await request(`/${thread}`, testToken('ezra')));
    denied(await read(thread, testToken('ezra')));
    console.log('Passed actual published-baseline rules: private membership/profile documents, four authorized authors, immutable member-only conversations, scoped access and revocation.');
  } finally { emulator.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
