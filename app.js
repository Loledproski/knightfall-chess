/* Knightfall's game rules run in the browser for a fast, friendly first version.
   The production roadmap is to repeat this validation on the server as well. */

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECES = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const VALUES = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 0 };
const DIFFICULTY_LEVELS = [
  { id: 'beginner', name: 'Beginner', elo: '400', pool: 99, replies: false, think: 340 },
  { id: 'apprentice', name: 'Apprentice', elo: '700', pool: 18, replies: false, think: 400 },
  { id: 'intermediate', name: 'Intermediate', elo: '1000', pool: 9, replies: false, think: 480 },
  { id: 'advanced', name: 'Advanced', elo: '1300', pool: 4, replies: false, think: 570 },
  { id: 'master', name: 'Master', elo: '1600', pool: 1, replies: true, think: 720 },
  { id: 'morphy', name: 'Paul Morphy', elo: '1900', pool: 1, replies: true, think: 800 },
  { id: 'capablanca', name: 'José Raúl Capablanca', elo: '2200', pool: 1, replies: true, think: 900 },
  { id: 'fischer', name: 'Bobby Fischer', elo: '2500', pool: 1, replies: true, think: 1040 },
  { id: 'kasparov', name: 'Garry Kasparov', elo: '2900', pool: 1, replies: true, think: 1160 },
  { id: 'magnus', name: 'Magnus Carlsen', elo: '3200+', pool: 1, replies: true, think: 1300 },
];
const TIME_CONTROLS = [
  { id: 'bullet', name: 'Bullet', seconds: 60, label: '1 min Bullet' },
  { id: 'blitz', name: 'Blitz', seconds: 300, label: '5 min Blitz' },
  { id: 'rapid', name: 'Rapid', seconds: 1800, label: '30 min Rapid' },
  { id: 'classical', name: 'Classical', seconds: 3600, label: '60 min Classical' },
];
const PROGRESS_KEY = 'knightfall-player-progress-v2';
const THEME_KEY = 'knightfall-theme-v1';
const BOARD_THEME_KEY = 'knightfall-board-theme-v1';
const BOARD_THEMES = ['classic', 'medieval', 'scifi', 'nature', 'luxury', 'fun'];

const boardElement = document.querySelector('#board');
const moveListElement = document.querySelector('#moveList');
const queueOverlay = document.querySelector('#queueOverlay');
const matchmakingModal = document.querySelector('#matchmakingModal');
const toastElement = document.querySelector('#toast');
const gameEndModal = document.querySelector('#gameEndModal');
const captureCallout = document.querySelector('#captureCallout');
const promotionPicker = document.querySelector('#promotionPicker');
const promotionCelebration = document.querySelector('#promotionCelebration');
const checkAlert = document.querySelector('#checkAlert');
const replayModal = document.querySelector('#replayModal');
const replayBoard = document.querySelector('#replayBoard');
const replayMoveList = document.querySelector('#replayMoveList');
const replayMoveMeta = document.querySelector('#replayMoveMeta');
const replayPlayButton = document.querySelector('#replayPlayButton');
const heroKnight = document.querySelector('#heroKnight');
let socket = null;
let toastTimer = null;
let aiTimer = null;
let captureTimer = null;
let promotionTimer = null;
let checkTimer = null;
let replayTimer = null;
let playerProgress = loadPlayerProgress();
let knightDrag = null;
let knightPose = { x: 0, y: 0, rotation: -12 };
let gameRevision = 0;
let engineQueue = Promise.resolve();
const stockfish = { worker: null, ready: null, job: null, status: 'loading' };

let state;

function createInitialBoard() {
  return [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
  ];
}

function resetGame(options = {}) {
  clearTimeout(aiTimer);
  clearTimeout(captureTimer);
  clearTimeout(promotionTimer);
  clearTimeout(checkTimer);
  clearInterval(replayTimer);
  aiTimer = null;
  captureTimer = null;
  promotionTimer = null;
  checkTimer = null;
  replayTimer = null;
  gameEndModal.classList.add('is-hidden');
  replayModal.classList.add('is-hidden');
  const nextMode = options.mode || state?.mode || 'local';
  const timeControl = getTimeControl(options.timeControl || playerProgress.selectedTimeControl);
  const startingBoard = createInitialBoard();
  gameRevision += 1;
  state = {
    board: startingBoard,
    turn: 'white',
    selected: null,
    legalMoves: [],
    lastMove: null,
    history: [],
    positions: [{ board: cloneBoard(startingBoard), turn: 'white', lastMove: null }],
    replayIndex: 0,
    gameRevision,
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: null,
    flipped: options.flipped ?? ((nextMode === 'online' && options.onlineColor === 'black') || (nextMode === 'computer' && options.playerColor === 'black')),
    mode: nextMode,
    onlineColor: options.onlineColor || (nextMode === 'online' ? 'white' : null),
    playerColor: options.playerColor || state?.playerColor || 'white',
    timeControl: timeControl.id,
    onlineMatched: Boolean(options.onlineMatched),
    connectionStatus: options.connectionStatus || null,
    aiDifficulty: options.aiDifficulty || state?.aiDifficulty || playerProgress.selectedDifficulty || 'intermediate',
    aiThinking: false,
    pendingPromotion: null,
    promotionEvent: null,
    checkEvent: null,
    captureEvent: null,
    unlockedRival: null,
    queued: false,
    gameOver: false,
    result: null,
    winner: null,
    clocks: { white: timeControl.seconds, black: timeControl.seconds },
  };
  render();
}

function colorOf(piece) {
  return piece && piece === piece.toUpperCase() ? 'white' : 'black';
}

function otherColor(color) { return color === 'white' ? 'black' : 'white'; }
function humanColor() { return state.mode === 'online' ? (state.onlineColor || 'white') : state.mode === 'computer' ? state.playerColor : 'white'; }
function humanCanMove() { return state.mode !== 'computer' || state.turn === humanColor(); }
function inside(row, col) { return row >= 0 && row < 8 && col >= 0 && col < 8; }
function squareName(square) { return `${FILES[square.c]}${8 - square.r}`; }
function pieceName(piece) {
  return { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[piece.toLowerCase()];
}
function cloneBoard(board) { return board.map((row) => [...row]); }

function render() {
  renderBoard();
  renderGamePanel();
  renderReview();
  renderDifficultyLadder();
  renderPromotionPicker();
  renderBoardEffects();
  const modeSwitch = document.querySelector('.mode-switch');
  modeSwitch.dataset.activeMode = state.mode;
  document.querySelectorAll('.mode-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === state.mode);
  });
  document.querySelector('#timeControlChoices').dataset.activeTime = playerProgress.selectedTimeControl;
  document.querySelectorAll('[data-time-control]').forEach((button) => {
    button.classList.toggle('active', button.dataset.timeControl === playerProgress.selectedTimeControl);
  });
  document.querySelector('#aiDifficulty').classList.toggle('is-hidden', state.mode !== 'computer');
  document.querySelectorAll('.ai-side-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.aiColor === state.playerColor);
  });
  queueOverlay.classList.add('is-hidden');
  renderMatchmaking();
}

function renderMatchmaking() {
  matchmakingModal.classList.toggle('is-hidden', !state.queued);
  if (!state.queued) return;
  const control = getTimeControl(state.timeControl);
  const searching = state.connectionStatus === 'searching';
  document.querySelector('#matchmakingTitle').textContent = searching ? 'Finding your opponent' : 'Connecting to online play';
  document.querySelector('#matchmakingMessage').textContent = searching
    ? 'We are looking for a player who chose the same time control. Keep this tab open.'
    : 'Opening a secure connection to the Knightfall chess server.';
  document.querySelector('#queueTimeControl').textContent = control.label;
}

