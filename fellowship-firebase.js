import { mountFirebaseDiscussion } from './fellowship-firebase-discussion.js';
import { clearDiscussionSessions } from './fellowship-session.js';
import { mountFellowshipChats } from './fellowship-chats.js';

const projectId = 'homegroups-fellowship';
let observedUid;
const roomSelections = new Map();

function signInError(error) {
  switch (error.code) {
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Google sign-in needs to be enabled in HomeGroups Fellowship first.';
    case 'auth/unauthorized-domain':
      return 'This preview address needs to be added to the project’s authorized domains.';
    case 'auth/popup-blocked':
      return 'Your browser blocked Google sign-in. Allow the sign-in window and try again.';
    case 'auth/popup-closed-by-user':
      return 'The sign-in window closed. You can try again.';
    default:
      return 'Could not complete sign-in. Try again in a moment.';
  }
}

export function mountFirebaseFellowship(target, { node, text, button, year, week, configPath, setInviteUser, passage, readPassage, surface, onConversationChange, onOpenConversation, onIdentityChange, getStudyContext }) {
  const controller = new AbortController();
  const status = text('Connecting to HomeGroups Fellowship…', 'form-caption');
  status.setAttribute('role', 'status');
  const discussion = node('div');
  const chatHub = node('div');
  const focused = typeof onOpenConversation === 'function';
  const account = node('details', '', 'fellowship-account');
  const accountLabel = node('summary', 'Account');
  account.append(accountLabel);
  if (focused) target.append(status, account);
  else target.append(text('Private community', 'eyebrow'), node('h2', 'HomeGroups Fellowship'), status);
  let unsubscribe;
  let stopDiscussion;
  let chats;
  let mountConversation;
  let selectRoom = () => { status.textContent = 'Sign in to open your saved conversations.'; };
  let view = 0;

  async function connect() {
    const response = await fetch(configPath, { signal: controller.signal });
    if (!response.ok) throw new Error('The Firebase preview configuration could not be loaded.');
    const config = await response.json();
    if (config.projectId !== projectId) throw new Error('Expected the HomeGroups Fellowship Firebase project.');
    const [firebase, authSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js'),
    ]);
    if (controller.signal.aborted) return;
    const name = 'homegroups-fellowship-preview';
    const app = firebase.getApps().find(candidate => candidate.name === name) ?? firebase.initializeApp(config, name);
    const auth = authSdk.getAuth(app);
    await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
    if (controller.signal.aborted) return;
    const provider = new authSdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const signIn = button('Sign in with Google', async () => {
      signIn.disabled = true;
      status.textContent = 'Opening Google sign-in…';
      try { await authSdk.signInWithPopup(auth, provider); }
      catch (error) { status.textContent = signInError(error); }
      finally { signIn.disabled = false; }
    }, 'button primary');
    const signOut = button('Sign out', async () => {
      try { await authSdk.signOut(auth); }
      catch { status.textContent = 'Could not sign out. Try again.'; }
    }, 'quiet');
    signIn.hidden = true;
    signOut.hidden = true;
    if (focused) { account.append(signOut); target.append(signIn, chatHub); }
    else target.append(signIn, signOut, chatHub, discussion);
    unsubscribe = authSdk.onAuthStateChanged(auth, async user => {
      if (controller.signal.aborted) return;
      const currentView = ++view;
      setInviteUser?.(user);
      stopDiscussion?.();
      stopDiscussion = null;
      chats?.close();
      chats = null;
      mountConversation = null;
      chatHub.replaceChildren();
      selectRoom = () => { status.textContent = 'Sign in to open your saved conversations.'; signIn.focus(); };
      if (observedUid && observedUid !== user?.uid) {
        clearDiscussionSessions(observedUid);
        roomSelections.delete(observedUid);
      }
      onIdentityChange?.(user?.uid || null);
      observedUid = user?.uid;
      discussion.replaceChildren();
      onConversationChange?.(null);
      signIn.hidden = Boolean(user);
      signOut.hidden = !user;
      account.hidden = !user;
      account.open = false;
      accountLabel.textContent = user?.displayName || 'Account';
      status.textContent = user
        ? focused ? '' : `Signed in as ${user.displayName || 'Fellowship member'}.`
        : 'Sign in to open your community conversation.';
      if (!user) return;
      try {
        const firestore = await import('https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js');
        if (controller.signal.aborted || currentView !== view) return;
        const db = firestore.getFirestore(app);
        mountConversation = (host, selection, options = {}) => {
          if (controller.signal.aborted || currentView !== view) return null;
          stopDiscussion?.();
          const stop = mountFirebaseDiscussion(host, {
            node, text, button, firestore, db, uid: user.uid,
            displayName: user.displayName, ...(getStudyContext?.() || { year, week }),
            ...(selection.kind === 'weekly' ? { year: selection.year, week: selection.week } : {}),
            passage, readPassage, surface,
            ...(selection.kind === 'household' ? { groupId: 'household-pilot', threadId: 'household', title: 'Household conversation' } : {}),
            ...(selection.kind === 'private' ? { groupId: 'household-pilot', privateChatId: selection.id, title: selection.title } : {}),
            ...options,
          });
          stopDiscussion = stop;
          return stop;
        };
        selectRoom = selection => {
          if (controller.signal.aborted || currentView !== view) return;
          if (selection.kind === 'weekly') selection = { ...selection, ...(getStudyContext?.() || { year, week }) };
          roomSelections.set(user.uid, selection);
          if (focused) { account.open = false; onOpenConversation(selection); return; }
          discussion.replaceChildren();
          const route = new URL(location.href);
          if (selection.kind === 'household') route.searchParams.set('room', 'household');
          else route.searchParams.delete('room');
          history.replaceState(history.state, '', route);
          onConversationChange?.(selection.kind === 'weekly' ? null : selection.kind === 'private' ? 'Private conversation' : 'Household');
          mountConversation(discussion, selection);
        };
        const requestedRoom = new URLSearchParams(location.search).get('room') === 'household'
          ? { kind: 'household', title: 'Household conversation' } : { kind: 'weekly' };
        if (!focused || requestedRoom.kind === 'household') selectRoom(focused ? requestedRoom : roomSelections.get(user.uid) || requestedRoom);
        try { chats = mountFellowshipChats(chatHub, { node, text, button, firestore, db, uid: user.uid, onSelect: selectRoom, compact: focused }); }
        catch { chatHub.append(text('Saved private chats are not available yet.', 'form-caption')); }
      } catch {
        if (!controller.signal.aborted && currentView === view) (focused ? chatHub : discussion).append(text('Could not open the discussion. Reload to try again.'));
      }
    });
  }

  connect().catch(error => {
    if (!controller.signal.aborted) status.textContent = error.message;
  });
  const close = () => { controller.abort(); unsubscribe?.(); stopDiscussion?.(); chats?.close(); };
  close.showChatWith = () => { if (chats) chats.show(); else selectRoom({ kind: 'weekly' }); };
  close.showHousehold = () => selectRoom({ kind: 'household', title: 'Household conversation' });
  close.showWeekly = () => selectRoom({ kind: 'weekly' });
  close.mountConversation = (host, selection, options) => mountConversation?.(host, selection, options);
  return close;
}
