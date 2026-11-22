export const getFirestore = () => ({ path: '' });
let serial = 0;
export function doc(base, ...parts) {
  return {
    kind: 'doc', path: [base.path, ...(parts.length ? parts : ['auto-' + Date.now() + '-' + (++serial)])].filter(Boolean).join('/'),
    get id() { return this.path.split('/').at(-1); },
  };
}
export const collection = (base, ...parts) => ({ kind: 'collection', path: [base.path, ...parts].filter(Boolean).join('/') });
export const query = (base, ...constraints) => ({ ...base, kind: 'query', constraints });
export const orderBy = (...args) => ({ order: args });
export const limit = value => ({ limit: value });
export const where = (...args) => ({ where: args });
export const serverTimestamp = () => 'SERVER_TIME';
async function call(op, ref, data) {
  const result = await window.__testStore({ op, ref, uid: sessionStorage.getItem('__test-auth'), data });
  if (result.error) throw Object.assign(new Error(result.error), { code: result.code });
  return result;
}
const snapshot = data => ({
  id: data.id, metadata: { fromCache: Boolean(window.__testOffline), hasPendingWrites: false },
  exists: () => data.exists, data: () => data.data,
});
export async function getDocFromServer(ref) { return snapshot(await call('get', ref)); }
export const setDoc = (ref, data) => call('set', ref, data);
export function onSnapshot(ref, options, next, error) {
  let active = true, busy = false, last;
  const tick = async () => {
    if (!active || busy) return;
    busy = true;
    try {
      const data = await call('get', ref);
      const key = JSON.stringify([data, Boolean(window.__testOffline)]);
      if (active && key !== last) {
        last = key;
        next(ref.kind === 'query' ? { docs: data.docs.map(snapshot), metadata: { fromCache: Boolean(window.__testOffline) } } : snapshot(data));
      }
    } catch (e) { if (active) { active = false; clearInterval(timer); error(e); } }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 100);
  void tick();
  return () => { active = false; clearInterval(timer); };
}
