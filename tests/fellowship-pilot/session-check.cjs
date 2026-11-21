const assert = require('node:assert/strict');

async function main() {
  const { discussionSession, clearDiscussionSessions, messageBody, messageParts } = await import('../../fellowship-session.js');
  const original = discussionSession('alpha', 'group', 2026, 7);
  original.body = 'Unfinished thought';
  original.reference = 'John 1:1–5';
  original.top = 245;
  assert.equal(discussionSession('alpha', 'group', 2026, 7), original);
  for (const state of [discussionSession('beta', 'group', 2026, 7), discussionSession('alpha', 'other', 2026, 7),
    discussionSession('alpha', 'group', 2025, 7), discussionSession('alpha', 'group', 2026, 8)]) {
    assert.equal(state.body, '');
    assert.notEqual(state, original);
  }
  const encoded = messageBody(' A thought ', 'John 1:1–5');
  assert.deepEqual(messageParts(encoded), { content: 'A thought', references: ['John 1:1–5'] });
  assert.deepEqual(messageParts('Legacy plain message'), { content: 'Legacy plain message', references: [] });
  assert.equal(messageBody(' ', ' '), '');
  assert.equal(messageBody('', 'John 1:1'), '[Scripture: John 1:1]');
  assert.deepEqual(messageParts('<img src=x onerror=alert(1)>'), { content: '<img src=x onerror=alert(1)>', references: [] });
  clearDiscussionSessions('alpha');
  assert.equal(original.body, '');
  assert.equal(discussionSession('alpha', 'group', 2026, 7).top, 0);
  console.log('Passed: draft isolation by account/community/year/week, navigation continuity, legacy message compatibility, and sign-out cleanup.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
