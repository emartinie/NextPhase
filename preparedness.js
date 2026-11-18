import {
  exercise, roles, roster, plan, practiceMessage, channelNames, sourceLabels,
  loadPractice, savePractice, summary, addPracticeEvent, compareReadback, practiceClock, printablePractice,
} from './preparedness-model.js';

const areas = {
  dickson: {
    label: 'Dickson County, Tennessee',
    items: [
      ['Club nets and exercises', 'Published schedule · Check with the club before attending.', 'https://wc4dc.org/nets/'],
      ['KG4HDZ repeater listing', 'Club publication · Audio source unverified.', 'https://wc4dc.org/radio-programming/'],
    ],
  },
  kentucky: {
    label: 'Clark County, Kentucky',
    items: [
      ['Clark County weekly nets and nearby listings', 'Gateway Amateur Radio Club publishes a Winchester-area list. Confirm timing with the host.', 'https://www.garc-ky.org/'],
    ],
  },
};
const viewLabels = { group: 'Group', listen: 'Listen', plan: 'Plan & learn' };
const preferenceKey = 'nextphase-preparedness-area-v1';

function preferredArea() {
  try {
    const id = localStorage.getItem(preferenceKey);
    if (Object.hasOwn(areas, id)) return id;
  } catch {
    // Fall back to the example exercise area if storage is blocked.
  }
  return 'dickson';
}

