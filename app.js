(function(){
  'use strict';

  var frame = document.getElementById('frame');
  var canvas = document.getElementById('veil');
  var ctx = canvas.getContext('2d');
  var hint = document.querySelector('.hint');
  var audio = document.getElementById('audio');
  var soundBtn = document.getElementById('soundBtn');
  var soundLabel = document.getElementById('soundLabel');

  var helmet = new Image();
  var helmetReady = false;
  helmet.onload = function(){ helmetReady = true; };
  helmet.src = 'helmet.jpg';

  var w = 0, h = 0, dpr = 1;

  // mask: everything erased by cursor stays erased (but we'll do instant-return mode)
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
  window.addEventListener('resize', resize);

  // -------- режим: линия (сразу возвращается) ----------
  var R_LINE = 0.068;
  var LINE_LIFE = 180; // мс — след исчезает почти сразу за курсором

  var brushR = function(){ return Math.max(12, h * R_LINE); };

  // stamps: {x, y, born}
  var stamps = [];
  var lx = -9999, ly = -9999;

  // спрайт кисти: плотная середина, тоненький размытый край, без обводки
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
    stamps.push({x:x, y:y, born:now});
    if (stamps.length > 500) stamps.splice(0, stamps.length - 500);
  }

  function stampMask(x, y, r, a){
    mctx.globalAlpha = a;
    mctx.drawImage(sprite, x-r, y-r, r*2, r*2);
    mctx.globalAlpha = 1;
  }

  function eachStep(x, y, step, fn){
    if (lx < -9000){
      lx = x; ly = y;
      fn(x, y);
      return;
    }
    var dx = x - lx, dy = y - ly;
    var dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < step) return;
    var n = Math.floor(dist / step);
    for (var i = 1; i <= n; i++){
      var t = i / n;
      fn(lx + dx*t, ly + dy*t);
    }
    lx = x; ly = y;
  }

  function strokeLine(x, y){
    var now = performance.now();
    eachStep(x, y, Math.max(4, brushR()*0.28), function(sx, sy){
      addStamp(sx, sy, now);
    });
  }

  // -------- звук --------
  var soundOn = false;
  var triedMoveSound = false;

  function enableSound(){
    if (soundOn) return;
    soundOn = true;
    try {
      audio.volume = 0.85;
      var p = audio.play();
      if (p && p.then) p.then(function(){}).catch(function(){});
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

  soundBtn.onclick = function(){
    if (soundOn) disableSound(); else enableSound();
  };

  // первый жест/клик запускает звук
  function tryStartSound(){
    if (!triedMoveSound){
      triedMoveSound = true;
      enableSound();
    }
  }

  // -------- указатель --------
  var px = -9999, py = -9999;

  function localPoint(e){
    var rect = frame.getBoundingClientRect();
    var sx = w / Math.max(1, rect.width);
    var sy = h / Math.max(1, rect.height);
    return {x: (e.clientX - rect.left)*sx, y: (e.clientY - rect.top)*sy};
  }

  function onPointer(e){
    var p = localPoint(e);
    px = p.x; py = p.y;

    // если звук ещё не стартанул — пробуем здесь
    tryStartSound();

    if (mode === 'line') strokeLine(px, py);
    // mode 'erase' etc could be added later

    if (hint) hint.style.opacity = '0';
  }

  frame.addEventListener('pointermove', onPointer);
  frame.addEventListener('pointerdown', function(){
    lx = -9999; ly = -9999;
    onPointer();
  });
  frame.addEventListener('pointerleave', function(){
    lx = -9999; ly = -9999;
  });

  // -------- роспись Saraunh0ly (появляется после первого действия) --------
  var sigAppeared = false;
  var sigEl = document.querySelector('.signature');
  var originalHint = hint ? hint.textContent : '';

  // когда пользователь взаимодействует — показываем подпись полной мощью
  function maybeAppearSig(){
    if (sigAppeared) return;
    // если курсор уже двигали — сразу показываем
    if (triedMoveSound || px > -9000){
      sigAppeared = true;
      if (sigEl) sigEl.style.opacity = '1';
      if (hint) hint.style.opacity = '0';
      return;
    }
    // иначе оставим hint, дадим время
    setTimeout(maybeAppearSig, 200);
  }

  // старт отслеживания
  ['pointerdown','touchstart','mousedown'].forEach(function(ev){
    window.addEventListener(ev, maybeAppearSig, {passive:true});
  });

  // -------- отрисовка --------
  function brushR(){ return Math.max(12, h * R_LINE); }

  function rebuildLineMask(now){
    var r = brushR();
    mctx.clearRect(0,0,w,h);
    for (var i = stamps.length-1; i >= 0; i--){
      if (now - stamps[i].born > LINE_LIFE) stamps.splice(i, 1);
    }
    for (var j = 0; j < stamps.length; j++){
      var s = stamps[j];
      var age = now - s.born;
      if (age >= LINE_LIFE) continue;
      var a = Math.pow(1 - age/LINE_LIFE, 1.25);
      stampMask(s.x, s.y, r, a);
    }
  }

  function draw(now){
    resize();
    ctx.clearRect(0,0,w,h);

    if (helmetReady && w > 2){
      ctx.drawImage(helmet, 0, 0, w, h);
      if (mode === 'line') rebuildLineMask(now);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mask, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    requestAnimationFrame(draw);
  }

  resize();
  requestAnimationFrame(draw);

})();