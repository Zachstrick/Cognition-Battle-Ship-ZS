import { Battle, FLEET, SIZE, coordinate } from './game.mjs?v=2';

const byId = (id) => document.getElementById(id);
const phase = byId('phase');
const status = byId('status');
const shuffle = byId('shuffle');
const place = byId('place');
const rotate = byId('rotate');
const randomFill = byId('random-fill');
const start = byId('start');
const restart = byId('restart');
const log = byId('log');
const result = byId('result');
const accessCode = byId('access-code');
const accessError = byId('access-error');
const accessKey = 'fleet-command:access';
const setupMessage = 'Place ships, shuffle, or start with this fleet.';
const labels = {
  water: ['Unfired', ''],
  ship: ['Ship', '■'],
  miss: ['Miss', '•'],
  hit: ['Hit', '×'],
  sunk: ['Sunk', '⊗'],
};

let battle = new Battle();
let vertical = false;
let previewIndex = null;
let timer;
let lastPlayerShot = null;
let lastAiShot = null;

function makeBoard(id, select, preview) {
  const board = byId(id);
  board.addEventListener('animationend', (event) => {
    if (event.pseudoElement === '::before' && (event.animationName === 'explosion' || event.animationName === 'splash-ring')) {
      delete event.target.dataset.effect;
    }
  });
  const cells = [];
  const grid = { cells, activeIndex: 0 };
  for (let r = -1; r < SIZE; r += 1) {
    const line = document.createElement('div');
    line.className = 'board-row';
    line.setAttribute('role', 'row');
    for (let c = -1; c < SIZE; c += 1) {
      const box = document.createElement('div');
      if (r < 0 || c < 0) {
        box.className = 'axis';
        box.setAttribute('role', r < 0 ? 'columnheader' : 'rowheader');
        box.textContent = r < 0 ? (c < 0 ? '' : c + 1) : String.fromCharCode(65 + r);
      } else {
        box.setAttribute('role', 'gridcell');
        const cell = document.createElement('button');
        cell.className = 'tile';
        cell.type = 'button';
        const index = r * SIZE + c;
        cell.addEventListener('click', () => select(index));
        cell.addEventListener('focus', () => {
          cells[grid.activeIndex].tabIndex = -1;
          grid.activeIndex = index;
          cell.tabIndex = 0;
          preview?.(index);
        });
        if (preview) cell.addEventListener('pointerenter', () => preview(index));
        box.append(cell);
        cells.push(cell);
      }
      line.append(box);
    }
    board.append(line);
  }
  if (preview) board.addEventListener('pointerleave', () => preview(null));
  board.addEventListener('keydown', (event) => {
    const index = grid.activeIndex;
    const r = Math.floor(index / SIZE);
    const c = index % SIZE;
    const moves = {
      ArrowUp: r > 0 ? -SIZE : 0,
      ArrowDown: r < SIZE - 1 ? SIZE : 0,
      ArrowLeft: c > 0 ? -1 : 0,
      ArrowRight: c < SIZE - 1 ? 1 : 0,
      Home: -c,
      End: SIZE - c - 1,
    };
    if (!Object.hasOwn(moves, event.key)) return;
    event.preventDefault();
    cells[index + moves[event.key]].focus();
  });
  return grid;
}

function makeFleet(id) {
  return FLEET.map(({ name, length }) => {
    const item = document.createElement('li');
    const pips = document.createElement('span');
    pips.className = 'pips';
    pips.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < length; i += 1) pips.append(document.createElement('i'));
    const title = document.createElement('span');
    title.textContent = name;
    item.append(pips, title);
    byId(id).append(item);
    return item;
  });
}

const ownGrid = makeBoard('own-grid', placeAt, previewPlacement);
const enemyGrid = makeBoard('enemy-grid', fire);
const ownFleet = makeFleet('own-fleet');
const enemyFleet = makeFleet('enemy-fleet');

function previewPlacement(index = previewIndex) {
  previewIndex = index;
  const cells = battle.placementAt(index, vertical) ?? [];
  ownGrid.cells.forEach((cell, i) => cell.classList.toggle('placement-preview', cells.includes(i)));
}

function renderBoard(view, grid, fleet, count, lastShot, { focusable = true, canSelect, placing = false }) {
  view.cells.forEach((state, index) => {
    const cell = grid.cells[index];
    const [label, glyph] = labels[state];
    cell.dataset.state = state;
    cell.classList.toggle('latest', index === lastShot);
    cell.setAttribute('aria-label', `${coordinate(index)}: ${label}`);
    cell.textContent = glyph;
    cell.disabled = !focusable;
    cell.setAttribute('aria-disabled', String(!canSelect(index, state)));
    cell.tabIndex = focusable && index === grid.activeIndex ? 0 : -1;
  });
  const total = view.fleet.filter((ship) => placing ? ship.placed : !ship.sunk).length;
  count.textContent = `${total}/${FLEET.length} ${placing ? 'placed' : 'afloat'}`;
  view.fleet.forEach(({ name, length, placed, sunk }, index) => {
    fleet[index].classList.toggle('ship-sunk', sunk);
    fleet[index].classList.toggle('ship-pending', !placed);
    const condition = placing ? (placed ? 'placed' : 'not placed') : (sunk ? 'sunk' : 'afloat');
    fleet[index].setAttribute('aria-label', `${name}, ${length} squares, ${condition}`);
  });
}

