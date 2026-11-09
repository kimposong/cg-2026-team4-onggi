// src/core/text.js — 문자열 하나를 텍스처로 (11주차 강의 코드 기반)

const TextTex = (() => {

  function makeTextTexture(gl, text, opt = {}) {
    const fontSize = opt.fontSize || 64;
    const pad = opt.pad || 16;
    const color = opt.color || '#ffffff';
    const font = `${opt.weight || 700} ${fontSize}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;

    // ① 크기를 재기 위해 임시 2D 컨텍스트를 만든다
    const m = document.createElement('canvas').getContext('2d');
    m.font = font;
    const w = Math.ceil(m.measureText(text).width) + pad * 2;
    const h = Math.ceil(fontSize * 1.25) + pad * 2; // 한글·이모지 위아래가 잘리지 않게 여유

    // ② 실제로 글자를 그린다
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, pad, h / 2);

    // ③ 그 캔버스를 그대로 텍스처로 올린다
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return { tex, w, h, aspect: w / h };
  }

  return { makeTextTexture };
})();
