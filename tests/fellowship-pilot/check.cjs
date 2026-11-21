const assert = require('node:assert/strict');
const { startEmulator, testToken, group, thread, archive, messages } = require('./emulator.cjs');

async function check({ request, seed, seedPilot, read, send, commit, inviteWrite, redemptionWrites }) {
  const allowed = result => assert.equal(result.status, 200, JSON.stringify(result.data));
  const denied = result => assert.equal(result.status, 403, JSON.stringify(result.data));
  const bodies = result => {
    allowed(result);
    return result.data.filter(row => row.document).map(row => row.document.fields.body.stringValue);
  };

  await seedPilot();
  const miriam = testToken('miriam');
  const daniel = testToken('daniel');
  const outsider = testToken('outsider');

  // Four independent synthetic members; never use real family UIDs or conversations.
  for (const uid of ['ruth', 'ezra']) await seed(`${group}/members/${uid}`, { role: { stringValue: 'member' } });
  const profile = uid => `/${group}/profiles/${uid}`;
  const putProfile = (uid, token, fields) => request(profile(uid), token, 'PATCH', { fields });
  for (const [uid, name] of [['miriam', 'Miriam Ellis'], ['daniel', 'Daniel Brooks'], ['ruth', 'Ruth'], ['ezra', 'Ezra']]) {
    allowed(await putProfile(uid, testToken(uid), { displayName: { stringValue: name } }));
  }
  allowed(await request(profile('miriam'), daniel));
  denied(await request(profile('miriam'), outsider));
  denied(await request(profile('miriam'), undefined));
  denied(await putProfile('miriam', daniel, { displayName: { stringValue: 'Impersonation' } }));
  denied(await putProfile('outsider', outsider, { displayName: { stringValue: 'Not enrolled' } }));
  for (const fields of [{}, { displayName: { stringValue: ' ' } }, { displayName: { stringValue: 'x'.repeat(81) } },
    { displayName: { integerValue: '42' } }, { displayName: { stringValue: 'Miriam' }, role: { stringValue: 'leader' } },
    { displayName: { stringValue: 'Miriam' }, email: { stringValue: 'private@example.invalid' } }]) {
    denied(await putProfile('miriam', miriam, fields));
  }
  allowed(await putProfile('miriam', miriam, { displayName: { stringValue: 'Miriam Ellis' } }));
  const listProfiles = (token, limit) => request(`/${group}:runQuery`, token, 'POST', {
    structuredQuery: { from: [{ collectionId: 'profiles' }], ...(limit && { limit }) },
  });
  allowed(await listProfiles(daniel, 50));
  denied(await listProfiles(daniel, 51));
  denied(await listProfiles(daniel));
  denied(await listProfiles(outsider, 50));
  denied(await listProfiles(undefined, 50));
  const other = 'groups/other-community/studyThreads/current';
  await seed(other, { open: { booleanValue: true } });
  await seed('groups/other-community/members/foreign', { role: { stringValue: 'member' } });
  denied(await read(other, miriam));
  denied(await send(other, 'cross-community', miriam, 'miriam', 'Wrong audience'));
  denied(await read(thread, testToken('foreign')));
  denied(await request(profile('miriam'), testToken('foreign')));
  allowed(await request(`/${group}/members/ezra`, 'owner', 'DELETE'));
  denied(await request(profile('miriam'), testToken('ezra')));
  denied(await read(thread, testToken('ezra')));
  console.log('Passed: four scoped profiles, owner-only validated writes, bounded member-only reads, community isolation, and membership revocation.');

  allowed(await request('/' + thread, miriam));
  allowed(await send(thread, 'first', miriam, 'miriam', 'What stood out in this week’s reading?'));
  assert.deepEqual(bodies(await read(thread, daniel)), ['What stood out in this week’s reading?']);
  allowed(await send(thread, 'reply', daniel, 'daniel', 'The promise to be with Jacob.'));
  assert.deepEqual(bodies(await read(thread, miriam)), [
    'What stood out in this week’s reading?', 'The promise to be with Jacob.',
  ]);
  assert.deepEqual(bodies(await read(archive, daniel)), []);

  denied(await read(thread, outsider));
  denied(await read(thread, undefined));
  denied(await request(`/${messages(thread)}/first`, outsider));
  denied(await send(thread, 'intrusion', outsider, 'outsider', 'Private group'));
  denied(await send(thread, 'anonymous', undefined, 'outsider', 'Private group'));
  denied(await send(thread, 'spoof', miriam, 'daniel', 'Forged author'));
  denied(await send(thread, 'blank', miriam, 'miriam', '   '));
  denied(await send(thread, 'oversized', miriam, 'miriam', 'x'.repeat(1601)));
  denied(await send(archive, 'archived-reply', miriam, 'miriam', 'This archive is read-only.'));
  denied(await send(`${group}/studyThreads/nonexistent`, 'stray', miriam, 'miriam', 'No thread'));
  denied(await request(`/${group}/members/outsider`, outsider, 'PATCH', { fields: {} }));
  denied(await request(`/${messages(thread)}/first`, miriam, 'DELETE'));
  denied(await read(thread, miriam, 51));
  console.log('Passed: two test members exchanged replies, study periods stayed separate, and unauthorized reads and writes were denied.');

  const id = 'a'.repeat(32);
  const expiredId = 'b'.repeat(32);
  const expiry = new Date(Date.now() + 3_600_000).toISOString();
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const invitePath = inviteId => `/${group}/invites/${inviteId}`;
  const membership = `/${group}/members/outsider`;
  denied(await commit(daniel, [inviteWrite(id, 'daniel', 'outsider', expiry)]));
  denied(await commit(miriam, [inviteWrite(id, 'miriam', 'daniel', expiry)]));
  denied(await commit(miriam, [inviteWrite(id, 'miriam', 'outsider', past)]));
  allowed(await commit(miriam, [inviteWrite(expiredId, 'miriam', 'outsider', expiry)]));
  allowed(await request(`${invitePath(expiredId)}?updateMask.fieldPaths=expiresAt`, 'owner', 'PATCH', {
    fields: { expiresAt: { timestampValue: past } },
  }));
  denied(await commit(outsider, redemptionWrites(expiredId, 'outsider')));
  allowed(await commit(miriam, [inviteWrite(id, 'miriam', 'outsider', expiry)]));
  allowed(await request(invitePath(id), outsider));
  denied(await request(invitePath(id), daniel));
  denied(await request(invitePath(id), undefined));
  denied(await request(`/${group}/invites`, miriam));
  denied(await request(membership, daniel));
  denied(await commit(daniel, redemptionWrites(id, 'outsider')));
  denied(await commit(undefined, redemptionWrites(id, 'outsider')));
  const [redeem, join] = redemptionWrites(id, 'outsider');
  denied(await commit(outsider, [redeem]));
  denied(await commit(outsider, [join]));
  const escalation = structuredClone(join);
  escalation.update.fields.role.stringValue = 'leader';
  denied(await commit(outsider, [redeem, escalation]));
  const foreignMembership = structuredClone(join);
  foreignMembership.update.name = foreignMembership.update.name.replace('/pilot-group/', '/another-group/');
  denied(await commit(outsider, [redeem, foreignMembership]));
  assert.equal((await request(membership, outsider)).status, 404);
  assert.equal((await request(invitePath(id), outsider)).data.fields.redeemed.booleanValue, false);
  allowed(await commit(outsider, [redeem, join]));
  assert.equal((await request(membership, outsider)).data.fields.role.stringValue, 'member');
  assert.equal((await request(invitePath(id), outsider)).data.fields.redeemed.booleanValue, true);
  denied(await commit(outsider, [redeem, join]));
  allowed(await read(thread, outsider));
  allowed(await send(thread, 'joined', outsider, 'outsider', 'Thanks for inviting me.'));
  assert.equal(bodies(await read(thread, miriam)).at(-1), 'Thanks for inviting me.');
  console.log('Passed: a leader issued an invite, the recipient joined and replied, and expired, repeated, split, or unauthorized redemption was denied.');
}

async function main() {
  const emulator = await startEmulator();
  try {
    await check(emulator.db);
  } finally {
    emulator.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
