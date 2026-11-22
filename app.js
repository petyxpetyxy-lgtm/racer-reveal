(function(){
  'use strict';

  var frame = document.getElementById('frame');
  var canvas = document.getElementById('veil');
  var ctx = canvas.getContext('2d');
  var stage = document.getElementById('stage');
  var hint = document.getElementById('hint');
  var sigsEl = document.getElementById('sigs');
  var cue = document.getElementById('cue');
  var audio = document.getElementById('audio');
  var soundBtn = document.getElementById('soundBtn');
  var soundLabel = document.getElementById('soundLabel');
  var modeBtns = Array.prototype.slice.call(document.querySelectorAll('.mode-btn[data-mode]'));
  var resetBtn = document.getElementById('resetBtn');

  var helmet = new Image();
  var helmetReady = false;
  helmet.onload = function(){ helmetReady = true; };
  helmet.src = 'helmet.jpg';

  var face = new Image();
  var faceReady = false;
  face.onload = function(){ faceReady = true; };
  face.src = 'face.jpg';

  var FACE_W = 1280, FACE_H = 698;

  var w = 0, h = 0, dpr = 1;

  function resize(){
    var nw = frame.clientWidth;
    var nh = frame.clientHeight;
    var nd = Math.min(2, window.devicePixelRatio || 1);
    if (nw < 2 || nh < 2) return;
    if (nw === w && nh === h && nd === dpr) return;
    w = nw; h = nh; dpr = nd;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render(performance.now());
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(function(){ resize(); }).observe(frame);

  // ---------------- режимы ----------------
  var mode = 'line';

  modeBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      if (btn.dataset.mode === mode) return;
      mode = btn.dataset.mode;
      modeBtns.forEach(function(b){ b.classList.toggle('active', b === btn); });
      resetMarks();
    });
  });

  resetBtn.addEventListener('click', function(){ resetMarks(); });

  function resetMarks(){
    lineStamps.length = 0;
    paintStamps.length = 0;
    lx = -9999; ly = -9999;
    render(performance.now());
  }

  // ---------------- кисть ----------------
  var R_LINE = 0.072;
  var LINE_LIFE = 200;

  function brushR(){ return Math.max(13, h * R_LINE); }

  var lineStamps = [];
  var paintStamps = [];
  var lx = -9999, ly = -9999;

  // мягкий шарик: плотный центр и растушёванный край
  var sprite = (function(){
    var S = 128;
    var c = document.createElement('canvas');
    c.width = S; c.height = S;
    var g2 = c.getContext('2d');
    var g = g2.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.80, 'rgba(255,255,255,1)');
    g.addColorStop(0.92, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.97, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = g;
    g2.beginPath();
    g2.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    g2.fill();
    return c;
  })();

  function addLine(x, y){
    lineStamps.push({ x: x, y: y, born: performance.now() });
    if (lineStamps.length > 700) lineStamps.splice(0, lineStamps.length - 700);
  }

  function addPaint(x, y){
    paintStamps.push({ x: x, y: y });
    if (paintStamps.length > 1600) paintStamps.splice(0, paintStamps.length - 1600);
  }

  function eachStep(x, y, step, fn){
    if (lx < -9000){
      lx = x; ly = y;
      fn(x, y);
      return;
    }
    var dx = x - lx, dy = y - ly;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < step) return;
    var n = Math.floor(dist / step);
    for (var i = 1; i <= n; i++){
      var t = i / n;
      fn(lx + dx * t, ly + dy * t);
    }
    lx = x; ly = y;
  }

  // ---------------- указатель ----------------
  function localPoint(e){
    var rect = frame.getBoundingClientRect();
    var sx = w / Math.max(1, rect.width);
    var sy = h / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy
    };
  }

  function onPointer(e){
    var p = localPoint(e);
    if (mode === 'line'){
      eachStep(p.x, p.y, Math.max(4, brushR() * 0.26), addLine);
    } else if (mode === 'erase'){
      eachStep(p.x, p.y, Math.max(4, brushR() * 0.30), addPaint);
    } else {
      eachStep(p.x, p.y, Math.max(4, brushR() * 0.34), addPaint);
    }
    if (hint) hint.style.opacity = '0';
  }

  frame.addEventListener('pointermove', onPointer);
  frame.addEventListener('pointerdown', function(e){
    lx = -9999; ly = -9999;
    onPointer(e);
  });
  frame.addEventListener('pointerleave', function(){
    lx = -9999; ly = -9999;
  });

  // ---------------- звук ----------------
  var soundOn = false;
  var userMuted = false;

  function updateSoundUI(){
    soundBtn.classList.toggle('playing', soundOn);
    soundLabel.textContent = soundOn ? 'выключить звук' : 'включить звук';
  }

  function enableSound(){
    if (soundOn) return;
    soundOn = true;
    var p = null;
    try {
      audio.volume = 0.85;
      p = audio.play();
    } catch (err) { p = null; }

    if (p && p.then){
      p.then(updateSoundUI).catch(function(){
        soundOn = false;
        updateSoundUI();
      });
    }
    updateSoundUI();
  }

  function disableSound(){
    soundOn = false;
    userMuted = true;
    try { audio.pause(); } catch (err) {}
    updateSoundUI();
  }

  soundBtn.addEventListener('click', function(){
    if (soundOn) disableSound();
    else { userMuted = false; enableSound(); }
  });

  // автозапуск один раз: по клику/тапу/клавише (кнопку звука не трогаем)
  function firstGesture(e){
    if (soundBtn.contains(e.target)) return;
    if (!userMuted && !soundOn) enableSound();
  }
  window.addEventListener('pointerdown', firstGesture, { passive: true });
  window.addEventListener('touchstart', firstGesture, { passive: true });
  window.addEventListener('keydown', firstGesture);

  // ---------------- росписи после первого прокрута ----------------
  var revealed = false;

  function revealSigs(){
    if (revealed) return;
    revealed = true;
    stage.classList.add('revealed');
    if (cue) cue.classList.add('hide');
  }

  window.addEventListener('wheel', revealSigs, { passive: true });
  window.addEventListener('touchmove', revealSigs, { passive: true });
  window.addEventListener('keydown', function(e){
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') revealSigs();
  });
  window.addEventListener('scroll', function(){
    if (window.scrollY > 20) revealSigs();
  }, { passive: true });

  function buildSigs(){
    var N = 30;
    var seed = 20261120;
    function rnd(){
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    var hues = ['#12a150', '#1fae54', '#27c463', '#0e7a3c', '#2fbf63'];
    var frag = document.createDocumentFragment();

    for (var i = 0; i < N; i++){
      var el = document.createElement('span');
      var big = i < 6;
      var ang = (i / N) * Math.PI * 2 + rnd() * 0.6;

      // кольцо вокруг фото: подальше от центра, чтобы росписи было видно
      var rx = big ? (30 + rnd() * 16) : (31 + rnd() * 16);
      var ry = big ? (30 + rnd() * 14) : (30 + rnd() * 15);

      el.className = 'sig' + (big ? ' sig-big' : '');
      el.textContent = 'Saraunh0ly';
      el.style.left = (50 + Math.cos(ang) * rx).toFixed(2) + '%';
      el.style.top = (50 + Math.sin(ang) * ry).toFixed(2) + '%';
      el.style.setProperty('--fs', (big ? (4.6 + rnd() * 3.2) : (1.7 + rnd() * 1.9)).toFixed(2) + 'vw');
      el.style.setProperty('--r', (-26 + rnd() * 52).toFixed(1) + 'deg');
      el.style.setProperty('--o', (big ? (0.20 + rnd() * 0.14) : (0.45 + rnd() * 0.45)).toFixed(2));
      el.style.setProperty('--hue', hues[Math.floor(rnd() * hues.length)]);
      el.style.setProperty('--d', String(i * 32) + 'ms');
      frag.appendChild(el);
    }
    sigsEl.appendChild(frag);
  }
  buildSigs();

  // ---------------- отрисовка ----------------
  function drawFace(){
    if (!faceReady) return;
    var s = Math.max(w / FACE_W, h / FACE_H);
    var dw = FACE_W * s;
    var dh = FACE_H * s;
    ctx.drawImage(face, (w - dw) / 2, 0, dw, dh);
  }

  function render(now){
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (w < 2 || h < 2) return;

    var r = brushR();

    if (mode === 'wear'){
      // сначала лицо, потом шлем только в стёртых местах
      drawFace();
      if (helmetReady && paintStamps.length){
        ctx.save();
        ctx.beginPath();
        for (var i = 0; i < paintStamps.length; i++){
          var ps = paintStamps[i];
          var pr = r * 1.05;
          ctx.moveTo(ps.x + pr, ps.y);
          ctx.arc(ps.x, ps.y, pr, 0, Math.PI * 2);
        }
        ctx.clip();
        ctx.drawImage(helmet, 0, 0, w, h);
        ctx.restore();
      }
      return;
    }

    if (!helmetReady) return;
    ctx.drawImage(helmet, 0, 0, w, h);

    // стираем шлем в местах мазков
    ctx.globalCompositeOperation = 'destination-out';

    if (mode === 'line'){
      for (var k = lineStamps.length - 1; k >= 0; k--){
        if (now - lineStamps[k].born > LINE_LIFE) lineStamps.splice(k, 1);
      }
      for (var j = 0; j < lineStamps.length; j++){
        var s = lineStamps[j];
        var age = now - s.born;
        if (age >= LINE_LIFE) continue;
        var a = Math.pow(1 - age / LINE_LIFE, 1.2);
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, s.x - r, s.y - r, r * 2, r * 2);
      }
    } else {
      ctx.globalAlpha = 0.9;
      for (var p = 0; p < paintStamps.length; p++){
        var st = paintStamps[p];
        ctx.drawImage(sprite, st.x - r, st.y - r, r * 2, r * 2);
      }
    }

    ctx.globalAlpha = 1;

    // в стёртые места подкладываем лицо
    ctx.globalCompositeOperation = 'destination-over';
    drawFace();
    ctx.globalCompositeOperation = 'source-over';
  }

  function loop(now){
    resize();
    render(now);
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);

  // ---------------- тестовые хеши (для проверки без курсора) ----------------
  if (location.hash === '#reveal'){
    setTimeout(revealSigs, 400);
  }
  if (location.hash === '#paint'){
    setTimeout(function(){
      mode = 'erase';
      var r = brushR() * 1.05;
      for (var i = 0; i <= 40; i++){
        var t = i / 40;
        var x = w * (0.30 + 0.40 * t);
        var y = h * (0.50 - Math.sin(t * Math.PI) * 0.16);
        paintStamps.push({ x: x, y: y });
      }
      render(performance.now());
    }, 500);
  }
  if (location.hash === '#line'){
    setTimeout(function(){
      for (var i = 0; i <= 40; i++){
        var t = i / 40;
        var x = w * (0.30 + 0.40 * t);
        var y = h * (0.50 - Math.sin(t * Math.PI) * 0.16);
        lineStamps.push({ x: x, y: y, born: performance.now() + 100000 });
      }
      render(performance.now());
    }, 500);
  }
})();
