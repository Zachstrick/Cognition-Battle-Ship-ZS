import { Battle, FLEET, SIZE, coordinate } from './game.mjs';

const byId = (id) => document.getElementById(id);
const phase = byId('phase');
const status = byId('status');
const shuffle = byId('shuffle');
const start = byId('start');
const restart = byId('restart');
const log = byId('log');
const labels = {
  water: ['Unfired', ''],
  ship: ['Ship', ''],
  miss: ['Miss', '•'],
  hit: ['Hit', '×'],
  sunk: ['Sunk', '×'],
};

let battle = new Battle();
let activeCell = 0;
let timer;
let lastPlayerShot = null;
let lastAiShot = null;

function makeBoard(id, interactive) {
  const board = byId(id);
  const cells = [];
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
        box.setAttribute('role', interactive ? 'gridcell' : 'cell');
        const cell = interactive ? document.createElement('button') : box;
        cell.className = 'tile';
        if (interactive) {
          const index = r * SIZE + c;
          cell.type = 'button';
          cell.addEventListener('click', () => fire(index));
          cell.addEventListener('focus', () => setActive(index));
          box.append(cell);
        }
        cells.push(cell);
      }
      line.append(box);
    }
    board.append(line);
  }
  return cells;
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

const ownCells = makeBoard('own-grid', false);
const enemyCells = makeBoard('enemy-grid', true);
const ownFleet = makeFleet('own-fleet');
const enemyFleet = makeFleet('enemy-fleet');

function setActive(index) {
  enemyCells[activeCell].tabIndex = -1;
  activeCell = index;
  enemyCells[activeCell].tabIndex = 0;
}

byId('enemy-grid').addEventListener('keydown', (event) => {
  const r = Math.floor(activeCell / SIZE);
  const c = activeCell % SIZE;
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
  enemyCells[activeCell + moves[event.key]].focus();
});

function renderBoard(view, cells, fleet, count, lastShot, canFire = false) {
  view.cells.forEach((state, index) => {
    const cell = cells[index];
    const [label, glyph] = labels[state];
    cell.dataset.state = state;
    cell.classList.toggle('latest', index === lastShot);
    cell.setAttribute('aria-label', `${coordinate(index)}: ${label}`);
    cell.textContent = glyph;
    if (cell.tagName === 'BUTTON') {
      cell.setAttribute('aria-disabled', String(!canFire || state !== 'water'));
      cell.tabIndex = index === activeCell ? 0 : -1;
    }
  });
  const remaining = view.fleet.filter((ship) => !ship.sunk).length;
  count.textContent = `${remaining}/${FLEET.length} afloat`;
  view.fleet.forEach(({ name, length, sunk }, index) => {
    fleet[index].classList.toggle('ship-sunk', sunk);
    fleet[index].setAttribute('aria-label', `${name}, ${length} squares, ${sunk ? 'sunk' : 'afloat'}`);
  });
}

function render(message) {
  const view = battle.view();
  phase.textContent = {
    setup: 'Fleet setup', player: 'Your turn', enemy: 'Enemy turn',
    won: 'Victory', lost: 'Defeat',
  }[view.phase];
  phase.dataset.phase = view.phase;
  status.textContent = message;
  shuffle.hidden = start.hidden = view.phase !== 'setup';
  restart.hidden = view.phase === 'setup';
  restart.classList.toggle('primary', view.phase === 'won' || view.phase === 'lost');
  renderBoard(view.player, ownCells, ownFleet, byId('own-count'), lastAiShot);
  renderBoard(view.enemy, enemyCells, enemyFleet, byId('enemy-count'), lastPlayerShot, view.phase === 'player');
}

function record(actor, shot) {
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

function fire(index) {
  const shot = battle.fire(index);
  if (!shot) return;
  lastPlayerShot = shot.index;
  const message = record('You', shot);
  if (battle.view().phase === 'won') {
    render(`${message} You win!`);
    return;
  }
  render(`${message} The AI is aiming.`);
  timer = window.setTimeout(() => {
    const shot = battle.counterFire();
    lastAiShot = shot.index;
    const reply = record('AI', shot);
    render(`${reply} ${battle.view().phase === 'lost' ? 'The AI wins.' : 'Your turn.'}`);
  }, 400);
}

shuffle.addEventListener('click', () => {
  battle.shuffle();
  render('Fleet shuffled. Start a battle when ready.');
});
start.addEventListener('click', () => {
  battle.start();
  render('Pick a square in enemy waters to fire.');
  enemyCells[activeCell].focus({ preventScroll: true });
});
restart.addEventListener('click', () => {
  window.clearTimeout(timer);
  battle = new Battle();
  activeCell = 0;
  lastPlayerShot = lastAiShot = null;
  log.replaceChildren();
  byId('empty-log').hidden = false;
  render('Shuffle your fleet or start with this formation.');
  start.focus();
});

render('Shuffle your fleet or start with this formation.');
