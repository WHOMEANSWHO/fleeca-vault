/* ===========================================================
   Matrix-rain backdrop for the landing page.
   Pauses when the tab is hidden; honours reduced-motion.
   =========================================================== */
(() => {
  const canvas = document.getElementById('matrix');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  const FONT = 15;
  const CHARS = 'アカサタナハマヤラ0123456789ABCDEF#$%*+-<>/\\='.split('');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cols, drops, raf = 0, last = 0;

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    cols = Math.ceil(canvas.width / FONT);
    drops = Array.from({ length: cols }, () => Math.random() * -60);
    if (reduced) { staticFrame(); }
  }

  function step() {
    ctx.fillStyle = 'rgba(2, 8, 4, 0.09)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = FONT + 'px Consolas, monospace';
    for (let i = 0; i < cols; i++) {
      const ch = CHARS[(Math.random() * CHARS.length) | 0];
      const y = drops[i] * FONT;
      ctx.fillStyle = Math.random() < 0.03 ? '#d6ffdf' : 'rgba(57, 255, 91, 0.5)';
      ctx.fillText(ch, i * FONT, y);
      if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 1;
    }
  }

  // reduced-motion: a single calm static frame, no animation
  function staticFrame() {
    ctx.fillStyle = '#020804';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = FONT + 'px Consolas, monospace';
    ctx.fillStyle = 'rgba(57,255,91,0.18)';
    for (let i = 0; i < cols; i++)
      for (let y = (Math.random() * 6 | 0); y * FONT < canvas.height; y += 3 + (Math.random() * 4 | 0))
        ctx.fillText(CHARS[(Math.random() * CHARS.length) | 0], i * FONT, y * FONT);
  }

  function loop(t) {
    if (t - last > 55) { last = t; step(); }   // ~18fps
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!reduced && !raf) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

  resize();
  start();
})();
