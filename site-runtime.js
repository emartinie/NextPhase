// Runtime choice is explicit for the reviewed HomeGroups website destinations.
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
  const pages = url.protocol === 'https:' && url.hostname === 'emartinie.github.io'
    && (url.pathname === '/NextPhase' || url.pathname.startsWith('/NextPhase/'));
  const pilotMode = local ? requested : (hosted || pages) && requested === 'firebase' ? 'firebase' : null;
  return {
    localPreview:local, pilotMode, firebaseCommunication:hosted || pages || pilotMode === 'firebase',
    configPath:hosted ? '/__/firebase/init.json' : pages ? '/NextPhase/fellowship-web-config.json' : './__fellowship-firebase/config',
  };
}
