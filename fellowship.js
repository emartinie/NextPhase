const STORAGE_KEY = 'nextphase-mainstage-local-v1';
export const members = [
  { id: 'miriam', name: 'Miriam Ellis', hello: 'I’m working through the weekly portion too. Which part would you like to read together?' },
  { id: 'daniel', name: 'Daniel Brooks', hello: 'Glad you reached out. If you share a Scripture reference, we can start there.' },
];

export function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return { drafts: saved.drafts ?? {}, posts: saved.posts ?? {}, notes: saved.notes ?? {} };
  } catch {
    return { drafts: {}, posts: {}, notes: {} };
  }
}

export function saveLocal(ledger) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
    return true;
  } catch {
    return false;
  }
}

export function fixture(year, week, liveYear, cycleWeek, portion, reference) {
  if (year === liveYear && [1, 6, cycleWeek].includes(week)) {
    return {
      name: 'Wednesday HomeGroup',
      opening: 'What do you notice on a second reading? Bring one observation or question to our next gathering, and include the verse that prompted it.',
      reply: 'I’m reading a little at a time this week. I’d like to hear what connections others see across the assigned passages.',
      reference,
    };
  }
  if (year === liveYear - 1 && [1, 6, cycleWeek].includes(week)) {
    return {
      name: 'Wednesday HomeGroup',
      opening: `As we close our ${year} discussion of ${portion}, add one insight you want to carry into the next study.`,
      reply: 'Coming back to the passage together helped me hear questions I missed on my own.',
      reference,
    };
  }
  return null;
}

