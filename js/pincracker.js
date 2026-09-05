/* ===========================================================
   PIN CRACKER — Wordle / Mastermind PIN hack
   Unique digits from 0–9. Green = right slot, blue = in the PIN
   wrong slot, red = not in the PIN. 4, 5 or 6 digits. 5 attempts.
   A heist can chain 2–5 PINs; fail one and the run is over.
   =========================================================== */
const PinCracker = (() => {
  const LENGTHS = [4, 5, 6];
  const DEFAULT_ATTEMPTS = 5;

  let els, onWin, onFail;
  let active = false;
  let timers = [];
  let state = null;

  const rnd = n => (Math.random() * n) | 0;
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(p => p[1]);

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers = timers.filter(t => t !== id);
      fn();
    }, ms);
    timers.push(id);
  }

  function stopTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function beep(freq, ms, gain) {
    try {
      const ctx = beep.ctx || (beep.ctx = new AudioContext());
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = gain || 0.03;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + (ms || 40) / 1000);
    } catch (_) { /* ignore */ }
  }

  function generatePin(len) {
    return shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, len);
  }

  function pickLength() {
    if (state.lenMode === 'mix') return LENGTHS[rnd(LENGTHS.length)];
    return state.lenMode;
  }

  function pickStages() {
    if (state.stageMode === 'heist') return 2 + rnd(4);
    return Math.max(1, state.stageMode | 0);
  }

  function scoreGuess(guess, secret) {
    const has = new Set(secret);
    return guess.map((d, i) => {
      if (d === secret[i]) return 'correct';
      if (has.has(d)) return 'placement';
      return 'wrong';
    });
  }

  function remainingCopy(left, max) {
    const word = left === 1 ? 'ATTEMPT' : 'ATTEMPTS';
    return left + '/' + max + ' ' + word + ' REMAINING';
  }

  function stagesLeftCopy(n) {
    const word = n === 1 ? 'STAGE' : 'STAGES';
    return n + ' ' + word + ' LEFT';
  }

  function digitSpans(guess, colours) {
    return guess.map((d, i) =>
      '<span class="pc-digit ' + colours[i] + '">' + d + '</span>'
    ).join('');
  }

  function renderPlay() {
    const hist = state.attempts.slice().reverse().map(row =>
      '<div class="pc-attempt">' +
        '<span class="pc-alabel">ATTEMPT ' + row.n + ':</span>' +
        '<span class="pc-digits">' + digitSpans(row.guess, row.colours) + '</span>' +
      '</div>'
    ).join('');

    els.hud.innerHTML =
      '<div class="pc-title">PIN CRACKER</div>' +
      '<div class="pc-line">ENTER A ' + state.pinLen + ' PIN OF UNIQUE DIGITS</div>' +
      '<div class="pc-legend">' +
        '<span class="correct">CORRECT</span>' +
        '<span class="pipe">|</span>' +
        '<span class="placement">WRONG PLACEMENT</span>' +
        '<span class="pipe">|</span>' +
        '<span class="wrong">WRONG</span>' +
      '</div>' +
      '<div class="pc-input">' +
        '<span class="pc-prompt">&gt;&gt;</span>' +
        '<span class="pc-typed">' + state.input + '</span>' +
        '<span class="pc-caret' + (state.locked ? ' hidden' : '') + '"></span>' +
      '</div>' +
      '<div class="pc-remain">' + remainingCopy(state.remaining, state.maxAttempts) + '</div>' +
      '<div class="pc-history">' + hist + '</div>';
  }

  function renderStatus(kind) {
    let body = '';
    if (kind === 'success-next') {
      const left = state.stagesTotal - state.stageIndex - 1;
      body =
        '<div class="pc-smsg">SUCCESS</div>' +
        '<div class="pc-ssub">GENERATING NEW STAGE ...</div>' +
        '<div class="pc-sleft">' + stagesLeftCopy(left) + '</div>';
    } else if (kind === 'success-done') {
      body =
        '<div class="pc-smsg">SUCCESS</div>' +
        '<div class="pc-ssub">ALL STAGES COMPLETE</div>';
    } else {
      body =
        '<div class="pc-smsg failed">FAILED</div>';
    }
    els.hud.innerHTML =
      '<div class="pc-title">PIN CRACKER</div>' +
      '<div class="pc-status">' + body + '</div>';
  }

  function render() {
    if (!els || !state) return;
    if (state.view === 'play') renderPlay();
    else renderStatus(state.view);
  }

  function startStage() {
    state.pinLen = pickLength();
    state.secret = generatePin(state.pinLen);
    state.input = '';
    state.attempts = [];
    state.remaining = state.maxAttempts;
    state.locked = false;
    state.view = 'play';
    render();
  }

  function finishWin() {
    if (!active) return;
    const last = state.stageIndex + 1 >= state.stagesTotal;
    if (last) {
      state.view = 'success-done';
      beep(980, 120, 0.04);
      render();
      later(() => { if (active) onWin && onWin(); }, 1400);
      return;
    }
    state.view = 'success-next';
    beep(880, 90, 0.04);
    render();
    later(() => {
      if (!active) return;
      state.stageIndex += 1;
      startStage();
    }, 2200);
  }

  function finishFail() {
    if (!active) return;
    state.view = 'fail';
    beep(140, 220, 0.05);
    render();
    later(() => { if (active) onFail && onFail(); }, 1600);
  }

  function submitGuess() {
    if (!active || state.locked || state.view !== 'play') return;
    if (state.input.length !== state.pinLen) {
      beep(180, 80, 0.04);
      return;
    }
    const guess = state.input.split('').map(Number);
    const colours = scoreGuess(guess, state.secret);
    state.attempts.push({ n: state.attempts.length + 1, guess, colours });
    state.input = '';
    beep(720, 35, 0.025);

    if (colours.every(c => c === 'correct')) {
      state.locked = true;
      render();
      later(finishWin, 280);
      return;
    }
    state.remaining -= 1;
    if (state.remaining <= 0) {
      state.locked = true;
      render();
      later(finishFail, 400);
      return;
    }
    render();
  }

  function onKey(e) {
    if (!active) return;
    const shown = document.getElementById('pincracker');
    if (!shown || !shown.classList.contains('active')) return;
    if (!state) return;

    const key = e.key;
    if (['Enter', 'Backspace', ' '].includes(key) || /^[0-9]$/.test(key)) e.preventDefault();
    if (state.view !== 'play' || state.locked) return;

    if (key === 'Backspace') {
      if (state.input.length) {
        state.input = state.input.slice(0, -1);
        beep(420, 25, 0.02);
        render();
      }
      return;
    }
    if (key === 'Enter') {
      submitGuess();
      return;
    }
    if (/^[0-9]$/.test(key)) {
      if (state.input.length >= state.pinLen) return;
      if (state.input.includes(key)) {
        beep(200, 50, 0.03);
        return;
      }
      state.input += key;
      beep(760, 22, 0.02);
      render();
    }
  }

  function init(elements, winCb, failCb) {
    els = elements;
    onWin = winCb;
    onFail = failCb;
    document.addEventListener('keydown', onKey);
  }

  function newGame(opts) {
    opts = opts || {};
    stopTimers();
    active = true;
    const stages = opts.stages === 'heist' ? 'heist' : (opts.stages || 1);
    state = {
      lenMode: opts.pinLen === 4 || opts.pinLen === 5 || opts.pinLen === 6 ? opts.pinLen : 'mix',
      stageMode: stages,
      maxAttempts: opts.maxAttempts || DEFAULT_ATTEMPTS,
      stagesTotal: 1,
      stageIndex: 0,
    };
    state.stagesTotal = pickStages();
    startStage();
  }

  function stop() {
    active = false;
    stopTimers();
  }

  return { init, newGame, stop };
})();
