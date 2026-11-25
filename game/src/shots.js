// Deterministic screenshot staging for ?shot=cover|play|end.
// Each scene sets a real mid-game state with the game's own rules — orders
// on the board, a plate mid-assembly, a patty on the grill, a live timer —
// then freezes the clock, so the frame is what a short game really looks
// like. Every shot is a pure play frame: no title panel covers the kitchen.
import { SCREEN_PLAY } from './render.js';

// A Sunny Burger plate, mid-assembly (bun + cooked patty + chopped tomato;
// the lettuce is still to add).
function sunnyPlate() {
  return [
    { id: 'bun', state: 'raw' },
    { id: 'patty', state: 'cooked' },
    { id: 'tomato', state: 'chopped' },
  ];
}

const SHOTS = {
  // The cover: two orders on the board, the chef carrying a Sunny Burger
  // mid-assembly, a patty sizzling on the grill, timer running.
  cover: {
    time: 38, shiftLeft: 112, score: 120, served: 1, combo: 1,
    orders: [[0, 34], [1, 22]],
    player: { x: 640, y: 420, facing: -Math.PI / 2 },
    plate: 'sunny', platedDown: false,
    grill: [{ state: 'cooking', t: 2.2 }, null],
    chop: { active: false, target: null, t: 0 },
  },
  // The rush: three orders, one about to expire, the chef at the grill
  // grabbing a cooked patty, lettuce on the board mid-chop.
  play: {
    time: 96, shiftLeft: 54, score: 340, served: 4, combo: 3,
    orders: [[0, 8], [2, 26], [4, 41]],
    player: { x: 1060, y: 380, facing: 0 },
    plate: 'sunny', plateExtra: [{ id: 'lettuce', state: 'raw' }], platedDown: false,
    grill: [{ state: 'cooked', t: 5.5 }, { state: 'cooking', t: 1.1 }],
    chop: { active: true, target: 'lettuce', t: 0.7 },
  },
  // The end: shift nearly done, a finished plate in hand, the chef racing
  // the last order's timer to the serve window.
  end: {
    time: 141, shiftLeft: 9, score: 610, served: 7, combo: 2,
    orders: [[3, 11]],
    player: { x: 980, y: 260, facing: Math.PI / 2 },
    plate: 'full', platedDown: false,
    grill: [null, null],
    chop: { active: false, target: null, t: 0 },
  },
};

export function stageShot(name, world) {
  const stage = SHOTS[name] || SHOTS.cover;
  const state = world.state;
  world.reset();
  state.time = stage.time;
  state.shiftLeft = stage.shiftLeft;
  state.score = stage.score;
  state.coins = stage.score;
  state.served = stage.served;
  state.combo = stage.combo;
  state.bestCombo = stage.combo;
  state.player.x = stage.player.x;
  state.player.y = stage.player.y;
  state.player.facing = stage.player.facing;
  state.grill = stage.grill.map((s) => (s ? { ...s } : null));
  state.chop = { ...stage.chop };
  if (stage.plate === 'sunny') state.plate = sunnyPlate();
  else if (stage.plate === 'full') {
    state.plate = [
      { id: 'bun', state: 'raw' },
      { id: 'patty', state: 'cooked' },
      { id: 'cheese', state: 'raw' },
      { id: 'tomato', state: 'chopped' },
    ];
  }
  if (stage.plateExtra) state.plate.push(...stage.plateExtra.map((it) => ({ ...it })));
  state.platedDown = stage.platedDown;
  for (const [recipeIndex, timeLeft] of stage.orders) {
    world._spawnRecipe(recipeIndex, timeLeft);
  }
  return { screen: SCREEN_PLAY, best: state.score };
}
