// Runtime choice is explicit for the reviewed HomeGroups Hosting destinations.
// This does not grant membership or change Authentication/Firestore settings.
const productionHosts = new Set([
  'homegroups.org', 'www.homegroups.org',
  'homegroups-fellowship.web.app', 'homegroups-fellowship.firebaseapp.com',
]);

export function fellowshipRuntime(address) {
  const url = new URL(address);
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
  const requested = url.searchParams.get('pilot');
  const hosted = url.protocol === 'https:' && (productionHosts.has(url.hostname)
    || /^homegroups-fellowship--iphone-pilot-[a-z0-9]+\.web\.app$/.test(url.hostname));
  const pilotMode = local ? requested : hosted && requested === 'firebase' ? 'firebase' : null;
  return {
    localPreview:local, pilotMode, firebaseCommunication:hosted || pilotMode === 'firebase',
    configPath:hosted ? '/__/firebase/init.json' : './__fellowship-firebase/config',
  };
}
