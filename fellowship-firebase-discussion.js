export function mountFirebaseDiscussion(target, { node, text, firestore, db, uid, year, week }) {
  const status = text('Checking access to the private discussion…', 'form-caption');
  status.setAttribute('role', 'status');
  const feed = node('div');
  const form = node('form');
  form.hidden = true;
  const label = node('label', 'Reply');
  const field = node('textarea');
  field.required = true;
  field.maxLength = 1600;
  label.append(field);
  const submit = node('button', 'Post reply', 'button primary');
  submit.disabled = true;
  const postStatus = text('', 'form-caption');
  postStatus.setAttribute('role', 'status');
  form.append(label, submit, postStatus);
  target.append(node('h3', 'Wednesday HomeGroup'), status, feed, form);

  const thread = firestore.doc(db, 'groups', 'pilot-group', 'studyThreads', `${year}-week-${String(week).padStart(2, '0')}`);
  const messages = firestore.collection(thread, 'messages');
  let stopMessages;
  let active = true;
  let online = false;
  let sending = false;

  function showError(error) {
    if (!active) return;
    online = false;
    submit.disabled = true;
    feed.replaceChildren();
    form.hidden = true;
    status.textContent = error.code === 'permission-denied'
      ? 'This discussion is available only to enrolled members.'
      : 'Could not load the discussion. Reload to try again.';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const body = field.value.trim();
    if (!active || !online || sending || !body || body.length > 1600) return;
    sending = true;
    submit.disabled = true;
    postStatus.textContent = 'Posting reply…';
    try {
      await firestore.addDoc(messages, { authorId: uid, body, createdAt: firestore.serverTimestamp() });
      if (!active) return;
      if (field.value.trim() === body) field.value = '';
      postStatus.textContent = 'Reply posted.';
    } catch (error) {
      if (error.code === 'permission-denied') showError(error);
      if (active) postStatus.textContent = 'Reply could not be posted. Your text is still here.';
    } finally {
      sending = false;
      if (active) submit.disabled = !online;
    }
  });

  firestore.getDocFromServer(thread).then(snapshot => {
    if (!active) return;
    if (!snapshot.exists()) {
      status.textContent = 'The private test discussion is still being set up.';
      return;
    }
    const canPost = snapshot.data().open === true;
    const recent = firestore.query(messages, firestore.orderBy('createdAt', 'desc'), firestore.limit(50));
    stopMessages = firestore.onSnapshot(recent, { includeMetadataChanges: true }, result => {
      if (!active) return;
      if (result.metadata.fromCache) {
        online = false;
        submit.disabled = true;
        status.textContent = 'Waiting for Firestore to confirm access…';
        return;
      }
      online = canPost;
      submit.disabled = !online || sending;
      form.hidden = !canPost;
      const posts = result.docs.filter(item => !item.metadata.hasPendingWrites).reverse().map(item => {
        const { authorId, body } = item.data();
        const row = node('article', '', 'message');
        row.append(node('strong', authorId === uid ? 'You' : 'Group member'), text(body, 'source-copy'));
        return row;
      });
      feed.replaceChildren(...posts);
      status.textContent = canPost ? (posts.length ? '' : 'What stood out in the reading? Share a thought to start the conversation.') : 'Read-only discussion.';
    }, showError);
  }).catch(showError);

  return () => { active = false; stopMessages?.(); };
}
