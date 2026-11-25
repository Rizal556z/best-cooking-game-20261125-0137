// Logic test for Sizzle & Serve's world: runs the kitchen rules in Node
// with no DOM. Usage: node test-world.mjs  (exit 0 = all pass)
import { createRandom } from './game/src/random.js';
import {
  createWorld,
  EVENT_BURNED, EVENT_CHOP_DONE, EVENT_EXPIRED, EVENT_OVER,
  EVENT_SERVED, EVENT_WIN, EVENT_WRONG,
} from './game/src/world.js';
import { BINS, BOARD, GRILL, PLATE_STACK, SERVE, STEP, TRASH } from './game/src/config.js';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}`);
  }
}
const idle = { move: { x: 0, y: 0 }, interactHeld: false, confirm: false };
function stepN(world, n, input = idle) {
  let events = 0;
  for (let i = 0; i < n; i += 1) events |= world.step(STEP, input);
  return events;
}
function at(world, x, y) {
  world._setPlayer(x, y);
}
function use(world) {
  return world.step(STEP, { move: { x: 0, y: 0 }, interactHeld: false, confirm: true });
}
function binPos(id) {
  const b = BINS.find((v) => v.id === id);
  return [b.x, b.y + 80];
}

console.log('world logic tests');
{
  // 1. Pick up a plate, then ingredients from bins.
  const w = createWorld(createRandom(1));
  at(w, PLATE_STACK.x, PLATE_STACK.y + 80);
  stepN(w, 2);
  use(w);
  check('plate picked up', Array.isArray(w.state.plate) && w.state.plate.length === 0);
  const [bx, by] = binPos('bun');
  at(w, bx, by);
  stepN(w, 2);
  use(w);
  check('bun added to plate', w.state.plate.some((i) => i.id === 'bun'));
  // Duplicate ingredient refused.
  use(w);
  check('duplicate bun refused', w.state.plate.filter((i) => i.id === 'bun').length === 1);
  // No plate, no ingredient.
  const w2 = createWorld(createRandom(2));
  at(w2, ...binPos('bun'));
  stepN(w2, 2);
  use(w2);
  check('bin without plate does nothing', w2.state.plate === null);
}
{
  // 2. Chop a tomato on the board (hold E).
  const w = createWorld(createRandom(3));
  w._givePlate([['bun', 'raw'], ['tomato', 'raw']]);
  at(w, BOARD.x, BOARD.y + 90);
  stepN(w, 2);
  const events = stepN(w, 90, { move: { x: 0, y: 0 }, interactHeld: true, confirm: false });
  const tomato = w.state.plate.find((i) => i.id === 'tomato');
  check('tomato chopped after holding E', tomato && tomato.state === 'chopped');
  check('chop done event fired', (events & EVENT_CHOP_DONE) !== 0);
}
{
  // 3. Grill a patty: cooks, then burns if left.
  const w = createWorld(createRandom(4));
  w._givePlate([['patty', 'raw']]);
  at(w, GRILL.x, GRILL.y + 90);
  stepN(w, 2);
  use(w);
  check('patty moved to grill', w.state.grill[0] && w.state.grill[0].state === 'cooking');
  check('plate patty removed', !w.state.plate.some((i) => i.id === 'patty'));
  stepN(w, 60 * 5);
  check('patty cooked after 4s', w.state.grill[0] && w.state.grill[0].state === 'cooked');
  stepN(w, 60 * 5);
  check('patty burned after 9s', w.state.grill[0] && w.state.grill[0].state === 'burned');
  use(w);
  check('burnt patty binned with E', w.state.grill[0] === null);
}
{
  // 4. Serve a matching order: score, served count, order leaves the board.
  const w = createWorld(createRandom(5));
  w._spawnRecipe(1, 40); // Cheesy Melt: bun + patty + cheese
  w._givePlate([['bun', 'raw'], ['patty', 'cooked'], ['cheese', 'raw']]);
  at(w, SERVE.x, SERVE.y + 80);
  stepN(w, 2);
  const before = w.state.score;
  const events = use(w);
  check('matching serve event', (events & EVENT_SERVED) !== 0);
  check('score increased', w.state.score > before);
  check('served count 1', w.state.served === 1);
  check('order removed from board', w.state.orders.length === 0);
  check('plate emptied after serve', w.state.plate.length === 0);
}
{
  // 5. Wrong serve: heart lost, plate emptied.
  const w = createWorld(createRandom(6));
  w._spawnRecipe(1, 40); // Cheesy Melt
  w._givePlate([['bun', 'raw'], ['tomato', 'chopped']]);
  at(w, SERVE.x, SERVE.y + 80);
  stepN(w, 2);
  const events = use(w);
  check('wrong serve event', (events & EVENT_WRONG) !== 0);
  check('heart lost on wrong serve', w.state.hearts === 2);
  check('plate emptied on wrong serve', w.state.plate.length === 0);
}
{
  // 6. Order expiry costs a heart.
  const w = createWorld(createRandom(7));
  w._spawnRecipe(0, 1);
  const events = stepN(w, 70);
  check('expiry event fired', (events & EVENT_EXPIRED) !== 0);
  check('heart lost on expiry', w.state.hearts === 2);
}
{
  // 7. Three strikes ends the shift; shift timer ends in a win.
  const w = createWorld(createRandom(8));
  w._spawnRecipe(1, 40);
  w._givePlate([['bun', 'raw']]);
  at(w, SERVE.x, SERVE.y + 80);
  stepN(w, 2);
  use(w);
  w._givePlate([['bun', 'raw']]);
  use(w);
  w._givePlate([['bun', 'raw']]);
  const events = use(w);
  check('three wrong serves end the game', (events & EVENT_OVER) !== 0 && w.state.over);
  const w2 = createWorld(createRandom(9));
  // Jump near the end of the shift (orders need ~50 s to expire, so none
  // can cost a heart in the last half-second).
  w2.state.time = 149.5;
  const ev2 = stepN(w2, 60);
  check('shift timer ends in a win', (ev2 & EVENT_WIN) !== 0 && w2.state.won);
}
{
  // 8. Trash empties the plate; plating counter sets it down and back.
  const w = createWorld(createRandom(10));
  w._givePlate([['bun', 'raw'], ['cheese', 'raw']]);
  at(w, TRASH.x, TRASH.y + 80);
  stepN(w, 2);
  use(w);
  check('trash empties plate', w.state.plate.length === 0 && w.state.plate !== null);
  w._givePlate([['bun', 'raw']]);
  at(w, 640, 648 - 70);
  stepN(w, 2);
  use(w);
  check('plate set down on plating counter', w.state.platedDown === true);
  use(w);
  check('plate picked back up', w.state.platedDown === false);
}
{
  // 9. Movement stays inside the floor.
  const w = createWorld(createRandom(11));
  at(w, 640, 460);
  stepN(w, 600, { move: { x: 1, y: 1 }, interactHeld: false, confirm: false });
  check('player clamped to floor', w.state.player.x <= 24 + 1232 - 22 && w.state.player.y <= 196 + 500 - 22);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
