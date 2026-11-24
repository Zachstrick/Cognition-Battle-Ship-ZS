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

function placementCells(start, length, vertical) {
  if (!valid(start) || (vertical ? row(start) : column(start)) + length > SIZE) return null;
  return Array.from({ length }, (_, part) => start + part * (vertical ? SIZE : 1));
}

function completeFleet(ships, random) {
  const next = FLEET[ships.length];
  if (!next) return ships;
  const occupied = new Set(ships.flatMap(({ cells }) => cells));
  const placements = [];
  for (const start of positions) {
    for (const vertical of [false, true]) {
      const cells = placementCells(start, next.length, vertical);
      if (cells?.every((cell) => !occupied.has(cell))) placements.push(cells);
    }
  }
  while (placements.length) {
    const [cells] = placements.splice(Math.floor(random() * placements.length), 1);
    const fleet = completeFleet([...ships, { name: next.name, cells }], random);
    if (fleet) return fleet;
  }
  return null;
}

export function generateFleet(random = Math.random) {
  return completeFleet([], random);
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

const isSunk = (shots, { cells }) => shots[cells[0]] === 'sunk';
const fleetSunk = ({ ships, shots }) => ships.every((ship) => isSunk(shots, ship));

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
    fleet: FLEET.map(({ name, length }, index) => ({
      name,
      length,
      placed: Boolean(ships[index]),
      sunk: Boolean(ships[index]) && isSunk(shots, ships[index]),
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

  get phase() {
    return this.#phase;
  }

  get nextShip() {
    return this.#phase === 'setup' ? FLEET[this.#player.ships.length] ?? null : null;
  }

  beginPlacement() {
    if (this.#phase !== 'setup') return;
    this.#player.ships = [];
  }

  placementAt(index, vertical = false) {
    if (!this.nextShip) return null;
    const cells = placementCells(index, this.nextShip.length, vertical);
    if (!cells) return null;
    return this.#player.ships.some((ship) => ship.cells.some((cell) => cells.includes(cell))) ? null : cells;
  }

  placeShip(index, vertical = false) {
    const cells = this.placementAt(index, vertical);
    if (!cells) return false;
    this.#player.ships.push({ name: this.nextShip.name, cells });
    return true;
  }

  placeRemaining() {
    if (!this.nextShip) return false;
    const fleet = completeFleet(this.#player.ships, this.#random);
    if (!fleet) return false;
    this.#player.ships = fleet;
    return true;
  }

  shuffle() {
    if (this.#phase !== 'setup') return;
    this.#player = makeBoard(this.#random);
  }

  start() {
    if (this.#phase !== 'setup' || this.nextShip) return false;
    this.#phase = 'player';
    return true;
  }

  fire(index) {
    if (this.#phase !== 'player') return null;
    const result = resolveShot(this.#enemy, index);
    if (!result) return null;
    this.#phase = fleetSunk(this.#enemy) ? 'won' : 'enemy';
    return result;
  }

  counterFire() {
    if (this.#phase !== 'enemy') return null;
    const index = chooseAiShot(this.#player.shots, this.#random);
    const result = resolveShot(this.#player, index);
    this.#phase = fleetSunk(this.#player) ? 'lost' : 'player';
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
