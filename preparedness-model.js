export const exercise = {
  id: 'wednesday-storm-outreach-practice',
  group: 'Wednesday HomeGroup',
  title: 'Storm outreach practice',
  briefing: 'Confirm you received this briefing, then practice logging the pickup window. Use only the fictional details in this exercise.',
};

export const roles = {
  participant: { name: 'Miriam Ellis', label: 'Miriam · Participant' },
  coordinator: { name: 'Ruth Miller', label: 'Ruth · Group coordinator' },
  operator: { name: 'Daniel Brooks', label: 'Daniel · Radio lead' },
};

export const roster = [
  roles.participant.name, roles.coordinator.name, roles.operator.name, 'Leah Harris',
  'Samuel Reed', 'Naomi Clark', 'Esther Brooks', 'Anna Jones', 'Caleb Hill', 'Ezra Davis',
  'Hannah Lee', 'Josiah Wade', 'Luke Scott', 'Mary Bell', 'Phoebe Ross', 'Silas Reed',
];

export const practiceMessage = {
  id: '04',
  recipient: 'Miriam',
  window: '7–8 PM Central',
  transcript: [
    ['Net control', 'Exercise. Message zero four for Miriam. Please confirm the pickup window, seven to eight PM Central.'],
    ['Miriam', 'I copied the window as seven to eight PM Central.'],
    ['Net control', 'That is correct. End of exercise.'],
  ],
};

export const plan = [
  ['Primary', 'Use the Fellowship practice check-in while the simulated app channel is available.'],
  ['Alternate', 'For this digital-only exercise, rehearse an off-app contact using a fictional message and a printed copy of the plan.'],
  ['Contingency', 'The coordinator reviews unanswered acknowledgments privately. The fictional radio lead may log an exercise-only report.'],
  ['Emergency', 'If there is an actual emergency in the U.S., call 911 and follow official instructions.'],
];

export const channelNames = {
  app: 'App channel available in this scenario',
  fallback: 'Fallback plan in use',
};

export const sourceLabels = {
  app: 'App · Self-reported',
  radio: 'Radio · Simulated operator report',
  exercise: 'Exercise · Local entry',
};

const storeKey = 'nextphase-preparedness-practice-v1';

function seed() {
  const confirmed = [roles.coordinator.name, roles.operator.name, 'Leah Harris', 'Samuel Reed'];
  const entries = confirmed.map((actor) => ({ type: 'check-in', source: 'app', actor, subject: actor, note: 'Checked in for the exercise.' }));
  entries.push({ type: 'check-in', source: 'radio', actor: roles.operator.name, subject: 'Naomi Clark', note: 'Entered a fictional check-in relayed in the scenario.' });
  entries.push(...confirmed.slice(0, 2).map((actor) => ({ type: 'ack', source: 'app', actor, subject: actor, note: 'Acknowledged the exercise briefing.' })));
  return { participation: 'invited', channel: 'app', finished: false, draft: {}, improvement: '', entries };
}

export function loadPractice() {
  try {
    const record = JSON.parse(localStorage.getItem(storeKey) || 'null');
    if (record && Array.isArray(record.entries) && record.draft) return record;
  } catch {
    // Start the scenario again if browser storage cannot be read.
  }
  return seed();
}

export function savePractice(record) {
  try {
    localStorage.setItem(storeKey, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function summary(record) {
  const checked = new Set(), acknowledged = new Set();
  for (const { type, subject } of record.entries) {
    if (!roster.includes(subject)) continue;
    if (type === 'check-in') checked.add(subject);
    if (type === 'ack') acknowledged.add(subject);
  }
  return { expected: roster.length, checked, acknowledged, awaiting: roster.length - checked.size };
}

export function addPracticeEvent(record, entry) {
  if (record.finished || !Object.hasOwn(sourceLabels, entry.source)) return false;
  if (['check-in', 'ack'].includes(entry.type)) {
    const current = summary(record);
    if (!roster.includes(entry.subject) || current[entry.type === 'ack' ? 'acknowledged' : 'checked'].has(entry.subject)) return false;
  }
  record.entries.push(entry);
  return true;
}

export function compareReadback(draft) {
  const clean = (value) => String(value ?? '').trim().toLowerCase().replace(/[\u2013\u2014]/g, '-');
  const time = clean(draft.window).replace(/\./g, '').replace(/\bseven\b/g, '7').replace(/\beight\b/g, '8');
  return {
    id: /^(?:message\s+)?0?4$/.test(clean(draft.id)),
    recipient: /^miriam(?:\s+ellis)?$/.test(clean(draft.recipient)),
    window: /^7(?::00)?(?:\s*pm)?\s*(?:-|to)\s*8(?::00)?\s*pm\s*(?:central(?: time)?|ct|cst|cdt)$/.test(time),
  };
}

export function practiceClock(index) {
  const elapsed = 65 + index;
  return (6 + Math.floor(elapsed / 60)) + ':' + String(elapsed % 60).padStart(2, '0') + ' PM Central';
}

export function printablePractice() {
  return [exercise.title, exercise.group, 'SIMULATED EXERCISE • Printable practice card', '',
    ...plan.flatMap(([name, value]) => [name, value, '']),
    'When using a fallback, record what was received, by whom, and when.',
    'Awaiting a check-in means the exercise has not logged a check-in for that participant.'].join('\n');
}