function renderDifficultyLadder() {
  const track = document.querySelector('#difficultyTrack');
  const unlockHint = document.querySelector('#difficultyUnlockHint');
  track.innerHTML = DIFFICULTY_LEVELS.map((level, index) => {
    const locked = index > playerProgress.unlockedThrough;
    const active = state.mode === 'computer' && state.aiDifficulty === level.id;
    const name = locked ? 'Classified rival' : level.name;
    const elo = locked ? '???' : level.elo;
    return `<button class="difficulty-card${active ? ' active' : ''}" type="button" data-ai-level="${level.id}"${locked ? ' disabled' : ''}>
      <span class="difficulty-rank">${String(index + 1).padStart(2, '0')}</span>
      <span class="difficulty-name">${name}</span>
      <span class="difficulty-elo">~${elo}${locked ? '' : ' Elo'}</span>${locked ? '<span class="difficulty-lock">&#128274;</span>' : ''}
    </button>`;
  }).join('');
  const nextRival = DIFFICULTY_LEVELS[playerProgress.unlockedThrough];
  unlockHint.textContent = playerProgress.unlockedThrough >= DIFFICULTY_LEVELS.length - 1
    ? 'Every legendary rival is revealed.'
    : `Defeat ${nextRival.name} to reveal the next rival.`;
}

function renderPromotionPicker() {
  const pending = state.pendingPromotion;
  promotionPicker.classList.toggle('is-hidden', !pending);
  if (!pending) return;
  const white = colorOf(pending.piece) === 'white';
  promotionPicker.querySelectorAll('[data-promotion-piece]').forEach((button) => {
    const kind = button.dataset.promotionPiece;
    button.textContent = PIECES[white ? kind.toUpperCase() : kind];
  });
}

function renderBoardEffects() {
  const captured = state.captureEvent;
  captureCallout.classList.toggle('is-hidden', !captured);
  if (captured) {
    const capturedColor = colorOf(captured.piece);
    captureCallout.innerHTML = `<span class="captured-icon">${PIECES[captured.piece]}</span><span><strong>${capitalize(capturedColor)} ${pieceName(captured.piece)} captured</strong><small>${capitalize(captured.by)} takes an important piece.</small></span>`;
  }
  promotionCelebration.classList.toggle('is-hidden', !state.promotionEvent);
  if (state.promotionEvent) promotionCelebration.textContent = PIECES[state.promotionEvent.piece];
  checkAlert.classList.toggle('is-hidden', !state.checkEvent);
  if (state.checkEvent) {
    checkAlert.innerHTML = `CHECK!<small>${state.checkEvent.by === humanColor() ? 'You give check' : 'Your king is under attack'}</small>`;
  }
}

function renderBoard() {
  boardElement.innerHTML = '';
  const rows = state.flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
  const cols = state.flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];

  rows.forEach((row, displayRow) => {
    cols.forEach((col, displayCol) => {
      const piece = state.board[row][col];
      const square = { r: row, c: col };
      const legalMove = state.legalMoves.find((move) => move.to.r === row && move.to.c === col);
      const button = document.createElement('button');
      button.className = `square ${(row + col) % 2 ? 'dark' : ''}`;
      button.dataset.row = row;
      button.dataset.col = col;
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', `${squareName(square)}${piece ? ` ${pieceName(piece)}` : ''}`);

      if (state.selected?.r === row && state.selected?.c === col) button.classList.add('selected');
      if (legalMove) button.classList.add(legalMove.capture || legalMove.enPassant ? 'capture' : 'legal');
      if ([state.lastMove?.from, state.lastMove?.to].some((moveSquare) => moveSquare?.r === row && moveSquare?.c === col)) button.classList.add('last-move');
      if (isKingInCheck(state.board, state.turn) && state.board[row][col]?.toLowerCase() === 'k' && colorOf(state.board[row][col]) === state.turn) button.classList.add('in-check');

      if (displayCol === 0) button.insertAdjacentHTML('beforeend', `<span class="rank-coord">${8 - row}</span>`);
      if (displayRow === 7) button.insertAdjacentHTML('beforeend', `<span class="coord">${FILES[col]}</span>`);
      if (piece) button.insertAdjacentHTML('beforeend', `<span class="piece ${colorOf(piece) === 'black' ? 'black' : ''}">${PIECES[piece]}</span>`);
      if (state.captureEvent?.square.r === row && state.captureEvent?.square.c === col) button.insertAdjacentHTML('beforeend', '<span class="capture-burst"></span>');
      boardElement.appendChild(button);
    });
  });
}

function renderGamePanel() {
  const online = state.mode === 'online';
  const computer = state.mode === 'computer';
  const playerColor = humanColor();
  const opponentColor = otherColor(playerColor);
  const topName = online ? 'Online opponent' : computer ? 'Knightfall AI' : 'New opponent';
  document.querySelector('#topPlayerName').textContent = topName;
  if (online && !state.onlineMatched) document.querySelector('#topPlayerName').textContent = 'Knightfall arena';
  document.querySelector('#topPlayerMeta').textContent = online
    ? `${capitalize(opponentColor)} · connected`
    : computer ? `${getDifficulty(state.aiDifficulty).name} · ~${getDifficulty(state.aiDifficulty).elo} Elo` : 'Pass the board to a friend';
  document.querySelector('#bottomPlayerMeta').textContent = `${capitalize(playerColor)} · ${state.turn === playerColor ? 'your move' : 'waiting'}`;
  if (online && !state.onlineMatched) document.querySelector('#topPlayerMeta').textContent = state.connectionStatus === 'connecting' ? 'Secure connection starting' : 'Finding an opponent';
  document.querySelector('#topClock').textContent = formatClock(state.clocks[opponentColor]);
  document.querySelector('#bottomClock').textContent = formatClock(state.clocks[playerColor]);
  document.querySelector('#topClock').classList.toggle('active-clock', state.turn === opponentColor && !state.gameOver);
  document.querySelector('#bottomClock').classList.toggle('active-clock', state.turn === playerColor && !state.gameOver);

  let status = state.gameOver ? state.result : `${capitalize(state.turn)} to move`;
  if (!state.gameOver && online && state.onlineMatched && state.turn !== playerColor) status = 'Opponent is thinking';
  if (!state.gameOver && computer && (state.aiThinking || state.turn !== playerColor)) status = 'Knightfall AI is thinking';
  if (state.queued) status = 'Searching for an opponent…';
  document.querySelector('#gameStatus').lastElementChild.textContent = status;
  document.querySelector('#moveHint').textContent = state.gameOver
    ? 'Start a new game whenever you are ready.'
    : (online || computer) && state.turn !== playerColor
      ? computer ? 'Knightfall AI is choosing a move.' : 'Your opponent is deciding.'
      : 'Choose a piece, then choose its destination.';

  moveListElement.innerHTML = state.history.map((entry) => `<li title="${entry.note}">${entry.notation}</li>`).join('');
  const material = materialBalance(state.board);
  const materialText = material === 0 ? 'Even' : `${material > 0 ? 'White' : 'Black'} +${Math.abs(material).toFixed(1).replace('.0', '')}`;
  document.querySelector('#materialValue').textContent = materialText;
  document.querySelector('#balanceFill').style.width = `${Math.min(92, Math.max(8, 50 + material * 4))}%`;
  document.querySelector('#positionNote').textContent = positionNote();

  const coach = document.querySelector('#liveReviewCoach');
  const lastMove = state.history.at(-1);
  coach.className = `live-review-coach${lastMove ? ` ${lastMove.quality}` : ''}`;
  coach.innerHTML = lastMove
    ? `<span>Move ${state.history.length} · ${capitalize(lastMove.color)}</span><strong>${lastMove.label}: ${lastMove.notation}</strong><p>${lastMove.note}</p>`
    : '<span>Move coach</span><strong>Your game story starts here.</strong><p>Every move will get a clear label and a short explanation.</p>';
}

