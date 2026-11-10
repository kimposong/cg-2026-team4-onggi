// src/scenes/stage3-stack.js — 3단계: 흙 쌓기
// 인벤토리에는 타래만 있다. 타래를 바닥판 위에 올릴 때마다 옹기 벽이 한 겹씩 높아지고, 올리는 순간 이미 성형된 모양이다
// 6겹(= 옹기 6구간)을 올리면 4단계가 시작하는 기본 옹기 모양(Pot 기본값)과 똑같아진다 → 그대로 4단계로 넘겨 준다

(() => {
  const LAYERS = Pot.BANDS;                          // 6겹
  const st = { layers: 0, g: 0, sq: 0, doneAt: 0, left: false };
  let data = null;                                   // 완성될 옹기 모양 { height, radii }

  const cb = {
    top: () => (st.g * data.height) / LAYERS,
    hitClay: (ctx, x, y) => Work.hitClay(ctx, x, y, 0.62, Math.max(cb.top(), 0.25)),
    onDrop(id, x, y) {
      const ctx = cb.ctx;
      if (st.doneAt) return;
      if (id === 'coil' && cb.hitClay(ctx, x, y)) {
        st.layers++; st.sq = 1;
        if (st.layers >= LAYERS) st.doneAt = performance.now() + 1800;
      } else if (id === 'coil') Work.hint(['타래가 바닥판 테두리에 닿도록', '바닥판 위에 놓아 주세요']);
    },
  };

  Scenes.register('stage3-stack', {
    enter(ctx) {
      ctx.pot_main.reset();                           // 기본 옹기 모양 = 이 단계가 만들어 갈 목표
      data = ctx.pot_main.toData();
      Object.assign(st, { layers: 0, g: 0, sq: 0, doneAt: 0, left: false });
      Work.setInventory(['coil'], true);              // 3단계 인벤토리: 타래만
      Work.setLump(ctx, 0.5, 0.06, 7, 0);             // 2단계에서 만든 바닥판
      Work.setWall(ctx, data, 0.001);
    },

    update(ctx, dt) {
      cb.ctx = ctx;
      Work.update(ctx, dt);
      st.g += (st.layers - st.g) * Math.min(1, dt * 5);     // 쌓인 높이를 부드럽게 따라간다
      st.sq *= Math.exp(-dt * 5);
      if (cb.top() > 0.005) Work.setWall(ctx, data, cb.top());
      if (st.doneAt && !st.left && performance.now() > st.doneAt) { st.left = true; setTimeout(() => ctx.go('stage4-shape', data), 0); }
    },

    draw(ctx) {
      Work.drawScene(ctx, () => {
        Work.drawLump(ctx, 0.35, 1, 0);                         // 바닥판
        if (cb.top() > 0.005) Work.drawWall(ctx, st.sq * Math.cos(performance.now() / 70));
      });
    },

    drawUI(ctx) {
      const done = st.doneAt > 0;
      Work.drawGuide(ctx, '③ 흙 쌓기',
        done ? ['✨ 타래 6겹을 올려 속이 빈 옹기 몸체가 완성됐어요', '다음에는 옆면을 드래그해 원하는 모양으로 빚어 봐요']
             : ['인벤토리의 타래를 끌어다 바닥판 위에 놓아', `타래 한 겹을 올리세요 (${st.layers}/${LAYERS})`],
        done ? '' : '올릴 때마다 옹기 벽이 한 겹씩 높아지고, 배가 부른 모양으로 바로 성형돼요');
      Work.drawInventory(ctx);
    },

    down(ctx, x, y, type) { cb.ctx = ctx; Work.down(ctx, x, y, type, cb); },
    move(ctx, x, y) { Work.move(ctx, x, y); },
    up(ctx, x, y) { cb.ctx = ctx; Work.up(ctx, x, y, cb); },

    exit(ctx) { return data; },
  });
})();