function render(message) {
  const view = battle.view();
  const setup = view.phase === 'setup';
  const placing = Boolean(battle.nextShip);
  phase.textContent = {
    setup: 'Fleet setup', player: 'Your turn', enemy: 'Enemy turn',
    won: 'Victory', lost: 'Defeat',
  }[view.phase];
  phase.dataset.phase = view.phase;
  status.textContent = message;
  shuffle.hidden = start.hidden = !setup;
  place.hidden = !setup || placing;
  rotate.hidden = randomFill.hidden = !placing;
  rotate.setAttribute('aria-pressed', String(vertical));
  start.disabled = placing;
  restart.hidden = setup;
  byId('theater').classList.toggle('placing', placing);
  if (placing) byId('own-grid').setAttribute('aria-describedby', 'status');
  else byId('own-grid').removeAttribute('aria-describedby');
  restart.classList.toggle('primary', view.phase === 'won' || view.phase === 'lost');
  renderBoard(view.player, ownGrid, ownFleet, byId('own-count'), lastAiShot, {
    placing,
    focusable: placing,
    canSelect: (index) => Boolean(battle.placementAt(index, vertical)),
  });
  renderBoard(view.enemy, enemyGrid, enemyFleet, byId('enemy-count'), lastPlayerShot, {
    canSelect: (_, state) => view.phase === 'player' && state === 'water',
  });
  if (!placing) previewIndex = null;
  previewPlacement();
}

function record(actor, shot) {
  const target = (actor === 'You' ? enemyGrid : ownGrid).cells[shot.index];
  target.dataset.effect = shot.outcome === 'miss' ? 'splash' : 'blast';
  const square = coordinate(shot.index);
  const desc = shot.outcome === 'sunk' ? `sunk the ${shot.ship}` : shot.outcome;
  const item = document.createElement('li');
  const name = document.createElement('strong');
  name.textContent = actor;
  item.append(name, ` · ${square} · ${desc}`);
  log.prepend(item);
  if (log.children.length > 4) log.lastElementChild.remove();
  byId('empty-log').hidden = true;
  return `${actor === 'You' ? 'Your shot' : 'The AI'} at ${square}: ${desc}.`;
}

function finishRound(outcome, message) {
  const won = outcome === 'won';
  render(`${message} ${won ? 'You win!' : 'The AI wins.'}`);
  result.dataset.outcome = outcome;
  byId('result-title').textContent = won ? 'Victory!' : 'Defeat';
  byId('result-detail').textContent = won
    ? 'Enemy fleet sunk. You command these waters.'
    : 'Your fleet has gone under. Regroup and try again.';
  result.returnValue = '';
  timer = window.setTimeout(() => result.showModal(), 1000);
}

function fire(index) {
  const shot = battle.fire(index);
  if (!shot) return;
  lastPlayerShot = shot.index;
  const message = record('You', shot);
  if (battle.phase === 'won') {
    finishRound('won', message);
    return;
  }
  render(`${message} The AI is aiming.`);
  timer = window.setTimeout(() => {
    const shot = battle.counterFire();
    lastAiShot = shot.index;
    const reply = record('AI', shot);
    if (battle.phase === 'lost') {
      finishRound('lost', reply);
    } else {
      render(`${reply} Your turn.`);
    }
  }, 1250);
}

shuffle.addEventListener('click', () => {
  battle.shuffle();
  render('Fleet shuffled. Start a battle when ready.');
});

function placementMessage() {
  const { name, length } = battle.nextShip;
  return `Place the ${name} (${length} squares) ${vertical ? 'vertically' : 'horizontally'} in Your waters.`;
}

function finishPlacement() {
  render('Fleet placed. Start battle when ready.');
  start.focus();
}

function placeAt(index) {
  if (!battle.nextShip) return;
  if (!battle.placeShip(index, vertical)) {
    status.textContent = 'That ship won’t fit. Try another square or rotate.';
    return;
  }
  if (battle.nextShip) render(placementMessage());
  else finishPlacement();
}

place.addEventListener('click', () => {
  battle.beginPlacement();
  vertical = false;
  ownGrid.activeIndex = 0;
  render(placementMessage());
  ownGrid.cells[0].focus();
});
rotate.addEventListener('click', () => {
  if (!battle.nextShip) return;
  vertical = !vertical;
  render(placementMessage());
});
randomFill.addEventListener('click', () => {
  if (battle.placeRemaining()) finishPlacement();
  else status.textContent = 'No fleet fits here. Try Shuffle fleet to start over.';
});
start.addEventListener('click', () => {
  if (!battle.start()) return;
  render('Pick a square in enemy waters to fire.');
  enemyGrid.cells[enemyGrid.activeIndex].focus();
});
function resetBattle() {
  window.clearTimeout(timer);
  battle = new Battle();
  ownGrid.activeIndex = enemyGrid.activeIndex = 0;
  vertical = false;
  lastPlayerShot = lastAiShot = null;
  document.querySelectorAll('.tile[data-effect]').forEach((cell) => { delete cell.dataset.effect; });
  log.replaceChildren();
  byId('empty-log').hidden = false;
  render(setupMessage);
  start.focus();
}

restart.addEventListener('click', resetBattle);
result.addEventListener('close', () => {
  if (result.returnValue === 'replay') resetBattle();
});

render(setupMessage);

function openGame() {
  byId('access').hidden = true;
  byId('battle').hidden = false;
}

byId('access-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (accessCode.value.trim().toUpperCase() !== 'COGNITION') {
    accessError.textContent = 'That code isn’t correct. Try again.';
    accessCode.setAttribute('aria-invalid', 'true');
    accessCode.focus();
    return;
  }
  try { sessionStorage.setItem(accessKey, '1'); } catch {}
  openGame();
  start.focus();
});

accessCode.addEventListener('input', () => {
  accessCode.removeAttribute('aria-invalid');
  accessError.textContent = '';
});

try {
  if (sessionStorage.getItem(accessKey) === '1') openGame();
} catch {}
