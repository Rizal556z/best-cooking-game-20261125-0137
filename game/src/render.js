// Everything the player sees: the kitchen, the order board, the chef and
// the plates, plus the title / pause / over / win screens.
// One clear job: drawing only — it never changes the world.
import {
  BINS, BIN_H, BIN_W, BOARD, FLOOR, GRILL, INGREDIENT_NAMES, PLATE_STACK,
  PLATING, PLAYER, SERVE, TRASH, VIEW,
} from './config.js';
import { plateNeeds } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CREAM = '#fff6e3';
const INK = '#2b2118';
const COUNTER_TOP = '#b5763f';
const COUNTER_SIDE = '#8a5426';
const STEEL = '#c9ced6';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function text(ctx, s, x, y, size, color, align = 'center', weight = '700') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Trebuchet MS", Verdana, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
function shadow(ctx, on) {
  ctx.shadowColor = on ? 'rgba(0,0,0,0.25)' : 'transparent';
  ctx.shadowBlur = on ? 6 : 0;
  ctx.shadowOffsetY = on ? 3 : 0;
}

// One ingredient drawn small, at (x, y), roughly `size` px wide.
export function drawIngredient(ctx, id, state, x, y, size) {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  if (id === 'bun') {
    ctx.fillStyle = '#e8a94e';
    ctx.beginPath();
    ctx.arc(0, 2, s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f7c873';
    ctx.fillRect(-s, 2, s * 2, s * 0.45);
    ctx.fillStyle = '#fff2cf';
    for (const dx of [-s * 0.5, 0, s * 0.5]) {
      ctx.beginPath();
      ctx.arc(dx, -s * 0.45, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'patty') {
    ctx.fillStyle = state === 'burned' ? '#1d1410' : state === 'cooked' ? '#7a4a21' : '#c46a7a';
    rr(ctx, -s, -s * 0.45, s * 2, s * 0.9, s * 0.35);
    ctx.fill();
    if (state === 'cooked') {
      ctx.fillStyle = '#5d3413';
      for (const dx of [-s * 0.5, s * 0.4]) {
        ctx.beginPath();
        ctx.arc(dx, 0, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (id === 'tomato') {
    ctx.fillStyle = state === 'chopped' ? '#ff7a6b' : '#e63946';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9d94';
    ctx.beginPath();
    ctx.arc(-s * 0.3, -s * 0.3, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    if (state === 'chopped') {
      ctx.strokeStyle = '#c1121f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, 0);
      ctx.lineTo(s * 0.6, 0);
      ctx.stroke();
    }
  } else if (id === 'lettuce') {
    ctx.fillStyle = state === 'chopped' ? '#7ed957' : '#38b000';
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      ctx.arc(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.55, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = '#a7e88a';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'cheese') {
    ctx.fillStyle = '#ffc300';
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.6);
    ctx.lineTo(s, s * 0.6);
    ctx.lineTo(0, -s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e09f00';
    for (const [dx, dy] of [[-s * 0.3, s * 0.2], [s * 0.25, 0]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'onion') {
    ctx.strokeStyle = state === 'chopped' ? '#b388eb' : '#7b2cbf';
    ctx.lineWidth = 4;
    for (const r of [s * 0.85, s * 0.55, s * 0.28]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#e0aaff';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlate(ctx, items, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#f8f9fa';
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#adb5bd';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Stack the ingredients on the plate, bottom to top.
  const order = ['bun', 'patty', 'cheese', 'tomato', 'lettuce', 'onion'];
  const sorted = [...items].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  let lift = -6;
  for (const it of sorted) {
    drawIngredient(ctx, it.id, it.state, 0, lift, 40);
    lift -= 9;
  }
  ctx.restore();
}

function drawOrderCard(ctx, order, x, y, w, h, plate) {
  const urgent = order.timeLeft < 12;
  ctx.save();
  shadow(ctx, true);
  ctx.fillStyle = urgent ? '#ffe3e3' : CREAM;
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = urgent ? '#ff5964' : '#d9a441';
  ctx.lineWidth = urgent ? 3 : 2;
  rr(ctx, x, y, w, h, 10);
  ctx.stroke();
  text(ctx, `#${order.id} ${order.recipe.name}`, x + 10, y + 14, 13, INK, 'left');
  // Recipe icons in a row.
  let ix = x + 22;
  for (const id of order.recipe.items) {
    const state = id === 'patty' ? 'cooked' : ['tomato', 'lettuce', 'onion'].includes(id) ? 'chopped' : 'raw';
    drawIngredient(ctx, id, state, ix, y + 38, 26);
    ix += 30;
  }
  // What the carried plate still owes this order (title line, right side).
  if (plate && plate.length > 0) {
    const missing = plateNeeds(plate, order.recipe);
    text(ctx, missing.length === 0 ? 'READY!' : `needs ${missing.length} more`, x + w - 10, y + 14, 11, missing.length === 0 ? '#2a9d3f' : '#8a5426', 'right');
  }
  // Timer bar.
  const frac = Math.max(0, order.timeLeft / order.timeMax);
  ctx.fillStyle = '#e9ecef';
  rr(ctx, x + 10, y + h - 16, w - 20, 8, 4);
  ctx.fill();
  ctx.fillStyle = frac > 0.5 ? '#2a9d3f' : frac > 0.25 ? '#ff9f1c' : '#ff5964';
  if (frac > 0) {
    rr(ctx, x + 10, y + h - 16, (w - 20) * frac, 8, 4);
    ctx.fill();
  }
  text(ctx, `${Math.ceil(order.timeLeft)}s`, x + w - 10, y + h - 26, 11, urgent ? '#ff5964' : INK, 'right');
}

function drawStation(ctx, box, label, active, sub) {
  ctx.save();
  shadow(ctx, true);
  ctx.fillStyle = COUNTER_TOP;
  rr(ctx, box.x - box.w / 2, box.y - box.h / 2, box.w, box.h, 12);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = COUNTER_SIDE;
  rr(ctx, box.x - box.w / 2, box.y + box.h / 2 - 10, box.w, 10, 5);
  ctx.fill();
  if (active) {
    ctx.strokeStyle = '#ffe66d';
    ctx.lineWidth = 4;
    rr(ctx, box.x - box.w / 2 - 3, box.y - box.h / 2 - 3, box.w + 6, box.h + 6, 14);
    ctx.stroke();
  }
  text(ctx, label, box.x, box.y + box.h / 2 - 22, 13, '#fff', 'center');
  if (sub) text(ctx, sub, box.x, box.y - box.h / 2 + 14, 11, '#ffe9a8', 'center');
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = VIEW.width * dpr;
  canvas.height = VIEW.height * dpr;
  canvas.style.width = '100%';
  ctx.scale(dpr, dpr);

  function drawKitchen(state) {
    // Floor tiles.
    ctx.fillStyle = '#e9d8a6';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#e2cf9b';
    const tile = 64;
    for (let y = 0; y < VIEW.height; y += tile) {
      for (let x = ((y / tile) % 2) * tile; x < VIEW.width; x += tile * 2) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
    // Walls.
    ctx.fillStyle = '#9c6644';
    ctx.fillRect(0, 64, VIEW.width, 14);
    ctx.fillStyle = '#7f4f24';
    ctx.fillRect(0, 64, 14, VIEW.height - 64);
    ctx.fillRect(VIEW.width - 14, 64, 14, VIEW.height - 64);
    // Top counter strip (below the order board, above the floor).
    ctx.fillStyle = COUNTER_SIDE;
    ctx.fillRect(30, 146, 1220, 84);
    ctx.fillStyle = COUNTER_TOP;
    ctx.fillRect(30, 142, 1220, 78);
    // Pantry bins with their ingredients on display.
    for (const bin of BINS) {
      const active = state.nearStation && state.nearStation.kind === 'bin' && state.nearStation.id === bin.id;
      drawStation(ctx, { x: bin.x, y: bin.y, w: BIN_W, h: BIN_H }, bin.label, active);
      const st = bin.id === 'patty' ? 'raw' : ['tomato', 'lettuce', 'onion'].includes(bin.id) ? 'raw' : 'raw';
      drawIngredient(ctx, bin.id, st, bin.x, bin.y - 12, 34);
    }
    drawStation(ctx, { x: PLATE_STACK.x, y: PLATE_STACK.y, w: 92, h: BIN_H }, 'PLATES', state.nearStation?.kind === 'plates');
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.ellipse(PLATE_STACK.x, PLATE_STACK.y - 12, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawStation(ctx, { x: TRASH.x, y: TRASH.y, w: 92, h: BIN_H }, 'TRASH', state.nearStation?.kind === 'trash');
    text(ctx, '🗑', TRASH.x, TRASH.y - 12, 22, '#fff');
    // Serve window.
    const serveActive = state.nearStation?.kind === 'serve';
    drawStation(ctx, { x: SERVE.x, y: SERVE.y, w: 200, h: BIN_H }, 'SERVE  •  E', serveActive);
    text(ctx, '🔔', SERVE.x - 70, SERVE.y - 12, 22, '#fff');
    // Chopping board (left) and grill (right).
    drawStation(ctx, { x: BOARD.x, y: BOARD.y, w: 150, h: 120 }, '', state.nearStation?.kind === 'board');
    ctx.fillStyle = '#d9a441';
    rr(ctx, BOARD.x - 55, BOARD.y - 52, 110, 56, 8);
    ctx.fill();
    ctx.strokeStyle = '#8a5426';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (state.chop.active) {
      const frac = state.chop.t / 1.2;
      ctx.fillStyle = '#e9ecef';
      rr(ctx, BOARD.x - 55, BOARD.y + 12, 110, 10, 5);
      ctx.fill();
      ctx.fillStyle = '#2a9d3f';
      rr(ctx, BOARD.x - 55, BOARD.y + 12, 110 * frac, 10, 5);
      ctx.fill();
      text(ctx, `chopping ${INGREDIENT_NAMES[state.chop.target] || ''}…`, BOARD.x, BOARD.y + 34, 12, '#fff');
    } else {
      text(ctx, 'veg only', BOARD.x, BOARD.y + 34, 12, '#ffe9a8');
    }
    text(ctx, 'CHOP — hold E', BOARD.x, BOARD.y + 52, 13, '#fff');
    drawStation(ctx, { x: GRILL.x, y: GRILL.y, w: 150, h: 120 }, '', state.nearStation?.kind === 'grill');
    for (let i = 0; i < 2; i += 1) {
      const gx = GRILL.x - 34 + i * 68;
      const gy = GRILL.y - 28;
      ctx.fillStyle = '#343a40';
      rr(ctx, gx - 28, gy - 22, 56, 44, 8);
      ctx.fill();
      const slot = state.grill[i];
      if (slot) {
        drawIngredient(ctx, 'patty', slot.state, gx, gy, 40);
        if (slot.state === 'cooking') {
          const frac = Math.min(1, slot.t / 4);
          ctx.fillStyle = '#e9ecef';
          rr(ctx, gx - 24, gy + 26, 48, 7, 3);
          ctx.fill();
          ctx.fillStyle = '#ff9f1c';
          rr(ctx, gx - 24, gy + 26, 48 * frac, 7, 3);
          ctx.fill();
        } else if (slot.state === 'cooked') {
          text(ctx, 'READY', gx, gy + 38, 10, '#7bf1a8');
        } else {
          text(ctx, 'BURNT!', gx, gy + 38, 10, '#ff5964');
        }
      } else {
        ctx.strokeStyle = '#6c757d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx - 12, gy);
        ctx.lineTo(gx + 12, gy);
        ctx.moveTo(gx, gy - 12);
        ctx.lineTo(gx, gy + 12);
        ctx.stroke();
      }
    }
    text(ctx, 'GRILL — E', GRILL.x, GRILL.y + 52, 13, '#fff');
    // Plating counter (bottom centre).
    drawStation(ctx, { x: PLATING.x, y: PLATING.y, w: 240, h: 64 }, 'PLATING — E to set down', state.nearStation?.kind === 'plating');
    if (state.plate && state.platedDown) {
      drawPlate(ctx, state.plate, PLATING.x, PLATING.y - 14, 1);
    }
    // Particles and floating scores.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of state.floats) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
      text(ctx, f.text, f.x, f.y - f.t * 30, 18, f.color);
    }
    ctx.globalAlpha = 1;
  }

  function drawChef(state) {
    const p = state.player;
    const bob = p.moving ? Math.sin(state.time * 14) * 2 : 0;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    shadow(ctx, true);
    // Body: white chef coat.
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.stroke();
    // Toque (chef hat).
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-8, -PLAYER.radius - 4, 9, 0, Math.PI * 2);
    ctx.arc(0, -PLAYER.radius - 8, 10, 0, Math.PI * 2);
    ctx.arc(8, -PLAYER.radius - 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-13, -PLAYER.radius - 6, 26, 8);
    // Face: eyes toward the facing direction.
    const fx = Math.cos(p.facing) * 7;
    const fy = Math.sin(p.facing) * 7;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-6 + fx, -2 + fy, 2.5, 0, Math.PI * 2);
    ctx.arc(6 + fx, -2 + fy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx, 4 + fy, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // Carried plate, held overhead like a waiter's tray.
    if (state.plate && !state.platedDown) {
      drawPlate(ctx, state.plate, 0, -PLAYER.radius - 34, 0.8);
    }
    ctx.restore();
  }

  function drawHud(state, screen) {
    // Top bar.
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(0, 0, VIEW.width, 64);
    text(ctx, 'SIZZLE & SERVE', 16, 32, 22, '#ffe66d', 'left');
    text(ctx, 'Ember Lane Kitchen', 210, 34, 12, '#e9d8a6', 'left');
    // Order board: cards under the top bar, left side.
    const cardW = 250;
    const cardH = 62;
    for (let i = 0; i < 3; i += 1) {
      const order = state.orders[i];
      const x = 16 + i * (cardW + 10);
      const y = 72;
      if (order) {
        drawOrderCard(ctx, order, x, y, cardW, cardH, state.plate && !state.platedDown ? state.plate : null);
      } else {
        ctx.fillStyle = 'rgba(255,246,227,0.35)';
        rr(ctx, x, y, cardW, cardH, 10);
        ctx.fill();
        text(ctx, '— no order —', x + cardW / 2, y + cardH / 2, 13, '#5c4a32');
      }
    }
    // Shift timer, score, hearts, combo — top right.
    const mins = Math.floor(state.shiftLeft / 60);
    const secs = Math.ceil(state.shiftLeft % 60);
    const timerColor = state.shiftLeft < 30 ? '#ff5964' : '#fff6e3';
    text(ctx, `⏱ ${mins}:${String(secs).padStart(2, '0')}`, VIEW.width - 330, 32, 24, timerColor, 'left');
    text(ctx, `★ ${state.score}`, VIEW.width - 190, 32, 22, '#ffe66d', 'left');
    let hearts = '';
    for (let i = 0; i < 3; i += 1) hearts += i < state.hearts ? '♥' : '♡';
    text(ctx, hearts, VIEW.width - 90, 32, 22, '#ff5964', 'left');
    if (state.combo >= 2) {
      text(ctx, `COMBO x${1 + Math.min(2, state.combo - 1) * 0.5}`, VIEW.width - 190, 52, 12, '#7bf1a8', 'left');
    }
    // Hint line just below the counter strip.
    if (state.hintT > 0 && screen === SCREEN_PLAY) {
      text(ctx, state.hint, VIEW.width / 2, 252, 15, '#2b2118');
    }
    // Serve / wrong flashes.
    if (state.servedFlash > 0) {
      ctx.globalAlpha = state.servedFlash * 0.25;
      ctx.fillStyle = '#7bf1a8';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.globalAlpha = 1;
    }
    if (state.wrongFlash > 0) {
      ctx.globalAlpha = state.wrongFlash * 0.3;
      ctx.fillStyle = '#ff5964';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.globalAlpha = 1;
    }
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(43,33,24,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = CREAM;
    rr(ctx, 290, 130, 700, 440, 18);
    ctx.fill();
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 3;
    rr(ctx, 290, 130, 700, 440, 18);
    ctx.stroke();
    text(ctx, '🍔  SIZZLE & SERVE  🍔', 640, 180, 40, '#c1440e');
    text(ctx, 'Ember Lane Kitchen', 640, 222, 20, INK);
    text(ctx, 'Take orders. Chop, grill, stack, serve — before the timer runs out.', 640, 262, 15, '#5c4a32');
    const lines = [
      ['WASD / Arrows', 'run around the kitchen'],
      ['E', 'grab a plate · pick ingredients · use a station'],
      ['Hold E at CHOP', 'chop tomato, lettuce or onion'],
      ['E at GRILL', 'cook the patty — take it off before it burns!'],
      ['E at SERVE', 'serve the plate that matches an order'],
      ['P pause', 'M mute · R restart'],
    ];
    let y = 300;
    for (const [key, desc] of lines) {
      text(ctx, key, 400, y, 15, '#c1440e', 'left');
      text(ctx, desc, 600, y, 15, INK, 'left');
      y += 28;
    }
    text(ctx, '3 strikes and the shift is over. Serve fast for a combo bonus!', 640, 486, 15, '#8a5426');
    ctx.fillStyle = '#c1440e';
    rr(ctx, 520, 510, 240, 48, 12);
    ctx.fill();
    text(ctx, 'START SHIFT  ▶', 640, 535, 20, '#fff');
    if (best > 0) text(ctx, `Best score: ${best}`, 640, 580 - 12, 14, INK);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(43,33,24,0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text(ctx, 'PAUSED', 640, 330, 48, '#fff6e3');
    text(ctx, 'P to resume · R to restart', 640, 380, 18, '#ffe9a8');
  }

  function drawEnd(state, best, won) {
    ctx.fillStyle = 'rgba(43,33,24,0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = CREAM;
    rr(ctx, 340, 170, 600, 380, 18);
    ctx.fill();
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 3;
    rr(ctx, 340, 170, 600, 380, 18);
    ctx.stroke();
    text(ctx, won ? '🎉  SHIFT COMPLETE!' : '💔  SHIFT OVER', 640, 220, 34, won ? '#2a9d3f' : '#c1440e');
    text(ctx, `Score: ${state.score}`, 640, 280, 26, INK);
    text(ctx, `Dishes served: ${state.served}   ·   Best combo: x${1 + Math.min(2, state.bestCombo - 1 < 0 ? 0 : state.bestCombo - 1) * 0.5}`, 640, 322, 16, INK);
    text(ctx, `Mistakes: ${state.mistakes}`, 640, 352, 16, INK);
    if (state.score >= best && state.score > 0) text(ctx, '★ NEW BEST SCORE! ★', 640, 392, 18, '#c1440e');
    else if (best > 0) text(ctx, `Best score: ${best}`, 640, 392, 16, INK);
    ctx.fillStyle = '#c1440e';
    rr(ctx, 520, 430, 240, 48, 12);
    ctx.fill();
    text(ctx, 'PLAY AGAIN  ▶', 640, 455, 18, '#fff');
    text(ctx, 'R to restart', 640, 510, 14, '#8a5426');
  }

  return {
    draw(state, screen, best) {
      ctx.clearRect(0, 0, VIEW.width, VIEW.height);
      drawKitchen(state);
      if (screen !== SCREEN_TITLE) drawChef(state);
      drawHud(state, screen);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawEnd(state, best, false);
      else if (screen === SCREEN_WIN) drawEnd(state, best, true);
    },
  };
}

