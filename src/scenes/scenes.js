// src/scenes/scenes.js — 화면(씬) 등록과 전환 관리 (Unity의 SceneManager 같은 역할)

/*
 * 모든 화면이 지킬 약속 — 필요한 것만 만들면 된다 (없는 함수는 건너뜀)
 *
 * Scenes.register('이름', {
 *   enter(ctx, data) {},   // 화면에 들어올 때. data = 이전 화면이 넘긴 옹기 데이터
 *   update(ctx, dt) {},    // 매 프레임 상태 갱신 (dt: 초)
 *   draw(ctx) {},          // 3D 그리기
 *   drawUI(ctx) {},        // 캔버스 UI 그리기
 *   down(ctx, x, y, type) {}, move(ctx, x, y, type) {}, up(ctx, x, y, type) {}, hover(ctx, x, y) {},
 *   exit(ctx) { return data; } // 화면을 떠날 때 다음 화면에 넘길 데이터
 * });
 *
 * ctx = main.js 가 만드는 공용 도구 묶음 { gl, W, H, s, ui, potShader, wheel, pot_main, go }
 */

const Scenes = (() => {
  const list = {};
  let current = null;
  let currentName = '';

  function register(name, def) { list[name] = def; }

  /** 화면 전환: 지금 화면의 exit → 다음 화면의 enter */
  function go(ctx, name, data) {
    if (!list[name]) { console.warn(`[Scenes] 없는 화면: ${name}`); return; }
    let out = data;
    if (current && current.exit) {
      const r = current.exit(ctx);
      if (r !== undefined && data === undefined) out = r;
    }
    current = list[name];
    currentName = name;
    if (current.enter) current.enter(ctx, out);
  }

  /** 지금 화면의 함수를 호출 (없으면 아무것도 안 함) */
  function call(fn, ...args) {
    if (current && current[fn]) return current[fn](...args);
  }

  return { register, go, call, get current() { return currentName; } };
})();
