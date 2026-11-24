import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Battle, FLEET, SIZE, chooseAiShot, coordinate, generateFleet, neighbors } from './game.mjs';

const area = SIZE ** 2;
const squares = () => Array(area).fill('water');

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function match(seed) {
  const random = seeded(seed);
  const own = generateFleet(random);
  const enemy = generateFleet(random);
  return { battle: new Battle(seeded(seed)), own, enemy };
}

test('many fleet layouts stay in bounds, contiguous, straight, and disjoint', () => {
  for (let seed = 0; seed < 128; seed += 1) {
    const fleet = generateFleet(seeded(seed));
    const occupied = fleet.flatMap(({ cells }) => cells);
    assert.equal(occupied.length, 17);
    assert.equal(new Set(occupied).size, 17);
    for (const [index, { name, cells }] of fleet.entries()) {
      assert.equal(name, FLEET[index].name);
      assert.equal(cells.length, FLEET[index].length);
      const step = cells[1] - cells[0];
      assert.ok(step === 1 || step === SIZE);
      for (const [part, cell] of cells.entries()) {
        assert.ok(cell >= 0 && cell < area);
        assert.equal(cell, cells[0] + step * part);
        if (step === 1) assert.equal(Math.floor(cell / SIZE), Math.floor(cells[0] / SIZE));
      }
    }
  }
});

test('edge cells never have neighbors from the other side of the board', () => {
  assert.equal(coordinate(9), 'A10');
  assert.equal(coordinate(10), 'B1');
  assert.deepEqual(neighbors(9), [19, 8]);
  assert.deepEqual(neighbors(10), [0, 20, 11]);
});

test('AI hunts unknown squares, follows aligned hits, and drops sunk targets', () => {
  const cells = squares();
  assert.equal(chooseAiShot(cells, () => 0), 0);
  cells[44] = 'hit';
  cells[45] = 'hit';
  cells[46] = 'miss';
  assert.equal(chooseAiShot(cells, () => 0), 43);
  cells[44] = cells[45] = 'sunk';
  assert.equal(chooseAiShot(cells, () => 0), 0);
  cells.fill('miss');
  cells[1] = 'water';
  assert.equal(chooseAiShot(cells, () => 0), 1);
  cells[1] = 'miss';
  assert.equal(chooseAiShot(cells, () => 0), null);
});

test('setup can shuffle only your fleet; enemy positions remain hidden', () => {
  const { battle, enemy } = match(33);
  const before = battle.view();
  assert.equal(before.phase, 'setup');
  assert.equal(battle.phase, 'setup');
  assert.throws(() => { battle.phase = 'won'; }, TypeError);
  assert.equal(battle.fire(0), null);
  assert.equal(battle.counterFire(), null);
  assert.deepEqual(before.enemy.cells, squares());
  battle.shuffle();
  const shuffled = battle.view();
  assert.notDeepEqual(shuffled.player.cells, before.player.cells);
  assert.deepEqual(shuffled.enemy.cells, squares());
  battle.start();
  battle.shuffle();
  assert.deepEqual(battle.view().player.cells, shuffled.player.cells);
  assert.equal(battle.fire(enemy[0].cells[0]).outcome, 'hit');
});

test('invalid and duplicate shots do not spend a turn or allow another AI reply', () => {
  const { battle } = match(33);
  battle.start();
  for (const index of [-1, area, 0.5, '1', NaN]) assert.equal(battle.fire(index), null);
  assert.equal(battle.phase, 'player');
  assert.equal(battle.fire(0).index, 0);
  assert.equal(battle.fire(1), null);
  assert.ok(battle.counterFire());
  assert.equal(battle.counterFire(), null);
  assert.equal(battle.fire(0), null);
  assert.equal(battle.phase, 'player');
  assert.equal(battle.fire(1).index, 1);
});

test('sinking marks the full ship and the final hit wins without a return shot', () => {
  const { battle, enemy } = match(33);
  battle.start();
  for (const [shipIndex, { name, cells }] of enemy.entries()) {
    for (const [part, index] of cells.entries()) {
      const result = battle.fire(index);
      const lastPart = part === cells.length - 1;
      assert.deepEqual(result, lastPart ? { index, outcome: 'sunk', ship: name } : { index, outcome: 'hit' });
      if (lastPart) {
        const view = battle.view();
        assert.ok(view.enemy.fleet[shipIndex].sunk);
        assert.ok(cells.every((cell) => view.enemy.cells[cell] === 'sunk'));
      }
      const victory = lastPart && shipIndex === enemy.length - 1;
      assert.equal(battle.phase, victory ? 'won' : 'enemy');
      assert.equal(battle.counterFire() === null, victory);
    }
  }
  assert.equal(battle.fire(99), null);
});

test('AI completes a match without repeat shots; defeat reveals the surviving fleet', () => {
  for (let seed = 12; seed < 28; seed += 1) {
    const { battle, enemy } = match(seed);
    const occupied = new Set(enemy.flatMap(({ cells }) => cells));
    const counterShots = new Set();
    battle.start();
    for (let index = 0; index < area && battle.phase === 'player'; index += 1) {
      if (occupied.has(index)) continue;
      assert.equal(battle.fire(index).outcome, 'miss');
      const shot = battle.counterFire();
      assert.ok(!counterShots.has(shot.index));
      counterShots.add(shot.index);
    }
    const view = battle.view();
    assert.equal(view.phase, 'lost');
    assert.equal(battle.phase, 'lost');
    assert.ok(view.player.fleet.every(({ sunk }) => sunk));
    assert.ok([...occupied].every((index) => view.enemy.cells[index] === 'ship'));
    assert.equal(battle.counterFire(), null);
    assert.equal(battle.fire([...occupied][0]), null);
  }
});
