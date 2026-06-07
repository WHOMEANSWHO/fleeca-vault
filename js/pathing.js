/* ===========================================================
   PATHING — "Go to the next closest point"
   Chain a path through every node by always clicking the nearest
   unvisited point. A wrong pick fails the stage. 3 stages total.
   =========================================================== */
const Pathing = (() => {
  const STAGE_POINTS = [10, 10, 10];  // ~10 nodes per stage, like the video
  const TEAL = '#2af0c8';
  const TEAL_CORE = '#b6ffee';

  let canvas, ctx, segEls, msgEl, onWin, onFail;
  let W, H, PAD, MIN_D;
  let state;

  // ---- geometry helpers --------------------------------------------------
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function placePoints(n) {
    const pts = [];
    let tries = 0;
    while (pts.length < n && tries < 4000) {
      tries++;
      const p = { x: PAD + Math.random() * (W - 2 * PAD), y: PAD + Math.random() * (H - 2 * PAD) };
      if (pts.every(q => dist(p, q) >= MIN_D)) pts.push(p);
    }
    return pts;
  }

  function nnOrder(pts, start) {
    const n = pts.length, used = Array(n).fill(false), order = [start];
    used[start] = true;
    let cur = start;
    for (let k = 1; k < n; k++) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < n; i++) if (!used[i]) { const d = dist(pts[cur], pts[i]); if (d < bd) { bd = d; best = i; } }
      used[best] = true; order.push(best); cur = best;
    }
    return order;
  }

  // Like the video, close-calls are allowed (that's the challenge) — only
  // reject near-identical ties that would be unfair to judge by eye.
  function hasClearMargins(pts, order) {
    const used = Array(pts.length).fill(false);
    used[order[0]] = true;
    let cur = order[0];
    for (let k = 1; k < order.length; k++) {
      const ds = [];
      for (let i = 0; i < pts.length; i++) if (!used[i]) ds.push(dist(pts[cur], pts[i]));
      ds.sort((a, b) => a - b);
      if (ds.length >= 2 && ds[0] > ds[1] * 0.96) return false;   // reject only near-ties
      used[order[k]] = true; cur = order[k];
    }
    return true;
  }

  function buildStage(n) {
    for (let attempt = 0; attempt < 250; attempt++) {
      const pts = placePoints(n);
      if (pts.length < n) continue;
      const start = (Math.random() * n) | 0;
      const order = nnOrder(pts, start);
      if (hasClearMargins(pts, order)) return { pts, order };
    }
    // fallback: accept whatever we last built
    const pts = placePoints(n);
    return { pts, order: nnOrder(pts, 0) };
  }

  // ---- stage lifecycle ---------------------------------------------------
  function newStage() {
    const n = STAGE_POINTS[state.stage];
    const { pts, order } = buildStage(n);
    state.pts = pts;
    state.order = order;
    state.visited = [order[0]];      // indices visited, in path order
    state.current = order[0];
    state.busy = false;
    draw();
  }

  function progressFrac() {
    const n = state.pts.length;
    return (state.visited.length - 1) / (n - 1);
  }

  function paintSegments() {
    segEls.forEach((seg, i) => {
      const fill = seg.firstElementChild;
      seg.classList.remove('fail');
      if (i < state.stage) fill.style.width = '100%';
      else if (i === state.stage) fill.style.width = (progressFrac() * 100) + '%';
      else fill.style.width = '0%';
    });
  }

  function showMsg(text, kind) {
    msgEl.textContent = text;
    msgEl.className = 'overlay-msg show ' + (kind || '');
  }
  function hideMsg() { msgEl.className = 'overlay-msg'; }

  function stageFailed() {
    state.busy = true;
    segEls[state.stage].classList.add('fail');
    segEls[state.stage].firstElementChild.style.width = '100%';
    showMsg('Stage failed!', 'fail');
    setTimeout(() => { hideMsg(); onFail && onFail(); }, 1300);
  }

  function stageCompleted() {
    state.busy = true;
    paintSegments();
    if (state.stage >= STAGE_POINTS.length - 1) {
      showMsg('All Stages Completed!', 'win');
      setTimeout(() => { onWin && onWin(); }, 1100);
      draw();
      return;
    }
    showMsg(`Stage ${state.stage + 1} Completed!`, 'done');
    setTimeout(() => { hideMsg(); state.stage++; newStage(); paintSegments(); }, 1300);
  }

  // ---- interaction -------------------------------------------------------
  function nodeAt(mx, my) {
    for (let i = 0; i < state.pts.length; i++) {
      if (dist(state.pts[i], { x: mx, y: my }) <= 18) return i;
    }
    return -1;
  }

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * canvas.width,
      y: (e.clientY - r.top) / r.height * canvas.height,
    };
  }

  function onMove(e) {
    const p = toCanvas(e);
    state.mouse = p;
    state.hover = nodeAt(p.x, p.y);
    draw();
  }

  function onClick(e) {
    if (state.busy) return;
    const p = toCanvas(e);
    const i = nodeAt(p.x, p.y);
    if (i < 0) return;
    if (state.visited.includes(i)) return;
    const expected = state.order[state.visited.length];   // nearest unvisited
    if (i === expected) {
      state.visited.push(i);
      state.current = i;
      paintSegments();
      draw();
      if (state.visited.length === state.pts.length) stageCompleted();
    } else {
      stageFailed();
    }
  }

  // ---- rendering ---------------------------------------------------------
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();

    // solid connections along the visited path
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = TEAL; ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let k = 0; k < state.visited.length; k++) {
      const p = state.pts[state.visited[k]];
      if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // dashed line from current node toward the cursor
    if (state.mouse && !state.busy) {
      const c = state.pts[state.current];
      ctx.setLineDash([6, 7]);
      ctx.strokeStyle = 'rgba(42,240,200,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(state.mouse.x, state.mouse.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // nodes
    for (let i = 0; i < state.pts.length; i++) {
      const p = state.pts[i];
      const visited = state.visited.includes(i);
      const isCurrent = i === state.current;
      if (visited) {
        const r = isCurrent ? 11 : 8;
        ctx.shadowColor = TEAL; ctx.shadowBlur = isCurrent ? 22 : 12;
        ctx.fillStyle = TEAL;
        circle(p.x, p.y, r); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = TEAL_CORE;
        circle(p.x, p.y, r * 0.45); ctx.fill();
      } else {
        const hovered = i === state.hover;
        ctx.shadowColor = TEAL; ctx.shadowBlur = hovered ? 14 : 6;
        ctx.fillStyle = 'rgba(20,40,36,0.9)';
        circle(p.x, p.y, 10); ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = hovered ? TEAL_CORE : TEAL;
        circle(p.x, p.y, 10); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

  function drawBoard() {
    ctx.fillStyle = '#2b302e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // fine graph-paper grid
    ctx.strokeStyle = 'rgba(120,150,140,0.06)';
    ctx.lineWidth = 1;
    const step = 16;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = 0; y <= canvas.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
    // border
    ctx.strokeStyle = 'rgba(42,240,200,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  }

  // ---- public ------------------------------------------------------------
  function init(els, winCb, failCb) {
    canvas = els.canvas;
    ctx = canvas.getContext('2d');
    segEls = els.segs;
    msgEl = els.msg;
    onWin = winCb;
    onFail = failCb;
    W = canvas.width; H = canvas.height;
    PAD = 48; MIN_D = 84;
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);
  }

  function newGame() {
    state = { stage: 0, visited: [], mouse: null, hover: -1, busy: false };
    hideMsg();
    newStage();
    paintSegments();
  }

  return { init, newGame };
})();
