const assert = require('node:assert/strict');
const path = require('node:path');
const { startEmulator, testToken } = require('./emulator.cjs');

async function main() {
  const emulator = await startEmulator({ rulesFile: path.join(__dirname, 'household-pilot.rules') });
  const { request, seed, read, send } = emulator.db;
  const group = 'groups/household-pilot';
  const shared = group + '/studyThreads/household';
  const people = ['miriam', 'daniel', 'ruth', 'ezra'];
  const allowed = result => assert.equal(result.status, 200, JSON.stringify(result.data));
  const denied = result => assert.equal(result.status, 403, JSON.stringify(result.data));
  try {
    await seed(shared, { open: { booleanValue: true } });
    for (const uid of people) {
      await seed(group + '/members/' + uid, { role: { stringValue: 'member' } });
      await seed(group + '/profiles/' + uid, { displayName: { stringValue: uid } });
    }
    const rooms = [];
    for (let first = 0; first < people.length; first++) for (let second = first + 1; second < people.length; second++) {
      const pair = [people[first], people[second]];
      const current = group + '/privateChats/pair-' + first + '-' + second;
      rooms.push(current);
      await seed(current, { participantIds: { arrayValue: { values: pair.map(uid => ({ stringValue: uid })) } },
        title: { stringValue: 'Private household conversation' }, createdAt: { timestampValue: new Date().toISOString() } });
      for (const uid of people) (pair.includes(uid) ? allowed : denied)(await request('/' + current, testToken(uid)));
    }
    assert.equal(rooms.length, 6);
    const first = rooms[0];
    allowed(await send(first, 'private', testToken('miriam'), 'miriam', 'Private Scripture [Scripture: John 1:1]'));
    allowed(await read(first, testToken('daniel')));
    for (const token of [testToken('ruth'), testToken('ezra'), testToken('outsider'), undefined]) {
      denied(await read(first, token));
      denied(await request('/' + first + '/messages/private', token));
      denied(await send(first, 'intrusion', token, 'ruth', 'Not a participant'));
    }
    denied(await send(first, 'spoof', testToken('miriam'), 'daniel', 'Wrong author'));
    denied(await request('/' + first, testToken('miriam'), 'PATCH', { fields: {} }));
    denied(await request('/' + first, testToken('miriam'), 'DELETE'));
    denied(await request('/' + group + '/privateChats/new', testToken('miriam'), 'PATCH', { fields: {} }));
    denied(await request('/' + first + '/messages/private', testToken('miriam'), 'DELETE'));
    denied(await request('/' + first + '/messages/private', testToken('miriam'), 'PATCH', { fields: {} }));
    denied(await read(first, testToken('miriam'), 51));
    const list = (token, owner, limit = 20) => request('/' + group + ':runQuery', token, 'POST', { structuredQuery: {
      from: [{ collectionId: 'privateChats' }], limit,
      ...(owner && { where: { fieldFilter: { field: { fieldPath: 'participantIds' }, op: 'ARRAY_CONTAINS', value: { stringValue: owner } } } }),
    } });
    const own = await list(testToken('miriam'), 'miriam');
    allowed(own);
    assert.equal(own.data.filter(item => item.document).length, 3);
    denied(await list(testToken('miriam'), 'daniel'));
    denied(await list(testToken('miriam'), null));
    denied(await list(testToken('miriam'), 'miriam', 21));
    denied(await list(undefined, 'miriam'));
    allowed(await send(shared, 'group', testToken('miriam'), 'miriam', 'Everyone in the household'));
    for (const uid of people) allowed(await read(shared, testToken(uid)));
    denied(await read(shared, testToken('outsider')));
    denied(await request('/' + group + '/members/outsider', testToken('outsider'), 'PATCH', { fields: {} }));
    denied(await request('/' + group + '/profiles/miriam', testToken('daniel'), 'PATCH', { fields: { displayName: { stringValue: 'Impersonation' } } }));
    allowed(await request('/' + group + '/members/daniel', 'owner', 'DELETE'));
    denied(await read(first, testToken('daniel')));
    denied(await send(first, 'after-removal', testToken('miriam'), 'miriam', 'Recipient is no longer enrolled'));
    console.log('Passed household rules: six participant-only pairs, four-person shared room, scoped queries, immutable metadata/messages and revocation.');
  } finally { emulator.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
