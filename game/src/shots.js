// Screenshot scenes: each one plays the real rules forward from a fresh
// heist for a fixed number of steps, steered by a simple autopilot that
// follows waypoints, works the loot, and backs off when a cone finds it.
// The frame is what a real game looks like, and the same scene always
// gives the same frame.

import { resetGame, stepGame, SCREEN } from './game.js';

const STEP = 1 / 60;
const WAYPOINTS = [
  { x: 380, y: 640 },
  { x: 380, y: 160 },
  { x: 400, y: 110 },
  { x: 820, y: 110 },
  { x: 860, y: 170 },
  { x: 1130, y: 170, loot: 'vault-gold' },
  { x: 1190, y: 290, loot: 'jewels' },
  { x: 1100, y: 380 },
  { x: 640, y: 695 },
];

function scriptedInput() {
  return {
    keys: new Set(),
    mouse: { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 },
    pressed: new Set(),
  };
}

/** Press a key this step (held keys and the one-frame pressed set alike). */
function press(input, name) {
  input.keys.add(name);
  input.pressed.add(name);
}

function spotterPosition(game) {
  for (const guard of game.guards) {
    if (guard.spotted) return { x: guard.x, y: guard.y };
  }
  for (const camera of game.cameras) {
    if (camera.spotted) return { x: camera.x, y: camera.y };
  }
  return null;
}

function pressToward(input, dx, dy) {
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return;
  const nx = dx / dist;
  const ny = dy / dist;
  // A low threshold on the minor axis: the thief must still correct sideways
  // while pushing through a narrow gap, or it wedges on the wall's corner.
  if (nx > 0.12) input.keys.add('d');
  if (nx < -0.12) input.keys.add('a');
  if (ny > 0.12) input.keys.add('s');
  if (ny < -0.12) input.keys.add('w');
}

/**
 * The autopilot's steering state: a sidestep that fires when the thief is
 * pinned against a desk (no progress for half a second), sliding sideways
 * until the corner is cleared.
 */
function createPilot() {
  return {
    lastX: 0, lastY: 0, stillSteps: 0, sidestep: null, sidestepLeft: 0, side: 1,
    dirX: 0, dirY: -1,
  };
}

function steer(pilot, game, input, target, flee = true) {
  const thief = game.thief;
  const moved = Math.hypot(thief.x - pilot.lastX, thief.y - pilot.lastY);
  if (moved < 1.5) {
    pilot.stillSteps += 1;
  } else {
    pilot.stillSteps = 0;
  }
  pilot.lastX = thief.x;
  pilot.lastY = thief.y;
  if (pilot.stillSteps >= 18 && pilot.sidestepLeft <= 0) {
    pilot.side = -pilot.side;
    pilot.sidestep = pilot.side;
    pilot.sidestepLeft = 45;
    pilot.stillSteps = 0;
  }
  if (pilot.sidestepLeft > 0) {
    pilot.sidestepLeft -= 1;
    // Slide perpendicular to the direction that got blocked, not the target:
    // fleeing into a desk must slide along it instead of pushing into it.
    // (Scaled up: pressToward reads its arguments as a displacement.)
    const dist = Math.hypot(pilot.dirX, pilot.dirY) || 1;
    pressToward(input, (-pilot.dirY / dist) * pilot.sidestep * 100, (pilot.dirX / dist) * pilot.sidestep * 100);
    return;
  }
  let dx = target.x - thief.x;
  let dy = target.y - thief.y;
  const spotter = spotterPosition(game);
  if (flee && spotter && game.seenNow) {
    dx = thief.x - spotter.x;
    dy = thief.y - spotter.y;
  }
  const dist = Math.hypot(dx, dy) || 1;
  pilot.dirX = dx / dist;
  pilot.dirY = dy / dist;
  pressToward(input, dx, dy);
}

/** Run the autopilot along the waypoints until `stop` says the frame is ready. */
function runRoute(game, stop, maxSeconds) {
  const pilot = createPilot();
  let waypoint = 0;
  for (let step = 0; step < maxSeconds / STEP; step += 1) {
    const input = scriptedInput();
    const target = WAYPOINTS[Math.min(waypoint, WAYPOINTS.length - 1)];
    const thief = game.thief;
    const lootHere = target.loot &&
      game.loot.find((item) => item.id === target.loot && !item.taken);
    const nearTarget = Math.hypot(target.x - thief.x, target.y - thief.y) < 30;
    const guardNear = game.guards.some((g) => Math.hypot(g.x - thief.x, g.y - thief.y) < 230);
    if (lootHere && nearTarget && guardNear && game.smokes.length === 0 && game.kit > 0) {
      // A guard is close enough to catch a thief standing still to crack
      // the loot: spend a smoke bomb first, then work under cover.
      press(input, '1');
    } else if (lootHere && nearTarget) {
      input.keys.add('e');
    } else {
      steer(pilot, game, input, target);
    }
    stepGame(game, STEP, input);
    if (game.screen !== SCREEN.PLAY) break;
    if (lootHere && nearTarget) {
      if (game.loot.find((item) => item.id === target.loot).taken) waypoint += 1;
    } else if (nearTarget) {
      waypoint += 1;
    }
    if (stop(game, waypoint)) break;
  }
}

/**
 * Set `game` to the named scene (start, play, alarm or escape) and return
 * the screen to draw over it.
 */
export function stageShot(name, game) {
  if (name === 'start') {
    resetGame(game);
    game.screen = SCREEN.TITLE;
    for (let i = 0; i < 5 / STEP; i += 1) stepGame(game, STEP, scriptedInput());
    game.screen = SCREEN.TITLE;
    return SCREEN.TITLE;
  }
  if (name === 'alarm') {
    resetGame(game);
    // Stand in the middle of the hall guard's patrol leg and wait: he walks
    // into view, the cone finds the thief, and the alarm climbs. Slip away
    // when he closes in, so the scene shows a hot alarm, not a catch.
    const pilot = createPilot();
    const post = { x: 620, y: 380 };
    for (let i = 0; i < 40 / STEP; i += 1) {
      const input = scriptedInput();
      const thief = game.thief;
      const nearestGuard = game.guards.reduce((best, g) => {
        const d = Math.hypot(g.x - thief.x, g.y - thief.y);
        return !best || d < best.d ? { guard: g, d } : best;
      }, null);
      if (nearestGuard && nearestGuard.d < 110) {
        steer(pilot, game, input, { x: thief.x + (thief.x - nearestGuard.guard.x), y: thief.y + (thief.y - nearestGuard.guard.y) }, false);
      } else if (Math.hypot(post.x - thief.x, post.y - thief.y) > 24) {
        steer(pilot, game, input, post, false);
      }
      stepGame(game, STEP, input);
      if (game.screen !== SCREEN.PLAY) break;
      if (game.alarm >= 80) break;
    }
    return game.screen;
  }
  if (name === 'escape') {
    resetGame(game);
    runRoute(game, (state) => state.screen === SCREEN.WIN, 170);
    return game.screen;
  }
  // play: mid-heist, gold in hand, alarm warm, still inside the vault.
  resetGame(game);
  runRoute(game, (state) => state.lootTotal >= 3000, 60);
  return game.screen;
}