function renderReview() {
  const empty = document.querySelector('#reviewEmpty');
  const list = document.querySelector('#reviewList');
  const summary = document.querySelector('#reviewSummary');
  const reviewState = document.querySelector('#reviewState');
  const title = document.querySelector('#reviewTitle');
  const hasMoves = state.history.length > 0;
  empty.classList.toggle('is-hidden', hasMoves);
  list.innerHTML = hasMoves ? state.history.map((entry, index) => `
    <article class="review-item">
      <span class="review-number">${index + 1}</span>
      <div><strong>${entry.notation} · ${entry.label}</strong><p>${entry.note}</p></div>
      <span class="quality-pill quality-${entry.quality}">${entry.label}</span>
    </article>`).join('') : '';
  const pendingAnalysis = state.history.some((entry) => entry.quality === 'analyzing');
  reviewState.textContent = stockfish.status === 'unavailable'
    ? 'Quick review only'
    : pendingAnalysis ? 'Stockfish reviewing…'
      : state.gameOver ? 'Stockfish game review' : hasMoves ? 'Live Stockfish review' : 'Stockfish readying…';
  title.textContent = state.gameOver ? 'What your game can teach you.' : 'Your game, in context.';
  summary.classList.toggle('is-hidden', !hasMoves);
  if (hasMoves) document.querySelector('#summaryText').textContent = buildSummary();
}

function openReplay() {
  if (!state.history.length) {
    showToast('Make a move first — your replay will build itself as you play.');
    return;
  }
  stopReplay();
  state.replayIndex = state.history.length;
  renderReplay();
  replayModal.classList.remove('is-hidden');
}

function closeReplay() {
  stopReplay();
  replayModal.classList.add('is-hidden');
}

function setReplayIndex(index) {
  state.replayIndex = Math.max(0, Math.min(state.history.length, index));
  renderReplay();
}

function renderReplay() {
  const position = state.positions[state.replayIndex];
  if (!position) return;
  const rows = state.flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
  const cols = state.flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
  replayBoard.innerHTML = '';

  rows.forEach((row, displayRow) => cols.forEach((col, displayCol) => {
    const piece = position.board[row][col];
    const square = document.createElement('div');
    square.className = `replay-square ${(row + col) % 2 ? 'dark' : ''}`;
    if ([position.lastMove?.from, position.lastMove?.to].some((last) => last?.r === row && last?.c === col)) square.classList.add('replay-last');
    if (displayCol === 0) square.insertAdjacentHTML('beforeend', `<span class="replay-rank">${8 - row}</span>`);
    if (displayRow === 7) square.insertAdjacentHTML('beforeend', `<span class="replay-coordinate">${FILES[col]}</span>`);
    if (piece) square.insertAdjacentHTML('beforeend', `<span class="replay-piece ${colorOf(piece) === 'black' ? 'black' : ''}">${PIECES[piece]}</span>`);
    replayBoard.appendChild(square);
  }));

  const entry = state.replayIndex ? state.history[state.replayIndex - 1] : null;
  replayMoveMeta.innerHTML = entry
    ? `<strong>${entry.label} · ${entry.notation}</strong><span>Move ${state.replayIndex} · ${capitalize(entry.color)} · ${entry.note}</span>`
    : '<strong>Starting position</strong><span>Press Play or choose any move to walk through the whole game.</span>';
  replayMoveList.innerHTML = state.history.map((move, index) => `
    <li><button type="button" data-replay-index="${index + 1}" class="${state.replayIndex === index + 1 ? 'active' : ''}">
      <span class="replay-number">${index + 1}</span><strong>${move.notation}</strong><em>${move.label}</em>
    </button></li>`).join('');
  replayPlayButton.textContent = replayTimer ? 'Pause' : 'Play';
}

function toggleReplayPlayback() {
  if (replayTimer) {
    stopReplay();
    renderReplay();
    return;
  }
  if (state.replayIndex >= state.history.length) state.replayIndex = 0;
  replayTimer = setInterval(() => {
    if (state.replayIndex >= state.history.length) {
      stopReplay();
      renderReplay();
      return;
    }
    state.replayIndex += 1;
    renderReplay();
  }, 850);
  renderReplay();
}

function stopReplay() {
  if (replayTimer) clearInterval(replayTimer);
  replayTimer = null;
}

function handleSquareClick(event) {
  const squareElement = event.target.closest('.square');
  if (!squareElement || state.gameOver || state.queued) return;
  if (state.mode === 'online' && state.turn !== state.onlineColor) {
    showToast('It is your opponent’s turn.');
    return;
  }
  if (!humanCanMove() || state.aiThinking) {
    showToast('Knightfall AI is thinking.');
    return;
  }
  const square = { r: Number(squareElement.dataset.row), c: Number(squareElement.dataset.col) };
  const selectedMove = state.legalMoves.find((move) => move.to.r === square.r && move.to.c === square.c);
  if (selectedMove) {
    if (selectedMove.promotion) {
      openPromotionPicker(selectedMove);
      return;
    }
    makeMove(selectedMove);
    return;
  }
  const piece = state.board[square.r][square.c];
  if (piece && colorOf(piece) === state.turn) {
    state.selected = square;
    state.legalMoves = legalMovesFor(square);
  } else {
    state.selected = null;
    state.legalMoves = [];
  }
  renderBoard();
}

function legalMovesFor(from) {
  const piece = state.board[from.r][from.c];
  if (!piece || colorOf(piece) !== state.turn) return [];
  return pseudoMoves(from, state.board, state.castling, state.enPassant).filter((move) => isLegal(move));
}

