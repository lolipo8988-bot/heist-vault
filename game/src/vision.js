// Vision maths: line of sight past walls, and whether a watcher can see a point.
// Pure geometry, shared by guards, cameras and the screenshot autopilot.

import { WALLS, FIELD } from './config.js';

function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/** True when no wall stands between the two points. */
export function hasLineOfSight(x1, y1, x2, y2) {
  for (const wall of WALLS) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  return true;
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when `target` lies inside a watcher's cone and sight line. */
export function insideCone(wx, wy, angle, range, halfAngle, tx, ty) {
  const dx = tx - wx;
  const dy = ty - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 4) return true;
  return Math.abs(angleDifference(Math.atan2(dy, dx), angle)) <= halfAngle;
}

function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return Math.hypot(px - cx, py - cy) <= r;
}

/**
 * Full visibility test: range, cone, line of sight, and smoke.
 * `smokes` is a list of {x, y, radius} clouds that block sight through them.
 */
export function canSee(wx, wy, angle, range, halfAngle, tx, ty, smokes) {
  if (!insideCone(wx, wy, angle, range, halfAngle, tx, ty)) return false;
  if (!hasLineOfSight(wx, wy, tx, ty)) return false;
  for (const smoke of smokes) {
    if (segmentHitsCircle(wx, wy, tx, ty, smoke.x, smoke.y, smoke.radius)) return false;
  }
  return true;
}

/** Clamp a point inside the play field. */
export function clampToField(x, y, radius) {
  return {
    x: Math.max(FIELD.x + radius, Math.min(FIELD.x + FIELD.width - radius, x)),
    y: Math.max(FIELD.y + radius, Math.min(FIELD.y + FIELD.height - radius, y)),
  };
}

/** Move a circle against walls, sliding along them. Returns the new position. */
export function moveCircle(x, y, dx, dy, radius) {
  let nx = x + dx;
  let ny = y + dy;
  for (const wall of WALLS) {
    if (nx + radius > wall.x && nx - radius < wall.x + wall.w &&
        y + radius > wall.y && y - radius < wall.y + wall.h) {
      nx = dx > 0 ? wall.x - radius : wall.x + wall.w + radius;
    }
    if (nx + radius > wall.x && nx - radius < wall.x + wall.w &&
        ny + radius > wall.y && ny - radius < wall.y + wall.h) {
      ny = dy > 0 ? wall.y - radius : wall.y + wall.h + radius;
    }
  }
  const clamped = clampToField(nx, ny, radius);
  return { x: clamped.x, y: clamped.y };
}
