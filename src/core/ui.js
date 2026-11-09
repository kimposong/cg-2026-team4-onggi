// src/core/ui.js — 캔버스 안 버튼·글자 그리기 도구 (11주차: 직교 투영 + 깊이 테스트 끄기)
// 어떤 버튼을 어디에 둘지는 각 화면이 정한다. 여기에는 그리는 법·판정하는 법만 있다

const UI = (() => {
  const { mat4 } = glMatrix;

  /* ---------- 캔버스 UI 셰이더: 직교 투영 위의 사각형 (UI 도구의 일부라 core에 둔다) ---------- */
  const UI_VS = `#version 300 es
  in vec2 aPos;            // 0~1 단위 사각형
  uniform mat4 uOrtho;     // 좌상단 (0,0) ~ 우하단 (W,H) 픽셀 좌표계
  uniform vec4 uRect;      // x, y, w, h (픽셀)
  out vec2 vUV;
  out vec2 vLocal;
  void main() {
    vec2 p = uRect.xy + aPos * uRect.zw;
    // 텍스트 텍스처는 UNPACK_FLIP_Y 로 뒤집어 올렸으므로, 화면 위쪽(aPos.y=0)이 v=1을 읽어야 한다
    vUV = vec2(aPos.x, 1.0 - aPos.y);
    vLocal = aPos * uRect.zw;
    gl_Position = uOrtho * vec4(p, 0.0, 1.0);
  }`;

  const UI_FS = `#version 300 es
  precision mediump float;
  in vec2 vUV;
  in vec2 vLocal;
  uniform sampler2D uTex;
  uniform bool uUseTex;
  uniform vec4 uColor;
  uniform vec2 uSize;      // 사각형 크기(픽셀)
  uniform float uRadius;   // 모서리 둥글기(픽셀) — 크기의 절반이면 원
  out vec4 outColor;
  void main() {
    vec2 q = abs(vLocal - uSize * 0.5) - (uSize * 0.5 - vec2(uRadius));
    float dist = length(max(q, 0.0)) - uRadius;
    float a = clamp(0.5 - dist, 0.0, 1.0);
    vec4 c = uUseTex ? texture(uTex, vUV) * uColor : uColor;
    outColor = vec4(c.rgb, c.a * a);
  }`;

  function create(gl) {
    const { prog, locs } = Program.create(gl, UI_VS, UI_FS);
    const ortho = mat4.create();

    // 0~1 단위 사각형 하나를 모든 UI에 재사용
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(locs.aPos);
    gl.vertexAttribPointer(locs.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // 바뀌지 않는 글자는 한 번만 만들어 재사용 (매 프레임 만들면 프레임 시간이 나빠진다)
    const cache = new Map();
    function text(str, opt = {}) {
      const key = `${str}|${opt.weight || 700}`;
      if (!cache.has(key)) cache.set(key, TextTex.makeTextTexture(gl, str, { fontSize: 72, ...opt }));
      return cache.get(key);
    }
    // 자주 바뀌는 글자(수치)는 칸마다 하나만 두고, 값이 바뀔 때만 다시 만든다. 이전 텍스처는 지운다 (메모리 증가 방지)
    const slots = {};
    function dynText(slot, str) {
      const s = slots[slot];
      if (s && s.str === str) return s.t;
      if (s) gl.deleteTexture(s.t.tex);
      const t = TextTex.makeTextTexture(gl, str, { fontSize: 56 });
      slots[slot] = { str, t };
      return t;
    }

    function begin(W, H) {
      gl.disable(gl.DEPTH_TEST);   // UI는 항상 위에
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(prog);
      mat4.ortho(ortho, 0, W, H, 0, -1, 1); // 좌상단 (0,0), 우하단 (W,H)
      gl.uniformMatrix4fv(locs.uOrtho, false, ortho);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(locs.uTex, 0);
    }

    function rect(x, y, w, h, color, radius = 0) {
      gl.uniform4f(locs.uRect, x, y, w, h);
      gl.uniform2f(locs.uSize, w, h);
      gl.uniform1f(locs.uRadius, Math.min(radius, w / 2, h / 2));
      gl.uniform4fv(locs.uColor, color);
      gl.uniform1i(locs.uUseTex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** 중심 (x, y), 지름 d 인 원 */
    function circle(x, y, d, color) { rect(x - d / 2, y - d / 2, d, d, color, d / 2); }

    /** (x, y)를 기준점으로 높이 hPx인 글자를 그린다. 너무 넓으면 maxW에 맞춰 줄인다 */
    function drawText(t, x, y, hPx, align = 'center', maxW = Infinity, color = [1, 1, 1, 1]) {
      let h = hPx, w = t.aspect * h;
      if (w > maxW) { w = maxW; h = w / t.aspect; }
      const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.uniform4f(locs.uRect, x0, y - h / 2, w, h);
      gl.uniform2f(locs.uSize, w, h);
      gl.uniform1f(locs.uRadius, 0);
      gl.uniform4fv(locs.uColor, color);
      gl.uniform1i(locs.uUseTex, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** 버튼 하나 그리기: 둥근 사각형 + 가운데 글자 */
    function button(b) {
      rect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.primary ? [0.72, 0.42, 0.24, 1] : [1, 1, 1, 0.14], b.h * 0.3);
      drawText(text(b.label), b.x, b.y, b.h * 0.5, 'center', b.w * 0.85);
    }

    /** 화면 아래 버튼 두 개 배치 — 픽셀 고정값이 아니라 화면 비율로 잡는다 (기기마다 해상도가 다르므로) */
    function layoutBottomPair(W, H, left, right) {
      const s = Math.min(W, H);
      const bh = s * 0.12;                      // 터치 대상은 짧은 변의 8% 이상 (13주차 접근성 기준)
      const bw = Math.min(W * 0.42, bh * 3.4);
      const gap = W * 0.04;
      const y = H - bh * 0.5 - s * 0.06;
      return [
        { ...left,  x: W / 2 - gap / 2 - bw / 2, y, w: bw, h: bh },
        { ...right, x: W / 2 + gap / 2 + bw / 2, y, w: bw, h: bh },
      ];
    }

    /** 버튼 판정 — 사각형 안에 들어왔는지만 본다 (11주차) */
    function hit(btn, px, py) {
      return Math.abs(px - btn.x) <= btn.w / 2 && Math.abs(py - btn.y) <= btn.h / 2;
    }

    return { begin, rect, circle, drawText, text, dynText, button, layoutBottomPair, hit };
  }

  return { create };
})();