function pseudoMoves(from, board, castling, enPassant) {
  const piece = board[from.r][from.c];
  if (!piece) return [];
  const color = colorOf(piece);
  const kind = piece.toLowerCase();
  const moves = [];
  const add = (row, col, extra = {}) => {
    if (!inside(row, col)) return false;
    const target = board[row][col];
    if (target && (colorOf(target) === color || target.toLowerCase() === 'k')) return false;
    moves.push({ from: { ...from }, to: { r: row, c: col }, piece, capture: target || null, ...extra });
    return !target;
  };

  if (kind === 'p') {
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    const finalRow = color === 'white' ? 0 : 7;
    if (inside(from.r + direction, from.c) && !board[from.r + direction][from.c]) {
      add(from.r + direction, from.c, from.r + direction === finalRow ? { promotion: true } : {});
      if (from.r === startRow && !board[from.r + direction * 2][from.c]) add(from.r + direction * 2, from.c, { doublePawn: true });
    }
    [-1, 1].forEach((delta) => {
      const row = from.r + direction;
      const col = from.c + delta;
      if (!inside(row, col)) return;
      if (board[row][col] && colorOf(board[row][col]) !== color && board[row][col].toLowerCase() !== 'k') {
        add(row, col, row === finalRow ? { promotion: true } : {});
      }
      if (enPassant && enPassant.r === row && enPassant.c === col && board[from.r][col]?.toLowerCase() === 'p' && colorOf(board[from.r][col]) !== color) {
        add(row, col, { enPassant: true, capture: board[from.r][col], capturedAt: { r: from.r, c: col } });
      }
    });
  }

  if (kind === 'n') {
    [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dr, dc]) => add(from.r + dr, from.c + dc));
  }

  const slide = (directions) => directions.forEach(([dr, dc]) => {
    let row = from.r + dr;
    let col = from.c + dc;
    while (inside(row, col)) {
      const canContinue = add(row, col);
      if (!canContinue) break;
      row += dr;
      col += dc;
    }
  });
  if (kind === 'b' || kind === 'q') slide([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
  if (kind === 'r' || kind === 'q') slide([[-1, 0], [1, 0], [0, -1], [0, 1]]);
  if (kind === 'k') {
    [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => add(from.r + dr, from.c + dc));
    const homeRow = color === 'white' ? 7 : 0;
    const kingKey = color === 'white' ? 'K' : 'k';
    const queenKey = color === 'white' ? 'Q' : 'q';
    const rook = color === 'white' ? 'R' : 'r';
    if (from.r === homeRow && from.c === 4 && castling[kingKey] && board[homeRow][5] === null && board[homeRow][6] === null && board[homeRow][7] === rook) {
      add(homeRow, 6, { castle: 'king' });
    }
    if (from.r === homeRow && from.c === 4 && castling[queenKey] && board[homeRow][1] === null && board[homeRow][2] === null && board[homeRow][3] === null && board[homeRow][0] === rook) {
      add(homeRow, 2, { castle: 'queen' });
    }
  }
  return moves;
}

function isLegal(move) {
  return isLegalOnBoard(move, state.board, state.castling);
}

function isLegalOnBoard(move, board, castling) {
  const color = colorOf(move.piece);
  const enemy = otherColor(color);
  if (move.castle) {
    const through = { r: move.from.r, c: move.castle === 'king' ? 5 : 3 };
    if (isSquareAttacked(board, move.from, enemy) || isSquareAttacked(board, through, enemy)) return false;
  }
  const next = nextPosition(board, castling, move);
  const king = findKing(next.board, color);
  return king && !isSquareAttacked(next.board, king, enemy);
}

function allLegalMovesOnBoard(board, color, castling, enPassant) {
  const moves = [];
  for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
    const piece = board[row][col];
    if (!piece || colorOf(piece) !== color) continue;
    moves.push(...pseudoMoves({ r: row, c: col }, board, castling, enPassant)
      .filter((move) => isLegalOnBoard(move, board, castling)));
  }
  return moves;
}

function nextPosition(board, castling, move) {
  const nextBoard = cloneBoard(board);
  const nextCastling = { ...castling };
  const piece = nextBoard[move.from.r][move.from.c];
  const captured = move.enPassant ? nextBoard[move.capturedAt.r][move.capturedAt.c] : nextBoard[move.to.r][move.to.c];
  nextBoard[move.from.r][move.from.c] = null;
  if (move.enPassant) nextBoard[move.capturedAt.r][move.capturedAt.c] = null;
  const promotionPiece = (move.promotionPiece || 'q').toLowerCase();
  nextBoard[move.to.r][move.to.c] = move.promotion ? (colorOf(piece) === 'white' ? promotionPiece.toUpperCase() : promotionPiece) : piece;

  if (move.castle === 'king') {
    nextBoard[move.from.r][5] = nextBoard[move.from.r][7];
    nextBoard[move.from.r][7] = null;
  }
  if (move.castle === 'queen') {
    nextBoard[move.from.r][3] = nextBoard[move.from.r][0];
    nextBoard[move.from.r][0] = null;
  }

  if (piece === 'K') { nextCastling.K = false; nextCastling.Q = false; }
  if (piece === 'k') { nextCastling.k = false; nextCastling.q = false; }
  if (move.from.r === 7 && move.from.c === 0) nextCastling.Q = false;
  if (move.from.r === 7 && move.from.c === 7) nextCastling.K = false;
  if (move.from.r === 0 && move.from.c === 0) nextCastling.q = false;
  if (move.from.r === 0 && move.from.c === 7) nextCastling.k = false;
  if (captured?.toLowerCase() === 'r') {
    if (move.to.r === 7 && move.to.c === 0) nextCastling.Q = false;
    if (move.to.r === 7 && move.to.c === 7) nextCastling.K = false;
    if (move.to.r === 0 && move.to.c === 0) nextCastling.q = false;
    if (move.to.r === 0 && move.to.c === 7) nextCastling.k = false;
  }
  const nextEnPassant = move.doublePawn ? { r: (move.from.r + move.to.r) / 2, c: move.from.c } : null;
  return { board: nextBoard, castling: nextCastling, enPassant: nextEnPassant, captured };
}

function isSquareAttacked(board, target, attacker) {
  const pawn = attacker === 'white' ? 'P' : 'p';
  const pawnDirection = attacker === 'white' ? -1 : 1;
  const pawnRow = target.r - pawnDirection;
  for (const col of [target.c - 1, target.c + 1]) if (inside(pawnRow, col) && board[pawnRow][col] === pawn) return true;

  const knight = attacker === 'white' ? 'N' : 'n';
  for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
    if (inside(target.r + dr, target.c + dc) && board[target.r + dr][target.c + dc] === knight) return true;
  }
  const rayThreat = (directions, kinds) => directions.some(([dr, dc]) => {
    let row = target.r + dr;
    let col = target.c + dc;
    while (inside(row, col)) {
      const piece = board[row][col];
      if (piece) return colorOf(piece) === attacker && kinds.includes(piece.toLowerCase());
      row += dr;
      col += dc;
    }
    return false;
  });
  if (rayThreat([[-1, -1], [-1, 1], [1, -1], [1, 1]], ['b', 'q'])) return true;
  if (rayThreat([[-1, 0], [1, 0], [0, -1], [0, 1]], ['r', 'q'])) return true;
  const king = attacker === 'white' ? 'K' : 'k';
  return [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
    .some(([dr, dc]) => inside(target.r + dr, target.c + dc) && board[target.r + dr][target.c + dc] === king);
}

function findKing(board, color) {
  const king = color === 'white' ? 'K' : 'k';
  for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) if (board[row][col] === king) return { r: row, c: col };
  return null;
}

function isKingInCheck(board, color) {
  const king = findKing(board, color);
  return king ? isSquareAttacked(board, king, otherColor(color)) : false;
}

function makeMove(move, remote = false) {
  const before = state.board;
  const mover = state.turn;
  const fenBefore = boardToFen(before, mover, state.castling, state.enPassant);
  const notation = notationFor(move);
  const next = nextPosition(before, state.castling, move);
  const review = reviewMove(move, before, next.board);
  state.board = next.board;
  state.castling = next.castling;
  state.enPassant = next.enPassant;
  state.lastMove = { from: move.from, to: move.to };
  state.history.push({ ...review, notation, color: mover, fenBefore, fenAfter: null });
  state.turn = otherColor(state.turn);
  const fenAfter = boardToFen(state.board, state.turn, state.castling, state.enPassant);
  const historyIndex = state.history.length - 1;
  state.history[historyIndex].fenAfter = fenAfter;
  state.selected = null;
  state.legalMoves = [];
  state.positions.push({
    board: cloneBoard(state.board),
    turn: state.turn,
    lastMove: { from: { ...state.lastMove.from }, to: { ...state.lastMove.to } },
  });
  state.pendingPromotion = null;
  if (next.captured && next.captured.toLowerCase() !== 'p') {
    triggerCaptureEffect(next.captured, move.enPassant ? move.capturedAt : move.to, colorOf(move.piece));
  }
  if (move.promotion) triggerPromotionEffect(move, colorOf(move.piece));
  if (isKingInCheck(state.board, state.turn)) triggerCheckAlert(colorOf(move.piece));
  const gameEnded = checkGameEnd();
  if (gameEnded) unlockLegendLadderIfEarned();
  const shouldAIMove = !gameEnded && !remote && state.mode === 'computer' && state.turn === otherColor(humanColor());
  state.aiThinking = shouldAIMove;
  render();
  queueStockfishReview(historyIndex, state.gameRevision);

  if (!remote && state.mode === 'online' && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'move', move: { from: squareName(move.from), to: squareName(move.to), promotion: move.promotion ? (move.promotionPiece || 'q') : null }, clocks: state.clocks }));
  }
  if (gameEnded) showGameEndModal();
  if (shouldAIMove) scheduleAIMove();
}