export function createPreparednessViews({ node, text, button, cluster, disclosure, link, open }) {
  const record = loadPractice();
  let preferred = preferredArea();

  function localLink(label, url, mode) {
    const action = node('a', label, 'button');
    action.href = url;
    if (mode === 'download') action.download = 'homegroups-practice-plan.txt';
    if (mode === 'print') {
      action.target = '_blank';
      action.rel = 'noopener noreferrer';
    }
    return action;
  }

  function planActions() {
    const download = localLink('Save practice card', 'data:text/plain;charset=utf-8,' + encodeURIComponent(printablePractice()), 'download');
    return cluster(download, localLink('Open printable card ↗', './preparedness-plan.html', 'print'));
  }

  function renderPlan(target) {
    const list = node('dl', '', 'prep-plan');
    for (const [name, value] of plan) list.append(node('dt', name), node('dd', value));
    target.append(text('Practice plan · For a real emergency in the U.S., call 911.'), list, planActions());
  }

  function renderListening(target) {
    const audio = node('audio');
    audio.src = './corpus/preparedness/simulated-net.wav';
    audio.preload = 'none';
    audio.controls = true;
    audio.setAttribute('aria-label', 'Fictional practice net recording');
    const transcript = node('div', '', 'prep-stack');
    for (const [speaker, line] of practiceMessage.transcript) {
      const entry = node('div');
      entry.append(node('strong', speaker), text(line, 'source-copy'));
      transcript.append(entry);
    }
    target.append(node('h3', 'Listen to a practice net'), text('Scripted exercise · Synthetic narration'),
      audio, disclosure('Read the transcript', transcript),
      button('Practice a read-back', () => open('practiceReadback')));
  }

  return {
    preparedness(target, { data }) {
      const embeddedBack = data.surface === 'back';
      const labels = data.surface === 'front' ? { plan: 'Plan & learn', listen: 'Listen' } : viewLabels;
      let view = embeddedBack ? 'group' : Object.hasOwn(labels, data.initial) ? data.initial : Object.keys(labels)[0];
      let role = 'participant';
      let area = preferred;
      let renderedEntries = record.entries.length;
      const status = text('', 'status');
      status.setAttribute('role', 'status');
      const content = node('div', '', 'prep-stack');
      const controls = cluster(...Object.entries(labels).map(([key, label]) => {
        const control = button(label, () => { view = key; status.textContent = ''; render(); }, 'pill');
        control.dataset.view = key;
        return control;
      }));
      controls.setAttribute('aria-label', 'Preparedness views');
      controls.setAttribute('role', 'group');
      controls.hidden = embeddedBack;
      target.append(controls, content, status);

      function save(message) {
        status.textContent = savePractice(record) ? message : message + ' Browser storage is unavailable. Changes last for this tab.';
      }

      function action(label, run, style) {
        const control = button(label, () => {
          run();
          render();
          content.querySelector('.prep-heading')?.focus({ preventScroll: true });
        }, style);
        return control;
      }

      function header(label) {
        const title = node('h3', label, 'prep-heading');
        title.tabIndex = -1;
        content.append(title);
      }

      function rolePicker() {
        const field = node('label', 'Try a role');
        const select = node('select');
        select.setAttribute('aria-label', 'Try a role');
        for (const [key, value] of Object.entries(roles)) select.append(new Option(value.label, key));
        select.value = role;
        select.addEventListener('change', () => {
          role = select.value;
          status.textContent = '';
          render();
          content.querySelector('[aria-label="Try a role"]')?.focus({ preventScroll: true });
        });
        field.append(select);
        content.append(field);
      }

      function facts() {
        const counts = summary(record);
        const ledger = node('section', '', 'prep-result');
        ledger.append(text('Exercise clock · ' + practiceClock(record.entries.length - 1), 'eyebrow'),
          node('strong', counts.checked.size + ' checked in · ' + counts.awaiting + ' awaiting a check-in'),
          text(counts.expected + ' expected · ' + counts.acknowledged.size + ' briefing acknowledgments'),
          text('Awaiting means the exercise hasn’t logged a check-in.'));
        content.append(ledger);
        return counts;
      }

      function log() {
        const list = node('ol', '', 'prep-log');
        for (const { entry, index } of record.entries.map((entry, index) => ({ entry, index })).reverse()) {
          const row = node('li');
          row.append(node('strong', entry.actor), text(entry.note, 'source-copy'),
            text(practiceClock(index) + ' · ' + sourceLabels[entry.source]));
          list.append(row);
        }
        content.append(disclosure('Exercise log (' + record.entries.length + ')', list));
      }

      function participate(counts) {
        const person = roles.participant.name;
        if (record.participation !== 'joined') {
          const invited = record.participation === 'invited';
          content.append(node('p', invited ? 'Miriam is invited to the exercise.' : 'Miriam declined the practice invitation.', 'source-copy'),
            cluster(action(invited ? 'Join practice' : 'Join after all', () => {
              record.participation = 'joined';
              save('Miriam joined the local exercise.');
            }, 'button primary'),
            ...(invited ? [action('Decline practice', () => {
              record.participation = 'declined';
              save('Invitation declined in this browser.');
            }, 'quiet')] : [])));
          return;
        }
        content.append(text(exercise.briefing, 'source-copy'));
        const recordResponse = (type, note) => {
          if (addPracticeEvent(record, { type, source: 'app', actor: person, subject: person, note })) save(note);
        };
        const checked = counts.checked.has(person);
        const acknowledged = counts.acknowledged.has(person);
        const check = action(checked ? 'Check-in recorded' : 'Check in for this drill',
          () => recordResponse('check-in', 'Checked in for the exercise.'), 'button primary');
        const ack = action(acknowledged ? 'Briefing acknowledged' : 'Acknowledge briefing',
          () => recordResponse('ack', 'Acknowledged the exercise briefing.'), 'quiet');
        check.disabled = record.channel === 'fallback' || checked;
        ack.disabled = record.channel === 'fallback' || acknowledged;
        content.append(cluster(check, ack));
        if (record.channel === 'fallback') content.append(text('The app channel is interrupted in this scenario. Open the fallback to continue.'));
      }

      function operator(counts) {
        const person = roles.operator.name;
        content.append(text('Daniel is the fictional licensed radio lead. This exercise uses no radio or actual transmissions.'));
        const recipients = roster.filter((name) => !counts.checked.has(name));
        if (!recipients.length) {
          content.append(text('Every expected participant has an exercise check-in.'));
          return;
        }
        const form = node('form');
        const label = node('label', 'Practice report for');
        const select = node('select');
        select.required = true;
        select.setAttribute('aria-label', 'Practice report for');
        select.append(new Option('Choose a participant', ''), ...recipients.map((name) => new Option(name, name)));
        label.append(select);
        form.append(label, node('button', 'Log simulated radio check-in', 'button primary'));
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const subject = select.value;
          if (addPracticeEvent(record, { type: 'check-in', source: 'radio', actor: person, subject,
            note: 'Logged an exercise radio check-in for ' + subject + '.' })) {
            save('Simulated radio report saved in this browser.');
            render();
            content.querySelector('.prep-heading')?.focus({ preventScroll: true });
          }
        });
        content.append(form);
      }

      function coordinator() {
        const person = roles.coordinator.name;
        const fallback = record.channel === 'fallback';
        content.append(text('Ruth leads the exercise. The fictional radio lead is responsible for any simulated radio report.'),
          action(fallback ? 'Restore the practice app channel' : 'Simulate an app outage', () => {
            record.channel = fallback ? 'app' : 'fallback';
            const note = fallback ? 'Restored the practice app channel.' : 'Started the scenario outage and switched to the fallback plan.';
            addPracticeEvent(record, { type: 'channel', source: 'exercise', actor: person, note });
            save(note);
          }, 'button primary'));
        const form = node('form');
        const label = node('label', 'One improvement for the next drill');
        const input = node('input');
        input.maxLength = 180;
        input.value = record.improvement;
        label.append(input);
        input.addEventListener('input', () => {
          record.improvement = input.value;
          save('');
        });
        form.append(label, node('button', 'Complete exercise', 'button'));
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          addPracticeEvent(record, { type: 'complete', source: 'exercise', actor: person, note: 'Closed the exercise for debrief.' });
          record.finished = true;
          save('Exercise closed. The local debrief is ready.');
          render();
          content.querySelector('.prep-heading')?.focus({ preventScroll: true });
        });
        content.append(disclosure('Finish and debrief', form));
      }

      function groupView() {
        header(record.finished ? 'Exercise debrief' : exercise.title);
        content.append(text(exercise.group, 'source-copy'), text('Exercise · All participants and reports are fictional.'));
        const counts = facts();
        if (record.finished) {
          const attempts = record.entries.filter(({ type }) => type === 'readback');
          content.append(text(attempts.length + ' read-back attempts · ' + attempts.filter(({ matched }) => matched).length + ' matched the source'),
            text(record.improvement.trim() || 'No improvement was recorded.'),
            button('Open practice plan', () => open('practicePlan'), 'quiet'));
        } else {
          content.append(text(channelNames[record.channel], 'eyebrow'));
          if (record.channel === 'fallback') content.append(button('Open fallback plan', () => open('practicePlan'), 'button primary'));
          rolePicker();
          if (role === 'participant') participate(counts);
          if (role === 'operator') operator(counts);
          if (role === 'coordinator') coordinator();
        }
        log();
      }

      function listenView() {
        header('Listen and find local resources');
        content.append(cluster(button('Hear a practice net', () => open('practiceListen'), 'button primary'),
          button('Radio Network Map', () => open('prepMap', { zone: area === 'kentucky' ? 'winchester' : area })),
          button('Amateur radio resources', () => open('prepRadio', { zone: area === 'kentucky' ? 'winchester' : area }))));
        const field = node('label', 'Explore an area');
        const select = node('select');
        select.setAttribute('aria-label', 'Explore an area');
        for (const [key, choice] of Object.entries(areas)) select.append(new Option(choice.label, key));
        select.value = area;
        select.addEventListener('change', () => {
          area = select.value;
          render();
          content.querySelector('[aria-label="Explore an area"]')?.focus({ preventScroll: true });
        });
        field.append(select);
        content.append(field, text('Preferred area · ' + areas[preferred].label));
        if (area !== preferred) {
          content.append(action('Save as my preferred area', () => {
            try {
              localStorage.setItem(preferenceKey, area);
              status.textContent = 'Preferred area saved on this device.';
            } catch {
              status.textContent = 'Preferred area set for this tab.';
            }
            preferred = area;
          }, 'quiet'));
        }
        for (const [name, detail, url] of areas[area].items) {
          const card = node('section', '', 'prep-resource');
          card.append(link(name + ' ↗', url), text(detail));
          content.append(card);
        }
        content.append(link('NOAA Weather Radio locations ↗', 'https://www.weather.gov/nwr/station_listing'),
          text('Listings need internet. The practice clip and transcript are available in NextPhase.'));
      }

      function learnView() {
        header('Plan and learn');
        const entries = [
          ['Be Ready library', 'Browse 1,061 original catalog records.', 'prepLibrary'],
          ['Amateur radio resources', 'Licensing, listening, published nets and reference frequencies.', 'prepRadio'],
          ['Radio Network Map', 'Find legacy sample points and published repeater references.', 'prepMap'],
          ['The Common Ground', 'Read a short briefing with original sources.', 'commonGround'],
          ['Prayer Map', 'Explore community and prayer geography in its own view.', 'prepPrayer'],
          ['Research backlog', 'Explore all 36 original topics and their sources.', 'prepResearch'],
        ];
        for (const [label, description, type] of entries) {
          const row = button(label, () => open(type), 'prep-row');
          row.append(node('small', description));
          content.append(row);
        }
        content.append(cluster(button('Open practice plan', () => open('practicePlan'), 'button primary'),
          button('Practice a read-back', () => open('practiceReadback'))));
      }

      function render() {
        content.replaceChildren();
        for (const control of controls.children) control.setAttribute('aria-pressed', String(control.dataset.view === view));
        ({ group: groupView, listen: listenView, plan: learnView })[view]();
        renderedEntries = record.entries.length;
      }
      render();
      return () => {
        if (renderedEntries === record.entries.length) return;
        const expanded = [...content.querySelectorAll('details')].map(item => item.open);
        const selectedReport = content.querySelector('[aria-label="Practice report for"]')?.value;
        render();
        [...content.querySelectorAll('details')].forEach((item, index) => { item.open = Boolean(expanded[index]); });
        const report = content.querySelector('[aria-label="Practice report for"]');
        if (report && [...report.options].some(option => option.value === selectedReport)) report.value = selectedReport;
      };
    },
    practiceListen(target) {
      renderListening(target);
    },
    practicePlan(target) {
      renderPlan(target);
    },
    practiceReadback(target) {
      target.append(text('Practice logging what you heard. Use the fictional message only.'),
        button('Open the practice recording', () => open('practiceListen'), 'quiet'));
      const form = node('form');
      const fields = [['id', 'Message ID'], ['recipient', 'Recipient'], ['window', 'Pickup window and time zone']];
      const result = node('div', '', 'prep-stack');
      const storage = text('');
      storage.setAttribute('role', 'status');
      for (const [key, label] of fields) {
        const field = node('label', label);
        const input = node('input');
        input.required = true;
        input.maxLength = 90;
        input.value = record.draft[key] ?? '';
        input.addEventListener('input', () => {
          record.draft[key] = input.value;
          if (!savePractice(record)) storage.textContent = 'Browser storage is unavailable. Your draft stays in this tab.';
        });
        field.append(input);
        form.append(field);
      }
      form.append(node('button', 'Check my read-back', 'button primary'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const checks = compareReadback(record.draft);
        const matched = Object.values(checks).every(Boolean);
        const alert = text(matched ? 'Your read-back matches the source.' : 'Review the fields that need another try.', 'source-copy');
        alert.setAttribute('role', 'status');
        result.replaceChildren(alert);
        for (const [key, label] of fields) result.append(text(label + ' · ' + practiceMessage[key] + (checks[key] ? ' · Matches' : ' · Check again')));
        if (addPracticeEvent(record, { type: 'readback', source: 'exercise', actor: roles.participant.name, matched,
          note: matched ? 'Matched the source during a practice read-back.' : 'Compared a practice read-back and found a mismatch.' })) {
          if (!savePractice(record)) storage.textContent = 'Browser storage is unavailable. This result lasts for the current tab.';
        } else {
          storage.textContent = 'Exercise closed. You can still practice privately.';
        }
      });
      target.append(form, result, storage);
    },
  };
}
