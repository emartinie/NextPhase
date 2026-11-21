// Contacts and saved chats use the existing authenticated Fellowship project.
// Online presence is neither collected nor required.
export function mountFellowshipChats(target, { node, text, button, firestore, db, uid, onSelect, groupId = 'household-pilot', compact = false }) {
  if (typeof firestore.where !== 'function') throw new Error('Chat queries are unavailable.');
  const details = node('details');
  details.append(node('summary', 'People & chats'));
  const controls = node('div', '', 'actions');
  function entry(label, select, shared = false) {
    if (!compact) return button(label, select, 'quiet');
    const control = button('', select, 'communication-entry');
    control.setAttribute('aria-label', label);
    const avatar = node('span', label.split(/\s+/).slice(0,2).map(word=>word[0]).join(''), 'communication-avatar');
    avatar.setAttribute('aria-hidden','true');
    const copy = node('span', label, 'communication-entry-name');
    if (shared) copy.append(node('small','Group conversation'));
    control.append(avatar, copy);
    return control;
  }
  controls.append(entry(compact ? 'Household' : 'Household conversation', () => choose({ kind: 'household', title: 'Household conversation' }), true),
    entry(compact ? 'Weekly study' : 'Weekly study conversation', () => choose({ kind: 'weekly' }), true));
  const status = text('Loading saved private conversations…', 'form-caption');
  status.setAttribute('role', 'status');
  const people = node('div', '', 'rows');
  details.append(status, people);
  if (compact) {
    controls.className = 'communication-room-list';
    people.classList.add('communication-room-list');
    target.append(controls, status, people);
  } else target.append(controls, details);
  let active = true;
  let names = new Map();
  let chats = [];
  let chatsReady = false;
  let namesUnavailable = false;
  const stops = [];

  function choose(selection) {
    if (!active) return;
    details.open = false;
    onSelect(selection);
  }
  function render() {
    if (!active || !chatsReady) return;
    people.replaceChildren();
    for (const chat of chats) {
      const other = chat.participantIds.find(id => id !== uid);
      const label = names.get(other) || chat.title || 'Private conversation';
      people.append(entry(label, () => choose({ kind: 'private', id: chat.id, title: label })));
    }
    status.textContent = compact && chats.length && !namesUnavailable ? '' : chats.length
      ? (namesUnavailable ? 'Saved private chats · member names are unavailable.' : 'Choose a person to open your saved private conversation.')
      : 'No private conversations have been set up for this account yet.';
  }
  const group = firestore.doc(db, 'groups', groupId);
  stops.push(firestore.onSnapshot(firestore.query(firestore.collection(group, 'profiles'), firestore.limit(50)),
    { includeMetadataChanges: true }, result => {
      if (!active || result.metadata.fromCache) return;
      names = new Map(result.docs.filter(item => !item.metadata.hasPendingWrites && typeof item.data().displayName === 'string')
        .map(item => [item.id, item.data().displayName]));
      namesUnavailable = false;
      render();
    }, () => { if (active) { names.clear(); namesUnavailable = true; render(); } }));
  stops.push(firestore.onSnapshot(firestore.query(firestore.collection(group, 'privateChats'),
    firestore.where('participantIds', 'array-contains', uid), firestore.limit(20)),
    { includeMetadataChanges: true }, result => {
      if (!active || result.metadata.fromCache) return;
      chats = result.docs.filter(item => !item.metadata.hasPendingWrites).map(item => ({ ...item.data(), id: item.id }))
        .filter(chat => Array.isArray(chat.participantIds) && chat.participantIds.length === 2
          && chat.participantIds.includes(uid) && chat.participantIds[0] !== chat.participantIds[1]);
      chatsReady = true;
      render();
    }, error => {
      if (!active) return;
      chats = [];
      people.replaceChildren();
      status.textContent = error.code === 'permission-denied'
        ? 'Private conversations are not enabled for this account yet. The household and weekly rooms have separate access checks.'
        : 'Saved conversations could not load. Close and reopen Fellowship to try again.';
    }));
  return {
    show() { if (active) {
      if (compact) { target.scrollIntoView({ block: 'start' }); (people.querySelector('button') || controls.querySelector('button'))?.focus({ preventScroll: true }); }
      else { details.open = true; details.scrollIntoView({ block: 'nearest' }); details.querySelector('summary').focus(); }
    } },
    close() { active = false; for (const stop of stops) stop(); },
  };
}