function openPromotionPicker(move) {
  state.pendingPromotion = move;
  state.selected = null;
  state.legalMoves = [];
  render();
}

function triggerCaptureEffect(piece, square, by) {
  clearTimeout(captureTimer);
  state.captureEvent = { piece, square, by };
  captureTimer = setTimeout(() => {
    state.captureEvent = null;
    renderBoard();
    renderBoardEffects();
  }, 1450);
}

function triggerPromotionEffect(move, color) {
  clearTimeout(promotionTimer);
  const kind = (move.promotionPiece || 'q').toLowerCase();
  state.promotionEvent = { piece: color === 'white' ? kind.toUpperCase() : kind };
  promotionTimer = setTimeout(() => {
    state.promotionEvent = null;
    renderBoardEffects();
  }, 1550);
}

function triggerCheckAlert(by) {
  clearTimeout(checkTimer);
  state.checkEvent = { by };
  checkTimer = setTimeout(() => {
    state.checkEvent = null;
    renderBoardEffects();
  }, 1550);
}

function notationFor(move) {
  if (move.castle === 'king') return 'O-O';
  if (move.castle === 'queen') return 'O-O-O';
  const kind = move.piece.toUpperCase();
  const label = kind === 'P' ? '' : kind;
  const capture = move.capture || move.enPassant ? 'x' : '';
  const pawnFile = kind === 'P' && capture ? FILES[move.from.c] : '';
  const promotion = move.promotion ? `=${(move.promotionPiece || 'q').toUpperCase()}` : '';
  const next = nextPosition(state.board, state.castling, move).board;
  const givesCheck = isKingInCheck(next, otherColor(colorOf(move.piece)));
  return `${label}${pawnFile}${capture}${squareName(move.to)}${promotion}${givesCheck ? '+' : ''}`;
}

function checkGameEnd() {
  const currentMoves = allLegalMoves(state.turn);
  if (currentMoves.length) return false;
  state.gameOver = true;
  state.winner = isKingInCheck(state.board, state.turn) ? otherColor(state.turn) : null;
  state.result = state.winner
    ? `Checkmate — ${capitalize(state.winner)} wins`
    : 'Draw — stalemate';
  return true;
}

function allLegalMoves(color) {
  return allLegalMovesOnBoard(state.board, color, state.castling, state.enPassant);
}

function scheduleAIMove() {
  clearTimeout(aiTimer);
  const difficulty = getDifficulty(state.aiDifficulty);
  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (state.mode !== 'computer' || state.gameOver || state.turn !== otherColor(humanColor())) return;
    const move = chooseAIMove();
    if (!move) return;
    state.aiThinking = false;
    makeMove(move, true);
  }, difficulty.think);
}

function chooseAIMove() {
  const aiColor = otherColor(humanColor());
  const moves = allLegalMoves(aiColor);
  if (!moves.length) return null;
  const difficulty = getDifficulty(state.aiDifficulty);
  if (difficulty.pool >= moves.length) return moves[Math.floor(Math.random() * moves.length)];

  const scored = moves.map((move) => {
    const next = nextPosition(state.board, state.castling, move);
    let score = aiPositionScore(next.board, aiColor);
    if (difficulty.replies) {
      const replies = allLegalMovesOnBoard(next.board, humanColor(), next.castling, next.enPassant);
      if (!replies.length) score = isKingInCheck(next.board, humanColor()) ? 1000 : 0;
      else score = Math.min(...replies.map((reply) => {
        const afterReply = nextPosition(next.board, next.castling, reply);
        return aiPositionScore(afterReply.board, aiColor);
      }));
    }
    return { move, score };
  }).sort((first, second) => second.score - first.score);

  const choicePool = scored.slice(0, Math.min(difficulty.pool, scored.length));
  return choicePool[Math.floor(Math.random() * choicePool.length)].move;
}

function aiPositionScore(board, aiColor) {
  let score = positionalScore(board, aiColor);
  if (isKingInCheck(board, otherColor(aiColor))) score += .3;
  if (isKingInCheck(board, aiColor)) score -= .3;
  return score;
}

function getDifficulty(id) {
  return DIFFICULTY_LEVELS.find((level) => level.id === id) || difficultyFallback();
}

function difficultyFallback() { return DIFFICULTY_LEVELS[2]; }
function getTimeControl(id) { return TIME_CONTROLS.find((control) => control.id === id) || TIME_CONTROLS[1]; }

function chooseTimeControl(id) {
  const control = getTimeControl(id);
  if (state.queued) {
    showToast('Cancel the online search before changing the time control.');
    return;
  }
  playerProgress.selectedTimeControl = control.id;
  savePlayerProgress();
  if (!state.history.length && !state.aiThinking && !state.gameOver) {
    state.timeControl = control.id;
    state.clocks = { white: control.seconds, black: control.seconds };
  }
  render();
  showToast(`${control.label} selected.`);
}

function loadPlayerProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (saved && Number.isInteger(saved.unlockedThrough)) {
      return {
        unlockedThrough: Math.min(DIFFICULTY_LEVELS.length - 1, Math.max(4, saved.unlockedThrough)),
        selectedDifficulty: DIFFICULTY_LEVELS.some((level) => level.id === saved.selectedDifficulty) ? saved.selectedDifficulty : 'intermediate',
        selectedTimeControl: TIME_CONTROLS.some((control) => control.id === saved.selectedTimeControl) ? saved.selectedTimeControl : 'blitz',
      };
    }
  } catch { /* A private browser session can block saved progress. */ }
  return { unlockedThrough: 4, selectedDifficulty: 'intermediate', selectedTimeControl: 'blitz' };
}

function savePlayerProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(playerProgress)); } catch { /* Progress remains available for this visit. */ }
}

function unlockLegendLadderIfEarned() {
  if (state.mode !== 'computer' || state.winner !== humanColor()) return;
  const defeatedIndex = DIFFICULTY_LEVELS.findIndex((level) => level.id === state.aiDifficulty);
  if (defeatedIndex < 4 || defeatedIndex !== playerProgress.unlockedThrough) return;
  if (playerProgress.unlockedThrough >= DIFFICULTY_LEVELS.length - 1) return;
  const nextRival = DIFFICULTY_LEVELS[defeatedIndex + 1];
  playerProgress.unlockedThrough = defeatedIndex + 1;
  state.unlockedRival = nextRival.name;
  savePlayerProgress();
  showToast(`${DIFFICULTY_LEVELS[defeatedIndex].name} defeated — ${nextRival.name} has been revealed!`);
}

function boardToFen(board, turn, castling, enPassant) {
  const placement = board.map((row) => {
    let empty = 0;
    let fenRow = '';
    row.forEach((piece) => {
      if (!piece) empty += 1;
      else {
        if (empty) fenRow += empty;
        empty = 0;
        fenRow += piece;
      }
    });
    return `${fenRow}${empty || ''}`;
  }).join('/');
  const rights = `${castling.K ? 'K' : ''}${castling.Q ? 'Q' : ''}${castling.k ? 'k' : ''}${castling.q ? 'q' : ''}` || '-';
  const target = enPassant ? squareName(enPassant) : '-';
  const fullmove = Math.max(1, Math.floor(state.history.length / 2) + 1);
  return `${placement} ${turn === 'white' ? 'w' : 'b'} ${rights} ${target} 0 ${fullmove}`;
}

