/* ===========================================================
   STAGE 1 — Pipe / Circuit Routing Maze
   Rotate tiles to route the signal from IN (left) to OUT (top-right).
   =========================================================== */
const Maze = (() => {
  const COLS = 6, ROWS = 6;
  const DIRS = ['N', 'E', 'S', 'W'];
  const DELTA = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const OPP = { N: 'S', E: 'W', S: 'N', W: 'E' };

  // base pipe shapes (openings before rotation) — only straights & corners,
  // exactly like the FiveM original: every tile has precisely two openings.
  const SHAPES = {
    straight: ['N', 'S'],
    corner:   ['N', 'E'],
  };

  const IN_ROW = 3;          // IN node sits on west edge of (0, IN_ROW)
  const OUT_COL = COLS - 1;  // OUT node sits on east edge of last column
  let OUT_ROW = 0;           // randomised to a right-edge corner each game

  let canvas, ctx, cell, pad;
  let grid;                  // grid[y][x] = { type, rot }
  let moves, solved, rafId, onChange;

  // rotate a direction clockwise n times
  function rotDir(d, n) {
    let i = DIRS.indexOf(d);
    return DIRS[(i + n) % 4];
  }
  // openings for a cell (set of directions)
  function openings(c) {
    return SHAPES[c.type].map(d => rotDir(d, c.rot));
  }
  function hasOpening(c, d) {
    return openings(c).includes(d);
  }
  // find a rotation of `type` whose openings exactly match required set
  function rotationFor(type, required) {
    const want = [...required].sort().join('');
    for (let r = 0; r < 4; r++) {
      const got = SHAPES[type].map(d => rotDir(d, r)).sort().join('');
      if (got === want) return r;
    }
    return 0;
  }

  // ---- puzzle generation -------------------------------------------------
  function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

  // randomized DFS path from start to end cell
  function carvePath(sx, sy, ex, ey) {
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const path = [];
    function dfs(x, y) {
      visited[y][x] = true;
      path.push([x, y]);
      if (x === ex && y === ey) return true;
      const dirs = [...DIRS].sort(() => Math.random() - 0.5);
      for (const d of dirs) {
        const [dx, dy] = DELTA[d];
        const nx = x + dx, ny = y + dy;
        if (inBounds(nx, ny) && !visited[ny][nx]) {
          if (dfs(nx, ny)) return true;
        }
      }
      path.pop();
      return false;
    }
    dfs(sx, sy);
    return path;
  }

  function generate() {
    OUT_ROW = Math.random() < 0.5 ? 0 : ROWS - 1;   // top- or bottom-right corner

    grid = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ type: 'straight', rot: 0 })));

    const path = carvePath(0, IN_ROW, OUT_COL, OUT_ROW);
    const required = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => new Set()));

    // connect consecutive path cells
    for (let i = 0; i < path.length - 1; i++) {
      const [x, y] = path[i], [nx, ny] = path[i + 1];
      const d = DIRS.find(k => DELTA[k][0] === nx - x && DELTA[k][1] === ny - y);
      required[y][x].add(d);
      required[ny][nx].add(OPP[d]);
    }
    // external stubs
    required[IN_ROW][0].add('W');
    required[OUT_ROW][OUT_COL].add('E');

    // assign solved pieces along the path — every path cell has exactly two
    // openings, so it is always a straight or a corner.
    for (const [x, y] of path) {
      const req = required[y][x];
      const arr = [...req];
      const type = (OPP[arr[0]] === arr[1]) ? 'straight' : 'corner';
      grid[y][x] = { type, rot: rotationFor(type, req), onPath: true, sol: rotationFor(type, req) };
    }
    // fill the rest with random decoy pieces (straights & corners only)
    const decoy = ['straight', 'corner', 'corner'];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (!grid[y][x].onPath)
          grid[y][x] = { type: decoy[(Math.random() * decoy.length) | 0], rot: (Math.random() * 4) | 0 };

    // scramble every tile so the player has to fix it
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        grid[y][x].rot = (Math.random() * 4) | 0;

    moves = 0;
    solved = false;
  }

  // ---- connectivity check (flood fill from IN) ---------------------------
  function poweredSet() {
    const powered = new Set();
    const start = grid[IN_ROW][0];
    if (!hasOpening(start, 'W')) return powered; // signal can't enter
    const q = [[0, IN_ROW]];
    powered.add(`0,${IN_ROW}`);
    while (q.length) {
      const [x, y] = q.shift();
      const c = grid[y][x];
      for (const d of openings(c)) {
        const [dx, dy] = DELTA[d];
        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const key = `${nx},${ny}`;
        if (powered.has(key)) continue;
        const nb = grid[ny][nx];
        if (hasOpening(nb, OPP[d])) { powered.add(key); q.push([nx, ny]); }
      }
    }
    return powered;
  }

  function checkSolved(powered) {
    const end = grid[OUT_ROW][OUT_COL];
    return powered.has(`${OUT_COL},${OUT_ROW}`) && hasOpening(end, 'E');
  }

  // ---- rendering ---------------------------------------------------------
  function draw() {
    const powered = poweredSet();
    solved = checkSolved(powered);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // tiles: dark green cells with clear bright borders
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = pad + x * cell, py = pad + y * cell;
        const entry = (x === 0 && y === IN_ROW) || (x === OUT_COL && y === OUT_ROW);
        ctx.fillStyle = entry ? 'rgba(57,255,91,0.12)' : 'rgba(14,70,30,0.30)';
        ctx.fillRect(px, py, cell, cell);
        ctx.strokeStyle = 'rgba(64,240,104,0.30)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 0.75, py + 0.75, cell - 1.5, cell - 1.5);
      }
    }
    // unpowered pipes first, powered on top so the lit tube reads cleanly
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (!powered.has(`${x},${y}`)) drawPipe(grid[y][x], pad + x * cell, pad + y * cell, false);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (powered.has(`${x},${y}`)) drawPipe(grid[y][x], pad + x * cell, pad + y * cell, true);

    drawNode(pad, pad + (IN_ROW + 0.5) * cell, 'IN');                 // straddles left edge
    drawNode(pad + COLS * cell, pad + (OUT_ROW + 0.5) * cell, 'OUT'); // straddles right edge

    if (onChange) onChange({ moves, solved, powered: powered.size });
  }

  function strokePiece(c, cx, cy) {
    const ends = openings(c).map(d => [cx + DELTA[d][0] * cell / 2, cy + DELTA[d][1] * cell / 2]);
    ctx.beginPath();
    ctx.moveTo(ends[0][0], ends[0][1]);
    ctx.lineTo(cx, cy);
    ctx.lineTo(ends[1][0], ends[1][1]);
    ctx.stroke();
  }

  function drawPipe(c, px, py, lit) {
    const cx = px + cell / 2, cy = py + cell / 2;
    const w = cell * 0.18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (lit) {
      ctx.shadowColor = '#39ff5b'; ctx.shadowBlur = cell * 0.28;   // bloom
      ctx.strokeStyle = '#46ff64'; ctx.lineWidth = w; strokePiece(c, cx, cy);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#d6ffdf'; ctx.lineWidth = w * 0.38;        // bright core
      strokePiece(c, cx, cy);
    } else {
      ctx.shadowColor = '#1c7a30'; ctx.shadowBlur = cell * 0.06;
      ctx.strokeStyle = '#31b850'; ctx.lineWidth = w; strokePiece(c, cx, cy);
      ctx.shadowBlur = 0;
    }
  }

  function drawNode(cx, cy, label) {
    const w = cell * 0.56, h = cell * 0.42;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = 'rgba(2,12,6,0.92)';
    ctx.strokeStyle = '#39ff5b';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#39ff5b'; ctx.shadowBlur = 12;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#9bffb0';
    ctx.font = `bold ${Math.floor(cell * 0.2)}px Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
  }

  // ---- interaction -------------------------------------------------------
  function cellAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * canvas.width;
    const y = ((clientY - r.top) / r.height) * canvas.height;
    const gx = Math.floor((x - pad) / cell);
    const gy = Math.floor((y - pad) / cell);
    if (!inBounds(gx, gy)) return null;
    return [gx, gy];
  }

  function rotate(gx, gy, ccw) {
    if (solved) return;
    const c = grid[gy][gx];
    c.rot = (c.rot + (ccw ? 3 : 1)) % 4;
    moves++;
    draw();
    if (solved) win();
  }

  function win() {
    stopTimer();
    onChange && onChange({ moves, solved: true, win: true });
  }

  // ---- timer -------------------------------------------------------------
  // onTick receives the fractional seconds remaining so the caller can drain a
  // bar smoothly while still showing whole seconds.
  function startTimer(seconds, onTick, onExpire) {
    stopTimer();
    const dur = seconds * 1000;
    const start = performance.now();
    const tick = now => {
      const remain = Math.max(0, dur - (now - start));
      onTick(remain / 1000);
      if (remain <= 0) { rafId = null; onExpire(); return; }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }
  function stopTimer() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  // ---- public ------------------------------------------------------------
  function init(canvasEl, changeCb) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    pad = cell = 0;
    onChange = changeCb;

    const inset = 70;                         // room for IN/OUT nodes
    cell = Math.floor((canvas.width - inset) / COLS);
    pad = Math.floor((canvas.width - cell * COLS) / 2);

    canvas.addEventListener('click', e => {
      const hit = cellAt(e.clientX, e.clientY);
      if (hit) rotate(hit[0], hit[1], e.shiftKey);
    });
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      const hit = cellAt(e.clientX, e.clientY);
      if (hit) rotate(hit[0], hit[1], true);
    });
  }

  function newGame() { generate(); draw(); }

  return { init, newGame, draw, startTimer, stopTimer, total: COLS * ROWS, get solved() { return solved; }, get moves() { return moves; } };
})();
