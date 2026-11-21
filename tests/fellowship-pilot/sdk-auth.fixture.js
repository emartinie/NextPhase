const observers = new Set();
export const browserSessionPersistence = {};
export const getAuth = () => ({});
export const setPersistence = async () => {};
export class GoogleAuthProvider { setCustomParameters() {} }
const user = () => {
  const uid = sessionStorage.getItem('__test-auth');
  return uid ? { uid, displayName: window.__testNames[uid] } : null;
};
export function onAuthStateChanged(auth, cb) {
  observers.add(cb);
  queueMicrotask(() => { if (observers.has(cb)) cb(user()); });
  return () => observers.delete(cb);
}
export async function signInWithPopup() {
  sessionStorage.setItem('__test-auth', window.__testAuthChoice);
  for (const cb of observers) cb(user());
}
export async function signOut() {
  sessionStorage.removeItem('__test-auth');
  for (const cb of observers) cb(null);
}
