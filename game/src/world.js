// The kitchen's rules: orders, stations, the plate, the grill and the
// chopping board. Pure logic — no DOM, no canvas — so Node can test it.
// One clear job: what happens when the chef acts, and what the clock does.
import {
  BINS, BOARD, CHOP_SECONDS, FLOOR, GRILL, GRILL_BURN_SECONDS,
  GRILL_COOK_SECONDS, HEARTS, INTERACT_RANGE, MAX_ORDERS, NEEDS_CHOP,
  NEEDS_GRILL, ORDER_TIME_END, ORDER_TIME_START, PLATE_STACK, PLATING,
  PLAYER, RECIPES, SERVE, SHIFT_SECONDS, SPAWN_EVERY_END,
  SPAWN_EVERY_START, STEP, TRASH,
} from './config.js';

export const EVENT_ORDER = 1;
export const EVENT_SERVED = 2;
export const EVENT_WRONG = 4;
export const EVENT_EXPIRED = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_CHOP_DONE = 64;
export const EVENT_GRILL_DONE = 128;
export const EVENT_BURNED = 256;

// A plate item: { id, state } where state is raw | chopped | cooked.
function item(id, state = 'raw') {
  return { id, state };
}

// The multiset a recipe wants, as sorted "id:state" strings.
function wantedItems(recipe) {
  return recipe.items
    .map((id) => (NEEDS_CHOP.includes(id) ? `${id}:chopped` : NEEDS_GRILL.includes(id) ? `${id}:cooked` : `${id}:raw`))
    .sort();
}
function plateItems(plate) {
  return plate.map((it) => `${it.id}:${it.state}`).sort();
}
export function plateMatchesRecipe(plate, recipe) {
  const a = plateItems(plate);
  const b = wantedItems(recipe);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
export function plateNeeds(plate, recipe) {
  const want = wantedItems(recipe);
  const have = plateItems(plate);
  return want.filter((w) => {
    const i = have.indexOf(w);
    if (i === -1) return true;
    have.splice(i, 1);
    return false;
  });
}

function distToRect(px, py, box) {
  const dx = Math.max(box.x - box.w / 2 - px, 0, px - (box.x + box.w / 2));
  const dy = Math.max(box.y - box.h / 2 - py, 0, py - (box.y + box.h / 2));
  return Math.hypot(dx, dy);
}

export function createWorld(random) {
  const state = freshState();

  function freshState() {
    return {
      time: 0,
      shiftLeft: SHIFT_SECONDS,
      score: 0,
      coins: 0,
      served: 0,
      mistakes: 0,
      hearts: HEARTS,
      combo: 0,
      bestCombo: 0,
      over: false,
      won: false,
      orders: [],
      nextOrderId: 1,
      spawnIn: 2,
      player: { x: 640, y: 480, facing: 0, moving: false },
      // The plate the chef carries (null when hands are empty), or the plate
      // resting on the plating counter (platedDown true).
      plate: null,
      platedDown: false,
      grill: [null, null], // { state: 'cooking'|'cooked'|'burned', t } per slot
      chop: { active: false, target: null, t: 0 },
      floats: [], // { x, y, text, color, t }
      particles: [], // { x, y, vx, vy, color, t, life }
      hint: '',
      hintT: 0,
      nearStation: null,
      servedFlash: 0,
      wrongFlash: 0,
    };
  }

  function shiftProgress() {
    return Math.min(1, state.time / SHIFT_SECONDS);
  }
  function orderTime() {
    return ORDER_TIME_START + (ORDER_TIME_END - ORDER_TIME_START) * shiftProgress();
  }
  function spawnEvery() {
    return SPAWN_EVERY_START + (SPAWN_EVERY_END - SPAWN_EVERY_START) * shiftProgress();
  }

  function spawnOrder() {
    const recipe = random.pick(RECIPES);
    state.orders.push({
      id: state.nextOrderId++,
      recipe,
      timeLeft: orderTime(),
      timeMax: orderTime(),
    });
    return EVENT_ORDER;
  }

  function addFloat(x, y, text, color) {
    state.floats.push({ x, y, text, color, t: 0 });
    if (state.floats.length > 12) state.floats.shift();
  }
  function addParticles(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = random.next() * Math.PI * 2;
      const sp = 30 + random.next() * 70;
      state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        color, t: 0, life: 0.5 + random.next() * 0.4,
      });
    }
    if (state.particles.length > 120) state.particles.splice(0, state.particles.length - 120);
  }
  function setHint(text) {
    state.hint = text;
    state.hintT = 2.5;
  }

  // Nearest station the chef can use right now, or null.
  function nearestStation() {
    const p = state.player;
    const candidates = [];
    for (const bin of BINS) candidates.push({ kind: 'bin', id: bin.id, box: { x: bin.x, y: bin.y, w: 110, h: 90 } });
    candidates.push({ kind: 'plates', box: { x: PLATE_STACK.x, y: PLATE_STACK.y, w: 110, h: 90 } });
    candidates.push({ kind: 'trash', box: { x: TRASH.x, y: TRASH.y, w: 110, h: 90 } });
    candidates.push({ kind: 'serve', box: { x: SERVE.x, y: SERVE.y, w: 220, h: 90 } });
    candidates.push({ kind: 'board', box: { x: BOARD.x, y: BOARD.y, w: 170, h: 140 } });
    candidates.push({ kind: 'grill', box: { x: GRILL.x, y: GRILL.y, w: 170, h: 140 } });
    candidates.push({ kind: 'plating', box: { x: PLATING.x, y: PLATING.y, w: 260, h: 90 } });
    let best = null;
    let bestD = Infinity;
    for (const c of candidates) {
      const d = distToRect(p.x, p.y, c.box);
      if (d < INTERACT_RANGE && d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  function loseHeart(reason) {
    state.hearts -= 1;
    state.mistakes += 1;
    state.combo = 0;
    state.wrongFlash = 1;
    if (state.hearts <= 0) {
      state.over = true;
      return EVENT_OVER;
    }
    return reason;
  }

  // Press E (edge) at the station under the chef.
  function useStation() {
    const st = state.nearStation;
    if (!st) return 0;
    const plate = state.plate;
    if (st.kind === 'plates') {
      if (!plate) {
        state.plate = [];
        state.platedDown = false;
        addFloat(state.player.x, state.player.y - 40, 'Plate!', '#ffe9a8');
        return 0;
      }
      setHint('You already have a plate');
      return 0;
    }
    if (st.kind === 'bin') {
      if (!plate || state.platedDown) {
        setHint('Grab a plate first (PLATES)');
        return 0;
      }
      if (plate.some((it) => it.id === st.id)) {
        setHint('Already on the plate');
        return 0;
      }
      plate.push(item(st.id));
      addParticles(state.player.x, state.player.y - 20, '#ffd166', 6);
      return 0;
    }
    if (st.kind === 'trash') {
      if (!plate || plate.length === 0) {
        setHint('Nothing to throw away');
        return 0;
      }
      state.plate = [];
      addFloat(state.player.x, state.player.y - 40, 'Tossed', '#c9ced6');
      return 0;
    }
    if (st.kind === 'plating') {
      if (plate && !state.platedDown) {
        state.platedDown = true;
        return 0;
      }
      if (plate && state.platedDown) {
        state.platedDown = false;
        return 0;
      }
      setHint('No plate to set down');
      return 0;
    }
    if (st.kind === 'grill') {
      // Take a cooked patty first; then place a raw patty; burnt ones get binned.
      for (let i = 0; i < state.grill.length; i += 1) {
        const slot = state.grill[i];
        if (slot && slot.state === 'burned') {
          state.grill[i] = null;
          addFloat(GRILL.x, GRILL.y - 70, 'Binned the burnt patty', '#c9ced6');
          return 0;
        }
      }
      for (let i = 0; i < state.grill.length; i += 1) {
        const slot = state.grill[i];
        if (slot && slot.state === 'cooked' && plate && !state.platedDown) {
          state.grill[i] = null;
          plate.push(item('patty', 'cooked'));
          addFloat(state.player.x, state.player.y - 40, 'Patty on!', '#ffb703');
          return EVENT_GRILL_DONE;
        }
      }
      if (plate && !state.platedDown) {
        const raw = plate.findIndex((it) => it.id === 'patty' && it.state === 'raw');
        if (raw !== -1) {
          const free = state.grill.findIndex((s) => s === null);
          if (free !== -1) {
            plate.splice(raw, 1);
            state.grill[free] = { state: 'cooking', t: 0 };
            addParticles(GRILL.x, GRILL.y, '#ff9f1c', 10);
            return 0;
          }
          setHint('Grill is full');
          return 0;
        }
      }
      setHint('Grill needs a raw patty from your plate');
      return 0;
    }
    if (st.kind === 'serve') {
      if (!plate || state.platedDown) {
        setHint('Bring a finished plate to serve');
        return 0;
      }
      if (plate.length === 0) {
        setHint('The plate is empty');
        return 0;
      }
      const match = state.orders.find((o) => plateMatchesRecipe(plate, o.recipe));
      if (!match) {
        state.plate = [];
        addFloat(SERVE.x, SERVE.y - 60, 'WRONG ORDER!', '#ff5964');
        return loseHeart(EVENT_WRONG);
      }
      const reward = 40 + 10 * match.recipe.items.length + Math.round(match.timeLeft);
      const mult = 1 + Math.min(2, state.combo) * 0.5;
      const earned = Math.round(reward * mult);
      state.score += earned;
      state.coins += earned;
      state.served += 1;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.orders = state.orders.filter((o) => o.id !== match.id);
      state.plate = [];
      state.servedFlash = 1;
      addFloat(SERVE.x, SERVE.y - 60, `+${earned}  ${match.recipe.name}!`, '#7bf1a8');
      addParticles(SERVE.x, SERVE.y, '#7bf1a8', 16);
      return EVENT_SERVED;
    }
    return 0;
  }

  // Hold E at the chopping board: chops the first raw veg on the plate.
  function chopStep(dt, held) {
    const st = state.nearStation;
    const plate = state.plate;
    if (!held || !st || st.kind !== 'board' || !plate || state.platedDown) {
      if (state.chop.active) {
        state.chop.active = false;
        state.chop.t = 0;
      }
      return 0;
    }
    const target = plate.find((it) => NEEDS_CHOP.includes(it.id) && it.state === 'raw');
    if (!target) {
      state.chop.active = false;
      state.chop.t = 0;
      return 0;
    }
    state.chop.active = true;
    state.chop.target = target.id;
    state.chop.t += dt;
    if (random.next() < 0.3) addParticles(BOARD.x, BOARD.y - 20, '#8ac926', 1);
    if (state.chop.t >= CHOP_SECONDS) {
      target.state = 'chopped';
      state.chop.active = false;
      state.chop.t = 0;
      addFloat(BOARD.x, BOARD.y - 70, 'Chopped!', '#8ac926');
      return EVENT_CHOP_DONE;
    }
    return 0;
  }

  function step(dt, input) {
    if (state.over || state.won) return 0;
    let events = 0;
    state.time += dt;
    state.shiftLeft = Math.max(0, SHIFT_SECONDS - state.time);
    if (state.shiftLeft <= 0) {
      state.won = true;
      return EVENT_WIN;
    }
    // Move the chef.
    const p = state.player;
    const mx = input.move.x;
    const my = input.move.y;
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) p.facing = Math.atan2(my, mx);
    p.x = Math.min(FLOOR.x + FLOOR.w - PLAYER.radius, Math.max(FLOOR.x + PLAYER.radius, p.x + mx * PLAYER.speed * dt));
    p.y = Math.min(FLOOR.y + FLOOR.h - PLAYER.radius, Math.max(FLOOR.y + PLAYER.radius, p.y + my * PLAYER.speed * dt));

    state.nearStation = nearestStation();
    if (input.confirm) events |= useStation();
    events |= chopStep(dt, input.interactHeld);

    // Grill timers.
    for (let i = 0; i < state.grill.length; i += 1) {
      const slot = state.grill[i];
      if (!slot) continue;
      slot.t += dt;
      if (slot.state === 'cooking' && slot.t >= GRILL_COOK_SECONDS) {
        slot.state = 'cooked';
        addFloat(GRILL.x, GRILL.y - 70, 'Patty ready!', '#ffb703');
      } else if (slot.state === 'cooked' && slot.t >= GRILL_BURN_SECONDS) {
        slot.state = 'burned';
        addFloat(GRILL.x, GRILL.y - 70, 'BURNT!', '#ff5964');
        events |= EVENT_BURNED;
      }
    }

    // Order timers and spawning.
    for (const order of [...state.orders]) {
      order.timeLeft -= dt;
      if (order.timeLeft <= 0) {
        state.orders = state.orders.filter((o) => o.id !== order.id);
        addFloat(120, 130, `Order #${order.id} expired!`, '#ff5964');
        events |= loseHeart(EVENT_EXPIRED);
        if (state.over) return events | EVENT_OVER;
      }
    }
    state.spawnIn -= dt;
    if (state.spawnIn <= 0 && state.orders.length < MAX_ORDERS) {
      events |= spawnOrder();
      state.spawnIn = spawnEvery();
    }

    // Cosmetics.
    if (state.hintT > 0) state.hintT -= dt;
    if (state.servedFlash > 0) state.servedFlash = Math.max(0, state.servedFlash - dt * 1.5);
    if (state.wrongFlash > 0) state.wrongFlash = Math.max(0, state.wrongFlash - dt * 1.5);
    for (const f of state.floats) f.t += dt;
    state.floats = state.floats.filter((f) => f.t < 1.4);
    for (const pt of state.particles) {
      pt.t += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 60 * dt;
    }
    state.particles = state.particles.filter((pt) => pt.t < pt.life);
    return events;
  }

  function reset() {
    const fresh = freshState();
    for (const key of Object.keys(state)) state[key] = fresh[key];
  }

  return {
    state,
    step,
    reset,
    spawnOrder,
    plateMatchesRecipe,
    plateNeeds,
    // Test hooks: stage a state without playing.
    _setPlayer(x, y) {
      state.player.x = x;
      state.player.y = y;
    },
    _givePlate(items) {
      state.plate = items.map(([id, st]) => item(id, st || 'raw'));
      state.platedDown = false;
    },
    // Spawn an order for a specific recipe index with a set timer (shots).
    _spawnRecipe(recipeIndex, timeLeft) {
      const recipe = RECIPES[recipeIndex % RECIPES.length];
      const t = timeLeft ?? orderTime();
      state.orders.push({ id: state.nextOrderId++, recipe, timeLeft: t, timeMax: t });
    },
  };
}
