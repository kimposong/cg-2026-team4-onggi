// src/main.js — 시작: 공용 도구를 만들고, 렌더 루프를 돌리고, 입력을 지금 화면으로 전달한다
// 화면별 내용은 scenes/ 에 있다. 이 파일은 어느 화면인지 모른 채 Scenes.call 로 넘기기만 한다

(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl2', { antialias: true });

  if (!gl) {
    // 오류 상태: WebGL2를 못 쓰는 기기에서도 흰 화면 대신 안내를 보여 준다
    showFatal('이 기기에서는 3D 화면을 열 수 없어요.\n다른 브라우저(크롬·사파리 최신 버전)로 열어 주세요.');
    return;
  }

  /* ---------- 공용 도구 묶음 (모든 화면이 ctx 로 받는다) ---------- */
  const potShader = PotShader.create(gl);
  const ctx = {
    gl,
    W: 1, H: 1, s: 1,
    ui: UI.create(gl),
    potShader,
    wheel: Wheel.create(gl, potShader),
    // pot_main: 관람객이 직접 만드는 메인 옹기. 전시실의 박물관 옹기·다른 관람객 옹기와 구분하기 위한 이름
    // Pot.create 는 옹기를 만드는 공통 틀이라 전시실에서도 같은 틀로 여러 개를 만든다
    pot_main: Pot.create(gl, potShader.locs),
    go: (name, data) => Scenes.go(ctx, name, data),
  };

  const perf = { acc: 0, count: 0, shown: '' };

  /* ---------- 화면 크기 ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // 3배 화면은 2배로 제한 → 픽셀 계산량 절약
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.W = w; ctx.H = h; ctx.s = Math.min(w, h);
    gl.viewport(0, 0, w, h);
  }

  /* ---------- 입력 → 지금 화면 ---------- */
  Input.setup(canvas, {
    down: (x, y, type) => Scenes.call('down', ctx, x, y, type),
    move: (x, y, type) => Scenes.call('move', ctx, x, y, type),
    up: (x, y, type) => Scenes.call('up', ctx, x, y, type),
    hover: (x, y) => Scenes.call('hover', ctx, x, y),
  });

  /* ---------- 렌더 루프 ---------- */
  let last = performance.now();
  function frame(now) {
    const ms = now - last;
    const dt = Math.min(ms / 1000, 0.05); // 탭을 다시 열었을 때 한 번에 크게 튀지 않게
    trackFrameTime(ms);
    last = now;

    resize();
    gl.clearColor(0.165, 0.13, 0.11, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    Scenes.call('update', ctx, dt);
    Scenes.call('draw', ctx);

    ctx.ui.begin(ctx.W, ctx.H);
    Scenes.call('drawUI', ctx);
    // 프레임 시간 (성능 측정, 12주차 기준 16.7ms 이하) — 모든 화면 공통
    ctx.ui.drawText(ctx.ui.dynText('ms', perf.shown), ctx.W - ctx.s * 0.03, ctx.s * 0.03, ctx.s * 0.03, 'right', Infinity, [1, 1, 1, 0.5]);

    requestAnimationFrame(frame);
  }

  // 0.5초마다 평균 프레임 시간을 갱신해 표시한다
  function trackFrameTime(ms) {
    perf.acc += ms; perf.count++;
    if (perf.acc > 500) {
      perf.shown = `${(perf.acc / perf.count).toFixed(1)} ms/frame`;
      perf.acc = 0; perf.count = 0;
    }
  }

  function showFatal(msg) {
    const c2 = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    c2.fillStyle = '#2a211c';
    c2.fillRect(0, 0, canvas.width, canvas.height);
    c2.fillStyle = '#fff';
    c2.textAlign = 'center';
    c2.font = `${18 * dpr}px sans-serif`;
    msg.split('\n').forEach((line, i) => c2.fillText(line, canvas.width / 2, canvas.height / 2 + i * 28 * dpr));
  }

  resize();
  // 지금은 4단계만 만들어져 있으므로 바로 4단계로 시작한다. 시작 화면이 완성되면 'start' 로 바꾼다
  Scenes.go(ctx, 'stage1-knead');
  requestAnimationFrame(frame);
})();
