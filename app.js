(function(){
  const frame = document.getElementById('frame');
  const canvas = document.getElementById('veil');
  const ctx = canvas.getContext('2d');
  const hint = frame.querySelector('.hint');
  const audio = document.getElementById('audio');
  const soundBtn = document.getElementById('soundBtn');
  const soundLabel = document.getElementById('soundLabel');
  const modeBtns = Array.prototype.slice.call(document.querySelectorAll('.mode-btn'));

  const helmet = new Image();
  let helmetReady = false;
  helmet.onload = function(){ helmetReady = true; };
  helmet.src = 'helmet.jpg';

  let w = 0, h = 0, dpr = 1;

  const mask = document.createElement('canvas');
  const mctx = mask.getContext('2d');

  function resize(){
    const rect = frame.getBoundingClientRect();
    const nw = Math.max(1, Math.round(rect.width));
    const nh = Math.max(1, Math.round(rect.height));
    const nd = window.devicePixelRatio || 1;
    if (nw === w && nh === h && nd === dpr) return;
    w = nw; h = nh; dpr = nd;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mask.width = canvas.width;
    mask.height = canvas.height;
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  // ---------------- режимы ----------------
  let mode = 'line';

  modeBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      mode = btn.dataset.mode;
      modeBtns.forEach(function(b){ b.classList.toggle('active', b === btn); });
      resetMarks();
    });
  });

  function resetMarks(){
    stamps.length = 0;
    mctx.clearRect(0, 0, w, h);
    lx = -9999; ly = -9999;
  }

  // ---------------- кисть ----------------
  const R_LINE = 0.068;   // радиус кисти (доля высоты)
  const LINE_LIFE = 170;  // мс — шлем возвращается почти сразу

  function brushR(){ return Math.max(13, h * R_LINE); }

  const stamps = [];
  let lx = -9999, ly = -9999;

  // спрайт: плотная середина + тоненький размытый край, без обводки
  let sprite = null;
  function makeSprite(){
    const S = 128;
    sprite = document.createElement('canvas');
    sprite.width = S;
    sprite.height = S;
    const c = sprite.getContext('2d');
    const g = c.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.86, 'rgba(255,255,255,1)');
    g.addColorStop(0.94, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.98, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(S/2, S/2, S/2, 0, Math.PI * 2);
    c.fill();
  }
  makeSprite();

  function addStamp(x, y, now){
    stamps.push({ x: x, y: y, born: now });
    if (stamps.length > 600) stamps.splice(0, stamps.length - 600);
  }

  function stampMask(x, y, r, alpha){
    mctx.globalAlpha = alpha;
    mctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    mctx.globalAlpha = 1;
  }

  // след «линии» — живёт мгновение
  function strokeLine(x, y){
    const r = brushR();
    const now = performance.now();
    if (lx < -9000){ lx = x; ly = y; addStamp(x, y, now); return; }
    const dx = x - lx, dy = y - ly;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = Math.max(4, r * 0.28);
    if (dist < step) return;
    const n = Math.floor(dist / step);
    for (let i = 1; i <= n; i++){
      const t = i / n;
      addStamp(lx + dx * t, ly + dy * t, now);
    }
    lx = x; ly = y;
  }

  // режим «стирание» — мазки остаются навсегда
  function strokeErase(x, y){
    const r = brushR() * 1.15;
    if (lx < -9000){ lx = x; ly = y; stampMask(x, y, r, 0.9); return; }
    const dx = x - lx, dy = y - ly;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = Math.max(4, r * 0.3);
    if (dist < step) return;
    const n = Math.floor(dist / step);
    for (let i = 1; i <= n; i++){
      const t = i / n;
      stampMask(lx + dx * t, ly + dy * t, r, 0.9);
    }
    lx = x; ly = y;
  }

  // ---------------- указатель ----------------
  let px = -9999, py = -9999;
  let hovering = false;
  let cx = 0, cy = 0;
  let started = false;

  function onPointer(e){
    const rect = frame.getBoundingClientRect();
    px = e.clientX - rect.left;
    py = e.clientY - rect.top;
    hovering = true;

    if (mode === 'line') strokeLine(px, py);
    else if (mode === 'erase') strokeErase(px, py);

    if (!started){ started = true; enableSound(); }
    if (hint) hint.style.opacity = '0';
  }

  frame.addEventListener('pointermove', onPointer);

  frame.addEventListener('pointerdown', function(e){
    lx = -9999; ly = -9999;
    onPointer(e);
  });

  frame.addEventListener('pointerleave', function(){
    hovering = false;
    lx = -9999; ly = -9999;
  });

  frame.addEventListener('pointerenter', function(){
    hovering = true;
  });

  // ---------------- звук из видео ----------------
  let soundOn = false;

  function enableSound(){
    if (soundOn) return;
    soundOn = true;
    try {
      audio.volume = 0.9;
      const p = audio.play();
      if (p && p.then) p.catch(function(){});
    } catch (err) {}
    soundBtn.classList.add('playing');
    soundLabel.textContent = 'выключить звук';
  }

  function disableSound(){
    soundOn = false;
    audio.pause();
    soundBtn.classList.remove('playing');
    soundLabel.textContent = 'включить звук';
  }

  soundBtn.addEventListener('click', function(){
    if (soundOn) disableSound(); else enableSound();
  });

  // ---------------- отрисовка ----------------
  function drawCircle(){
    if (!hovering || px < -9000) return;
    cx += (px - cx) * 0.28;
    cy += (py - cy) * 0.28;
    const r = Math.max(40, h * 0.165);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.86, 'rgba(0,0,0,1)');
    g.addColorStop(0.96, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawLine(now){
    const r = brushR();
    mctx.clearRect(0, 0, w, h);
    for (let i = stamps.length - 1; i >= 0; i--){
      if (now - stamps[i].born > LINE_LIFE) stamps.splice(i, 1);
    }
    for (let i = 0; i < stamps.length; i++){
      const s = stamps[i];
      const age = now - s.born;
      if (age >= LINE_LIFE) continue;
      const a = Math.pow(1 - age / LINE_LIFE, 1.25);
      stampMask(s.x, s.y, r, a);
    }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawErase(){
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  function draw(now){
    resize();
    if (cx === 0 && cy === 0){ cx = w * 0.5; cy = h * 0.36; }

    ctx.clearRect(0, 0, w, h);

    if (helmetReady && w > 2){
      ctx.drawImage(helmet, 0, 0, w, h);

      if (mode === 'line') drawLine(now);
      else if (mode === 'erase') drawErase();
      else drawCircle();
    }

    requestAnimationFrame(draw);
  }

  resize();
  requestAnimationFrame(draw);
})();