function reviewMove() {
  return { quality: 'analyzing', label: 'Analyzing', note: 'Stockfish is checking the position before and after this move.' };
}

function initializeStockfish() {
  if (stockfish.ready) return stockfish.ready;
  stockfish.ready = new Promise((resolve, reject) => {
    try {
      stockfish.worker = new Worker('engine/stockfish-18-lite-single.js');
      stockfish.worker.onmessage = (event) => handleStockfishLine(String(event.data), resolve);
      stockfish.worker.onerror = (error) => {
        stockfish.status = 'unavailable';
        if (stockfish.job) {
          stockfish.job.reject(error);
          stockfish.job = null;
        }
        reject(error);
        if (state) renderReview();
      };
      stockfish.worker.postMessage('uci');
    } catch (error) {
      stockfish.status = 'unavailable';
      reject(error);
    }
  });
  return stockfish.ready;
}

function handleStockfishLine(line, ready) {
  line.split(/\r?\n/).map((part) => part.trim()).filter(Boolean).forEach((message) => handleStockfishMessage(message, ready));
}

function handleStockfishMessage(line, ready) {
  if (line === 'uciok') {
    stockfish.worker.postMessage('setoption name Hash value 16');
    stockfish.worker.postMessage('isready');
    return;
  }
  if (line === 'readyok') {
    stockfish.status = 'ready';
    ready();
    if (state) renderReview();
    return;
  }
  if (!stockfish.job) return;
  const score = parseEngineScore(line);
  if (score) stockfish.job.score = score;
  if (line.startsWith('bestmove')) {
    const job = stockfish.job;
    stockfish.job = null;
    clearTimeout(job.timeout);
    job.resolve(job.score || { type: 'cp', value: 0 });
  }
}

function parseEngineScore(line) {
  const score = line.match(/\bscore (cp|mate) (-?\d+)/);
  return score ? { type: score[1], value: Number(score[2]) } : null;
}

function evaluateWithStockfish(fen, depth = 15) {
  return initializeStockfish().then(() => new Promise((resolve, reject) => {
    if (stockfish.job) {
      reject(new Error('Stockfish received overlapping analysis requests.'));
      return;
    }
    const timeout = setTimeout(() => {
      if (!stockfish.job) return;
      stockfish.worker.postMessage('stop');
    }, 18000);
    stockfish.job = { resolve, reject, score: null, timeout };
    stockfish.worker.postMessage(`position fen ${fen}`);
    stockfish.worker.postMessage(`go depth ${depth}`);
  }));
}

function queueStockfishReview(index, revision) {
  const entry = state.history[index];
  if (!entry) return;
  const queued = { fenBefore: entry.fenBefore, fenAfter: entry.fenAfter, color: entry.color };
  engineQueue = engineQueue.catch(() => undefined).then(async () => {
    try {
      const before = await evaluateWithStockfish(queued.fenBefore);
      const after = await evaluateWithStockfish(queued.fenAfter);
      if (state.gameRevision !== revision || state.history[index]?.fenBefore !== queued.fenBefore) return;
      Object.assign(state.history[index], classifyEngineReview(before, after, queued.color));
      render();
    } catch (error) {
      stockfish.status = 'unavailable';
      if (state.gameRevision !== revision || state.history[index]?.fenBefore !== queued.fenBefore) return;
      const moveEntry = state.history[index];
      const openedAsFile = location.protocol === 'file:';
      Object.assign(moveEntry, openedAsFile
        ? { quality: 'analyzing', label: 'Start the server', note: 'Open http://localhost:3000 instead of index.html to run the full Stockfish review.' }
        : { quality: 'good', label: 'Quick review', note: 'Stockfish could not finish on this device, so this is a quick estimate.' });
      render();
    }
  });
}

function scoreForSide(score) {
  if (score.type === 'cp') return score.value;
  const magnitude = 100000 - Math.min(999, Math.abs(score.value) * 100);
  return score.value >= 0 ? magnitude : -magnitude;
}

function classifyEngineReview(before, after, mover) {
  const beforeValue = scoreForSide(before);
  const afterValue = -scoreForSide(after);
  const centipawnLoss = Math.max(0, beforeValue - afterValue);
  const missedMate = before.type === 'mate' && before.value > 0 && !(after.type === 'mate' && after.value < 0);
  const allowedMate = after.type === 'mate' && after.value > 0;
  const deliveredMate = after.type === 'mate' && after.value < 0;

  if (missedMate) {
    return { quality: 'blunder', label: 'Blunder', note: `Stockfish found a forced mate in ${Math.abs(before.value)}. This move lets it slip away.` };
  }
  if (allowedMate) {
    return { quality: 'blunder', label: 'Blunder', note: `This allows the opponent a forced mate in ${Math.abs(after.value)}.` };
  }
  if (deliveredMate) {
    return { quality: 'brilliant', label: 'Brilliant', note: `Forced mate in ${Math.abs(after.value)} — the opponent has no escape.` };
  }
  if (centipawnLoss <= 12) return { quality: 'best', label: 'Best', note: 'Stockfish keeps the evaluation essentially unchanged.' };
  if (centipawnLoss <= 40) return { quality: 'excellent', label: 'Excellent', note: `Only ${(centipawnLoss / 100).toFixed(2)} pawns away from Stockfish’s preferred continuation.` };
  if (centipawnLoss <= 100) return { quality: 'good', label: 'Good', note: `Solid choice; it gives away about ${(centipawnLoss / 100).toFixed(2)} pawns of evaluation.` };
  if (centipawnLoss <= 220) return { quality: 'inaccuracy', label: 'Inaccuracy', note: `Stockfish sees a stronger continuation worth about ${(centipawnLoss / 100).toFixed(2)} pawns.` };
  return { quality: 'blunder', label: 'Blunder', note: `This changes the evaluation by about ${(centipawnLoss / 100).toFixed(2)} pawns.` };
}

function quickReviewMove(move, before, after) {
  const mover = colorOf(move.piece);
  const opponent = otherColor(mover);
  const capturedValue = VALUES[(move.capture || '').toLowerCase()] || 0;
  const movedValue = VALUES[move.piece.toLowerCase()] || 0;
  const change = positionalScore(after, mover) - positionalScore(before, mover);
  const attacked = isSquareAttacked(after, move.to, opponent);
  const defended = isSquareAttacked(after, move.to, mover);
  const check = isKingInCheck(after, opponent);
  let quality = 'good';
  let label = 'Good';
  let note = 'Keeps the position steady and gives you a clear plan.';

  if (attacked && !defended && movedValue >= 5) {
    quality = 'blunder'; label = 'Blunder'; note = `Your ${pieceName(move.piece)} is left exposed on ${squareName(move.to)}.`;
  } else if (attacked && !defended && movedValue >= 3) {
    quality = 'inaccuracy'; label = 'Inaccuracy'; note = `This puts your ${pieceName(move.piece)} under pressure without enough support.`;
  } else if (movedValue > capturedValue && capturedValue > 0 && check && attacked) {
    quality = 'brilliant'; label = 'Brilliant'; note = 'A bold exchange that creates immediate pressure on the king.';
  } else if (capturedValue >= 3 || check || move.castle || change > .45) {
    quality = 'excellent'; label = 'Excellent'; note = move.castle ? 'King safety first — you brought your rook into the game.' : check ? 'Forces your opponent to respond and keeps the initiative.' : 'This improves your position in a concrete way.';
  }
  return { quality, label, note };
}

