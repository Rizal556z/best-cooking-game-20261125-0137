// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens:
// title, play, paused, game over and victory.
//
// ?seed=N fixes the run's randomness. ?shot=cover|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BURNED, EVENT_CHOP_DONE, EVENT_EXPIRED, EVENT_GRILL_DONE, EVENT_OVER, EVENT_SERVED, EVENT_WIN, EVENT_WRONG } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  // Keep painting every frame: a viewport resize clears the canvas, and a
  // screenshot taken after any resize must still catch the scene.
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted >= 2) window.__shotReady = true;
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let last = performance.now();
  let accumulator = 0;
  // Debug hook for the headless playtest: read-only view of the live state.
  window.__sizzle = { world, get screen() { return screen; }, get best() { return best; } };

  function setStatus() {
    const s = world.state;
    if (screen === SCREEN_PLAY) {
      status.textContent = `Score ${s.score}, ${s.served} served, ${s.hearts} hearts, ${Math.ceil(s.shiftLeft)} seconds left in the shift.`;
    } else if (screen === SCREEN_TITLE) {
      status.textContent = 'Sizzle and Serve. Press Enter or click Start Shift to play.';
    } else if (screen === SCREEN_OVER) {
      status.textContent = `Shift over. Score ${s.score}, ${s.served} dishes served.`;
    } else if (screen === SCREEN_WIN) {
      status.textContent = `Shift complete! Score ${s.score}, ${s.served} dishes served.`;
    }
  }

  function handleEvents(events) {
    if (events & EVENT_SERVED) {
      audio.ding();
      audio.stopSizzle();
    }
    if (events & EVENT_WRONG) audio.error();
    if (events & EVENT_EXPIRED) audio.error();
    if (events & EVENT_CHOP_DONE) audio.chopDone();
    if (events & EVENT_GRILL_DONE) audio.pickup();
    if (events & EVENT_BURNED) audio.error();
    if (events & EVENT_WIN) {
      screen = SCREEN_WIN;
      audio.ding();
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
    }
    if (events & EVENT_OVER) {
      screen = SCREEN_OVER;
      audio.error();
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
    }
  }

  function frame(now) {
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const actions = input.poll();
    if (actions.mute) {
      const muted = audio.toggleMute();
      status.textContent = muted ? 'Muted.' : 'Sound on.';
    }
    if (actions.click) {
      audio.unlock();
      const c = actions.click;
      if (screen === SCREEN_TITLE && c.x >= 520 && c.x <= 760 && c.y >= 510 && c.y <= 558) {
        world.reset();
        screen = SCREEN_PLAY;
      } else if ((screen === SCREEN_OVER || screen === SCREEN_WIN) && c.x >= 520 && c.x <= 760 && c.y >= 430 && c.y <= 478) {
        world.reset();
        screen = SCREEN_PLAY;
      }
    }
    if (screen === SCREEN_TITLE) {
      if (actions.confirm) {
        audio.unlock();
        world.reset();
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions.pause) {
        screen = SCREEN_PAUSED;
      } else {
        const prevGrill = world.state.grill.some((s) => s && s.state === 'cooking');
        accumulator += dt;
        let confirmSent = false;
        while (accumulator >= STEP) {
          const events = world.step(STEP, {
            move: actions.move,
            interactHeld: actions.interactHeld,
            // Edge-triggered: send the press to the first sub-step only,
            // or one Enter would use the station four times in a frame.
            confirm: actions.confirm && !confirmSent,
          });
          confirmSent = true;
          handleEvents(events);
          accumulator -= STEP;
          if (screen !== SCREEN_PLAY) break;
        }
        const grilling = world.state.grill.some((s) => s && s.state === 'cooking');
        if (grilling && !prevGrill) audio.startSizzle();
        if (!grilling && prevGrill) audio.stopSizzle();
        if (actions.confirm && world.state.nearStation) audio.pickup();
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions.pause || actions.confirm) screen = SCREEN_PLAY;
      if (actions.restart) {
        world.reset();
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions.confirm || actions.restart) {
        world.reset();
        screen = SCREEN_PLAY;
      }
    }
    renderer.draw(world.state, screen, best);
    setStatus();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
