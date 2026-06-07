/* ===========================================================
   TERMINAL HACK — Fallout-style password breach
   A memory dump hides same-length words in junk symbols. Guess a
   word -> the terminal reports LIKENESS (letters in the right spot
   vs the secret password). 4 attempts. Matched bracket pairs in the
   junk remove a dud word or replenish attempts.
   =========================================================== */
const Fallout = (() => {
  const ROWS_PER_COL = 16, COLS = 2, ROW_LEN = 12;
  const WORD_LEN = 6;
  const NUM_WORDS = 10;
  const NUM_BRACKETS = 7;
  let MAX_ATTEMPTS = 2;   // randomised to 1 or 2 each new hack

  const SYMBOLS = '!@#$%^&*_-+=|;:,.?/\\"\''.split('');
  const BRACKETS = [['(', ')'], ['[', ']'], ['{', '}'], ['<', '>']];
  const WORDS = [
    'VAULTS', 'BREACH', 'CIPHER', 'ACCESS', 'SECURE', 'LOCKED', 'MASTER',
    'SYSTEM', 'BINARY', 'MEMORY', 'KERNEL', 'MODULE', 'PACKET', 'ROUTER',
    'SIGNAL', 'DAMAGE', 'FAULTS', 'HACKER', 'ESCAPE', 'GUARDS', 'ALARMS',
    'TUNNEL', 'WIRING', 'COPPER', 'THEFTS', 'HEISTS', 'DENIED', 'GRANTS',
    'RECORD', 'TELLER', 'CREDIT', 'CASHED', 'FROZEN', 'LEDGER',
  ];

  let els, onWin, onFail;
  let rows, words, password, attempts, removed, usedBrackets, solved, locked, log, lastRemoved, lastBracket;

  const rnd = n => (Math.random() * n) | 0;
  const sym = () => SYMBOLS[rnd(SYMBOLS.length)];
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(p => p[1]);

  // ---- generation --------------------------------------------------------
  function blankRows() {
    const total = ROWS_PER_COL * COLS;
    const startAddr = 0xA000 + rnd(0x4000);
    return Array.from({ length: total }, (_, r) => ({
      addr: '0x' + ((startAddr + r * ROW_LEN) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'),
      cells: Array.from({ length: ROW_LEN }, () => ({ ch: sym(), word: null, bracket: null })),
    }));
  }

  function freeSpan(row, start, len) {
    for (let i = start; i < start + len; i++)
      if (row.cells[i].word !== null || row.cells[i].bracket !== null) return false;
    return true;
  }

  function placeWords() {
    words = shuffle(WORDS).slice(0, NUM_WORDS);
    password = words[rnd(words.length)];
    words.forEach((w, wi) => {
      for (let tries = 0; tries < 60; tries++) {
        const r = rnd(rows.length);
        const start = rnd(ROW_LEN - WORD_LEN + 1);
        if (!freeSpan(rows[r], start, WORD_LEN)) continue;
        for (let i = 0; i < WORD_LEN; i++) {
          rows[r].cells[start + i].ch = w[i];
          rows[r].cells[start + i].word = wi;
        }
        return;
      }
    });
  }

  function placeBrackets() {
    for (let bi = 0; bi < NUM_BRACKETS; bi++) {
      for (let tries = 0; tries < 80; tries++) {
        // mix of short and long bracket runs of random symbols
        const inner = Math.random() < 0.5 ? rnd(2) : 3 + rnd(6);   // 0-1 short, 3-8 long
        const len = inner + 2;
        if (len > ROW_LEN) continue;
        const r = rnd(rows.length);
        const start = rnd(ROW_LEN - len + 1);
        if (!freeSpan(rows[r], start, len)) continue;
        const pair = BRACKETS[rnd(BRACKETS.length)];
        const cells = rows[r].cells;
        cells[start].ch = pair[0];
        cells[start + len - 1].ch = pair[1];
        for (let i = 0; i < len; i++) cells[start + i].bracket = bi;
        break;
      }
    }
  }

  function generate() {
    rows = blankRows();
    placeWords();
    placeBrackets();
    MAX_ATTEMPTS = 1 + rnd(2);   // 1 or 2 attempts this round
    attempts = MAX_ATTEMPTS;
    removed = new Set();
    usedBrackets = new Set();
    solved = false; locked = false;
    lastRemoved = null; lastBracket = null;
    log = ['>WELCOME TO TERMLINK'];
  }

  // ---- rendering ---------------------------------------------------------
  function rowHTML(row) {
    let html = `<span class="addr">${row.addr}</span>`;
    let i = 0;
    while (i < ROW_LEN) {
      const c = row.cells[i];
      if (c.word !== null) {
        let j = i; while (j < ROW_LEN && row.cells[j].word === c.word) j++;
        if (removed.has(c.word)) {
          const flash = c.word === lastRemoved ? ' flash' : '';
          html += `<span class="dud${flash}">${'.'.repeat(j - i)}</span>`;
        } else {
          const text = row.cells.slice(i, j).map(x => x.ch).join('');
          html += `<span class="word" data-w="${c.word}">${esc(text)}</span>`;
        }
        i = j;
      } else if (c.bracket !== null) {
        let j = i; while (j < ROW_LEN && row.cells[j].bracket === c.bracket) j++;
        if (usedBrackets.has(c.bracket)) {
          // a used combo is consumed -> dotted out, just like a removed dud
          const flash = c.bracket === lastBracket ? ' flash' : '';
          html += `<span class="dud${flash}">${'.'.repeat(j - i)}</span>`;
        } else {
          const text = row.cells.slice(i, j).map(x => x.ch).join('');
          html += `<span class="bracket" data-b="${c.bracket}">${esc(text)}</span>`;
        }
        i = j;
      } else {
        // every other character is individually highlightable (so combos
        // don't stand out — you have to hover around to find them)
        html += `<span class="ch">${esc(c.ch)}</span>`;
        i++;
      }
    }
    return html;
  }

  function esc(s) {
    return s.replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  }

  function render() {
    // attempts blocks
    els.blocks.innerHTML =
      '<b>' + '■ '.repeat(attempts).trim() + '</b>' +
      '<i>' + ' □'.repeat(MAX_ATTEMPTS - attempts) + '</i>';

    // columns
    let cols = '';
    for (let c = 0; c < COLS; c++) {
      let col = '<div class="term-col">';
      for (let r = 0; r < ROWS_PER_COL; r++) {
        col += `<div class="term-row">${rowHTML(rows[c * ROWS_PER_COL + r])}</div>`;
      }
      cols += col + '</div>';
    }
    els.cols.innerHTML = cols;

    // log (latest at bottom, keep last 16)
    els.log.innerHTML = log.slice(-16).map(l => `<div>${esc(l)}</div>`).join('');
  }

  // ---- interaction -------------------------------------------------------
  function likeness(a, b) {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === b[i]) n++;
    return n;
  }

  function guess(wi) {
    if (solved || locked || removed.has(wi)) return;
    lastRemoved = null; lastBracket = null;
    const w = words[wi];
    log.push('>' + w);
    if (w === password) {
      solved = true;
      log.push('>EXACT MATCH!');
      log.push('>ACCESS GRANTED');
      els.status.textContent = 'ACCESS GRANTED';
      els.status.className = 'term-status win';
      render();
      onWin && onWin();
      return;
    }
    attempts--;
    log.push('>ENTRY DENIED');
    log.push(`>LIKENESS=${likeness(w, password)}/${WORD_LEN}`);
    if (attempts <= 0) {
      locked = true;
      log.push('>TERMINAL LOCKED');
      els.status.textContent = 'TERMINAL LOCKED';
      els.status.className = 'term-status fail';
      onFail && onFail();
    }
    render();
  }

  function useBracket(bi) {
    if (solved || locked || usedBrackets.has(bi)) return;
    usedBrackets.add(bi);
    lastBracket = bi;        // the combo itself is consumed -> dots
    lastRemoved = null;
    const duds = words.map((_, i) => i).filter(i => words[i] !== password && !removed.has(i));
    if ((attempts < MAX_ATTEMPTS && Math.random() < 0.25) || duds.length === 0) {
      attempts = MAX_ATTEMPTS;
      log.push('>ALLOWANCE REPLENISHED.');
    } else {
      lastRemoved = duds[rnd(duds.length)];
      removed.add(lastRemoved);
      log.push('>DUD REMOVED.');
    }
    render();
  }

  // ---- public ------------------------------------------------------------
  function init(elements, winCb, failCb) {
    els = elements;
    onWin = winCb;
    onFail = failCb;
    els.cols.addEventListener('click', e => {
      const w = e.target.closest('.word');
      if (w) { guess(+w.dataset.w); return; }
      const b = e.target.closest('.bracket');
      if (b) { useBracket(+b.dataset.b); }
    });
  }

  function newGame() {
    generate();
    els.status.textContent = 'AWAITING INPUT';
    els.status.className = 'term-status';
    render();
  }

  return { init, newGame };
})();