function positionalScore(board, color) {
  let score = 0;
  board.forEach((row, rowIndex) => row.forEach((piece, colIndex) => {
    if (!piece) return;
    const factor = colorOf(piece) === color ? 1 : -1;
    score += factor * VALUES[piece.toLowerCase()];
    if ([3, 4].includes(rowIndex) && [3, 4].includes(colIndex)) score += factor * .14;
    if (['n', 'b'].includes(piece.toLowerCase())) {
      const startRow = colorOf(piece) === 'white' ? 7 : 0;
      if (rowIndex !== startRow) score += factor * .11;
    }
  }));
  return score;
}

function materialBalance(board) {
  return board.flat().reduce((total, piece) => total + (piece ? (colorOf(piece) === 'white' ? 1 : -1) * VALUES[piece.toLowerCase()] : 0), 0);
}

function positionNote() {
  if (!state.history.length) return 'The center is still up for grabs.';
  if (isKingInCheck(state.board, state.turn)) return `${capitalize(state.turn)} needs to answer the check.`;
  const material = materialBalance(state.board);
  if (Math.abs(material) >= 3) return `${material > 0 ? 'White' : 'Black'} has a meaningful material edge.`;
  if (state.history.length < 10) return 'Develop pieces and look after king safety.';
  return 'Small decisions will matter from here.';
}

function buildSummary() {
  const yourColor = humanColor();
  const yourMoves = state.history.filter((entry) => entry.color === yourColor);
  const weakMove = yourMoves.find((entry) => ['blunder', 'inaccuracy'].includes(entry.quality));
  if (weakMove) return `${weakMove.notation} was the biggest moment to revisit. Ask: what piece was it leaving behind?`;
  const castles = yourMoves.find((entry) => entry.notation.startsWith('O-O'));
  if (castles) return 'Your king safety was a real strength. Keep connecting your rooks after castling.';
  return 'Your position stayed coherent. In the next game, look for a way to develop with tempo.';
}

function formatClock(seconds) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainder = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}
function capitalize(word) { return word.charAt(0).toUpperCase() + word.slice(1); }

function switchMode(mode) {
  if (mode === 'online') {
    startOnlineMatch();
  } else if (mode === 'computer') {
    startComputerGame(state?.aiDifficulty || playerProgress.selectedDifficulty || 'intermediate');
  } else {
    closeConnection();
    resetGame({ mode: 'local', flipped: false });
    showToast('Local game ready — pass the board after each move.');
  }
}

function startComputerGame(difficulty = 'intermediate', playerColor = state?.playerColor || 'white') {
  const level = getDifficulty(difficulty);
  if (DIFFICULTY_LEVELS.indexOf(level) > playerProgress.unlockedThrough) {
    showToast('Defeat Master first to unlock that legendary rival.');
    return;
  }
  closeConnection();
  playerProgress.selectedDifficulty = level.id;
  savePlayerProgress();
  resetGame({ mode: 'computer', playerColor, flipped: playerColor === 'black', aiDifficulty: level.id });
  if (playerColor === 'black') {
    state.aiThinking = true;
    render();
    scheduleAIMove();
  }
  showToast(`${level.name} is ready — approximately ${level.elo} Elo.`);
}

function startOnlineMatch() {
  if (!['http:', 'https:'].includes(location.protocol)) {
    showToast('To play online, start the site with Node.js first. See README.md for the 3 steps.');
    return;
  }
  if (socket?.readyState === WebSocket.OPEN || state.queued) return;
  const control = getTimeControl(playerProgress.selectedTimeControl);
  resetGame({ mode: 'online', onlineColor: 'white', flipped: false, timeControl: control.id, connectionStatus: 'connecting' });
  state.queued = true;
  render();
  const connection = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  socket = connection;
  connection.addEventListener('open', () => {
    if (socket !== connection) return;
    state.connectionStatus = 'searching';
    render();
    connection.send(JSON.stringify({ type: 'joinQueue', timeControl: control.id }));
  });
  connection.addEventListener('message', (event) => handleServerMessage(JSON.parse(event.data)));
  connection.addEventListener('error', () => {
    if (socket !== connection) return;
    state.queued = false;
    state.connectionStatus = 'error';
    render();
    showToast('Could not reach the game server. Make sure npm start is running.');
  });
  connection.addEventListener('close', () => {
    if (socket !== connection) return;
    socket = null;
    if (state.queued) {
      state.queued = false;
      state.connectionStatus = 'error';
      render();
      showToast('The online connection closed. Try searching again.');
    }
  });
}

function handleServerMessage(message) {
  if (message.type === 'queued') {
    state.connectionStatus = 'searching';
    render();
    return;
  }
  if (message.type === 'matchFound') {
    resetGame({ mode: 'online', onlineColor: message.color, flipped: message.color === 'black', timeControl: message.timeControl || playerProgress.selectedTimeControl, onlineMatched: true, connectionStatus: 'connected' });
    showToast(`Match found — you are playing ${message.color}.`);
  }
  if (message.type === 'opponentMove') {
    const from = nameToSquare(message.move.from);
    const to = nameToSquare(message.move.to);
    const move = legalMovesFor(from).find((candidate) => candidate.to.r === to.r && candidate.to.c === to.c);
    if (move) {
      if (message.clocks && Number.isFinite(message.clocks.white) && Number.isFinite(message.clocks.black)) {
        state.clocks = { white: Math.max(0, Math.floor(message.clocks.white)), black: Math.max(0, Math.floor(message.clocks.black)) };
      }
      if (move.promotion) move.promotionPiece = message.move.promotion || 'q';
      makeMove(move, true);
    }
    else showToast('The game lost sync. Start a fresh match.');
  }
  if (message.type === 'opponentResigned') endGame('Opponent resigned — you win', humanColor());
  if (message.type === 'opponentLeft') endGame('Opponent left — you win', humanColor());
  if (message.type === 'error') showToast(message.message);
}

function nameToSquare(name) { return { r: 8 - Number(name[1]), c: FILES.indexOf(name[0]) }; }
function closeConnection() {
  if (socket) { socket.close(); socket = null; }
}

function cancelOnlineSearch() {
  closeConnection();
  resetGame({ mode: 'local', flipped: false });
  showToast('Search cancelled. Local game ready.');
}

function endGame(result, winner = null) {
  clearTimeout(aiTimer);
  aiTimer = null;
  state.gameOver = true;
  state.aiThinking = false;
  state.queued = false;
  state.result = result;
  state.winner = winner;
  unlockLegendLadderIfEarned();
  render();
  showGameEndModal();
}

function showGameEndModal() {
  const playerColor = humanColor();
  const card = gameEndModal.querySelector('.game-end-card');
  const title = document.querySelector('#gameEndTitle');
  const message = document.querySelector('#gameEndMessage');
  const eyebrow = document.querySelector('#endEyebrow');
  card.classList.remove('loss', 'draw');

  if (state.winner === null) {
    title.textContent = 'Draw game';
    eyebrow.textContent = 'A hard-fought finish';
    message.textContent = 'Neither side could force a win. Your review highlights the moments that shaped it.';
    card.classList.add('draw');
  } else if (state.winner === playerColor) {
    title.textContent = 'You win!';
    eyebrow.textContent = 'Victory is yours';
    message.textContent = state.unlockedRival
      ? `You conquered this challenge. ${state.unlockedRival} has stepped out of the shadows.`
      : 'Great game. Open the review to see the moves that made the difference.';
  } else {
    title.textContent = 'You lost';
    eyebrow.textContent = 'Every game teaches';
    message.textContent = 'The review is ready. Find the turning point, then come back stronger.';
    card.classList.add('loss');
  }
  gameEndModal.classList.remove('is-hidden');
}

