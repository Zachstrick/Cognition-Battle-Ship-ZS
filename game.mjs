export const SIZE = 10;
export const FLEET = Object.freeze([
  Object.freeze({ name: 'Carrier', length: 5 }),
  Object.freeze({ name: 'Battleship', length: 4 }),
  Object.freeze({ name: 'Cruiser', length: 3 }),
  Object.freeze({ name: 'Submarine', length: 3 }),
  Object.freeze({ name: 'Destroyer', length: 2 }),
]);

const AREA = SIZE * SIZE;
const positions = Array.from({ length: AREA }, (_, index) => index);
const row = (index) => Math.floor(index / SIZE);
const column = (index) => index % SIZE;
const valid = (index) => Number.isInteger(index) && index >= 0 && index < AREA;
const pick = (options, random) => options[Math.floor(random() * options.length)];

export function coordinate(index) {
  return `${String.fromCharCode(65 + row(index))}${column(index) + 1}`;
}

export function neighbors(index) {
  return [
    row(index) > 0 ? index - SIZE : -1,
    row(index) < SIZE - 1 ? index + SIZE : -1,
    column(index) > 0 ? index - 1 : -1,
    column(index) < SIZE - 1 ? index + 1 : -1,
  ].filter(valid);
}

export function generateFleet(random = Math.random) {
  const occupied = new Set();
  return FLEET.map(({ name, length }) => {
    const placements = [];
    for (const start of positions) {
      for (const [offset, limit] of [[1, column(start)], [SIZE, row(start)]]) {
        if (limit + length > SIZE) continue;
        const cells = Array.from({ length }, (_, part) => start + part * offset);
        if (cells.every((cell) => !occupied.has(cell))) placements.push(cells);
      }
    }
    const cells = pick(placements, random);
    cells.forEach((cell) => occupied.add(cell));
    return { name, cells };
  });
}

export function chooseAiShot(shots, random = Math.random) {
  const open = positions.filter((index) => shots[index] === 'water');
  if (!open.length) return null;

  const scores = new Map();
  for (const hit of positions.filter((index) => shots[index] === 'hit')) {
    for (const next of neighbors(hit)) {
      if (shots[next] !== 'water') continue;
      const opposite = 2 * hit - next;
      const aligned = neighbors(hit).includes(opposite) && shots[opposite] === 'hit';
      scores.set(next, (scores.get(next) ?? 0) + (aligned ? 3 : 1));
    }
  }
  if (scores.size) {
    const best = Math.max(...scores.values());
    return pick([...scores.keys()].filter((index) => scores.get(index) === best), random);
  }

  // Every unhit ship spans both checkerboard colors.
  const hunt = open.filter((index) => (row(index) + column(index)) % 2 === 0);
  return pick(hunt.length ? hunt : open, random);
}

function makeBoard(random) {
  return { ships: generateFleet(random), shots: Array(AREA).fill('water') };
}

function resolveShot(board, index) {
  if (!valid(index) || board.shots[index] !== 'water') return null;
  const ship = board.ships.find(({ cells }) => cells.includes(index));
  if (!ship) {
    board.shots[index] = 'miss';
    return { index, outcome: 'miss' };
  }
  board.shots[index] = 'hit';
  if (!ship.cells.every((cell) => board.shots[cell] === 'hit')) {
    return { index, outcome: 'hit' };
  }
  ship.cells.forEach((cell) => { board.shots[cell] = 'sunk'; });
  return { index, outcome: 'sunk', ship: ship.name };
}

function boardView({ ships, shots }, reveal) {
  const cells = [...shots];
  if (reveal) {
    for (const ship of ships) {
      for (const cell of ship.cells) {
        if (cells[cell] === 'water') cells[cell] = 'ship';
      }
    }
  }
  return {
    cells,
    fleet: ships.map(({ name, cells }) => ({
      name,
      length: cells.length,
      sunk: shots[cells[0]] === 'sunk',
    })),
  };
}

export class Battle {
  #player;
  #enemy;
  #random;
  #phase = 'setup';

  constructor(random = Math.random) {
    this.#random = random;
    this.#player = makeBoard(random);
    this.#enemy = makeBoard(random);
  }

  shuffle() {
    if (this.#phase !== 'setup') return;
    this.#player = makeBoard(this.#random);
  }

  start() {
    if (this.#phase === 'setup') this.#phase = 'player';
  }

  fire(index) {
    if (this.#phase !== 'player') return null;
    const result = resolveShot(this.#enemy, index);
    if (!result) return null;
    this.#phase = this.#enemy.ships.every(({ cells }) => this.#enemy.shots[cells[0]] === 'sunk')
      ? 'won' : 'enemy';
    return result;
  }

  counterFire() {
    if (this.#phase !== 'enemy') return null;
    const index = chooseAiShot(this.#player.shots, this.#random);
    const result = resolveShot(this.#player, index);
    this.#phase = this.#player.ships.every(({ cells }) => this.#player.shots[cells[0]] === 'sunk')
      ? 'lost' : 'player';
    return result;
  }

  view() {
    return {
      phase: this.#phase,
      player: boardView(this.#player, true),
      enemy: boardView(this.#enemy, this.#phase === 'lost'),
    };
  }
}
