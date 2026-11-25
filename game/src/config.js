// Sizzle & Serve — Ember Lane Kitchen: tuning and layout constants.
// One clear job: every number the game balances on lives here.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const BEST_KEY = 'sizzle-and-serve-best';
export const SHIFT_SECONDS = 150;
export const HEARTS = 3;

export const PLAYER = { radius: 22, speed: 265 };

// Stations: { id, kind, x, y, w, h, label }. x/y are the counter's centre;
// the chef interacts when within INTERACT_RANGE of the station's edge box.
export const INTERACT_RANGE = 78;

export const BINS = [
  { id: 'bun', label: 'BUN', x: 105, y: 185 },
  { id: 'patty', label: 'PATTY', x: 215, y: 185 },
  { id: 'tomato', label: 'TOMATO', x: 325, y: 185 },
  { id: 'lettuce', label: 'LETTUCE', x: 435, y: 185 },
  { id: 'cheese', label: 'CHEESE', x: 545, y: 185 },
  { id: 'onion', label: 'ONION', x: 655, y: 185 },
];
export const BIN_W = 92;
export const BIN_H = 64;

export const PLATE_STACK = { x: 780, y: 185, w: 92, h: 64, label: 'PLATES' };
export const TRASH = { x: 905, y: 185, w: 92, h: 64, label: 'TRASH' };
export const SERVE = { x: 1110, y: 185, w: 200, h: 64, label: 'SERVE' };
export const BOARD = { x: 110, y: 400, w: 150, h: 120, label: 'CHOP' };
export const GRILL = { x: 1170, y: 400, w: 150, h: 120, label: 'GRILL' };
export const PLATING = { x: 640, y: 660, w: 240, h: 64, label: 'PLATING' };

// Kitchen floor bounds the chef can walk in (below the HUD, inside walls).
export const FLOOR = { x: 24, y: 236, w: 1232, h: 460 };

export const CHOP_SECONDS = 1.2;
export const GRILL_COOK_SECONDS = 4;
export const GRILL_BURN_SECONDS = 9;

export const ORDER_TIME_START = 50;
export const ORDER_TIME_END = 32;
export const SPAWN_EVERY_START = 14;
export const SPAWN_EVERY_END = 9;
export const MAX_ORDERS = 3;

// A recipe is a list of plate items. Item ids: bun, patty (cooked), cheese,
// tomato, lettuce, onion — the last three only count once chopped.
export const RECIPES = [
  { name: 'Sunny Burger', items: ['bun', 'patty', 'tomato', 'lettuce'] },
  { name: 'Cheesy Melt', items: ['bun', 'patty', 'cheese'] },
  { name: 'Garden Stack', items: ['bun', 'tomato', 'lettuce', 'onion', 'cheese'] },
  { name: 'Double Trouble', items: ['bun', 'patty', 'patty', 'cheese', 'tomato'] },
  { name: 'Onion Crunch', items: ['bun', 'patty', 'onion', 'lettuce'] },
  { name: 'Classic Melt', items: ['bun', 'patty', 'cheese', 'tomato'] },
];

export const INGREDIENT_NAMES = {
  bun: 'Bun',
  patty: 'Patty',
  tomato: 'Tomato',
  lettuce: 'Lettuce',
  cheese: 'Cheese',
  onion: 'Onion',
};

// Which raw items need chopping before they count in a recipe.
export const NEEDS_CHOP = ['tomato', 'lettuce', 'onion'];
// Which raw items need grilling before they count.
export const NEEDS_GRILL = ['patty'];
