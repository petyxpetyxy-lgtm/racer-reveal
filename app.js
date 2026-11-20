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
  }
  window.addEventListener('resize', resize);

  // состояние
  let tx = 0, ty = 0;      // цель
  let cx = 0, cy = 0;      // текущий центр
  let tr = 0, cr = 0;      // радиус: цель / текущий
  let follow = false;

  function radiusBase(){ return h * 0.235; }

  function onPointer(e){
    const rect = frame.getBoundingClientRect();
    tx = e.clientX - rect.left;
    ty = e.clientY - rect.top;
    follow = true;
    if (!started){
      started = true;
      enableSound();
    }
    if (hint) hint.style.opacity = '0';
  }
  frame.addEventListener('pointermove', onPointer);
  frame.addEventListener('pointerdown', onPointer);
  frame.addEventListener('pointerleave', function(){ follow = false; });

  // звук из видео
  let soundOn = false;
  let started = false;
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

  // отрисовка
  const startTs = performance.now();
  let first = true;

  function draw(now){
    const t = (now - startTs) / 1000;

    if (first){
      resize();
      cx = tx = w * 0.5;
      cy = ty = h * 0.36;
      cr = tr = radiusBase() * 0.6;
      first = false;
    }

    if (!follow){
      // авто-демо: мягко дышит над визором
      tx = w * 0.5 + Math.sin(t * 0.9) * w * 0.055;
      ty = h * 0.355 + Math.sin(t * 0.63 + 1.2) * h * 0.035;
      tr = radiusBase() * (0.80 + 0.16 * Math.sin(t * 1.15));
    } else {
      tr = radiusBase();
    }

    cx += (tx - cx) * 0.16;
    cy += (ty - cy) * 0.16;
    cr += (tr - cr) * 0.12;

    ctx.clearRect(0, 0, w, h);

    if (helmetReady && w > 2){
      // шлем поверх лица
      ctx.drawImage(helmet, 0, 0, w, h);

      // «проявление лица» — мягкое отверстие под курсором
      const r = Math.max(1, cr);
      ctx.globalCompositeOperation = 'destination-out';
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.62, 'rgba(0,0,0,1)');
      grad.addColorStop(0.86, 'rgba(0,0,0,0.45)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // зелёный контур-«сканер»
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(34,255,138,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.97, 0, Math.PI * 2);
      ctx.stroke();

      // мягкое свечение к краю
      const glow = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.25);
      glow.addColorStop(0, 'rgba(34,255,138,0.10)');
      glow.addColorStop(1, 'rgba(34,255,138,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  resize();
  requestAnimationFrame(draw);
})();
