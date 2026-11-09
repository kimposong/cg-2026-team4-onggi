// src/core/program.js — 셰이더 컴파일 도우미 (어떤 셰이더도 직접 갖고 있지 않다)
// 파일마다 즉시 실행 함수로 감싸서, 바깥에는 객체 하나만 내보낸다 (이름 충돌 방지)

const Program = (() => {

  function create(gl, vsSrc, fsSrc) {
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));

    // 이름으로 attribute·uniform 위치를 꺼내 쓰기 쉽게 모아 둔다
    const locs = {};
    const nA = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < nA; i++) { const n = gl.getActiveAttrib(prog, i).name; locs[n] = gl.getAttribLocation(prog, n); }
    const nU = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nU; i++) { const n = gl.getActiveUniform(prog, i).name; locs[n] = gl.getUniformLocation(prog, n); }
    return { prog, locs };
  }

  return { create };
})();
