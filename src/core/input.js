// src/core/input.js — 터치·마우스 입력을 캔버스 픽셀 좌표로 바꿔 전달

const Input = (() => {

  /**
   * pointer 이벤트는 터치와 마우스를 같은 코드로 받는다 → 개발은 마우스로, 시연은 휴대폰으로
   * handlers: { down(x, y, type), move(x, y, type), up(x, y, type), hover(x, y) }
   */
  function setup(canvas, handlers) {
    // CSS 좌표 → 캔버스 픽셀 좌표. devicePixelRatio 때문에 둘이 다르다
    // 이 변환을 빼먹으면 고해상도 휴대폰에서 버튼이 엉뚱한 곳에서 눌린다 (11주차, 가장 흔한 버그)
    const toPx = (e) => {
      const r = canvas.getBoundingClientRect();
      const dpr = canvas.width / r.width;
      return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
    };

    let activeId = null; // 한 손가락만 받는다

    canvas.addEventListener('pointerdown', (e) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      const p = toPx(e);
      handlers.down(p.x, p.y, e.pointerType);
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = toPx(e);
      if (activeId === null) {
        if (e.pointerType === 'mouse') handlers.hover(p.x, p.y);
      } else if (e.pointerId === activeId) {
        handlers.move(p.x, p.y, e.pointerType);
      }
    });

    const end = (e) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      const p = toPx(e);
      handlers.up(p.x, p.y, e.pointerType);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    // 길게 누를 때 뜨는 브라우저 메뉴 막기
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return { setup };
})();
