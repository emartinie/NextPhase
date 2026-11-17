import { mountFirebaseDiscussion } from './fellowship-firebase-discussion.js';

const projectId = 'homegroups-fellowship';

function signInError(error) {
  switch (error.code) {
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Google sign-in needs to be enabled in HomeGroups Fellowship first.';
    case 'auth/unauthorized-domain':
      return 'This preview address needs to be added to the project’s authorized domains.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Open this preview in Chrome or Edge and try again.';
    case 'auth/popup-closed-by-user':
      return 'The sign-in window closed. You can try again.';
    default:
      return 'Could not complete sign-in. Try again in a moment.';
  }
}

export function mountFirebaseFellowship(target, { node, text, button, year, week, configPath, setInviteUser }) {
  const controller = new AbortController();
  const status = text('Connecting to HomeGroups Fellowship…', 'form-caption');
  status.setAttribute('role', 'status');
  const discussion = node('div');
  target.append(text('Firebase preview · Private group', 'eyebrow'), node('h2', 'HomeGroups Fellowship'), status);
  let unsubscribe;
  let stopDiscussion;
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
    target.append(signIn, signOut, discussion);
    unsubscribe = authSdk.onAuthStateChanged(auth, async user => {
      const currentView = ++view;
      setInviteUser?.(user);
      stopDiscussion?.();
      discussion.replaceChildren();
      signIn.hidden = Boolean(user);
      signOut.hidden = !user;
      status.textContent = user
        ? `Signed in as ${user.displayName || 'Fellowship member'}.`
        : 'Sign in to open the private test discussion.';
      if (!user) return;
      if (week !== 7) {
        discussion.append(text('Choose Week 7 to open the pilot discussion.'));
        return;
      }
      try {
        const firestore = await import('https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js');
        if (controller.signal.aborted || currentView !== view) return;
        stopDiscussion = mountFirebaseDiscussion(discussion, {
          node, text, firestore, db: firestore.getFirestore(app), uid: user.uid, year, week,
        });
      } catch {
        if (!controller.signal.aborted && currentView === view) discussion.append(text('Could not open the discussion. Reload to try again.'));
      }
    });
  }

  connect().catch(error => {
    if (!controller.signal.aborted) status.textContent = error.message;
  });
  return () => { controller.abort(); unsubscribe?.(); stopDiscussion?.(); };
}
