// One persistent HTML audio element; every playback surface observes this session.
const audio = document.getElementById('audio');
const labels = { english: 'English', hebrew: 'Hebrew', greek: 'Greek', original: '' };
const listeners = new Set();
let queue = [], index = 0, language = 'original', autoNext = true, attempt = 0;
let title = 'Ready to listen', status = 'idle', message = 'Choose a recording in Listen.';
let speechOwner;

function stopSpeech() {
  const owner = speechOwner;
  speechOwner = null;
  owner?.();
}

function mediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function snapshot() {
  const available = Object.keys(queue[index]?.sources || {});
  return {
    title, status, message, source: audio.getAttribute('src') || '', language, autoNext,
    playing: !audio.paused && !audio.ended, currentTime: audio.currentTime || 0,
    duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    rate: audio.playbackRate, availableLanguages: available,
    canNext: queue.filter(track => track.sources[language]).length > 1,
  };
}

function emit(nextStatus = status, nextMessage = message) {
  status = nextStatus; message = nextMessage;
  const value = snapshot();
  for (const listener of listeners) listener(value);
}

function pause() {
  attempt++;
  audio.pause();
  emit(audio.hasAttribute('src') ? 'paused' : 'idle', audio.hasAttribute('src') ? 'Paused' : 'Choose a recording in Listen.');
}

function play() {
  stopSpeech();
  if (!audio.hasAttribute('src')) { emit('idle', 'Choose a recording in Listen.'); return Promise.resolve(false); }
  const request = ++attempt;
  emit('loading', 'Loading recording…');
  // Keep play in the initiating touch/click, without awaiting module/network work.
  try {
    return Promise.resolve(audio.play()).then(() => {
      if (request !== attempt) return false;
      emit('playing', 'Playing');
      return true;
    }).catch(error => {
      if (request !== attempt) return false;
      if (error.name === 'AbortError') emit('paused', 'Paused');
      else if (error.name === 'NotAllowedError') emit('blocked', 'Tap Play to start the recording.');
      else emit('error', 'This recording is unavailable. Try another recording.');
      return false;
    });
  } catch {
    emit('error', 'This recording is unavailable. Try another recording.');
    return Promise.resolve(false);
  }
}

function select(nextIndex, nextLanguage, autoplay) {
  const track = queue[nextIndex], source = track?.sources[nextLanguage];
  if (!source) return false;
  attempt++;
  audio.pause();
  index = nextIndex; language = nextLanguage;
  title = track.title + (labels[language] ? ' · ' + labels[language] : '');
  if (audio.getAttribute('src') !== source) audio.src = source;
  emit('ready', 'Ready to play');
  window.dispatchEvent(new CustomEvent('player:nowPlaying', {detail:{title, src:source, lang:language, index}}));
  if (autoplay) void play();
  return true;
}

function setPlaylist(tracks, options = {}) {
  const nextQueue = (Array.isArray(tracks) ? tracks : []).map(track => {
    const sources = {};
    for (const [key, value] of Object.entries(track?.sources || {})) {
      const url = mediaUrl(value);
      if (Object.hasOwn(labels, key) && url) sources[key] = url;
    }
    return {title: String(track?.title || 'Recording'), sources};
  });
  const nextIndex = options.index ?? 0, nextLanguage = options.language || 'original';
  if (!nextQueue[nextIndex]?.sources[nextLanguage]) {
    emit(status, 'No recording is available in that language.');
    return false;
  }
  queue = nextQueue;
  return select(nextIndex, nextLanguage, options.autoplay === true);
}

function playRecording(source, label) {
  return setPlaylist([{title:label || 'Recording', sources:{original:source}}], {autoplay:true});
}

function next(wrap = true) {
  let nextIndex = queue.findIndex((track, i) => i > index && track.sources[language]);
  if (nextIndex < 0 && wrap) nextIndex = queue.findIndex(track => track.sources[language]);
  if (nextIndex < 0 || nextIndex === index) return false;
  return select(nextIndex, language, true);
}

function setLanguage(value) {
  if (!queue[index]?.sources[value]) { emit(status, 'No recording is available in that language.'); return false; }
  return select(index, value, !audio.paused && !audio.ended);
}

function stop() {
  stopSpeech();
  attempt++;
  audio.pause(); audio.removeAttribute('src'); audio.load();
  queue = []; index = 0; language = 'original'; title = 'Ready to listen';
  emit('idle', 'Choose a recording in Listen.');
}

for (const event of ['play', 'playing']) audio.addEventListener(event, () => {
  if (!audio.paused && audio.hasAttribute('src')) { stopSpeech(); emit('playing', 'Playing'); }
});
audio.addEventListener('pause', () => {
  if (audio.paused && audio.hasAttribute('src') && !audio.ended && status !== 'error' && status !== 'blocked') emit('paused', 'Paused');
});
audio.addEventListener('waiting', () => { if (!audio.paused) emit('loading', 'Loading recording…'); });
audio.addEventListener('error', () => {
  if (audio.hasAttribute('src')) { attempt++; emit('error', 'This recording is unavailable. Try another recording.'); }
});
audio.addEventListener('ended', () => {
  if (!audio.ended) return;
  attempt++;
  if (!autoNext || !next(false)) emit('ended', 'Recording complete');
});
for (const event of ['timeupdate', 'loadedmetadata', 'durationchange', 'ratechange', 'seeked', 'emptied']) {
  audio.addEventListener(event, () => emit());
}

export const audioSession = {
  audio, play, pause, stop, playRecording, setPlaylist, setLanguage, next,
  claimSpeech(cancel) {
    stopSpeech(); pause(); speechOwner = cancel;
    return () => { if (speechOwner === cancel) speechOwner = null; };
  },
  toggle() { return audio.paused || audio.ended ? play() : pause(); },
  cycleLanguage() {
    const available = snapshot().availableLanguages;
    if (available.length > 1) setLanguage(available[(available.indexOf(language)+1) % available.length]);
  },
  setAutoNext(value) { autoNext = !!value; emit(); },
  cycleRate() {
    const rates = [1, 1.25, 1.5, 2];
    audio.playbackRate = rates[(rates.indexOf(audio.playbackRate)+1) % rates.length];
  },
  getState: snapshot,
  subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
  notice(text) { emit(status, text); },
};
