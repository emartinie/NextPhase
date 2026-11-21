import { discussionSession, messageBody, messageParts } from './fellowship-session.js';

export function mountFirebaseDiscussion(target, {
  node, text, button, firestore, db, uid, displayName, year, week,
  passage, readPassage, surface = target, groupId = 'pilot-group',
  threadId, privateChatId, title = 'Wednesday HomeGroup',
  compact = false, detailsTarget,
}) {
  const scope = privateChatId ? groupId + '/private/' + privateChatId : threadId ? groupId + '/thread/' + threadId : groupId;
  const state = discussionSession(uid, scope, threadId || privateChatId ? 0 : year, threadId || privateChatId ? 0 : week);
  const stream = compact ? node('div', '', 'conversation-stream') : target;
  if (compact) {
    target.classList.add('conversation-view');
    stream.tabIndex = 0;
    stream.setAttribute('aria-label', 'Conversation messages');
    surface = stream;
  }
  const status = text('Checking community access…', 'form-caption');
  status.setAttribute('role', 'status');
  const people = text('', 'form-caption');
  const profileStatus = text('', 'form-caption');
  profileStatus.setAttribute('role', 'status');
  const feed = node('div');
  feed.setAttribute('aria-label', 'Community messages');
  const form = node('form');
  if (compact) form.className = 'conversation-composer';
  form.hidden = true;
  const label = node('label', 'Reply');
  if (compact) label.className = 'conversation-reply';
  const field = node('textarea');
  field.maxLength = 1600;
  field.value = state.body;
  field.setAttribute('aria-label', 'Message');
  if (compact) { label.textContent = ''; field.placeholder = 'Message…'; field.rows = 1; }
  label.append(field);
  const refLabel = node('label', 'Scripture reference (optional)');
  const reference = node('input');
  reference.type = 'text';
  reference.maxLength = 180;
  reference.placeholder = 'John 1:1–5';
  reference.value = state.reference;
  refLabel.append(reference);
  const attachment = node('details');
  attachment.open = Boolean(reference.value);
  const attachControl = node('summary');
  attachControl.append(node('span', 'Share Scripture', compact ? 'visually-hidden' : ''));
  if (compact) {
    attachment.className = 'conversation-attachment';
    const plus = node('span', '+');
    plus.setAttribute('aria-hidden', 'true');
    attachControl.prepend(plus);
    attachControl.title = 'Share Scripture';
    attachment.addEventListener('toggle', () => { if (attachment.open) reference.focus({ preventScroll: true }); });
  }
  attachment.append(attachControl, refLabel);
  const submit = node('button', compact ? '↑' : 'Post reply', 'button primary');
  submit.setAttribute('aria-label', 'Send reply');
  submit.type = 'submit';
  submit.disabled = true;
  const postStatus = text(state.lastResult || '', 'form-caption');
  postStatus.setAttribute('role', 'status');
  postStatus.dataset.saved = String(state.lastResult === 'Reply sent · saved to the community.');
  const retry = button('Try conversation again', () => {
    retry.hidden = true;
    mounted = false;
    threadKnown = openThread = false;
    status.textContent = 'Checking community access…';
    watchCommunityAccess();
  }, 'quiet');
  retry.hidden = true;
  form.append(...(compact ? [attachment, label, submit, postStatus] : [label, attachment, submit, postStatus]));
  if (compact) {
    (detailsTarget || stream).append(profileStatus, people);
    stream.append(status, retry, feed);
    target.append(stream, form);
  } else target.append(node('h3', title), status, retry, profileStatus, people, feed, form);

  const group = firestore.doc(db, 'groups', groupId);
  const profile = firestore.doc(group, 'profiles', uid);
  const thread = privateChatId ? firestore.doc(group, 'privateChats', privateChatId)
    : firestore.doc(group, 'studyThreads', threadId || year + '-week-' + String(week).padStart(2, '0'));
  const messages = firestore.collection(thread, 'messages');
  const stops = [];
  const names = new Map();
  const roomNames = new Map();
  const rows = new Map();
  const events = new AbortController();
  let active = true;
  let member = false;
  let openThread = false;
  let threadKnown = false;
  let connected = false;
  let sending = Boolean(state.pending);
  let mounted = false;
  let restored = false;
  const returning = Boolean(state.visited);
  const initialTop = returning ? state.top : surface.scrollTop;
  state.visited = true;
  let participants = [];
  let nameForm;

  function remember() {
    state.body = field.value;
    state.reference = reference.value;
    if (surface.isConnected) state.top = surface.scrollTop;
  }
  function fitComposer() {
    if (!compact || !field.isConnected) return;
    field.style.height = 'auto';
    field.style.height = Math.min(112, Math.max(44, field.scrollHeight)) + 'px';
  }
  field.addEventListener('input', () => { remember(); fitComposer(); }, { signal: events.signal });
  reference.addEventListener('input', remember, { signal: events.signal });
  surface.addEventListener('scroll', () => { if (restored && surface.isConnected) state.top = surface.scrollTop; }, { signal: events.signal });

  function availability() {
    submit.disabled = !member || !openThread || !connected || sending;
  }

  function fail(error, stage = 'conversation') {
    if (!active) return;
    member = connected = false;
    availability();
    feed.replaceChildren();
    rows.clear();
    names.clear();
    roomNames.clear();
    people.textContent = '';
    profileStatus.textContent = '';
    form.hidden = true;
    retry.hidden = false;
    status.hidden = false;
    nameForm?.remove();
    status.textContent = stage === 'access' && error.code === 'permission-denied'
      ? 'This account does not have access to ' + title + '. Ask your group leader to check its membership.'
      : error.code === 'permission-denied'
        ? 'Your community access was confirmed, but these messages are not permitted for your account.'
        : 'Could not open this conversation. Please try again.';
    for (const stop of stops.splice(0)) stop();
  }

  function profileUnavailable(error) {
    if (!active || !member) return;
    if (roomNames.size) { profileStatus.textContent = ''; return; }
    profileStatus.textContent = error.code === 'permission-denied'
      ? 'Your community membership is confirmed. Member profiles are not available yet.'
      : 'Member names could not be loaded. You can still use the conversation.';
  }

  function preservePosition(change, restore = false) {
    if (!surface.isConnected) { change(); return; }
    const following = compact && restored && surface.scrollHeight - surface.scrollTop - surface.clientHeight < 72;
    const bounds = surface.getBoundingClientRect();
    const anchor = [...feed.children].find(row => {
      const rect = row.getBoundingClientRect();
      return rect.bottom > bounds.top && rect.top < bounds.bottom;
    });
    const offset = anchor?.getBoundingClientRect().top;
    const top = surface.scrollTop;
    change();
    if (restore && !restored) surface.scrollTop = compact && !returning ? surface.scrollHeight : initialTop;
    else if (following) surface.scrollTop = surface.scrollHeight;
    else if (anchor?.isConnected) surface.scrollTop = top + anchor.getBoundingClientRect().top - offset;
    else surface.scrollTop = top;
    if (restore) { restored = true; state.top = surface.scrollTop; }
  }

  function authorLabel(authorId) {
    const name = names.get(authorId) || roomNames.get(authorId);
    return authorId === uid ? (name ? name + ' · You' : 'You') : name || 'Member · profile unavailable';
  }

  function renderNames() {
    for (const row of rows.values()) row.querySelector('strong').textContent = authorLabel(row.dataset.author);
    const combinedNames = new Map([...roomNames, ...names]);
    const visibleNames = privateChatId ? participants.map(id => combinedNames.get(id)).filter(Boolean) : [...combinedNames.values()];
    people.textContent = visibleNames.length ? (privateChatId ? 'Private conversation: ' : 'Community members: ') + visibleNames.join(', ') : '';
  }

  function connectionStatus() {
    if (!threadKnown) return;
    status.textContent = !openThread ? 'Archived or unopened conversation · read only.' :
      !connected ? 'Reconnecting · new replies are not yet confirmed.' :
      rows.size ? 'Connected · replies are saved to this community.' : 'Share a thought or Scripture passage to begin.';
    status.hidden = compact && connected && openThread && rows.size > 0;
  }

  async function sendPending(pending) {
    sending = true;
    availability();
    postStatus.textContent = 'Sending reply · awaiting server confirmation…';
    postStatus.dataset.saved = 'false';
    try {
      // One document ID survives navigation; pending sends cannot be submitted twice.
      await firestore.setDoc(firestore.doc(messages, pending.id), {
        authorId: uid, body: pending.body, createdAt: firestore.serverTimestamp(),
      });
      if (state.pending === pending) {
        state.pending = null;
        state.lastResult = 'Reply sent · saved to the community.';
        if (messageBody(state.body, state.reference) === pending.body) state.body = state.reference = '';
      }
      if (!active) return;
      if (messageBody(field.value, reference.value) === pending.body) {
        field.value = reference.value = '';
        attachment.open = false;
      }
      postStatus.textContent = 'Reply sent · saved to the community.';
      postStatus.dataset.saved = 'true';
      fitComposer();
    } catch (error) {
      state.pending = null;
      state.lastResult = 'Reply was not sent. Your draft is preserved.';
      if (!active) return;
      if (error.code === 'permission-denied') fail(error);
      postStatus.textContent = state.lastResult;
      postStatus.dataset.saved = 'false';
    } finally {
      sending = false;
      if (active) availability();
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || sending || state.pending) return;
    postStatus.dataset.saved = 'false';
    const body = messageBody(field.value, reference.value);
    if (!body || body.length > 1600) {
      postStatus.textContent = 'Use up to 1,600 characters, including the Scripture reference.';
      return;
    }
    sending = true;
    availability();
    if (reference.value.trim()) {
      postStatus.textContent = 'Checking Scripture reference…';
      try { await readPassage(reference.value.trim()); }
      catch (error) {
        sending = false;
        if (active) { postStatus.textContent = error.message; availability(); }
        return;
      }
    }
    if (!active || !member || !openThread || !connected) {
      sending = false;
      if (active) { postStatus.textContent = 'Connection changed. Your draft is preserved.'; availability(); }
      return;
    }
    remember();
    const pending = { id: firestore.doc(messages).id, body };
    state.pending = pending;
    pending.promise = sendPending(pending);
  });

  if (state.pending) {
    postStatus.textContent = 'Sending reply · awaiting server confirmation…';
    state.pending.promise?.finally(() => {
      if (!active) return;
      sending = false;
      field.value = state.body;
      reference.value = state.reference;
      postStatus.textContent = state.lastResult;
      postStatus.dataset.saved = String(state.lastResult === 'Reply sent · saved to the community.');
      fitComposer();
      availability();
    });
  }

  function mountConversation() {
    if (mounted || !active || !member) return;
    mounted = true;
    stops.push(firestore.onSnapshot(firestore.query(firestore.collection(group, 'profiles'), firestore.limit(50)),
      { includeMetadataChanges: true }, result => {
        if (!active || !member || result.metadata.fromCache) return;
        names.clear();
        for (const item of result.docs) {
          if (!item.metadata.hasPendingWrites) names.set(item.id, item.data().displayName);
        }
        preservePosition(renderNames);
      }, error => {
        if (!active || !member) return;
        names.clear();
        preservePosition(renderNames);
        profileUnavailable(error);
      }));
    const recent = firestore.query(messages, firestore.orderBy('createdAt', 'desc'), firestore.limit(50));
    stops.push(firestore.onSnapshot(recent, { includeMetadataChanges: true }, result => {
      if (!active || !member) return;
      connected = !result.metadata.fromCache;
      availability();
      if (!connected) { connectionStatus(); return; }
      preservePosition(() => {
        const ids = new Set();
        for (const item of [...result.docs].reverse()) {
          const { authorId, body } = item.data();
          if (item.metadata.hasPendingWrites) continue;
          ids.add(item.id);
          let row = rows.get(item.id);
          if (!row) {
            row = node('article', '', 'message');
            row.dataset.message = item.id;
            row.dataset.author = authorId;
            row.dataset.own = String(authorId === uid);
            const { content, references } = messageParts(body);
            row.append(node('strong', authorLabel(authorId)), text(content, 'source-copy'));
            for (const ref of references) row.append(button(ref, () => { remember(); passage(ref); }, 'quiet'));
            if (compact) {
              const saved = node('span', '✓', 'conversation-saved');
              saved.setAttribute('aria-label', 'Saved to conversation');
              saved.title = 'Saved to conversation';
              row.append(saved);
            } else row.append(text('Saved to community', 'form-caption'));
            rows.set(item.id, row);
          }
          feed.append(row);
        }
        for (const [id, row] of rows) if (!ids.has(id)) { row.remove(); rows.delete(id); }
        renderNames();
      }, true);
      connectionStatus();
    }, fail));
  }

  async function prepareProfile() {
    const existing = await firestore.getDocFromServer(profile);
    if (!active || !member) return;
    if (existing.exists()) return;
    nameForm = node('form');
    const nameLabel = node('label', 'Your community display name');
    const nameField = node('input');
    nameField.required = true;
    nameField.maxLength = 80;
    nameField.value = typeof displayName === 'string' ? displayName.trim().slice(0, 80) : '';
    nameLabel.append(nameField);
    const save = node('button', 'Use this name', 'button');
    save.type = 'submit';
    nameForm.append(nameLabel, save);
    stream.insertBefore(nameForm, feed);
    profileStatus.textContent = 'Choose the name fellow community members will see.';
    nameForm.addEventListener('submit', async event => {
      event.preventDefault();
      const value = nameField.value.trim();
      if (!active || !member || !value || save.disabled) return;
      save.disabled = true;
      profileStatus.textContent = 'Saving your community name…';
      try {
        await firestore.setDoc(profile, { displayName: value });
        if (!active || !member) return;
        nameForm.remove();
        profileStatus.textContent = '';
      } catch (error) {
        save.disabled = false;
        profileUnavailable(error);
      }
    });
  }

  // The owner's published rules gate this read with isMember(groupId).
  // A server-authorized thread read confirms access without exposing membership
  // documents. Cached snapshots alone never unlock the conversation.
  function watchCommunityAccess() {
    stops.push(firestore.onSnapshot(thread, { includeMetadataChanges: true }, snapshot => {
      if (!active) return;
      if (snapshot.metadata.fromCache) {
        connected = false;
        availability();
        connectionStatus();
        return;
      }
      member = true;
      threadKnown = true;
      roomNames.clear();
      const labels = snapshot.exists() ? snapshot.data().memberLabels : null;
      if (labels && typeof labels === 'object' && !Array.isArray(labels)) {
        for (const [id, label] of Object.entries(labels).slice(0, 4)) {
          if (typeof label === 'string' && label.trim() && label.length <= 80) roomNames.set(id, label);
        }
      }
      participants = snapshot.exists() && Array.isArray(snapshot.data().participantIds) ? snapshot.data().participantIds : [];
      if (privateChatId && snapshot.exists() && (participants.length !== 2 || !participants.includes(uid))) {
        fail({ code: 'permission-denied' }, 'access');
        return;
      }
      openThread = snapshot.exists() && (privateChatId ? participants.includes(uid) : snapshot.data().open === true);
      form.hidden = !openThread;
      if (compact && openThread) requestAnimationFrame(() => { if (active) fitComposer(); });
      if (snapshot.exists() && !mounted) {
        mountConversation();
        prepareProfile().catch(profileUnavailable);
      }
      availability();
      connectionStatus();
      if (!snapshot.exists()) status.textContent = threadId || privateChatId
        ? 'This conversation has not been set up yet.' : 'This week’s conversation has not been opened by the community yet.';
    }, error => fail(error, 'access')));
  }
  watchCommunityAccess();

  const close = () => {
    if (!active) return;
    remember();
    active = false;
    events.abort();
    for (const stop of stops.splice(0)) stop();
  };
  close.remember = remember;
  close.resume = () => {
    if (!active || !surface.isConnected) return;
    surface.scrollTop = state.top;
    if (!restored && rows.size) { restored = true; surface.scrollTop = returning ? initialTop : surface.scrollHeight; state.top = surface.scrollTop; }
    fitComposer();
  };
  return close;
}
