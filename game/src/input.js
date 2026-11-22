// Keyboard and mouse input: WASD/arrows to move, Shift to sneak, E to work
// a lock or a case, 1 for smoke, 2 for EMP, click to toss a coin, M to mute.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    mouse: { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 },
    pressed: new Set(),
  };

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const name = keyName(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) state.pressed.add(name);
    keys.add(name);
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    state.mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouse.clickX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    state.mouse.clickY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    state.mouse.clicked = true;
  });

  return state;
}

/** Movement vector from the held keys, normalised. */
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (input.keys.has('a') || input.keys.has('ArrowLeft')) x -= 1;
  if (input.keys.has('d') || input.keys.has('ArrowRight')) x += 1;
  if (input.keys.has('w') || input.keys.has('ArrowUp')) y -= 1;
  if (input.keys.has('s') || input.keys.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

export function isSneaking(input) {
  return input.keys.has('Shift');
}

export function isWorking(input) {
  return input.keys.has('e') || input.keys.has('E');
}

/** True once for a key pressed since the last frame; call after reading. */
export function wasPressed(input, name) {
  return input.pressed.has(name);
}

export function endFrame(input) {
  input.pressed.clear();
  input.mouse.clicked = false;
}
