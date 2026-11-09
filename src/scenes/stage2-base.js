// src/scenes/stage2-base.js — 2단계: 바닥 만들기 (반죽을 꾹 눌러 바닥)
// 빈 틀: Scenes 약속(enter / update / draw / drawUI / down·move·up / exit)만 갖춰 두었다. 필요한 함수만 채우면 된다

(() => {
  Scenes.register('stage2-base', {
    enter(ctx, data) {
      // data: 이전 화면이 넘긴 옹기 데이터 { height, radii }
    },
    update(ctx, dt) {},
    draw(ctx) {},
    drawUI(ctx) {
      const { W, H, s, ui } = ctx;
      ui.drawText(ui.text('② 바닥 만들기'), W / 2, H * 0.45, s * 0.07, 'center', W * 0.9);
      ui.drawText(ui.text('준비 중', { weight: 400 }), W / 2, H * 0.45 + s * 0.08, s * 0.04, 'center', W * 0.9, [1, 1, 1, 0.5]);
    },
    down(ctx, x, y, type) {},
    move(ctx, x, y, type) {},
    up(ctx, x, y, type) {},
    exit(ctx) { return ctx.pot_main.toData(); },
  });
})();
