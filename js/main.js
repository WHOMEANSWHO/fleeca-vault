/* ===========================================================
   Router + stage orchestration
   =========================================================== */
(() => {
  const screens = {
    menu: document.getElementById('menu'),
    maze: document.getElementById('maze'),
    decoder: document.getElementById('decoder'),
    pathing: document.getElementById('pathing'),
    fallout: document.getElementById('fallout'),
  };

  let mode = 'single';   // 'single' (one stage) or 'full' (chained)

  function show(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    document.getElementById('exit-btn').hidden = (name === 'menu');
  }

  // ---- maze HUD elements ----
  const mEls = {
    moves: document.getElementById('m-moves'),
    miss: document.getElementById('m-miss'),
    timer: document.getElementById('m-timer'),
    bar: document.getElementById('m-bar'),
    status: document.getElementById('m-status'),
    stage: document.getElementById('m-stage'),
  };
  // ---- decoder HUD elements ----
  const dEls = {
    cipher: document.getElementById('d-cipher'),
    code: document.getElementById('d-code'),
    key: document.getElementById('d-key'),
    trial: document.getElementById('d-trial'),
    shiftVal: document.getElementById('d-shift-val'),
    shiftUp: document.getElementById('d-shift-up'),
    shiftDown: document.getElementById('d-shift-down'),
    boxes: document.getElementById('d-boxes'),
    packets: document.getElementById('d-packets'),
    tabs: document.getElementById('d-tabs'),
    miss: document.getElementById('d-miss'),
    timer: document.getElementById('d-timer'),
    bar: document.getElementById('d-bar'),
    status: document.getElementById('d-status'),
    stage: document.getElementById('d-stage'),
  };

  // ---------- full breach state machine ----------
  // Terminal x1 -> Circuit x2 -> Cipher x2 -> Pathing x2.
  // Fail the terminal -> restart terminal. Fail anything later -> back to start.
  const BREACH = [
    { stage: 'fallout', rounds: 1 },
    { stage: 'maze',    rounds: 2 },
    { stage: 'decoder', rounds: 2 },
    { stage: 'pathing', rounds: 2 },
  ];
  let breachStep = 0, breachRound = 1;

  function startBreach() {
    mode = 'full';
    breachStep = 0; breachRound = 1;
    runBreachStage();
  }
  function runBreachStage() {
    const st = BREACH[breachStep].stage;
    if (st === 'fallout') startFallout();
    else if (st === 'maze') startMaze();
    else if (st === 'decoder') startDecoder();
    else if (st === 'pathing') startPathing();
  }
  function breachPass() {
    if (mode !== 'full') return;
    const step = BREACH[breachStep];
    if (breachRound < step.rounds) { breachRound++; setTimeout(runBreachStage, 1200); }
    else if (breachStep < BREACH.length - 1) { breachStep++; breachRound = 1; setTimeout(runBreachStage, 1200); }
    // else: full breach complete — stay on the final win screen
  }
  function breachFail() {
    if (mode !== 'full') return;
    if (BREACH[breachStep].stage === 'fallout') setTimeout(runBreachStage, 1600);   // terminal restarts itself
    else { breachStep = 0; breachRound = 1; setTimeout(runBreachStage, 1600); }      // back to the start
  }

  // Solo practice: after finishing a round (win OR fail) auto-serve another of
  // the same game, until the player exits. Skips if they've already left.
  function soloLoop(screenName, restart, delay) {
    setTimeout(() => {
      if (mode === 'single' && screens[screenName].classList.contains('active')) restart();
    }, delay);
  }

  // ---------- CIRCUIT ROUTING ----------
  Maze.init(document.getElementById('maze-canvas'), state => {
    mEls.moves.textContent = state.moves + '/--';
    if (state.win) {
      mEls.status.textContent = 'CIRCUIT COMPLETE';
      mEls.status.className = 'status win';
      if (mode === 'full') breachPass(); else soloLoop('maze', startMaze, 1400);
    }
  });

  function startMaze() {
    show('maze');
    mEls.status.textContent = 'IN PROGRESS';
    mEls.status.className = 'status';
    mEls.stage.textContent = mode === 'full' ? `${breachRound}/2` : '1/1';
    mEls.bar.style.transition = 'none';          // rAF drives the width directly
    mEls.bar.style.width = '100%';
    mEls.bar.style.background = '';
    const limit = 75;            // a touch more time for the larger 7x7 board
    Maze.newGame();
    Maze.startTimer(limit,
      rem => {
        mEls.timer.textContent = Math.ceil(rem) + 's';
        mEls.bar.style.width = (rem / limit) * 100 + '%';
        const low = rem <= 10;
        mEls.bar.style.background = low ? '#ff4646' : '';
        mEls.bar.style.boxShadow = low ? '0 0 6px #ff4646' : '';
      },
      () => mazeFail());
  }

  function mazeFail() {
    if (Maze.solved) return;
    mEls.status.textContent = 'LOCKOUT — RETRY';
    mEls.status.className = 'status fail';
    if (mode === 'full') breachFail(); else soloLoop('maze', startMaze, 1700);
  }

  // ---------- CIPHER DECODER ----------
  Decoder.init(dEls, () => {
    Maze.stopTimer();
    decoderTimerStop();
    dEls.bar.style.width = '100%';
    dEls.status.textContent = 'PACKETS DECODED';
    dEls.status.className = 'status win';
    if (mode === 'full') breachPass(); else soloLoop('decoder', startDecoder, 1400);
  });

  // ---------- PATHING ----------
  const pEls = {
    canvas: document.getElementById('path-canvas'),
    segs: [...document.querySelectorAll('#pathing .seg')],
    msg: document.getElementById('p-msg'),
  };
  Pathing.init(pEls,
    () => { if (mode === 'full') breachPass(); else soloLoop('pathing', startPathing, 1000); },  // all stages complete
    () => { if (mode === 'full') breachFail(); else Pathing.newGame(); });                        // wrong pick

  function startPathing() {
    show('pathing');
    Pathing.newGame();
  }

  // ---------- STAGE 4: TERMINAL HACK ----------
  const fEls = {
    cols: document.getElementById('f-cols'),
    log: document.getElementById('f-log'),
    blocks: document.getElementById('f-blocks'),
    status: document.getElementById('f-status'),
  };
  Fallout.init(fEls,
    () => { if (mode === 'full') breachPass(); else soloLoop('fallout', () => Fallout.newGame(), 1500); },
    () => { if (mode === 'full') breachFail(); else soloLoop('fallout', () => Fallout.newGame(), 1700); });

  function startFallout() {
    show('fallout');
    // no "NEW HACK" restart during a full breach run
    document.getElementById('f-new').style.display = mode === 'full' ? 'none' : '';
    Fallout.newGame();
  }

  let dRaf = null;
  function decoderTimerStart(seconds) {
    decoderTimerStop();
    const dur = seconds * 1000;
    const start = performance.now();
    dEls.bar.style.transition = 'none';          // rAF drives the width directly
    dEls.bar.style.width = '100%';
    dEls.bar.style.background = '';
    const tick = now => {
      const remain = Math.max(0, dur - (now - start));
      dEls.timer.textContent = Math.ceil(remain / 1000) + 's';
      dEls.bar.style.width = (remain / dur) * 100 + '%';
      const low = remain <= 12000;
      dEls.bar.style.background = low ? '#ff4646' : '';
      dEls.bar.style.boxShadow = low ? '0 0 6px #ff4646' : '';
      if (remain <= 0) { dRaf = null; decoderFail(); return; }
      dRaf = requestAnimationFrame(tick);
    };
    dRaf = requestAnimationFrame(tick);
  }
  function decoderTimerStop() {
    if (dRaf) { cancelAnimationFrame(dRaf); dRaf = null; }
    dEls.bar.style.transition = '';
  }
  function decoderFail() {
    if (Decoder.done) return;
    dEls.status.textContent = 'LOCKOUT — RETRY';
    dEls.status.className = 'status fail';
    if (mode === 'full') breachFail(); else soloLoop('decoder', startDecoder, 1700);
  }

  function startDecoder() {
    show('decoder');
    dEls.stage.textContent = mode === 'full' ? `${breachRound}/2` : '1/1';
    dEls.status.textContent = 'IN PROGRESS';
    dEls.status.className = 'status';
    Decoder.newGame();
    decoderTimerStart(90);
  }

  // ---------- navigation ----------
  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => {
      const go = btn.dataset.go;
      Maze.stopTimer();
      decoderTimerStop();
      if (go === 'menu') { show('menu'); return; }
      if (go === 'maze') { mode = 'single'; show('maze'); startMaze(); return; }
      if (go === 'decoder') { mode = 'single'; show('decoder'); startDecoder(); return; }
      if (go === 'pathing') { mode = 'single'; startPathing(); return; }
      if (go === 'fallout') { mode = 'single'; startFallout(); return; }
      if (go === 'full') { startBreach(); return; }
    });
  });

  // ---------- landing home / category routing ----------
  const homeView = document.getElementById('home-view');
  const catView = document.getElementById('category-view');
  const cvFleeca = document.getElementById('cv-fleeca');
  const cvWip = document.getElementById('cv-wip');

  function showHome() {
    catView.hidden = true;
    homeView.hidden = false;
  }
  function openCategory(cat, name) {
    homeView.hidden = true;
    catView.hidden = false;
    document.getElementById('cv-title').textContent = name;
    const live = cat === 'fleeca';
    cvFleeca.hidden = !live;
    cvWip.hidden = live;
    document.getElementById('cv-sub').textContent = live ? '4 HACKS' : 'COMING SOON';
    if (!live) document.getElementById('cv-wip-text').textContent =
      `${name} hacks are being built. Check back soon.`;
    screens.menu.scrollTop = 0;
  }

  document.querySelectorAll('.cat-tile').forEach(tile =>
    tile.addEventListener('click', () => openCategory(tile.dataset.cat, tile.dataset.name)));
  document.querySelectorAll('[data-open-cat]').forEach(el =>
    el.addEventListener('click', () => openCategory(el.dataset.openCat, el.dataset.name)));

  // navbar links: ensure home view, then scroll to a section
  const NAV_SECTIONS = { categories: 'categories-section', about: 'about-section' };
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      const nav = el.dataset.nav;
      showHome();
      if (nav === 'home') { screens.menu.scrollTop = 0; return; }
      const t = document.getElementById(NAV_SECTIONS[nav]);
      if (t) setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    });
  });

  document.getElementById('m-new').addEventListener('click', () => startMaze());
  document.getElementById('p-new').addEventListener('click', () => Pathing.newGame());
  document.getElementById('f-new').addEventListener('click', () => Fallout.newGame());

  show('menu');
})();
