// src/scenes/stage4-shape.js — 4단계: 옹기 빚기
// 6구간 반지름(가로 원판)과 높이(세로 축)를 드래그로 조절. 카메라는 옹기 중심을 기준으로 상하좌우 회전

(() => {
  const { mat4 } = glMatrix;

  /* ---------- 4단계 전용: 반투명 가이드 판 셰이더 (구간 원판·높이 축) ---------- */
  const GUIDE_VS = `#version 300 es
  in vec3 aPos;
  in vec2 aUV;
  uniform mat4 uModel, uView, uProj;
  out vec2 vUV;
  void main() {
    vUV = aUV;
    gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
  }`;

  const GUIDE_FS = `#version 300 es
  precision mediump float;
  in vec2 vUV;
  uniform vec4 uColor;
  uniform float uEdge;   // 1이면 원판: 가장자리(v→1)를 밝게 그려 고리처럼 보이게
  out vec4 outColor;
  void main() {
    vec3 c = uColor.rgb;
    float a = uColor.a;
    if (uEdge > 0.5) {
      float e = smoothstep(0.82, 1.0, vUV.y);   // 원판 단면에서 v는 중심(0) → 가장자리(1)
      c = mix(c, vec3(1.0), e * 0.5);
      a = mix(a, min(1.0, a * 3.5), e);
    }
    outColor = vec4(c, a);
  }`;

  const RING_GAP = 0.05;   // 원판은 옹기 표면보다 살짝 크게 → 가장자리 고리가 옹기 밖으로 보인다
  const AXIS_WIDTH = 0.07; // 높이 축 판의 폭
  const KNOB_LIFT = 0.16;  // 높이 손잡이는 입구보다 이만큼 위에

  const PICK = [1.0, 0.75, 0.42];   // 선택 색
  const IDLE = [0.85, 0.9, 1.0];    // 기본 가이드 색

  /* ---------- 4단계 카메라 설정 (core/camera.js 는 도구만, 값은 여기서 정한다) ---------- */
  const CAM = {
    FOVY: (40 * Math.PI) / 180,
    PITCH_START: (12 * Math.PI) / 180,   // 처음에는 거의 옆에서 본다
    PITCH_MIN: (-30 * Math.PI) / 180,    // 아래에서 올려다보는 한계
    PITCH_MAX: (80 * Math.PI) / 180,     // 위에서 내려다보는 한계 (90°에 닿으면 화면이 뒤집힌다)
    ROT_SPEED: Math.PI,                  // 화면 폭(또는 높이)만큼 밀면 반 바퀴
  };

  // 화면 상태 — 이 단계 안에서만 쓴다
  let gres = null;                       // 가이드 셰이더·메시 (처음 들어올 때 한 번 만든다)
  const cam = Camera.createOrbit();
  const camCfg = { yaw: 0, pitch: CAM.PITCH_START, target: [0, 0.65, 0], dist: 4, fovy: CAM.FOVY };
  const m = mat4.create();               // 가이드 모델 행렬 (재사용)

  const st = {
    selected: 2,           // 선택한 대상: 0~5 = 구간, 'height' = 높이 축, null = 없음
    drag: null,            // { kind: 'band' | 'height' | 'rotate', side, lastX, lastY }
    hover: null,
    cursor: { x: 0, y: 0, visible: false, grab: false },
    bands: [],             // 구간별 화면 정보 { cx, cy, a, b, pxPerUnit }  (원판이 화면에 그려지는 타원)
    axis: null,            // 높이 축 화면 정보 { x, top, bottom, knobX, knobY, pxPerUnitY }
    buttons: [],
    toastUntil: 0,
  };

  function initResources(gl) {
    const prog = Program.create(gl, GUIDE_VS, GUIDE_FS);
    gres = {
      prog,
      disk: Mesh.uploadMesh(gl, Mesh.createRevolution(Mesh.diskProfile(1, 0, 8), 64), prog.locs),
      quad: Mesh.uploadMesh(gl, Mesh.quadMesh(), prog.locs),
    };
  }

  /** i번 원판의 모델 행렬: 높이 y로 옮기고, 반지름 r만큼 x·z로 늘린다 */
  function diskModel(y, r) {
    mat4.fromTranslation(m, [0, y, 0]);
    mat4.scale(m, m, [r + RING_GAP, 1, r + RING_GAP]);
    return m;
  }

  /** 높이 축 판: 항상 카메라를 바라보도록 Y축으로 yaw만큼 돌린다 (빌보드) */
  function axisModel(height, yaw) {
    mat4.fromYRotation(m, yaw);
    mat4.scale(m, m, [AXIS_WIDTH, height + KNOB_LIFT, 1]);
    return m;
  }

  /* ---------- 가이드가 화면 어디에 있는지 계산 (선택 판정·라벨 배치에 사용) ---------- */
  function computeScreenInfo(ctx) {
    const { W, H } = ctx;
    const pot = ctx.pot_main;
    const toS = (p) => Camera.worldToScreen(cam.viewProj, p, W, H);
    const yaw = camCfg.yaw;
    // 카메라 쪽 수평 방향 (원판 타원의 세로 반지름을 구할 때 사용)
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    // 카메라 기준 오른쪽 수평 방향
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);

    st.bands = pot.shape.radii.map((r, i) => {
      const y = pot.bandY(i);
      const R = r + RING_GAP;
      const c = toS([0, y, 0]);
      const side = toS([rx * R, y, rz * R]);
      const front = toS([fx * R, y, fz * R]);
      const a = Math.hypot(side.x - c.x, side.y - c.y);
      return { cx: c.x, cy: c.y, a, b: Math.abs(front.y - c.y), pxPerUnit: a / R };
    });

    const h = pot.shape.height;
    const bottom = toS([0, 0, 0]);
    const top = toS([0, h, 0]);
    const knob = toS([0, h + KNOB_LIFT, 0]);
    const one = toS([0, 1, 0]);
    // 위에서 내려다볼수록 축이 화면에서 짧아진다. 너무 짧으면 조금만 밀어도 높이가 크게 변하므로 최소값을 둔다
    const ppu = Math.max(Math.abs(bottom.y - one.y), ctx.s * 0.15);
    st.axis = { x: bottom.x, top: top.y, bottom: bottom.y, knobX: knob.x, knobY: knob.y, pxPerUnitY: ppu };
  }

  /* ---------- 무엇을 잡았는가 ---------- */
  function pick(ctx, x, y) {
    const s = ctx.s;
    const ax = st.axis;
    // ① 높이 축: 위쪽 손잡이 근처이거나, 축 판 위 (폭이 좁으므로 손가락 여유를 넉넉히)
    if (Math.hypot(x - ax.knobX, y - ax.knobY) < s * 0.08) return 'height';
    if (Math.abs(x - ax.x) < s * 0.035 && y > Math.min(ax.knobY, ax.bottom) && y < Math.max(ax.knobY, ax.bottom)) return 'height';

    // ② 원판: 화면에 그려진 타원 안에 들어왔는지. 여러 개면 높이가 가장 가까운 것
    let best = null, bestD = Infinity;
    st.bands.forEach((b, i) => {
      const dx = (x - b.cx) / (b.a * 1.15);
      const dy = (y - b.cy) / Math.max(b.b * 1.3, s * 0.035); // 타원이 납작하므로 세로 여유를 준다
      if (dx * dx + dy * dy <= 1 && Math.abs(y - b.cy) < bestD) { best = i; bestD = Math.abs(y - b.cy); }
    });
    if (best !== null) return best;
    return null; // 빈 곳 → 회전
  }

  // 손가락에 커서가 가려지지 않도록, 터치일 때는 커서를 손가락보다 위에 그리고 그 위치로 조작한다
  function cursorFrom(ctx, x, y, type) {
    const off = type === 'mouse' ? 0 : ctx.s * 0.08;
    return { x, y: y - off };
  }

  function onButton(ctx, id) {
    if (id === 'reset') {
      ctx.pot_main.reset();
      camCfg.yaw = 0; camCfg.pitch = CAM.PITCH_START;
      st.selected = 2;
    }
    if (id === 'done') {
      // 프로토타입: 다음 단계(문양 넣기)로 넘길 데이터를 콘솔에 남긴다
      console.log('[옹기 형태]', JSON.stringify(ctx.pot_main.toData()));
      st.toastUntil = performance.now() + 1800;
      // 5단계가 완성되면: ctx.go('stage5-decorate', ctx.pot_main.toData());
    }
  }

  function normalize(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  Scenes.register('stage4-shape', {

    enter(ctx, data) {
      if (!gres) initResources(ctx.gl);
      if (data) ctx.pot_main.load(data);   // 3단계에서 넘어온 형태가 있으면 이어받는다
      camCfg.target[1] = ctx.pot_main.shape.height / 2;
    },

    update(ctx, dt) {
      const pot = ctx.pot_main;
      pot.update();

      // 회전 중심 = 옹기 높이의 절반. 높이가 바뀌면 부드럽게 따라간다 (갑자기 튀면 조절 중에 놓치기 쉽다)
      const ty = pot.shape.height / 2;
      camCfg.target[1] += (ty - camCfg.target[1]) * Math.min(1, dt * 6);
      // 가장 큰 옹기(지름 1.8 + 고리, 높이 2.0 + 손잡이)도 들어오는 거리
      camCfg.dist = Camera.fitDistance(ctx.W / ctx.H, CAM.FOVY, 2.2, 2.6) * 1.05;
      cam.update(ctx.W / ctx.H, camCfg);

      computeScreenInfo(ctx);
      st.buttons = ctx.ui.layoutBottomPair(ctx.W, ctx.H,
        { id: 'reset', label: '처음으로' }, { id: 'done', label: '완료', primary: true });
    },

    draw(ctx) {
      const gl = ctx.gl;
      // 조명은 카메라를 따라 돈다 → 어느 방향으로 돌려 봐도 앞면이 밝게 보인다
      const ly = camCfg.yaw - 0.6;
      ctx.potShader.begin(cam, normalize([Math.sin(ly) * 0.8, 0.9, Math.cos(ly) * 0.8]));

      ctx.wheel.draw(0);
      const active = typeof st.selected === 'number' ? st.selected : -1;
      ctx.pot_main.draw(ctx.potShader, PotShader.CLAY, { activeBand: active });

      /*
       * 반투명 가이드: 옹기 "안쪽"에 있지만 보여야 하므로 깊이 테스트를 끄고 그 위에 겹쳐 그린다.
       * 깊이 테스트를 켜 두면 옹기 벽에 가려 보이지 않는다.
       */
      const L = gres.prog.locs;
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(gres.prog.prog);
      gl.uniformMatrix4fv(L.uView, false, cam.view);
      gl.uniformMatrix4fv(L.uProj, false, cam.proj);

      // 가로 원판 6개
      gl.uniform1f(L.uEdge, 1);
      gl.bindVertexArray(gres.disk.vao);
      ctx.pot_main.shape.radii.forEach((r, i) => {
        const on = st.selected === i;
        const hov = st.hover === i;
        const col = on ? PICK : IDLE;
        gl.uniform4f(L.uColor, col[0], col[1], col[2], on ? 0.22 : hov ? 0.14 : 0.07);
        gl.uniformMatrix4fv(L.uModel, false, diskModel(ctx.pot_main.bandY(i), r));
        gl.drawElements(gl.TRIANGLES, gres.disk.count, gl.UNSIGNED_SHORT, 0);
      });

      // 세로 높이 축 1개
      const onH = st.selected === 'height';
      const colH = onH ? PICK : IDLE;
      gl.uniform1f(L.uEdge, 0);
      gl.uniform4f(L.uColor, colH[0], colH[1], colH[2], onH ? 0.45 : 0.18);
      gl.uniformMatrix4fv(L.uModel, false, axisModel(ctx.pot_main.shape.height, camCfg.yaw));
      gl.bindVertexArray(gres.quad.vao);
      gl.drawElements(gl.TRIANGLES, gres.quad.count, gl.UNSIGNED_SHORT, 0);
    },

    drawUI(ctx) {
      const { W, H, s, ui } = ctx;
      const pot = ctx.pot_main;

      // 제목과 안내
      ui.drawText(ui.text('④ 옹기 빚기'), W / 2, H * 0.06, s * 0.07, 'center', W * 0.9);
      ui.drawText(ui.text('고리를 좌우로 밀어 폭을, 가운데 축을 위아래로 밀어 높이를 바꿔요', { weight: 400 }),
        W / 2, H * 0.06 + s * 0.07, s * 0.04, 'center', W * 0.92, [1, 0.92, 0.85, 0.85]);
      ui.drawText(ui.text('빈 곳을 밀면 옹기를 이리저리 돌려 볼 수 있어요', { weight: 400 }),
        W / 2, H * 0.06 + s * 0.115, s * 0.034, 'center', W * 0.92, [1, 0.92, 0.85, 0.55]);

      // 높이 손잡이 (축 맨 위의 동그라미)
      const ax = st.axis;
      const onH = st.selected === 'height';
      ui.circle(ax.knobX, ax.knobY, s * 0.06, onH ? [1, 0.75, 0.42, 0.95] : [1, 1, 1, 0.55]);
      ui.drawText(ui.text('↕'), ax.knobX, ax.knobY, s * 0.045, 'center', Infinity, [0.2, 0.15, 0.12, 1]);

      // 구간 번호 (아래부터 1~6) — 원판 왼쪽 끝
      st.bands.forEach((b, i) => {
        const on = st.selected === i;
        ui.drawText(ui.text(String(i + 1)), b.cx - b.a - s * 0.035, b.cy, s * (on ? 0.045 : 0.035), 'right', Infinity,
          on ? [1, 0.8, 0.5, 1] : [1, 1, 1, 0.5]);
      });

      // 선택한 대상의 현재 값
      let label = '';
      if (typeof st.selected === 'number') {
        const r = pot.shape.radii[st.selected];
        label = `${st.selected + 1}구간 폭 ${Math.round(((r - Pot.R_MIN) / (Pot.R_MAX - Pot.R_MIN)) * 100)}%`;
      } else if (st.selected === 'height') {
        label = `높이 ${Math.round(((pot.shape.height - Pot.H_MIN) / (Pot.H_MAX - Pot.H_MIN)) * 100)}%`;
      }
      if (label) ui.drawText(ui.dynText('value', label), W / 2, H * 0.06 + s * 0.18, s * 0.05, 'center', Infinity, [1, 0.8, 0.5, 1]);

      // 버튼
      for (const b of st.buttons) ui.button(b);

      // 완료 안내
      if (performance.now() < st.toastUntil) {
        const t = ui.text('모양을 저장했어요 (콘솔 확인)', { weight: 400 });
        const th = s * 0.045, tw = Math.min(t.aspect * th, W * 0.9);
        const ty = st.buttons[0].y - st.buttons[0].h - s * 0.04;
        ui.rect(W / 2 - tw / 2 - s * 0.03, ty - th * 0.9, tw + s * 0.06, th * 1.8, [0, 0, 0, 0.6], th * 0.5);
        ui.drawText(t, W / 2, ty, th, 'center', W * 0.9);
      }

      // 손 커서: 펼친 손 / 쥔 손
      if (st.cursor.visible) {
        ui.drawText(ui.text(st.cursor.grab ? '✊' : '✋'), st.cursor.x, st.cursor.y, s * 0.1);
      }
    },

    down(ctx, x, y, type) {
      for (const b of st.buttons) {
        if (ctx.ui.hit(b, x, y)) { onButton(ctx, b.id); return; }
      }
      const c = cursorFrom(ctx, x, y, type);
      Object.assign(st.cursor, c, { visible: true, grab: true });
      const target = pick(ctx, c.x, c.y);

      if (target === 'height') {
        st.selected = 'height';
        st.drag = { kind: 'height', lastY: c.y };
      } else if (target !== null) {
        st.selected = target;
        // 오른쪽을 잡으면 오른쪽으로 당길 때, 왼쪽을 잡으면 왼쪽으로 당길 때 넓어진다
        st.drag = { kind: 'band', side: c.x >= st.bands[target].cx ? 1 : -1, lastX: c.x };
      } else {
        st.drag = { kind: 'rotate', lastX: x, lastY: y }; // 회전은 손가락 위치 그대로
        st.cursor.grab = false;
      }
    },

    move(ctx, x, y, type) {
      const c = cursorFrom(ctx, x, y, type);
      Object.assign(st.cursor, c, { visible: true });
      const d = st.drag;
      if (!d) return;
      const pot = ctx.pot_main;

      if (d.kind === 'band') {
        const i = st.selected;
        // 화면에서 움직인 픽셀 → 월드 단위 반지름 변화 (그 높이에서 1 단위가 몇 픽셀인지로 나눈다)
        pot.setRadius(i, pot.shape.radii[i] + d.side * (c.x - d.lastX) / st.bands[i].pxPerUnit);
        d.lastX = c.x;
      } else if (d.kind === 'height') {
        // 화면 y는 아래로 갈수록 커지므로, 위로 밀면(dy < 0) 높아진다
        pot.setHeight(pot.shape.height - (c.y - d.lastY) / st.axis.pxPerUnitY);
        d.lastY = c.y;
      } else if (d.kind === 'rotate') {
        // 좌우로 밀면 옆으로 돌고(yaw), 위아래로 밀면 위·아래에서 보도록 돈다(pitch)
        camCfg.yaw -= ((x - d.lastX) / ctx.W) * CAM.ROT_SPEED;
        camCfg.pitch += ((y - d.lastY) / ctx.H) * CAM.ROT_SPEED;
        camCfg.pitch = Math.min(CAM.PITCH_MAX, Math.max(CAM.PITCH_MIN, camCfg.pitch));
        d.lastX = x; d.lastY = y;
      }
    },

    up(ctx, x, y, type) {
      st.drag = null;
      st.cursor.grab = false;
      if (type !== 'mouse') st.cursor.visible = false;
    },

    hover(ctx, x, y) {
      Object.assign(st.cursor, { x, y, visible: true, grab: false });
      st.hover = pick(ctx, x, y);
    },

    exit(ctx) { return ctx.pot_main.toData(); },
  });
})();
