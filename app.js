(function(){
  const frame = document.getElementById('frame');
  const canvas = document.getElementById('veil');
  const ctx = canvas.getContext('2d');
  const hint = frame.querySelector('.hint');
  const audio = document.getElementById('audio');
  const soundBtn = document.getElementById('soundBtn');
  const soundLabel = document.getElementById('soundLabel');

  const helmet = new Image();
  let helmetReady = false;
  helmet.onload = function(){ helmetReady = true; };
  helmet.src = 'helmet.jpg';

  let w = 0, h = 0, dpr = 1;

  // отдельный canvas-маска для кисти
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

  // --- кисть ---
  function brushR(){ return Math.max(16, h * 0.075); }
  const LIFE = 1500;          // время жизни мазка, мс
  const MAX_STAMPS = 420;
  const stamps = [];
  let lx = -9999, ly = -9999;

  function addStamp(x, y, now){
    stamps.push({ x: x, y: y, born: now });
    if (stamps.length > MAX_STAMPS) stamps.splice(0, stamps.length - MAX_STAMPS);
  }

  function strokeTo(x, y, now){
    const r = brushR();
    if (lx < -9000){ lx = x; ly = y; addStamp(x, y, now); return; }
    const dx = x - lx, dy = y - ly;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const step = Math.max(6, r * 0.33);
    if (dist < step) return;
    const n = Math.floor(dist / step);
    for (let i = 1; i <= n; i++){
      const t = i / n;
      addStamp(lx + dx * t, ly + dy * t, now);
    }
    lx = x; ly = y;
  }

  // спрайт кисти: мягкие размытые края, без обводки
  let sprite = null;
  function makeSprite(){
    const S = 128;
    sprite = document.createElement('canvas');
    sprite.width = S; sprite.height = S;
    const c = sprite.getContext('2d');
    const g = c.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.97)');
    g.addColorStop(0.68, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.86, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(S/2, S/2, S/2, 0, Math.PI*2);
    c.fill();
  }
  makeSprite();

  // --- ввод ---
  let lastUser = -9999;
  let started = false;
  let demoStarted = false;

  function onPointer(e){
    const rect = frame.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    strokeTo(x, y, performance.now());
    lastUser = performance.now();
    if (!started){ started = true; enableSound(); }
    if (hint) hint.style.opacity = '0';
  }
  frame.addEventListener('pointermove', onPointer);
  frame.addEventListener('pointerdown', function(e){
    lx = -9999; ly = -9999;
    onPointer(e);
  });
  frame.addEventListener('pointerleave', function(){ lx = -9999; ly = -9999; });

  // --- звук ---
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

  // --- цикл отрисовки ---
  const startTs = performance.now();

  function draw(now){
    resize();

    // авто-демо, пока пользователь не двигает 2.5с
    if (now - lastUser > 2500){
      const t = (now - startTs) / 1000;
      const x = w * (0.5 + 0.17 * Math.sin(t * 0.5));
      const y = h * (0.36 + 0.07 * Math.sin(t * 0.85 + 1.2));
      if (!demoStarted){ demoStarted = true; lx = x; ly = y; }
      strokeTo(x, y, now);
    } else {
      demoStarted = false;
    }

    ctx.clearRect(0, 0, w, h);

    if (helmetReady && w > 2){
      ctx.drawImage(helmet, 0, 0, w, h);

      // маска кисти
      mctx.clearRect(0, 0, w, h);
      const r = brushR();
      for (let i = stamps.length - 1; i >= 0; i--){
        if (now - stamps[i].born > LIFE) stamps.splice(i, 1);
      }
      for (let i = 0; i < stamps.length; i++){
        const s = stamps[i];
        let a = 1 - (now - s.born) / LIFE;
        if (a <= 0) continue;
        a = Math.pow(a, 1.35);
        mctx.globalAlpha = a;
        mctx.drawImage(sprite, s.x - r, s.y - r, r * 2, r * 2);
      }
      mctx.globalAlpha = 1;

      // вырезаем шлем по маске — мягко
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mask, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    requestAnimationFrame(draw);
  }

  resize();
  requestAnimationFrame(draw);
})();
