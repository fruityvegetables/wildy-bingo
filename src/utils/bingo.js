export function createEmptyGrid(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => '')
  );
}

export function centerIndex(size) {
  return Math.floor(size / 2);
}

export function isCenterCell(row, col, size) {
  if (size % 2 === 0) return false;
  const mid = centerIndex(size);
  return row === mid && col === mid;
}

export function fillGridFromLines(grid, lines) {
  const size = grid.length;
  const next = grid.map((row) => [...row]);
  let index = 0;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (isCenterCell(row, col, size)) continue;
      if (index < lines.length) {
        next[row][col] = lines[index];
        index++;
      }
    }
  }

  return next;
}

export function parseItemLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function randomInt(max) {
  if (max <= 0) return 0;

  const array = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;

  let value;
  do {
    crypto.getRandomValues(array);
    value = array[0];
  } while (value >= limit);

  return value % max;
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function shuffleColumns(grid) {
  const size = grid.length;
  const next = grid.map((row) => [...row]);

  for (let col = 0; col < size; col++) {
    const movable = [];

    for (let row = 0; row < size; row++) {
      if (isCenterCell(row, col, size)) continue;
      movable.push(next[row][col]);
    }

    shuffleInPlace(movable);

    let index = 0;
    for (let row = 0; row < size; row++) {
      if (isCenterCell(row, col, size)) continue;
      next[row][col] = movable[index++];
    }
  }

  return next;
}

export function shuffleBoard(grid) {
  const size = grid.length;
  const next = grid.map((row) => [...row]);
  const values = [];
  const positions = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (isCenterCell(row, col, size)) continue;
      values.push(next[row][col]);
      positions.push([row, col]);
    }
  }

  shuffleInPlace(values);

  positions.forEach(([row, col], index) => {
    next[row][col] = values[index];
  });

  return next;
}

export function resizeGrid(grid, newSize) {
  const next = createEmptyGrid(newSize);
  const oldSize = grid.length;
  const limit = Math.min(oldSize, newSize);

  for (let row = 0; row < limit; row++) {
    for (let col = 0; col < limit; col++) {
      next[row][col] = grid[row][col];
    }
  }

  if (newSize % 2 === 1) {
    const mid = centerIndex(newSize);
    next[mid][mid] = 'FREE';
  }

  return next;
}

export function initGrid(size) {
  const grid = createEmptyGrid(size);
  if (size % 2 === 1) {
    const mid = centerIndex(size);
    grid[mid][mid] = 'FREE';
  }
  return grid;
}

export function cellCount(size) {
  let total = size * size;
  if (size % 2 === 1) total -= 1;
  return total;
}
