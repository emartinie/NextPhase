const sessionKey = 'homegroups-fellowship-pilot-session';
const choices = [
  ['miriam', 'Miriam Ellis'], ['daniel', 'Daniel Brooks'], ['outsider', 'Outside Tester'],
];

export function mountLocalFellowship(target, { node, text, button, cluster, year, week }) {
  const controller = new AbortController();
  const status = text('Opening the local Fellowship pilot…', 'form-caption');
  status.setAttribute('role', 'status');
  const body = node('div');
  target.append(text('Local pilot · Test identities', 'eyebrow'), node('h2', 'Wednesday HomeGroup'),
    text('Replies, invitations, and group access reset when the local pilot restarts.'), status, body);
  let timer;
  let version = 0;
  const current = value => !controller.signal.aborted && value === version;

  async function api(route, payload) {
    const key = sessionStorage.getItem(sessionKey);
    const response = await fetch(new URL(`./__fellowship-pilot/${route}`, location.href), {
      method: payload ? 'POST' : 'GET', signal: controller.signal,
      headers: { ...(key && { Authorization: `Bearer ${key}` }), ...(payload && { 'Content-Type': 'application/json' }) },
      body: payload && JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status });
    return result;
  }

  function inviteCreator(view) {
    const panel = node('details');
    const recipientLabel = node('label', 'Test recipient');
    const recipient = node('select');
    const option = node('option', 'Outside Tester');
    option.value = 'outsider';
    recipient.append(option);
    recipientLabel.append(recipient);
    const feedback = text('', 'form-caption');
    feedback.setAttribute('role', 'status');
    const output = node('label', 'Invitation link');
    const field = node('input');
    field.type = 'text';
    field.readOnly = true;
    field.addEventListener('focus', () => field.select());
    output.append(field);
    output.hidden = true;
    const create = button('Create invite link', async () => {
      create.disabled = true;
      feedback.textContent = 'Creating invitation…';
      output.hidden = true;
      field.value = '';
      try {
        const { id } = await api('invites', { recipient: recipient.value });
        if (!current(view)) return;
        const url = new URL(location.href);
        url.searchParams.set('face', 'fellowship');
        url.searchParams.set('week', week);
        url.hash = `invite=${id}`;
        field.value = url.href;
        output.hidden = false;
        feedback.textContent = 'Link ready. Copy it into another tab on this computer. It expires in 12 hours or after one use.';
      } catch (error) {
        if (current(view)) feedback.textContent = error.message;
      } finally {
        if (current(view)) create.disabled = false;
      }
    });
    panel.append(node('summary', 'Invite a member'), recipientLabel, create, feedback, output);
    return panel;
  }

  async function render(joined = false) {
    clearTimeout(timer);
    const view = ++version;
    body.replaceChildren();
    try {
      const session = await api('session');
      if (!current(view)) return;
      if (session.year !== year || session.week !== week) {
        status.textContent = `The pilot discussion is Week ${session.week} of ${session.year}.`;
        const url = new URL(location.href);
        url.searchParams.set('week', session.week);
        url.searchParams.set('face', 'fellowship');
        const link = node('a', 'Open the test discussion', 'button');
        link.href = url.href;
        body.append(link);
        return;
      }
      const url = new URL(location.href);
      const invitation = new URLSearchParams(url.hash.slice(1)).get('invite');
      if (!session.name) {
        status.textContent = invitation === null
          ? 'Choose a test identity. Open a second tab and choose another one.'
          : 'Choose the test identity that received the invitation.';
        const controls = cluster(...choices.map(([member, label]) => button(label, async () => {
          for (const control of controls.querySelectorAll('button')) control.disabled = true;
          try {
            const { key } = await api('session', { member });
            if (!current(view)) return;
            sessionStorage.setItem(sessionKey, key);
            await render();
          } catch (error) {
            if (!current(view)) return;
            status.textContent = 'Could not start the test session. Try again.';
            for (const control of controls.querySelectorAll('button')) control.disabled = false;
          }
        })));
        body.append(controls);
        return;
      }

      status.textContent = joined ? `Invitation accepted. You joined as ${session.name}.` : `Signed in as ${session.name}.`;
      const signOut = button('Sign out', async () => {
        signOut.disabled = true;
        try { await api('session/end', {}); } catch { /* End the browser session either way. */ }
        if (!current(view)) return;
        sessionStorage.removeItem(sessionKey);
        await render();
      }, 'quiet');
      body.append(signOut);
      if (invitation !== null) {
        const feedback = text('', 'form-caption');
        feedback.setAttribute('role', 'status');
        const clearInvitation = () => {
          url.hash = '';
          history.replaceState(history.state, '', url);
        };
        const accept = button('Accept invitation', async () => {
          accept.disabled = cancel.disabled = signOut.disabled = true;
          feedback.textContent = 'Accepting invitation…';
          try {
            await api('invites/accept', { id: invitation });
            if (!current(view)) return;
            clearInvitation();
            await render(true);
          } catch (error) {
            if (!current(view)) return;
            feedback.textContent = error.message;
            accept.disabled = cancel.disabled = signOut.disabled = false;
          }
        });
        const cancel = button('Back to discussion', () => {
          clearInvitation();
          void render();
        }, 'quiet');
        body.append(text('You have a group invitation link.'), cluster(accept, cancel), feedback);
        return;
      }
      if (session.role === 'leader') body.append(inviteCreator(view));
      const feed = node('div');
      const feedStatus = text('Loading replies…', 'form-caption');
      feedStatus.setAttribute('role', 'status');
      const form = node('form');
      form.hidden = true;
      const label = node('label', 'Reply');
      const field = node('textarea');
      field.maxLength = 1600;
      field.required = true;
      label.append(field);
      const submit = node('button', 'Post reply', 'button primary');
      const postStatus = text('', 'form-caption');
      postStatus.setAttribute('role', 'status');
      form.append(label, submit, postStatus);
      body.append(feedStatus, feed, form);

      let lastFeed;
      async function refresh() {
        try {
          const { messages } = await api('messages');
          if (!current(view)) return;
          const snapshot = JSON.stringify(messages);
          if (snapshot !== lastFeed) {
            feed.replaceChildren(...messages.map(({ name, body: reply }) => {
              const item = node('article', '', 'message');
              item.append(node('strong', name), text(reply, 'source-copy'));
              return item;
            }));
            lastFeed = snapshot;
          }
          feedStatus.textContent = messages.length ? '' : 'Be the first to post a reply.';
          form.hidden = false;
        } catch (error) {
          if (!current(view)) return;
          if (error.status === 401) {
            sessionStorage.removeItem(sessionKey);
            await render();
            return;
          }
          if (error.status === 403) {
            feed.replaceChildren();
            feedStatus.textContent = error.message;
            form.hidden = true;
            return;
          }
          feedStatus.textContent = 'Could not refresh the discussion. Retrying…';
        }
        if (current(view)) timer = setTimeout(refresh, 900);
      }

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const reply = field.value.trim();
        if (!reply || submit.disabled) return;
        submit.disabled = true;
        postStatus.textContent = 'Posting reply…';
        try {
          await api('messages', { body: reply });
          if (!current(view)) return;
          if (field.value.trim() === reply) field.value = '';
          postStatus.textContent = 'Reply posted.';
        } catch (error) {
          if (!current(view)) return;
          postStatus.textContent = error.status && error.status < 500
            ? error.message : 'Could not confirm the reply. Check the discussion before trying again.';
        } finally {
          if (current(view)) submit.disabled = false;
        }
      });
      await refresh();
    } catch {
      if (current(view)) status.textContent = 'Open the link from the local Fellowship pilot server to try this discussion.';
    }
  }

  window.addEventListener('hashchange', () => { void render(); }, { signal: controller.signal });
  void render();
  return () => { controller.abort(); clearTimeout(timer); };
}
