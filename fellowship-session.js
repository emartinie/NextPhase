// Private drafts stay in page memory, scoped to identity, community and study.
// No conversation text is persisted in localStorage or sessionStorage.
const sessions = new Map();

export function discussionSession(uid, group, year, week) {
  const key = JSON.stringify([uid, group, year, week]);
  if (!sessions.has(key)) sessions.set(key, { uid, body: '', reference: '', top: 0 });
  return sessions.get(key);
}

export function clearDiscussionSessions(uid) {
  for (const [key, value] of sessions) if (value.uid === uid) {
    value.body = value.reference = '';
    value.pending = null;
    sessions.delete(key);
  }
}

export function messageBody(body, reference) {
  return [body.trim(), reference.trim() && `[Scripture: ${reference.trim()}]`].filter(Boolean).join('\n\n');
}

export function messageParts(body) {
  const references = [];
  const content = String(body ?? '').replace(/\[Scripture: ([^\]\r\n]{1,180})\]/g, (_, reference) => {
    if (!references.includes(reference)) references.push(reference);
    return '';
  }).trim();
  return { content, references };
}
