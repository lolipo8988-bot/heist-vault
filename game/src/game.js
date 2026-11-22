// Game state: the heist itself — alarm, loot, tools, strikes, lockdown and
// the getaway. One step per frame; the renderer only draws what is here.

import {
  ENTRY, EXIT, LOOT, LOOT_TARGET, MAX_STRIKES, THIEF, TOOLS,
  START_KIT, ALARM_LOCKDOWN_AT, LOCKDOWN_SECONDS,
} from './config.js';
import { buildGuards, buildCameras, stepGuard, stepCamera, distractGuards } from './guards.js';
import { moveCircle } from './vision.js';
import * as audio from './audio.js';
import { moveVector, isSneaking, isWorking, wasPressed } from './input.js';

export const SCREEN = { TITLE: 'title', PLAY: 'play', WIN: 'win', BUSTED: 'busted' };

export function createGame() {
  return {
    screen: SCREEN.TITLE,
    time: 0,
    thief: { x: ENTRY.x, y: ENTRY.y, angle: -Math.PI / 2, moving: false, sneaking: false, invulnerable: 0, stepTimer: 0 },
    guards: buildGuards(),
    cameras: buildCameras(),
    loot: LOOT.map((item) => ({ ...item, taken: false })),
    lootTotal: 0,
    alarm: 0,
    alarmPeak: 0,
    strikes: 0,
    kit: START_KIT,
    coins: TOOLS.coin.uses,
    smokes: [],
    empLeft: 0,
    lockdownTimer: 0,
    channel: { lootId: null, progress: 0 },
    seenNow: false,
    wasSeen: false,
    spottedCooldown: 0,
    timesSpotted: 0,
    messages: [],
    score: null,
  };
}

export function resetGame(game) {
  const fresh = createGame();
  fresh.screen = SCREEN.PLAY;
  Object.assign(game, fresh);
}

function toast(game, text) {
  game.messages.push({ text, left: 3 });
  if (game.messages.length > 3) game.messages.shift();
}

function nearestLoot(game) {
  let best = null;
  let bestDist = Infinity;
  for (const loot of game.loot) {
    if (loot.taken) continue;
    const d = Math.hypot(loot.x - game.thief.x, loot.y - game.thief.y);
    if (d < bestDist) {
      best = loot;
      bestDist = d;
    }
  }
  return bestDist <= 42 ? best : null;
}

function useSmoke(game) {
  if (game.kit < TOOLS.smoke.cost) {
    toast(game, 'No kit left for a smoke bomb');
    return;
  }
  game.kit -= TOOLS.smoke.cost;
  game.smokes.push({ x: game.thief.x, y: game.thief.y, radius: TOOLS.smoke.radius, left: TOOLS.smoke.seconds });
  audio.playSmoke();
  toast(game, 'Smoke out — cones cannot see through it');
}

function useEmp(game) {
  if (game.kit < TOOLS.emp.cost) {
    toast(game, 'EMP needs 2 kit — not enough left');
    return;
  }
  game.kit -= TOOLS.emp.cost;
  game.empLeft = TOOLS.emp.seconds;
  audio.playEmp();
  toast(game, 'EMP pulse — cameras blind for 12s');
}

function tossCoin(game, x, y) {
  if (game.coins <= 0) {
    toast(game, 'Out of coins to toss');
    return;
  }
  game.coins -= 1;
  const name = distractGuards(game.guards, x, y);
  audio.playCoin();
  toast(game, name ? `${name} heard the coin and went to look` : 'The coin clattered — nobody close enough');
}

function catchThief(game) {
  game.strikes += 1;
  audio.playCaught();
  if (game.strikes >= MAX_STRIKES) {
    game.screen = SCREEN.BUSTED;
    return;
  }
  const lost = Math.floor(game.lootTotal * 0.2);
  game.lootTotal -= lost;
  game.thief.x = ENTRY.x;
  game.thief.y = ENTRY.y;
  game.thief.invulnerable = 2.5;
  game.alarm = 50;
  game.channel = { lootId: null, progress: 0 };
  toast(game, `Caught! ${game.strikes}/3 strikes — lost $${lost} in the scuffle`);
}

function finishHeist(game) {
  const timeBonus = Math.max(0, 2400 - Math.floor(game.time) * 8);
  const cleanBonus = game.strikes === 0 ? 500 : 0;
  game.score = {
    loot: game.lootTotal,
    timeBonus,
    cleanBonus,
    total: game.lootTotal + timeBonus + cleanBonus,
    seconds: Math.floor(game.time),
  };
  game.screen = SCREEN.WIN;
  audio.playWin();
}

