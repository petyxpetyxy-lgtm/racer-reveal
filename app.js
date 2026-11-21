(function(){
  'use strict';

  var frame = document.getElementById('frame');
  var canvas = document.getElementById('veil');
  var ctx = canvas.getContext('2d');
  var hint = document.getElementById('hint');
  var audio = document.getElementById('audio');
  var soundBtn = document.getElementById('soundBtn');
  var soundLabel = document.getElementById('soundLabel');
  var modeBtns = Array.prototype.slice.call(document.querySelectorAll('.mode-btn[data-mode]'));
  var resetBtn = document.getElementById('resetBtn');
  var stage = document.getElementById('stage');
  var holder = document.getElementById('photoHolder');
  var spacer = document.getElementById('spacer');
  var sigsEl = document.getElementById('sigs');
  var cue = document.getElementById('cue');

  var helmet = new Image();
  var helmetReady = false;
  helmet.onload = function(){ helmetReady = true; };
  helmet.src = 'helmet.jpg';

  var w = 0, h = 0, dpr = 1;

  // маска: всё, что нарисовано кистью
  var mask = document.createElement('canvas');
  var mctx = mask.getContext('2d');

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
    mask.width = canvas.width;
    mask.height = canvas.height;
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  if (window.ResizeObserver) {
    new ResizeObserver(function(){ resize(); }).observe(frame);
  }
  window.addEventListener('resize', resize);

  // ---------------- режимы ----------------
  var mode = 'line';
  var HINTS = {
    line: 'води курсором по шлему',
    erase: 'води курсором — шлем стирается',
    wear: 'води курсором — шлем появляется'
  };

  modeBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      if (btn.dataset.mode === mode) return;
      mode = btn.dataset.mode;
      modeBtns.forEach(function(b){ b.classList.toggle('active', b === btn); });
      resetMarks();
      if (hint) hint.textContent = HINTS[mode] || HINTS.line;
    });
  });

  resetBtn.addEventListener('click', function(){
    resetMarks();
  });

  function resetMarks(){
    stamps.length = 0;
    mctx.clearRect(0, 0, w, h);
    lx = -9999; ly = -9999;
  }

  // ---------------- кисть ----------------
  var R_LINE = 0.068;
  var LINE_LIFE = 175;

  function brushR(){ return Math.max(13, h * R_LINE); }

  var stamps = [];
  var lx = -9999, ly = -9999;

  // тонкий размытый край, без обводки
  var sprite = (function(){
    var S = 128;
    var c = document.createElement('canvas');
    c.width = S; c.height = S;
    var g2 = c.getContext('2d');
    var g = g2.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.86, 'rgba(255,255,255,1)');
    g.addColorStop(0.94, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.98, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = g;
    g2.beginPath();
    g2.arc(S/2, S/2, S/2, 0, Math.PI * 2);
    g2.fill();
    return c;
  })();

  function addStamp(x, y, now){
    stamps.push({ x: x, y: y, born: now });
    if (stamps.length > 500) stamps.splice(0, stamps.length - 500);
  }

  function stampMask(x, y, r, alpha){
    mctx.globalAlpha = alpha;
    mctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    mctx.globalAlpha = 1;
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

  // линия: след живёт мгновение и сразу возвращается
  function strokeLine(x, y){
    var now = performance.now();
    eachStep(x, y, Math.max(4, brushR() * 0.28), function(sx, sy){
      addStamp(sx, sy, now);
    });
  }

  // остаётся / шлем появляется: мазки остаются до сброса
  function strokePaint(x, y){
    var r = brushR() * 1.1;
    eachStep(x, y, Math.max(4, r * 0.3), function(sx, sy){
      stampMask(sx, sy, r, 0.9);
    });
  }

  // ---------------- указатель ----------------
  var px = -9999, py = -9999;

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
    px = p.x; py = p.y;

    if (mode === 'line') strokeLine(px, py);
    else strokePaint(px, py);

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

  function enableSound(){
    if (soundOn) return;
    soundOn = true;
    try {
      audio.volume = 0.85;
      var p = audio.play();
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

  // первый жест пользователя запускает песню
  function firstGesture(e){
    if (soundBtn.contains(e.target)) return;
    enableSound();
    cleanup();
  }
  function cleanup(){
    ['pointerdown', 'touchstart', 'keydown'].forEach(function(ev){
      window.removeEventListener(ev, firstGesture);
    });
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function(ev){
    window.addEventListener(ev, firstGesture, { passive: true });
  });

  // ---------------- прокрутка ----------------
  var scrollTarget = 0, scrollP = 0, lastScale = -1;
  var debugCollage = location.hash === '#collage';

  function measureScroll(){
    var max = Math.max(1, spacer.offsetHeight - window.innerHeight);
    scrollTarget = Math.min(1, Math.max(0, window.scrollY / max));
    if (cue) cue.classList.toggle('hide', scrollTarget > 0.03);
  }
  window.addEventListener('scroll', measureScroll, { passive: true });
  window.addEventListener('resize', measureScroll);
  measureScroll();

  function easeInOut(t){
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function updateScroll(){
    if (debugCollage){
      holder.style.transform = 'scale(0.5)';
      stage.classList.add('collage');
      return;
    }

    scrollP += (scrollTarget - scrollP) * 0.12;
    if (Math.abs(scrollTarget - scrollP) < 0.0006) scrollP = scrollTarget;

    var t = Math.min(1, scrollP / 0.8);
    var s = 1 - 0.5 * easeInOut(t);
    if (Math.abs(s - lastScale) > 0.0005){
      holder.style.transform = 'scale(' + s.toFixed(4) + ')';
      lastScale = s;
    }
    stage.classList.toggle('collage', scrollP > 0.16);
  }

  // ---------------- росписи вокруг ----------------
  function buildSigs(){
    var N = 40;
    var seed = 20261120;
    function rnd(){
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    var frag = document.createDocumentFragment();
    var hues = ['#22ff8a', '#43ffa5', '#12e57c', '#8dffc4', '#2bff9c'];

    for (var i = 0; i < N; i++){
      var el = document.createElement('span');
      var big = (i < 4);
      el.className = 'sig' + (big ? ' sig-big' : '');
      el.textContent = 'Saraunh0ly';

      var x = 3 + rnd() * 94;
      var y = 4 + rnd() * 92;
      el.style.left = x.toFixed(2) + '%';
      el.style.top = y.toFixed(2) + '%';
      el.style.setProperty('--fs', (big ? (5.5 + rnd() * 3.2) : (1.5 + rnd() * 2.9)).toFixed(2) + 'vw');
      el.style.setProperty('--r', (-24 + rnd() * 48).toFixed(1) + 'deg');
      el.style.setProperty('--o', (big ? (0.10 + rnd() * 0.10) : (0.20 + rnd() * 0.52)).toFixed(2));
      el.style.setProperty('--i', String(i));
      el.style.setProperty('--hue', hues[Math.floor(rnd() * hues.length)]);
      frag.appendChild(el);
    }
    sigsEl.appendChild(frag);
  }
  buildSigs();

  // ---------------- отрисовка ----------------
  function rebuildLineMask(now){
    var r = brushR();
    mctx.clearRect(0, 0, w, h);
    for (var i = stamps.length - 1; i >= 0; i--){
      if (now - stamps[i].born > LINE_LIFE) stamps.splice(i, 1);
    }
    for (var j = 0; j < stamps.length; j++){
      var s = stamps[j];
      var age = now - s.born;
      if (age >= LINE_LIFE) continue;
      var a = Math.pow(1 - age / LINE_LIFE, 1.25);
      stampMask(s.x, s.y, r, a);
    }
  }

  function draw(now){
    resize();
    updateScroll();

    ctx.clearRect(0, 0, w, h);

    if (helmetReady && w > 2){
      if (mode === 'wear'){
        // наоборот: шлем появляется на лице
        ctx.drawImage(helmet, 0, 0, w, h);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mask, 0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        // шлем поверх лица, стираем по маске
        ctx.drawImage(helmet, 0, 0, w, h);
        if (mode === 'line') rebuildLineMask(now);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(mask, 0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    requestAnimationFrame(draw);
  }

  resize();
  requestAnimationFrame(draw);

  // отладочный якорь для скриншотов
  if (location.hash === '#scrolltest'){
    setTimeout(function(){
      window.scrollTo(0, (spacer.offsetHeight - window.innerHeight) * 0.9);
      setTimeout(function(){
        var r = stage.getBoundingClientRect();
        if (hint){
          hint.textContent = 'Y=' + Math.round(window.scrollY) +
            ' top=' + Math.round(r.top) +
            ' h=' + Math.round(r.height) +
            ' vh=' + window.innerHeight;
          hint.style.opacity = '1';
        }
      }, 700);
    }, 300);
  }
})();
