// src/scenes/stage1-knead.js — 1단계: 반죽하기 (흙 + 물 드래그, n번 터치)
// 빈 틀: Scenes 약속(enter / update / draw / drawUI / down·move·up / exit)만 갖춰 두었다. 필요한 함수만 채우면 된다

(() => {
  Scenes.register('stage1-knead', {
    enter(ctx, data) {
      // data: 이전 화면이 넘긴 옹기 데이터 { height, radii }
    },
    update(ctx, dt) {},
    draw(ctx) {},
    drawUI(ctx) {
      const { W, H, s, ui } = ctx;
      ui.drawText(ui.text('① 반죽하기'), W / 2, H * 0.45, s * 0.07, 'center', W * 0.9);
      ui.drawText(ui.text('준비 중', { weight: 400 }), W / 2, H * 0.45 + s * 0.08, s * 0.04, 'center', W * 0.9, [1, 1, 1, 0.5]);
    },
    down(ctx, x, y, type) {},
    move(ctx, x, y, type) {},
    up(ctx, x, y, type) {},
    exit(ctx) { return ctx.pot_main.toData(); },
  });
})();
