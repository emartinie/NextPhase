export const GAMES = {
  trivia: { name: 'Bible Trivia', summary: 'Five questions with Scripture hints.' },
  bingo: { name: 'Bible Bingo', summary: 'Mark called numbers to make a line.' },
};

const COLUMNS = [
  { letter: 'B', min: 1, max: 15 },
  { letter: 'I•', min: 16, max: 30 },
  { letter: 'B', min: 31, max: 45 },
  { letter: 'L', min: 46, max: 60 },
  { letter: 'E', min: 61, max: 75 },
];

export const bingoHeadings = COLUMNS.map(({ letter }) => letter);
const bingoNumbers = COLUMNS.flatMap(({ min, max }) =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index));
const lines = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
];

function shuffled(items, random) {
  const shuffledItems = [...items];
  for (let last = shuffledItems.length - 1; last > 0; last--) {
    const pick = Math.floor(random() * (last + 1));
    [shuffledItems[last], shuffledItems[pick]] = [shuffledItems[pick], shuffledItems[last]];
  }
  return shuffledItems;
}

export function triviaRound(records, random = Math.random) {
  const unique = new Map();
  for (const question of records) {
    const fields = [question?.question, question?.hint, question?.answer];
    if (!fields.every((field) => typeof field === 'string' && field.trim())) continue;
    unique.set(question.question.trim().toLowerCase(), question);
  }
  if (unique.size < 5) throw new Error('At least five questions are needed to start Trivia.');
  return {
    questions: shuffled([...unique.values()], random).slice(0, 5).map(({ question, hint, answer }) => ({
      question,
      hint,
      answer,
      opponentCorrect: random() < 0.6,
    })),
    answers: [],
    draft: '',
    showHint: false,
    revealed: false,
  };
}

export function scoreTrivia(game, correct) {
  if (!game.revealed || game.answers.length >= game.questions.length) return false;
  game.answers.push({ guess: game.draft, correct });
  game.draft = '';
  game.revealed = false;
  game.showHint = false;
  return true;
}

export function triviaScore(game) {
  return {
    yours: game.answers.filter(({ correct }) => correct).length,
    theirs: game.questions.slice(0, game.answers.length).filter(({ opponentCorrect }) => opponentCorrect).length,
  };
}

function bingoCard(random) {
  const columns = COLUMNS.map(({ min, max }) =>
    shuffled(Array.from({ length: max - min + 1 }, (_, index) => min + index), random).slice(0, 5));
  return Array.from({ length: 25 }, (_, index) => index === 12 ? 0 : columns[index % 5][Math.floor(index / 5)]);
}

export function bingoRound(random = Math.random) {
  return { deck: shuffled(bingoNumbers, random), yours: bingoCard(random), theirs: bingoCard(random), calls: [], marks: [], outcome: null };
}

export function callLabel(number) {
  const column = COLUMNS.find(({ min, max }) => number >= min && number <= max);
  return column ? column.letter + ' ' + number : '';
}

export function winningLine(card, marked) {
  const claimed = new Set(marked);
  return lines.find((line) => line.every((index) => card[index] === 0 || claimed.has(card[index]))) ?? null;
}

export function opponentHasBingo(game) {
  return Boolean(winningLine(game.theirs, game.calls));
}

export function drawBingo(game) {
  if (game.outcome || opponentHasBingo(game) || game.calls.length >= game.deck.length) return false;
  game.calls.push(game.deck[game.calls.length]);
  return true;
}

export function markBingo(game, number) {
  if (game.outcome || !game.calls.includes(number) || !game.yours.includes(number)) return false;
  if (!game.marks.includes(number)) game.marks.push(number);
  return true;
}

export function claimBingo(game) {
  if (game.outcome || !winningLine(game.yours, game.marks)) return false;
  game.outcome = opponentHasBingo(game) ? 'tie' : 'you';
  return true;
}

export function finishBingoTurn(game) {
  if (game.outcome || !opponentHasBingo(game)) return false;
  game.outcome = 'opponent';
  return true;
}
