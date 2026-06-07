/* ===========================================================
   STAGE 2 — Cipher Decoder
   Decode 3 packets. Each packet uses a cipher (HEX / MORSE / ATBASH).
   A decoder key is shown; type the decoded word.
   =========================================================== */
const Decoder = (() => {
  const WORDS = [
    'GUARD', 'WIRE', 'VAULT', 'BREACH', 'CIPHER', 'ACCESS', 'CRACK',
    'LOCK', 'STEEL', 'ALARM', 'SECURE', 'BYPASS', 'HEIST', 'CODE',
    'NODE', 'RELAY', 'PULSE', 'GRID', 'FLEECA', 'SIGNAL', 'CORE',
  ];

  const MORSE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
    H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
    O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
    V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  };
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(p => p[1]);

  const atbash = ch => String.fromCharCode(155 - ch.charCodeAt(0)); // A<->Z
  const hex = ch => ch.charCodeAt(0).toString(16).toUpperCase();

  // Caesar: shift a letter forward by k; the key lists, for each decoded
  // letter D (A..Z), which encoded letter maps to it at the current shift.
  const caesarEnc = (ch, k) => String.fromCharCode((ch.charCodeAt(0) - 65 + k) % 26 + 65);
  const caesarEncode = (w, k) => w.split('').map(c => caesarEnc(c, k)).join('');
  const caesarKey = k => ALPHA.map(d => `${caesarEnc(d, k)} → ${d}`);

  // each cipher: encode the answer for display, and build a key table
  const CIPHERS = {
    hex: {
      label: 'HEX → ASCII',
      encode: w => w.split('').map(hex).join(' '),
      key: () => ALPHA.map(l => `${hex(l)} → ${l}`),
    },
    morse: {
      label: 'MORSE → ASCII',
      encode: w => w.split('').map(l => MORSE[l]).join(' / '),
      key: () => ALPHA.map(l => `${MORSE[l]} → ${l}`),
    },
    atbash: {
      label: 'ATBASH MIRROR',
      encode: w => w.split('').map(atbash).join(''),
      key: () => ALPHA.map(l => `${l} → ${atbash(l)}`),
    },
  };

  let els, state, onChange, onWin;
  const TYPES = ['hex', 'morse', 'atbash', 'caesar'];

  function pickWord(used) {
    const pool = WORDS.filter(w => !used.includes(w));
    const src = pool.length ? pool : WORDS;
    return src[(Math.random() * src.length) | 0];
  }

  // build one packet per cipher type, each with its own independent state
  function buildPacket(type, used) {
    const word = pickWord(used);
    used.push(word);
    const p = { type, answer: word, input: '', solved: false };
    if (type === 'caesar') {
      p.label = 'CAESAR CIPHER';
      p.secretShift = 1 + ((Math.random() * 25) | 0);   // 1..25
      p.trialShift = 1;                                  // local to THIS packet only
      p.code = caesarEncode(word, p.secretShift);
    } else {
      p.label = CIPHERS[type].label;
      p.cipher = CIPHERS[type];
      p.code = CIPHERS[type].encode(word);
    }
    return p;
  }

  const cur = () => state.packets[state.current];

  function changeShift(d) {
    const p = cur();
    if (p.type !== 'caesar' || p.solved || state.done) return;
    let s = p.trialShift + d;
    if (s > 25) s = 1;
    if (s < 1) s = 25;
    p.trialShift = s;                                    // only affects this packet
    render();
  }

  function render() {
    const p = cur();
    const isCaesar = p.type === 'caesar';
    els.cipher.textContent = p.label;
    els.code.textContent = p.code;

    // trial-shift control (caesar only) — reads this packet's own shift
    els.trial.hidden = !isCaesar;
    if (isCaesar) els.shiftVal.textContent = '+' + p.trialShift;

    els.key.innerHTML = '';
    const entries = isCaesar ? caesarKey(p.trialShift) : p.cipher.key();
    for (const entry of entries) {
      const d = document.createElement('div');
      d.className = 'key-cell';
      d.textContent = entry;
      els.key.appendChild(d);
    }
    renderBoxes(false);
    renderProgress();
    els.miss.textContent = state.miss;
  }

  function renderProgress() {
    const solvedCount = state.packets.filter(p => p.solved).length;
    els.packets.textContent = `${solvedCount}/${state.packets.length}`;
    [...els.tabs.children].forEach((el, i) => {
      el.className = 'ptab'
        + (state.packets[i].solved ? ' done' : '')
        + (i === state.current ? ' current' : '');
    });
  }

  function renderBoxes(bad) {
    const p = cur();
    els.boxes.innerHTML = '';
    for (let i = 0; i < p.answer.length; i++) {
      const b = document.createElement('div');
      b.className = 'box';
      if (p.solved) { b.textContent = p.answer[i]; b.classList.add('filled'); }
      else if (i < p.input.length) { b.textContent = p.input[i]; b.classList.add('filled'); }
      else if (i === p.input.length) b.classList.add('cursor');
      if (bad) b.classList.add('bad');
      els.boxes.appendChild(b);
    }
  }

  function key(e) {
    if (state.done) return;
    const p = cur();
    if (p.solved) return;
    if (e.key === 'Backspace') {
      p.input = p.input.slice(0, -1);
      renderBoxes(false);
      return;
    }
    const ch = e.key.toUpperCase();
    if (!/^[A-Z]$/.test(ch)) return;
    if (p.input.length >= p.answer.length) return;
    p.input += ch;
    renderBoxes(false);

    if (p.input.length === p.answer.length) {
      if (p.input === p.answer) packetSolved();
      else packetMissed();
    }
  }

  function packetSolved() {
    cur().solved = true;
    renderProgress();
    renderBoxes(false);
    if (state.packets.every(p => p.solved)) {
      state.done = true;
      onWin && onWin();
    } else {
      // forced sequential — the player can't choose the order, it's random
      setTimeout(() => { state.current++; render(); }, 400);
    }
  }

  function packetMissed() {
    state.miss++;
    els.miss.textContent = state.miss;
    renderBoxes(true);
    const p = cur();
    setTimeout(() => { p.input = ''; renderBoxes(false); }, 350);
  }

  function init(elements, winCb) {
    els = elements;
    onWin = winCb;
    els.shiftUp.addEventListener('click', () => changeShift(1));
    els.shiftDown.addEventListener('click', () => changeShift(-1));
    document.addEventListener('keydown', e => {
      const active = document.getElementById('decoder').classList.contains('active');
      if (!active) return;
      if (e.key === 'ArrowRight') { changeShift(1); return; }
      if (e.key === 'ArrowLeft') { changeShift(-1); return; }
      key(e);
    });
  }

  function newGame() {
    const used = [];
    const packets = shuffle(TYPES).map(type => buildPacket(type, used));
    state = { packets, current: 0, miss: 0, done: false };
    render();
  }

  return { init, newGame, get done() { return state?.done; }, get solved() { return state?.solvedPackets || 0; } };
})();
