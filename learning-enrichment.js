
import { getAlphabetLab, getVisualTeachings } from './corpus.js';
import { audioSession } from './audio-session.js';

const languages = { hebrew: 'Hebrew', greek: 'Greek' };
const preziSource = /^https:\/\/prezi\.com\/p\/embed\/[A-Za-z0-9_-]+\/$/;

function whileInPanel(content, stop) {
  const dialog = content.closest('dialog');
  if (!dialog) return () => {};
  const observer = new MutationObserver(() => {
    if (content.isConnected && dialog.open) return;
    observer.disconnect();
    stop();
  });
  observer.observe(dialog, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
  return () => observer.disconnect();
}

export function createLearningEnrichment({ node, text, button, cluster, disclosure, link, row }) {
  return {
    async languageLab(target, { data }) {
      const alphabet = await getAlphabetLab();
      const position = { hebrew: 0, greek: 0 };
      let language = data.language === 'greek' ? 'greek' : 'hebrew';
      let paleo = false;
      let stopPlayback;
      const title = node('h3');
      const glyph = node('bdi', '', 'alphabet-glyph');
      const name = node('strong');
      const hint = text('', 'source-copy');
      const place = text('', 'eyebrow');
      const letter = node('div', '', 'alphabet-letter');
      letter.setAttribute('aria-live', 'polite');
      letter.append(place, glyph, name, hint);

      const grid = node('div', '', 'alphabet-grid');
      grid.setAttribute('aria-label', 'Choose a letter');
      grid.setAttribute('role', 'group');
      const status = text('');
      status.setAttribute('role', 'status');

      function renderLetter() {
        stopPlayback?.();
        status.textContent = '';
        const letters = alphabet[language];
        const current = letters[position[language]];
        glyph.textContent = language === 'hebrew' ? (paleo ? current.paleo : current.letter) : current.upper + ' ' + current.lower;
        glyph.lang = language === 'hebrew' ? (paleo ? 'phn' : 'he') : 'el';
        glyph.dir = language === 'hebrew' ? 'rtl' : 'ltr';
        name.textContent = current.name;
        place.textContent = (position[language] + 1) + ' of ' + letters.length;
        hint.textContent = language === 'hebrew'
          ? (paleo ? current.letter + ' · ' : '') + 'Sound · ' + current.sound
          : 'Transliteration · ' + current.translit + '    Sound · ' + current.sound;
        [...grid.children].forEach((tile, i) => {
          tile.setAttribute('aria-pressed', String(i === position[language]));
        });
      }

      function step(direction) {
        const length = alphabet[language].length;
        position[language] = (position[language] + direction + length) % length;
        renderLetter();
      }

      const scriptChoice = cluster(
        button('Modern Hebrew', () => setScript(false), 'pill'),
        button('Paleo-Hebrew', () => setScript(true), 'pill'),
      );
      scriptChoice.setAttribute('role', 'group');
      scriptChoice.setAttribute('aria-label', 'Hebrew script');

      function updateGlyphs() {
        [...grid.children].forEach((tile, i) => {
          const item = alphabet[language][i];
          tile.textContent = language === 'greek' ? item.upper + ' ' + item.lower : paleo ? item.paleo : item.letter;
          tile.lang = language === 'greek' ? 'el' : paleo ? 'phn' : 'he';
        });
      }

      function setScript(showPaleo) {
        paleo = showPaleo;
        scriptChoice.children[0].setAttribute('aria-pressed', String(!paleo));
        scriptChoice.children[1].setAttribute('aria-pressed', String(paleo));
        updateGlyphs();
        renderLetter();
      }

      const song = node('div');
      song.className = 'alphabet-song';
      song.hidden = true;
      song.append(button('Playback controls', () => window.dispatchEvent(new Event('audio:show-controls')), 'quiet'));
      const songSource = new URL('./corpus/learning/alephbet-song.mp3', import.meta.url).href;

      function trackSong() {
        // Closing the lesson removes its observers, not the persistent recording.
        const disconnect = whileInPanel(target, () => finish());
        let unsubscribe = () => {};
        const finish = () => {
          disconnect();
          unsubscribe();
          if (stopPlayback === stop) stopPlayback = undefined;
        };
        const stop = () => {
          if (audioSession.getState().source === songSource) audioSession.pause();
          finish();
        };
        stopPlayback = stop;
        unsubscribe = audioSession.subscribe(state => {
          if (state.source === songSource) status.textContent = state.message;
          else if (!state.source) status.textContent = 'Playback stopped.';
          else status.textContent = 'Another recording is selected.';
        });
        return stop;
      }

      function playSong() {
        stopPlayback?.();
        song.hidden = false;
        trackSong();
        audioSession.playRecording(songSource, 'Alephbet song');
      }

      function speak() {
        stopPlayback?.();
        const voice = window.speechSynthesis;
        if (!voice || typeof window.SpeechSynthesisUtterance !== 'function') {
          status.textContent = 'This browser has no system voice. Use the pronunciation guide above.';
          return;
        }
        const letter = alphabet.greek[position.greek];
        const utterance = new SpeechSynthesisUtterance(letter.name + '. ' + letter.sound + '.');
        let releaseSpeech = () => {};
        utterance.lang = 'en-US';
        utterance.rate = .82;
        const disconnect = whileInPanel(target, () => stop());
        const finish = () => {
          releaseSpeech();
          disconnect();
          if (stopPlayback === stop) stopPlayback = undefined;
        };
        const stop = () => {
          finish();
          voice.cancel();
        };
        utterance.onend = finish;
        utterance.onerror = () => {
          if (stopPlayback !== stop) return;
          finish();
          status.textContent = 'The system voice was unavailable. Use the pronunciation guide above.';
        };
        stopPlayback = stop;
        releaseSpeech = audioSession.claimSpeech(stop);
        status.textContent = 'Reading the pronunciation guide for ' + letter.name + '.';
        voice.speak(utterance);
      }

      const languagesChoice = cluster(...Object.entries(languages).map(([code, label]) =>
        button(label, () => { language = code; renderLanguage(); }, 'pill')));
      languagesChoice.setAttribute('role', 'group');
      languagesChoice.setAttribute('aria-label', 'Alphabet');
      const hebrewAudio = button('Play Alephbet song', playSong, 'button primary');
      const greekAudio = button('Speak letter', speak, 'button primary');
      const writingList = node('ul', '', 'alphabet-writing');
      writingList.append(...alphabet.writing.map(item => {
        const entry = node('li');
        const character = node('bdi', item.letter);
        character.lang = 'he';
        entry.append(character, node('span', item.name + ' · ' + item.sound));
        return entry;
      }));
      const writing = disclosure('Hebrew writing reference', writingList);
      const audioNotes = disclosure('Audio sources',
        text('The original includes the Hebrew song. The individual Hebrew recordings and Greek song were missing. Greek pronunciation uses your device’s English voice to read the guide.'));
      const arrows = cluster(button('Previous letter', () => step(-1)), button('Next letter', () => step(1)));

      function renderLanguage() {
        title.textContent = languages[language] + ' alphabet';
        [...languagesChoice.children].forEach((control, i) => {
          control.setAttribute('aria-pressed', String(Object.keys(languages)[i] === language));
        });
        scriptChoice.hidden = writing.hidden = hebrewAudio.hidden = language !== 'hebrew';
        greekAudio.hidden = language !== 'greek';
        if (language === 'greek') song.hidden = true;
        grid.replaceChildren(...alphabet[language].map((item, i) => {
          const tile = button('', () => {
            position[language] = i;
            renderLetter();
          }, 'alphabet-tile');
          tile.setAttribute('aria-label', 'Choose ' + item.name);
          return tile;
        }));
        grid.dir = language === 'hebrew' ? 'rtl' : 'ltr';
        if (language === 'hebrew') setScript(paleo);
        else {
          updateGlyphs();
          renderLetter();
        }
      }

      target.append(languagesChoice, title, scriptChoice, letter, arrows,
        cluster(hebrewAudio, greekAudio), song, status, grid, writing, audioNotes);
      renderLanguage();
    },

    async visualTeachings(target) {
      const { presentations } = await getVisualTeachings();
      const categories = [...new Set(presentations.map(item => item.category))];
      if (!categories.length) {
        target.append(text('The presentation catalog is empty.'));
        return;
      }
      let index = 0;
      let matches = [];
      let closePlayer;
      const picker = node('select');
      picker.setAttribute('aria-label', 'Presentation category');
      picker.append(...categories.map(category => new Option(category, category)));
      const field = node('label', 'Presentation category');
      field.append(picker);
      const title = node('h3');
      const position = text('', 'eyebrow');
      const current = node('div', '', 'learning-stack');
      current.setAttribute('aria-live', 'polite');
      current.append(position, title);
      const previous = button('Previous presentation', () => select(index - 1));
      const next = button('Next presentation', () => select(index + 1));
      const actions = cluster();
      const player = node('div', '', 'visual-player');
      const list = node('div', '', 'rows');
      const browse = disclosure('Browse this category', list);

      function loadPlayer(item, control) {
        const frame = node('iframe');
        frame.title = item.title + ' · Prezi presentation';
        frame.src = item.url;
        frame.referrerPolicy = 'no-referrer';
        frame.allow = 'fullscreen';
        frame.allowFullscreen = true;
        player.replaceChildren(frame, text('If the presentation doesn’t load here, try opening the source in Prezi.'));
        control.setAttribute('aria-expanded', 'true');
        control.textContent = 'Close player';
        const disconnect = whileInPanel(target, () => close());
        const close = () => {
          disconnect();
          player.replaceChildren();
          control.setAttribute('aria-expanded', 'false');
          control.textContent = 'Load Prezi player';
          closePlayer = undefined;
        };
        closePlayer = close;
      }

      function select(i) {
        if (!matches[i]) return;
        closePlayer?.();
        index = i;
        const item = matches[i];
        title.textContent = item.title;
        position.textContent = (index + 1) + ' of ' + matches.length + ' · ' + item.category;
        previous.disabled = index === 0;
        next.disabled = index === matches.length - 1;
        if (preziSource.test(item.url)) {
          const load = button('Load Prezi player', () => {
            if (closePlayer) closePlayer();
            else loadPlayer(item, load);
          }, 'button primary');
          load.setAttribute('aria-expanded', 'false');
          actions.replaceChildren(load, link('Open in Prezi ↗', item.url));
        } else actions.replaceChildren(text('The original presentation link is unavailable.'));
        [...list.children].forEach((control, j) => {
          control.setAttribute('aria-current', String(j === index));
        });
      }

      function filter() {
        matches = presentations.filter(item => item.category === picker.value);
        list.replaceChildren(...matches.map((item, i) => row(item.title, '', () => select(i))));
        select(0);
      }

      picker.addEventListener('change', filter);
      target.append(field, current, actions, player, cluster(previous, next), browse);
      filter();
    },
  };
}
