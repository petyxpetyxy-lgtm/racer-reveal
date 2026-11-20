(function(){
  const img = document.getElementById('racer');
  const cvs = document.getElementById('reveal');
  const ctx = cvs.getContext('2d', { alpha: true });
  const pulse = document.createElement('div');
  pulse.className = 'pulse';
  document.querySelector('.stage').appendChild(pulse);

  let dpr = window.devicePixelRatio || 1;
  let rect = { l:0,t:0,w:0,h:0 };
  let mx = -9999, my = -9999;       // target (mouse)
  let lx = -9999, ly = -9999;       // lerped (visual)
  let active = false;

  function resize(){
    rect = img.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    cvs.width = Math.max(1, Math.round(rect.w * dpr));
    cvs.height = Math.max(1, Math.round(rect.h * dpr));
    cvs.style.width = rect.w + 'px';
    cvs.style.height = rect.h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  img.addEventListener('load', resize);
  resize();

  function onMove(e){
    if (!rect.w) return;
    active = true;
    mx = e.clientX - rect.left;
    my = e.clientY - rect.top;
    // clamp inside image
    mx = Math.max(0, Math.min(rect.w, mx));
    my = Math.max(0, Math.min(rect.h, my));
    pulse.style.left = (rect.left + mx) + 'px';
    pulse.style.top = (rect.top + my) + 'px';
    pulse.style.opacity = '1';
  }
  document.querySelector('.stage').addEventListener('mousemove', onMove);
  document.querySelector('.stage').addEventListener('mouseleave', function(){
    active = false;
    pulse.style.opacity = '0';
  });

  // smooth follow
  function lerp(a,b,t){ return a + (b-a)*t; }

  const RADIUS = 110;
  function draw(){
    lx = lerp(lx, mx, 0.18);
    ly = lerp(ly, my, 0.18);

    ctx.clearRect(0, 0, rect.w, rect.h);

    // "шлемный" покров: тёмный холодный voile над фото
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(6, 14, 22, 0.72)';
    ctx.fillRect(0, 0, rect.w, rect.h);
    // чуть более темная зона в области лица (шлем), чтобы проявление было заметнее
    const grad = ctx.createRadialGradient(rect.w*0.5, rect.h*0.34, 0, rect.w*0.5, rect.h*0.34, rect.w*0.55);
    grad.addColorStop(0, 'rgba(2,6,12,0.55)');
    grad.addColorStop(1, 'rgba(2,6,12,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, rect.w, rect.h);

    // отверстие — лицо проявляется под курсором
    ctx.globalCompositeOperation = 'destination-out';
    const hole = ctx.createRadialGradient(lx, ly, 0, lx, ly, RADIUS);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(lx, ly, RADIUS, 0, Math.PI*2);
    ctx.fill();

    // мягкое свечение по краю отверстия
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(34, 255, 138, 0.18)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(lx, ly, RADIUS + 6, 0, Math.PI*2);
    ctx.stroke();

    requestAnimationFrame(draw);
  }
  draw();

  // 初始ная позиция в центре лица (примерно)
  if (rect.w && rect.h) {
    mx = rect.w * 0.5; my = rect.h * 0.38;
    lx = mx; ly = my;
  }

})();