/** One frame of the heist. `input` is the object createInput returns. */
export function stepGame(game, dt, input) {
  for (const message of game.messages) message.left -= dt;
  game.messages = game.messages.filter((message) => message.left > 0);

  if (game.screen === SCREEN.TITLE) {
    game.time += dt;
    for (const guard of game.guards) stepGuard(guard, dt, { ...game.thief, invulnerable: 99 }, [], 0, false);
    for (const camera of game.cameras) stepCamera(camera, game.time, dt, { ...game.thief, invulnerable: 99 }, [], 0);
    if (wasPressed(input, 'Enter') || input.mouse.clicked) {
      audio.ensureAudio();
      audio.playClick();
      game.screen = SCREEN.PLAY;
      toast(game, 'Get $4,000 of loot, then slip out the getaway door');
    }
    return;
  }

  if (game.screen === SCREEN.WIN || game.screen === SCREEN.BUSTED) {
    if (wasPressed(input, 'r') || wasPressed(input, 'R') || wasPressed(input, 'Enter')) {
      resetGame(game);
    }
    return;
  }

  game.time += dt;
  const thief = game.thief;
  thief.invulnerable = Math.max(0, thief.invulnerable - dt);
  game.empLeft = Math.max(0, game.empLeft - dt);
  for (const smoke of game.smokes) smoke.left -= dt;
  game.smokes = game.smokes.filter((smoke) => smoke.left > 0);
  if (game.lockdownTimer > 0) {
    game.lockdownTimer -= dt;
    if (game.lockdownTimer <= 0) {
      game.alarm = 55;
      toast(game, 'Lockdown lifted — alarm back to 55');
    }
  }

  // Movement.
  const move = moveVector(input);
  thief.sneaking = isSneaking(input);
  thief.moving = move.x !== 0 || move.y !== 0;
  if (thief.moving) {
    const speed = thief.sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
    const next = moveCircle(thief.x, thief.y, move.x * speed * dt, move.y * speed * dt, THIEF.radius);
    thief.x = next.x;
    thief.y = next.y;
    thief.angle = Math.atan2(move.y, move.x);
    thief.stepTimer -= dt;
    if (thief.stepTimer <= 0) {
      thief.stepTimer = thief.sneaking ? 0.55 : 0.38;
      audio.playStep(thief.sneaking);
    }
  }

  // Tools.
  if (wasPressed(input, TOOLS.smoke.key)) useSmoke(game);
  if (wasPressed(input, TOOLS.emp.key)) useEmp(game);
  if (input.mouse.clicked) tossCoin(game, input.mouse.clickX, input.mouse.clickY);
  if (wasPressed(input, 'm') || wasPressed(input, 'M')) {
    toast(game, audio.toggleMute() ? 'Sound off' : 'Sound on');
  }

  // Working a loot target: hold E beside it, standing still.
  const target = nearestLoot(game);
  if (target && isWorking(input) && !thief.moving) {
    if (game.channel.lootId !== target.id) game.channel = { lootId: target.id, progress: 0 };
    game.channel.progress += dt / target.channel;
    if (game.channel.progress >= 1) {
      target.taken = true;
      game.lootTotal += target.value;
      audio.playPickup();
      toast(game, `${target.name} — +$${target.value}`);
      game.channel = { lootId: null, progress: 0 };
    }
  } else if (game.channel.lootId !== null) {
    game.channel.progress = Math.max(0, game.channel.progress - dt * 2);
    if (game.channel.progress === 0) game.channel.lootId = null;
  }

  // Watchers.
  let seenByGuard = false;
  let seenByCamera = false;
  for (const guard of game.guards) {
    const range = thief.sneaking ? guard.def.range * 0.65 : guard.def.range;
    const seen = stepGuardWithRange(guard, dt, thief, game.smokes, range, game.lockdownTimer > 0);
    seenByGuard = seenByGuard || seen;
  }
  for (const camera of game.cameras) {
    const seen = stepCamera(camera, game.time, dt, thief, game.smokes, game.empLeft);
    seenByCamera = seenByCamera || seen;
  }
  game.seenNow = seenByGuard || seenByCamera;
  // One spotting per lull: a sweeping cone crossing the thief every frame
  // is one spotting, not dozens — count it only after 3s out of sight.
  game.spottedCooldown = Math.max(0, game.spottedCooldown - dt);
  if (game.seenNow && !game.wasSeen && game.spottedCooldown <= 0) {
    game.timesSpotted += 1;
    game.spottedCooldown = 3;
    audio.playSpotted();
    toast(game, seenByGuard ? 'SPOTTED by a guard — break line of sight!' : 'SPOTTED by a camera — get out of the cone!');
  }
  game.wasSeen = game.seenNow;

  if (game.lockdownTimer <= 0) {
    if (seenByGuard) game.alarm += 45 * dt;
    if (seenByCamera) game.alarm += 30 * dt;
    if (!game.seenNow) game.alarm -= 10 * dt;
    game.alarm = Math.max(0, Math.min(ALARM_LOCKDOWN_AT, game.alarm));
    game.alarmPeak = Math.max(game.alarmPeak, game.alarm);
    if (game.alarm >= ALARM_LOCKDOWN_AT) {
      game.lockdownTimer = LOCKDOWN_SECONDS;
      toast(game, 'LOCKDOWN! Exit sealed 8s — guards are running');
    }
  }
  audio.updateAlarmSound(game.alarm, dt);

  // Caught?
  if (thief.invulnerable <= 0) {
    for (const guard of game.guards) {
      if (Math.hypot(guard.x - thief.x, guard.y - thief.y) <= THIEF.catchRadius + 12) {
        catchThief(game);
        return;
      }
    }
  }

  // Getaway.
  const atExit = thief.y > 688 && thief.x > EXIT.x && thief.x < EXIT.x + EXIT.w;
  if (atExit) {
    if (game.lockdownTimer > 0) {
      toast(game, 'Exit sealed by lockdown — wait it out');
    } else if (game.lootTotal >= LOOT_TARGET) {
      finishHeist(game);
    } else {
      toast(game, `Getaway locked — need $${LOOT_TARGET} of loot (have $${game.lootTotal})`);
    }
  }
}

function stepGuardWithRange(guard, dt, thief, smokes, range, lockdown) {
  const original = guard.def.range;
  guard.def.range = range;
  const seen = stepGuard(guard, dt, thief, smokes, 0, lockdown);
  guard.def.range = original;
  return seen;
}
