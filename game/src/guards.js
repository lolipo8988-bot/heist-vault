// Guard and camera behaviour: patrols you can read, a chase when you are
// spotted, and an investigation when a tossed coin clatters nearby.

import { GUARDS, CAMERAS, THIEF } from './config.js';
import { canSee, moveCircle } from './vision.js';

export const GUARD_STATE = { PATROL: 'patrol', CHASE: 'chase', INVESTIGATE: 'investigate', RETURN: 'return' };

export function buildGuards() {
  return GUARDS.map((def) => ({
    name: def.name,
    def,
    x: def.waypoints[0][0],
    y: def.waypoints[0][1],
    waypoint: 1,
    angle: 0,
    state: GUARD_STATE.PATROL,
    investigate: null,
    investigateTimer: 0,
    chaseTimer: 0,
    spotted: false,
    pauseTimer: 0,
  }));
}

export function buildCameras() {
  return CAMERAS.map((def, index) => ({
    name: def.name,
    def,
    x: def.x,
    y: def.y,
    angle: def.base,
    // Fixed phase per camera, so a screenshot scene always looks the same.
    time: index * def.period * 0.37,
    spotted: false,
  }));
}

/** Camera sweep angle at a given moment: a slow sine sweep around its base. */
export function cameraAngle(camera, time) {
  const phase = (time % camera.def.period) / camera.def.period;
  return camera.def.base + Math.sin(phase * Math.PI * 2) * camera.def.sweep;
}

function moveToward(guard, tx, ty, dt, speed) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  const next = moveCircle(guard.x, guard.y, (dx / dist) * step, (dy / dist) * step, 12);
  guard.x = next.x;
  guard.y = next.y;
  guard.angle = Math.atan2(dy, dx);
  return dist <= step + 1;
}

/** Advance one guard a step. Returns true when it currently sees the thief. */
export function stepGuard(guard, dt, thief, smokes, alarm, lockdown) {
  const speedBoost = lockdown ? 1.45 : 1;
  const speed = guard.def.speed * speedBoost;
  const seen = thief.invulnerable <= 0 &&
    canSee(guard.x, guard.y, guard.angle, guard.def.range, guard.def.halfAngle,
      thief.x, thief.y, smokes);
  guard.spotted = seen;

  if (seen) {
    guard.state = GUARD_STATE.CHASE;
    guard.chaseTimer = 2.5;
  } else if (guard.state === GUARD_STATE.CHASE) {
    guard.chaseTimer -= dt;
    if (guard.chaseTimer <= 0) guard.state = GUARD_STATE.RETURN;
  }

  if (guard.state === GUARD_STATE.CHASE) {
    moveToward(guard, thief.x, thief.y, dt, speed * 1.7);
    return seen;
  }
  if (guard.state === GUARD_STATE.INVESTIGATE && guard.investigate) {
    const arrived = moveToward(guard, guard.investigate.x, guard.investigate.y, dt, speed * 1.2);
    if (arrived) {
      guard.investigateTimer -= dt;
      guard.angle += dt * 2.2;
      if (guard.investigateTimer <= 0) {
        guard.state = GUARD_STATE.RETURN;
        guard.investigate = null;
      }
    }
    return seen;
  }
  if (guard.state === GUARD_STATE.RETURN) {
    const target = guard.def.waypoints[guard.waypoint];
    if (moveToward(guard, target[0], target[1], dt, speed)) {
      guard.state = GUARD_STATE.PATROL;
    }
    return seen;
  }

  // Patrol: walk the loop, pausing a beat at each corner so the cone is readable.
  if (guard.pauseTimer > 0) {
    guard.pauseTimer -= dt;
    return seen;
  }
  const target = guard.def.waypoints[guard.waypoint];
  if (moveToward(guard, target[0], target[1], dt, speed)) {
    guard.waypoint = (guard.waypoint + 1) % guard.def.waypoints.length;
    guard.pauseTimer = 0.9;
  }
  return seen;
}

/** Send the nearest guard to look at a noise point. */
export function distractGuards(guards, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const guard of guards) {
    const d = Math.hypot(guard.x - x, guard.y - y);
    if (d < bestDist && guard.state !== GUARD_STATE.CHASE) {
      best = guard;
      bestDist = d;
    }
  }
  if (best && bestDist < 420) {
    best.state = GUARD_STATE.INVESTIGATE;
    best.investigate = { x, y };
    best.investigateTimer = 4;
    return best.name;
  }
  return null;
}

/** Advance one camera a step. Returns true when it currently sees the thief. */
export function stepCamera(camera, time, dt, thief, smokes, empLeft) {
  camera.time += dt;
  camera.angle = cameraAngle(camera, camera.time);
  if (empLeft > 0) {
    camera.spotted = false;
    return false;
  }
  const seen = thief.invulnerable <= 0 &&
    canSee(camera.x, camera.y, camera.angle, camera.def.range, camera.def.halfAngle,
      thief.x, thief.y, smokes);
  camera.spotted = seen;
  return seen;
}

export { THIEF };
