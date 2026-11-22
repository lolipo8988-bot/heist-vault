// Canvas rendering: the whole heist in one frame — floor plan, vision cones
// clipped by walls, loot, guards, cameras, the alarm meter and the overlays.

import { CANVAS, FIELD, WALLS, EXIT, LOOT_TARGET, THIEF } from './config.js';
import { SCREEN } from './game.js';

const FLOOR = '#1b2334';
const CARPET = '#33202b';
const VAULT_FLOOR = '#2c2617';
const WALL_FILL = '#4b5a73';
const WALL_TOP = '#7d8fb0';

function rayDistance(wx, wy, dx, dy, range) {
  let best = range;
  for (const wall of WALLS) {
    let tmin = 0;
    let tmax = best;
    if (dx === 0) {
      if (wx < wall.x || wx > wall.x + wall.w) continue;
    } else {
      let t1 = (wall.x - wx) / dx;
      let t2 = (wall.x + wall.w - wx) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (dy === 0) {
      if (wy < wall.y || wy > wall.y + wall.h) continue;
    } else {
      let t1 = (wall.y - wy) / dy;
      let t2 = (wall.y + wall.h - wy) / dy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (tmin < best) best = tmin;
  }
  // Also stop at the field edge.
  const edge = Math.min(
    dx > 0 ? (FIELD.x + FIELD.width - wx) / dx : dx < 0 ? (FIELD.x - wx) / dx : Infinity,
    dy > 0 ? (FIELD.y + FIELD.height - wy) / dy : dy < 0 ? (FIELD.y - wy) / dy : Infinity,
  );
  return Math.max(0, Math.min(best, edge));
}

/** A cone polygon clipped by walls, so cones stop at cover like real sight. */
function conePath(ctx, x, y, angle, range, halfAngle) {
  const steps = 26;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= steps; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / steps;
    const d = rayDistance(x, y, Math.cos(a), Math.sin(a), range);
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function drawFloor(ctx, time) {
  ctx.fillStyle = FLOOR;
  ctx.fillRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);
  // Tile grid.
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = FIELD.x; x <= FIELD.x + FIELD.width; x += 52) {
    ctx.beginPath(); ctx.moveTo(x, FIELD.y); ctx.lineTo(x, FIELD.y + FIELD.height); ctx.stroke();
  }
  for (let y = FIELD.y; y <= FIELD.y + FIELD.height; y += 52) {
    ctx.beginPath(); ctx.moveTo(FIELD.x, y); ctx.lineTo(FIELD.x + FIELD.width, y); ctx.stroke();
  }
  // Hall carpet and vault floor.
  ctx.fillStyle = CARPET;
  ctx.fillRect(360, 160, 500, 420);
  ctx.fillStyle = VAULT_FLOOR;
  ctx.fillRect(904, 76, 352, 264);
  ctx.strokeStyle = 'rgba(255,215,100,0.25)';
  ctx.strokeRect(904, 76, 352, 264);
  // Room labels, faint, so the plan reads at a glance.
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('V A U L T', 1080, 110);
  ctx.fillText('SAFE ROOM', 170, 110);
  ctx.fillText('VENT', 610, 118);
  ctx.fillText('MAIN HALL', 610, 580);
  // Getaway door at the bottom edge.
  const open = true;
  ctx.fillStyle = open ? '#1f7a4d' : '#5a2a2a';
  ctx.fillRect(EXIT.x, EXIT.y - 6, EXIT.w, 14);
  ctx.fillStyle = '#e8f5e9';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('GETAWAY', EXIT.x + EXIT.w / 2, 690);
  void time;
}

function drawWalls(ctx) {
  for (const wall of WALLS) {
    ctx.fillStyle = WALL_FILL;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = WALL_TOP;
    ctx.fillRect(wall.x, wall.y, wall.w, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
  }
  ctx.strokeStyle = '#5a6b8a';
  ctx.lineWidth = 3;
  ctx.strokeRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);
}

function drawLoot(ctx, game, time) {
  for (const loot of game.loot) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + loot.x);
    if (loot.taken) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeRect(loot.x - 14, loot.y - 14, 28, 28);
      continue;
    }
    ctx.save();
    ctx.translate(loot.x, loot.y);
    if (loot.id === 'vault-gold') {
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(-14, -6, 28, 12);
      ctx.fillStyle = '#ffb300';
      ctx.fillRect(-10, -12, 20, 7);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(-14, -6, 28, 3);
    } else if (loot.id === 'jewels') {
      ctx.fillStyle = '#5ee6ff';
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(11, 0); ctx.lineTo(0, 13); ctx.lineTo(-11, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
    } else if (loot.id === 'safe') {
      ctx.fillStyle = '#8b98ad';
      ctx.fillRect(-15, -15, 30, 30);
      ctx.fillStyle = '#39445a';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd34d';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, -4); ctx.stroke();
    } else if (loot.id.startsWith('case')) {
      ctx.fillStyle = 'rgba(140,220,255,0.35)';
      ctx.fillRect(-15, -11, 30, 22);
      ctx.strokeStyle = '#cfe9ff';
      ctx.strokeRect(-15, -11, 30, 22);
      ctx.fillStyle = '#ff5d8f';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    } else if (loot.id === 'register') {
      ctx.fillStyle = '#6b7a94';
      ctx.fillRect(-13, -9, 26, 18);
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(-8, -14, 16, 6);
    } else {
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(-5, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, -2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 5, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Value tag and a breathing ring so loot is obvious at a glance.
    ctx.fillStyle = `rgba(255,211,77,${0.55 + 0.35 * pulse})`;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`$${loot.value}`, loot.x, loot.y - 24);
    ctx.strokeStyle = `rgba(255,211,77,${0.35 + 0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(loot.x, loot.y, 22 + 3 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSmoke(ctx, game) {
  for (const smoke of game.smokes) {
    const alpha = Math.min(0.55, (smoke.left / 6) * 0.55);
    ctx.fillStyle = `rgba(200,205,215,${alpha})`;
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(230,235,245,${alpha * 0.7})`;
    ctx.beginPath();
    ctx.arc(smoke.x - 30, smoke.y + 14, smoke.radius * 0.55, 0, Math.PI * 2);
    ctx.arc(smoke.x + 34, smoke.y - 12, smoke.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGuards(ctx, game) {
  for (const guard of game.guards) {
    const alert = guard.state !== 'patrol';
    ctx.fillStyle = guard.spotted || alert ? 'rgba(255,60,60,0.30)' : 'rgba(255,200,60,0.20)';
    conePath(ctx, guard.x, guard.y, guard.angle, guard.def.range, guard.def.halfAngle);
    ctx.fill();
    // Body: navy uniform, cap brim pointing where he looks.
    ctx.fillStyle = '#2f4b7c';
    ctx.beginPath(); ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d3357';
    ctx.beginPath(); ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 18, guard.y + Math.sin(guard.angle) * 18);
    ctx.stroke();
    ctx.fillStyle = '#e8ecf4';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(guard.state === 'patrol' ? '?' : '!', guard.x, guard.y - 18);
    ctx.fillStyle = '#cdd7e8';
    ctx.font = '11px sans-serif';
    ctx.fillText(guard.name, guard.x, guard.y + 26);
  }
}

function drawCameras(ctx, game) {
  for (const camera of game.cameras) {
    const disabled = game.empLeft > 0;
    ctx.fillStyle = disabled ? 'rgba(150,150,150,0.10)' : 'rgba(80,200,255,0.16)';
    conePath(ctx, camera.x, camera.y, camera.angle, camera.def.range, camera.def.halfAngle);
    ctx.fill();
    ctx.fillStyle = disabled ? '#777' : '#3aa7d6';
    ctx.beginPath(); ctx.arc(camera.x, camera.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = disabled ? '#999' : '#bfeaff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.lineTo(camera.x + Math.cos(camera.angle) * 14, camera.y + Math.sin(camera.angle) * 14);
    ctx.stroke();
    ctx.fillStyle = disabled ? '#aaa' : '#9fdcff';
    ctx.font = '11px sans-serif';
    // Cam 2 sits on the east wall: right-align its label so it is not cut off.
    ctx.textAlign = camera.x > 1150 ? 'right' : 'center';
    ctx.fillText(disabled ? `${camera.name} OFF` : camera.name, camera.x > 1150 ? camera.x - 12 : camera.x, camera.y + 24);
  }
}

function drawThief(ctx, game, time) {
  const thief = game.thief;
  const blink = thief.invulnerable > 0 && Math.floor(time * 8) % 2 === 0;
  if (blink) return;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(thief.x, thief.y + 10, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hooded figure: dark violet cloak, pale face slit, direction tick.
  ctx.fillStyle = '#6d4bd8';
  ctx.beginPath(); ctx.arc(thief.x, thief.y, THIEF.radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a1b52';
  ctx.beginPath(); ctx.arc(thief.x, thief.y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2e8c9';
  ctx.beginPath();
  ctx.arc(thief.x + Math.cos(thief.angle) * 4, thief.y + Math.sin(thief.angle) * 4, 4, 0, Math.PI * 2);
  ctx.fill();
  if (game.lootTotal > 0) {
    ctx.fillStyle = '#8a6d2f';
    ctx.beginPath();
    ctx.arc(thief.x - Math.cos(thief.angle) * 12, thief.y - Math.sin(thief.angle) * 12, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Channel ring while working a lock or a case.
  if (game.channel.lootId) {
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, 22, -Math.PI / 2, -Math.PI / 2 + game.channel.progress * Math.PI * 2);
    ctx.stroke();
  }
}

function drawHud(ctx, game) {
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, CANVAS.width, 64);
  ctx.strokeStyle = '#2a3446';
  ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(CANVAS.width, 64); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('MIDNIGHT VAULT', 18, 27);
  ctx.fillStyle = '#9fb0cc';
  ctx.font = '13px sans-serif';
  ctx.fillText('The Aldermore Job', 18, 47);

  // Loot progress.
  ctx.fillStyle = '#cdd7e8';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`LOOT $${game.lootTotal} / $${LOOT_TARGET}`, 300, 27);
  ctx.fillStyle = '#233047';
  ctx.fillRect(300, 36, 220, 10);
  ctx.fillStyle = game.lootTotal >= LOOT_TARGET ? '#37c978' : '#ffd34d';
  ctx.fillRect(300, 36, 220 * Math.min(1, game.lootTotal / LOOT_TARGET), 10);

  // Alarm meter.
  ctx.fillStyle = '#cdd7e8';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('ALARM', 560, 27);
  ctx.fillStyle = '#233047';
  ctx.fillRect(560, 36, 220, 10);
  const alarmColor = game.alarm < 40 ? '#37c978' : game.alarm < 75 ? '#ffb300' : '#ff3b3b';
  ctx.fillStyle = alarmColor;
  ctx.fillRect(560, 36, 220 * (game.alarm / 100), 10);
  if (game.lockdownTimer > 0) {
    ctx.fillStyle = '#ff3b3b';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`LOCKDOWN ${Math.ceil(game.lockdownTimer)}s`, 790, 46);
  }

  // Kit, coins, strikes, timer.
  ctx.fillStyle = '#cdd7e8';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Kit ${game.kit}  •  Coins ${game.coins}  •  Strikes ${game.strikes}/3`, 830, 27);
  const minutes = Math.floor(game.time / 60);
  const seconds = Math.floor(game.time % 60).toString().padStart(2, '0');
  ctx.fillText(`Time ${minutes}:${seconds}`, 830, 47);
  ctx.fillStyle = game.lootTotal >= LOOT_TARGET ? '#37c978' : '#9fb0cc';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(game.lootTotal >= LOOT_TARGET ? 'GETAWAY OPEN — reach the green door' : 'Steal $4,000, then get out', 300, 60 - 2);
  void 0;
}

function drawToasts(ctx, game) {
  ctx.textAlign = 'center';
  game.messages.forEach((message, i) => {
    const alpha = Math.min(1, message.left);
    ctx.fillStyle = `rgba(13,17,23,${0.8 * alpha})`;
    const width = ctx.measureText(message.text).width + 28;
    ctx.fillRect(CANVAS.width / 2 - width / 2, 76 + i * 30, width, 24);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(message.text, CANVAS.width / 2, 93 + i * 30);
  });
}

function drawHints(ctx, game) {
  if (game.screen !== SCREEN.PLAY) return;
  ctx.fillStyle = 'rgba(13,17,23,0.75)';
  ctx.fillRect(0, CANVAS.height - 26, CANVAS.width, 26);
  ctx.fillStyle = '#9fb0cc';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD / arrows move  •  Shift sneak  •  Hold E to crack loot  •  1 smoke (1 kit)  •  2 EMP (2 kit)  •  Click toss a coin  •  M mute', CANVAS.width / 2, CANVAS.height - 8);
}

function overlay(ctx, lines, accent) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? accent : '#e8ecf4';
    ctx.font = i === 0 ? 'bold 44px sans-serif' : i === 1 ? '20px sans-serif' : '16px sans-serif';
    ctx.fillText(line, CANVAS.width / 2, 220 + i * 44);
  });
}

export function render(ctx, game, time) {
  ctx.clearRect(0, 0, CANVAS.width, CANVAS.height);
  drawFloor(ctx, time);
  drawLoot(ctx, game, time);
  drawSmoke(ctx, game);
  drawGuards(ctx, game);
  drawCameras(ctx, game);
  drawWalls(ctx);
  drawThief(ctx, game, time);
  drawHud(ctx, game);
  drawToasts(ctx, game);
  drawHints(ctx, game);

  if (game.screen === SCREEN.TITLE) {
    overlay(ctx, [
      'MIDNIGHT VAULT',
      'The Aldermore Job — one room, three guards, two cameras, $7,800 inside',
      'Cross the floor, read the cones, crack $4,000 of loot, slip out the green door',
      'WASD move  •  Shift sneak  •  Hold E to crack  •  1 smoke  •  2 EMP  •  Click toss a coin',
      'The vent along the top sneaks past the hall guard — but only the patient get rich',
      'Press ENTER to begin',
    ], '#ffd34d');
  } else if (game.screen === SCREEN.WIN) {
    const score = game.score;
    overlay(ctx, [
      'CLEAN GETAWAY!',
      `Loot $${score.loot}  •  Time bonus $${score.timeBonus}  •  Clean bonus $${score.cleanBonus}`,
      `SCORE $${score.total}  —  ${score.seconds}s, spotted ${game.timesSpotted} time${game.timesSpotted === 1 ? '' : 's'}`,
      'The Aldermore vault is lighter by exactly one thief. Press R to run it again.',
    ], '#37c978');
  } else if (game.screen === SCREEN.BUSTED) {
    overlay(ctx, [
      'BUSTED',
      'Three strikes — the Aldermore job ends in the back of a patrol car',
      `Loot kept: $${game.lootTotal}  •  Best alarm ${Math.round(game.alarmPeak)}%  •  Spotted ${game.timesSpotted} times`,
      'Press R to case the joint again',
    ], '#ff3b3b');
  }

  // Red vignette while the alarm screams.
  if (game.alarm >= 75 && game.screen === SCREEN.PLAY) {
    const pulse = 0.12 + 0.08 * Math.sin(time * 6);
    ctx.strokeStyle = `rgba(255,59,59,${pulse + 0.25})`;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 71, CANVAS.width - 14, CANVAS.height - 78);
  }
}