function restartCurrentGame() {
  const mode = state.mode;
  const difficulty = state.aiDifficulty;
  if (mode === 'computer') startComputerGame(difficulty);
  else if (mode === 'online') {
    closeConnection();
    resetGame({ mode: 'local', flipped: false });
    showToast('Start a new online match from the Online match button.');
  } else resetGame({ mode: 'local', flipped: false });
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove('show'), 3600);
}

function savedTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; }
}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.classList.toggle('dark-theme', dark);
  document.querySelector('#themeToggle').setAttribute('aria-pressed', String(dark));
  document.querySelector('#themeToggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  document.querySelector('#themeToggleIcon').textContent = dark ? '☀' : '☾';
  document.querySelector('#themeToggleLabel').textContent = dark ? 'Light' : 'Dark';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0d1713' : '#f5f4ee');
  try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* Theme still applies for this visit. */ }
}

function savedBoardTheme() {
  try {
    const saved = localStorage.getItem(BOARD_THEME_KEY);
    return BOARD_THEMES.includes(saved) ? saved : 'classic';
  } catch { return 'classic'; }
}

function applyBoardTheme(boardTheme) {
  const theme = BOARD_THEMES.includes(boardTheme) ? boardTheme : 'classic';
  document.body.dataset.boardTheme = theme;
  document.querySelectorAll('#boardStyleChoices [data-board-theme]').forEach((button) => {
    button.classList.toggle('active', button.dataset.boardTheme === theme);
  });
  try { localStorage.setItem(BOARD_THEME_KEY, theme); } catch { /* Board style remains for this visit. */ }
}

function setKnightPose() {
  heroKnight.style.setProperty('--drag-x', `${knightPose.x}px`);
  heroKnight.style.setProperty('--drag-y', `${knightPose.y}px`);
  heroKnight.style.setProperty('--knight-rotation', `${knightPose.rotation}deg`);
}

function setupHeroKnight() {
  heroKnight.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    heroKnight.setPointerCapture(event.pointerId);
    knightDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: knightPose.x, originY: knightPose.y, moved: false };
    heroKnight.classList.add('dragging');
  });
  heroKnight.addEventListener('pointermove', (event) => {
    if (!knightDrag || knightDrag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - knightDrag.startX;
    const deltaY = event.clientY - knightDrag.startY;
    knightDrag.moved = knightDrag.moved || Math.abs(deltaX) + Math.abs(deltaY) > 5;
    knightPose.x = Math.max(-110, Math.min(185, knightDrag.originX + deltaX));
    knightPose.y = Math.max(-75, Math.min(110, knightDrag.originY + deltaY));
    knightPose.rotation = -12 + knightPose.x * .1 + knightPose.y * .05;
    setKnightPose();
  });
  const releaseKnight = (event) => {
    if (!knightDrag || knightDrag.pointerId !== event.pointerId) return;
    if (!knightDrag.moved) knightPose.rotation += 28;
    knightDrag = null;
    heroKnight.classList.remove('dragging');
    setKnightPose();
  };
  heroKnight.addEventListener('pointerup', releaseKnight);
  heroKnight.addEventListener('pointercancel', releaseKnight);
}

setInterval(() => {
  if (!state || state.gameOver || state.queued || state.history.length === 0) return;
  state.clocks[state.turn] -= 1;
  if (state.clocks[state.turn] <= 0) {
    state.clocks[state.turn] = 0;
    endGame(`${capitalize(otherColor(state.turn))} wins on time`, otherColor(state.turn));
  } else renderGamePanel();
}, 1000);

boardElement.addEventListener('click', handleSquareClick);
document.querySelectorAll('.mode-button').forEach((button) => button.addEventListener('click', () => switchMode(button.dataset.mode)));
document.querySelector('#timeControlChoices').addEventListener('click', (event) => {
  const button = event.target.closest('[data-time-control]');
  if (button) chooseTimeControl(button.dataset.timeControl);
});
document.querySelector('#heroPlayButton').addEventListener('click', () => { document.querySelector('#play').scrollIntoView(); switchMode('online'); });
document.querySelector('#headerPlayButton').addEventListener('click', () => { document.querySelector('#play').scrollIntoView(); switchMode('online'); });
document.querySelector('#howItWorksButton').addEventListener('click', () => document.querySelector('#review').scrollIntoView());
document.querySelector('#newGameButton').addEventListener('click', restartCurrentGame);
document.querySelector('#flipBoardButton').addEventListener('click', () => { state.flipped = !state.flipped; renderBoard(); });
document.querySelector('#openReplayButton').addEventListener('click', openReplay);
document.querySelector('#resignButton').addEventListener('click', () => {
  if (state.gameOver) return;
  if (state.mode === 'online' && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'resign' }));
  endGame('You resigned — game ended', otherColor(humanColor()));
});
document.querySelector('#cancelQueueButton').addEventListener('click', () => { closeConnection(); resetGame({ mode: 'local', flipped: false }); showToast('Search cancelled. Local game ready.'); });
document.querySelector('#matchmakingModal [data-cancel-queue]').addEventListener('click', cancelOnlineSearch);
document.querySelector('#difficultyTrack').addEventListener('click', (event) => {
  const button = event.target.closest('[data-ai-level]');
  if (button) startComputerGame(button.dataset.aiLevel, state.playerColor);
});
document.querySelectorAll('.ai-side-button').forEach((button) => {
  button.addEventListener('click', () => startComputerGame(state.aiDifficulty, button.dataset.aiColor));
});
document.querySelectorAll('[data-promotion-piece]').forEach((button) => button.addEventListener('click', () => {
  if (!state.pendingPromotion) return;
  const promotedMove = { ...state.pendingPromotion, promotionPiece: button.dataset.promotionPiece };
  state.pendingPromotion = null;
  makeMove(promotedMove);
}));
document.querySelector('#themeToggle').addEventListener('click', () => applyTheme(document.body.classList.contains('dark-theme') ? 'light' : 'dark'));
document.querySelector('#boardStyleChoices').addEventListener('click', (event) => {
  const button = event.target.closest('#boardStyleChoices [data-board-theme]');
  if (button) applyBoardTheme(button.dataset.boardTheme);
});
document.querySelector('#reviewGameButton').addEventListener('click', () => {
  gameEndModal.classList.add('is-hidden');
  openReplay();
});
document.querySelector('#playAgainButton').addEventListener('click', restartCurrentGame);
document.querySelector('#closeReplayButton').addEventListener('click', closeReplay);
document.querySelector('#replayFirstButton').addEventListener('click', () => { stopReplay(); setReplayIndex(0); });
document.querySelector('#replayPreviousButton').addEventListener('click', () => { stopReplay(); setReplayIndex(state.replayIndex - 1); });
document.querySelector('#replayPlayButton').addEventListener('click', toggleReplayPlayback);
document.querySelector('#replayNextButton').addEventListener('click', () => { stopReplay(); setReplayIndex(state.replayIndex + 1); });
document.querySelector('#replayLastButton').addEventListener('click', () => { stopReplay(); setReplayIndex(state.history.length); });
replayMoveList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-replay-index]');
  if (!button) return;
  stopReplay();
  setReplayIndex(Number(button.dataset.replayIndex));
});
document.querySelectorAll('.panel-tab').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.panel-tab').forEach((tab) => tab.classList.toggle('active', tab === button));
  document.querySelector('#movesPanel').classList.toggle('is-hidden', button.dataset.panel !== 'moves');
  document.querySelector('#insightsPanel').classList.toggle('is-hidden', button.dataset.panel !== 'insights');
}));

applyTheme(savedTheme());
applyBoardTheme(savedBoardTheme());
setupHeroKnight();
resetGame({ mode: 'local', flipped: false });
initializeStockfish().catch(() => {
  stockfish.status = 'unavailable';
  if (state) renderReview();
});
