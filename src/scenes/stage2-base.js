// src/scenes/stage2-base.js — 2단계: 바닥 만들기
// 다른 재료가 필요 없으므로 인벤토리를 위로 접는다. 반죽을 꾹 누르고 있으면 납작하고 둥근 바닥판이 된다
// (누른 채 좌우로 흔들면 물레가 돈다 — 움직이지 않고 누르고 있을 때만 눌린다)

(() => {
  const R0 = 0.42, H0 = 0.75, P0 = 2.3;             // 1단계에서 이어받은 덩어리
  const R1 = 0.5, H1 = 0.06, P1 = 7;                // 바닥판: 반지름은 옹기 맨 아래 반지름(0.5)과 같다
  const SPEED = 0.4;                                // 초당 진행 (약 2.5초 동안 누르면 완성)
  const st = { f: 0, sq: 0, doneAt: 0, left: false };
  const ease = (f) => f * f * (3 - 2 * f);

  const cb = {
    hitClay: (ctx, x, y) => Work.hitClay(ctx, x, y, R0 + (R1 - R0) * ease(st.f), H0 + (H1 - H0) * ease(st.f)),
    onDrop() { Work.hint(['이 단계는 재료를 쓰지 않아요', '반죽 덩어리를 직접 꾹 눌러 주세요']); },
  };

  Scenes.register('stage2-base', {
    enter(ctx) {
      Object.assign(st, { f: 0, sq: 0, doneAt: 0, left: false });
      Work.setInventory(['soil', 'water'], false);       // 2단계: 인벤토리를 위로 접는다
    },

    update(ctx, dt) {
      Work.update(ctx, dt);
      if (!st.doneAt && Work.holding()) {                // 누르고 있는 동안 진행
        st.f = Math.min(1, st.f + dt * SPEED);
        st.sq = Math.max(st.sq, 0.5);
        if (st.f >= 1) st.doneAt = performance.now() + 1500;
      }
      st.sq *= Math.exp(-dt * 5);
      const e = ease(st.f), c = Work.S.clay;
      Work.setLump(ctx, R0 + (R1 - R0) * e, H0 + (H1 - H0) * e, P0 + (P1 - P0) * e, 0.015 * (1 - e));
      if (st.doneAt && !st.left && performance.now() > st.doneAt) { st.left = true; setTimeout(() => ctx.go('stage3-stack'), 0); }
    },

    draw(ctx) {
      Work.drawScene(ctx, () => Work.drawLump(ctx, Work.S.clay.wet, 1, st.sq * 0.6));
    },

    drawUI(ctx) {
      const done = st.doneAt > 0;
      Work.drawGuide(ctx, '② 바닥 만들기',
        done ? ['✓ 바닥판 완성!', '이제 타래를 쌓아 옹기 벽을 만들어요'] : ['반죽 덩어리를 꾹 누르고 있어 보세요', `누르는 만큼 납작하게 눌려요 (${Math.round(st.f * 100)}%)`],
        done ? '' : '완성되면 옹기의 밑바닥이 될 둥글고 납작한 바닥판이 돼요');
      Work.drawInventory(ctx);
    },

    down(ctx, x, y, type) { Work.down(ctx, x, y, type, cb); },
    move(ctx, x, y) { Work.move(ctx, x, y); },
    up(ctx, x, y) { Work.up(ctx, x, y, cb); },
  });
})();