import {
  GAMES, triviaRound, scoreTrivia, triviaScore, bingoHeadings, bingoRound, callLabel,
  winningLine, opponentHasBingo, drawBingo, markBingo, claimBingo, finishBingoTurn,
} from './game-rules.js';

const storageKey = 'nextphase-fellowship-games-v1';
const triviaSource = './corpus/games/bible_questions_with_hints.json';
let bankRequest;

function loadQuestions() {
  if (!bankRequest) {
    bankRequest = fetch(triviaSource).then((response) => {
      if (!response.ok) throw new Error('Could not open the Bible Trivia questions.');
      return response.json();
    }).catch((error) => {
      bankRequest = null;
      throw error;
    });
  }
  return bankRequest;
}

function readGames() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch {
    // A missing or unreadable local save can start with an empty game list.
  }
  return {};
}

const statusNames = { pending: 'Awaiting response', declined: 'Declined', playing: 'In progress', completed: 'Completed' };

export function createGameView({ node, text, button, cluster, row, disclosure, members, passage }) {
  const saved = readGames();

  return function games(target, { data: { scope } }) {
    const invites = saved[scope] ??= [];
    let selected = null;
    const top = node('p', 'Local demo · invitations and turns stay in this browser.', 'subtle');
    const display = node('div', '', 'game-content');
    const storageStatus = text('');
    storageStatus.setAttribute('role', 'status');
    target.append(top, display, storageStatus);

    function persist() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(saved));
      } catch {
        storageStatus.textContent = 'Browser storage is unavailable. This game lasts for the current tab session.';
      }
    }

    function heading(label) {
      const title = node('h3', label);
      title.tabIndex = -1;
      return title;
    }

    function move(where, match = selected) {
      selected = match;
      where();
      const scroll = display.closest('.panel-body');
      if (scroll) scroll.scrollTop = 0;
      display.querySelector('h3')?.focus({ preventScroll: true });
    }

    function options(label, list) {
      const field = node('label', label);
      const select = node('select');
      select.required = true;
      select.setAttribute('aria-label', label);
      select.append(new Option('Choose ' + label.toLowerCase(), ''));
      for (const [id, name] of list) select.append(new Option(name, id));
      field.append(select);
      return { field, select };
    }

    function hub() {
      const form = node('form');
      const recipient = options('Participant', members.map(({ id, name }) => [id, name]));
      const game = options('Game', Object.entries(GAMES).map(([id, { name }]) => [id, name]));
      const names = text('');
      game.select.addEventListener('change', () => {
        names.textContent = GAMES[game.select.value]?.summary || '';
      });
      form.append(recipient.field, game.field, names, node('button', 'Send demo invitation', 'button primary'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!members.some(({ id }) => id === recipient.select.value) || !Object.hasOwn(GAMES, game.select.value)) return;
        const match = { memberId: recipient.select.value, type: game.select.value, status: 'pending' };
        invites.unshift(match);
        persist();
        move(details, match);
      });
      display.replaceChildren(heading('Invite someone'), form);
      if (invites.length) {
        const list = node('div', '', 'rows');
        for (const match of invites) {
          const member = members.find(({ id }) => id === match.memberId);
          if (!member || !Object.hasOwn(GAMES, match.type) || !Object.hasOwn(statusNames, match.status)) continue;
          list.append(row(GAMES[match.type].name + ' · ' + member.name, statusNames[match.status], () => move(details, match)));
        }
        if (list.childElementCount) display.append(heading('Your invitations'), list);
      }
    }

    function details(focusTarget) {
      const match = selected;
      const member = members.find(({ id }) => id === match.memberId);
      display.replaceChildren(heading(GAMES[match.type].name), text('You and ' + member.name + ' · Simulated participant'),
        button('Back to invitations', () => move(hub, null), 'quiet'));
      if (match.status === 'pending') {
        const status = text('Invitation pending. Try the recipient’s response as ' + member.name + '.');
        status.setAttribute('role', 'status');
        const decline = button('Decline invite', () => {
          match.status = 'declined';
          persist();
          move(details);
        }, 'quiet');
        const accept = button('Accept invite', async () => {
          accept.disabled = true;
          decline.disabled = true;
          status.textContent = 'Preparing the game…';
          try {
            match.game = match.type === 'trivia' ? triviaRound(await loadQuestions()) : bingoRound();
            match.status = 'playing';
            persist();
            move(details);
          } catch {
            status.textContent = 'The game could not start. Try accepting again.';
            accept.disabled = false;
            decline.disabled = false;
          }
        }, 'button primary');
        display.append(status, cluster(accept, decline));
      } else if (match.status === 'declined') {
        display.append(text(member.name + ' declined the demo invitation.', 'source-copy'));
      } else if (match.type === 'trivia') {
        trivia(match, member);
      } else {
        bingo(match, member);
      }
      if (typeof focusTarget === 'string') display.querySelector(focusTarget)?.focus({ preventScroll: true });
    }

    function scoreLine(yours, theirs, name) {
      const score = node('p', '', 'game-score');
      score.textContent = 'You ' + yours + ' · ' + name + ' ' + theirs;
      return score;
    }

    function trivia(match, member) {
      const game = match.game;
      const index = game.answers.length;
      const scores = triviaScore(game);
      if (match.status === 'completed') {
        const result = scores.yours === scores.theirs ? 'It’s a tie' :
          scores.yours > scores.theirs ? 'You win' : member.name + ' wins';
        display.append(text(result, 'game-result'), scoreLine(scores.yours, scores.theirs, member.name));
        const recap = node('ol', '', 'game-recap');
        game.questions.forEach((item, round) => {
          const entry = node('li');
          entry.append(node('strong', item.question), text(item.answer, 'source-copy'),
            text(game.answers[round].correct ? 'You scored this as correct.' : 'You scored this as missed.'));
          recap.append(entry);
        });
        display.append(disclosure('Review the five answers', recap));
        return;
      }

      const item = game.questions[index];
      const last = game.questions[index - 1];
      display.append(scoreLine(scores.yours, scores.theirs, member.name));
      if (last) display.append(text(member.name + (last.opponentCorrect ? ' scored the previous question.' : ' missed the previous question.')));
      display.append(text('Question ' + (index + 1) + ' of ' + game.questions.length, 'eyebrow'));
      const question = node('p', item.question, 'game-question');
      question.tabIndex = -1;
      display.append(question);

      if (!game.revealed) {
        const field = node('label', 'Your answer (optional)');
        const input = node('input');
        input.value = game.draft;
        input.maxLength = 240;
        input.autocomplete = 'off';
        input.addEventListener('input', () => {
          game.draft = input.value;
          persist();
        });
        field.append(input);
        const reveal = button('Reveal answer', () => {
          game.revealed = true;
          persist();
          details('.game-answer-title');
        }, 'button primary');
        const hint = button(game.showHint ? 'Hide hint' : 'Show hint', () => {
          game.showHint = !game.showHint;
          persist();
          details('.game-hint-toggle');
        }, 'quiet');
        hint.classList.add('game-hint-toggle');
        hint.setAttribute('aria-expanded', String(game.showHint));
        display.append(field, cluster(hint, reveal));
      }

      if (game.showHint || game.revealed) {
        const hintText = item.hint.trim();
        const reference = /^(?:[1-3]\s*)?[A-Za-z][A-Za-z. ]+\s*\d+(?::\d+(?:[-–]\d+)?)?$/.test(hintText);
        display.append(reference ? button('Read hint · ' + hintText, () => passage(hintText), 'quiet') :
          text('Hint · ' + hintText, 'source-copy'));
      }

      if (game.revealed) {
        const label = node('h4', 'Source answer', 'game-answer-title');
        label.tabIndex = -1;
        display.append(label, text(item.answer, 'source-copy'));
        if (game.draft.trim()) display.append(text('Your answer · ' + game.draft.trim()));
        display.append(text('Compare answers and mark your result.'));
        const mark = (correct) => {
          if (!scoreTrivia(game, correct)) return;
          if (game.answers.length === game.questions.length) {
            match.status = 'completed';
            persist();
            move(details);
          } else {
            persist();
            details('.game-question');
          }
        };
        display.append(cluster(button('I got it right', () => mark(true), 'button primary'), button('I missed it', () => mark(false), 'quiet')));
      }
    }

    function bingo(match, member) {
      const game = match.game;
      const playerLine = winningLine(game.yours, game.marks);
      const opponentLine = opponentHasBingo(game);
      const complete = match.status === 'completed';
      const current = game.calls.at(-1);
      display.append(text(complete ? ({
        you: 'You called Bingo!', opponent: member.name + ' called Bingo!', tie: 'You both called Bingo!',
      }[game.outcome]) : current ? callLabel(current) : 'Ready to draw', complete ? 'game-result' : 'game-call'));
      if (complete) display.append(text(game.calls.length + ' calls played'));
      else display.append(text(opponentLine ? member.name + ' has a line. Mark any called squares and check your card for a tie.' :
        'Mark numbers after they’re called. A row, column, or diagonal wins.'));

      const board = node('div', '', 'game-board');
      board.setAttribute('aria-label', 'Your Bingo card');
      board.setAttribute('role', 'group');
      for (const [index, letter] of bingoHeadings.entries()) {
        const header = node('span', letter, 'game-column');
        header.setAttribute('aria-label', 'Column ' + (index + 1) + ', ' + letter);
        board.append(header);
      }
      const called = new Set(game.calls);
      const marked = new Set(game.marks);
      game.yours.forEach((value, index) => {
        if (!value) {
          board.append(node('span', 'FREE', 'game-cell game-free'));
          return;
        }
        const cell = button(String(value), () => {
          if (!markBingo(game, value)) return;
          persist();
          details('[data-cell="' + index + '"]');
        }, 'game-cell');
        cell.dataset.cell = index;
        cell.classList.toggle('game-called', called.has(value));
        cell.classList.toggle('game-line', !!playerLine?.includes(index));
        cell.setAttribute('aria-label', callLabel(value));
        cell.setAttribute('aria-pressed', String(marked.has(value)));
        cell.disabled = complete || !called.has(value);
        board.append(cell);
      });
      display.append(board);

      function gameOver() {
        match.status = 'completed';
        persist();
        move(details);
      }

      if (!complete) {
        const call = button(opponentLine ? 'Finish turn' : 'Draw next number', () => {
          if (opponentHasBingo(game)) {
            if (finishBingoTurn(game)) gameOver();
          } else if (drawBingo(game)) {
            persist();
            details('.game-draw');
          }
        }, 'button primary game-draw');
        const claim = button('Call Bingo', () => {
          if (claimBingo(game)) gameOver();
        });
        claim.disabled = !playerLine;
        display.append(cluster(call, claim));
      }
      if (game.calls.length) {
        const calledList = node('p', game.calls.map(callLabel).join(' · '), 'source-copy');
        display.append(disclosure('Call history (' + game.calls.length + ')', calledList));
      }
    }
    hub();
  };
}
