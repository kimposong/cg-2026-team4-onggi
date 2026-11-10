// src/scenes/stage1-knead.js — 1단계: 반죽하기
// 인벤토리(흙·물)에서 끌어다 놓고, 젖은 흙을 n번 터치해 반죽한다. 끝나면 바로 2단계로 넘어간다
// 물레는 자동으로 돌지 않는다: 마우스 왼쪽 버튼으로 누른 채 좌우로 흔들면 그 방향으로 돈다 (shared/workbench.js)

(() => {
  const TAPS = 8;                                   // 반죽을 몇 번 터치해야 하는가
  const R = 0.42, H = 0.75, P = 2.3;                // 흙 덩어리 모양 (초타원)
  const st = { sub: 0, taps: 0, appear: 0, wetT: 0, sq: 0, doneAt: 0, left: false };
  // sub 0: 흙 → 물레 / 1: 물 → 흙 / 2: 젖은 흙 터치 n번

  const cb = {
    hitClay: (ctx, x, y) => st.sub >= 1 && Work.hitClay(ctx, x, y, R, H),

    onDrop(id, x, y) {
      const ctx = cb.ctx, onClay = cb.hitClay(ctx, x, y);
      if (st.doneAt) return;
      if (st.sub === 0) {
        if (id === 'soil') { st.sub = 1; st.appear = 0; st.sq = 1; }                 // 흙은 화면 안 어디에 놓아도 물레에 올라간다
        else Work.hint(['물은 흙을 올린 다음에 써요', '먼저 흙을 물레 위에 놓아 주세요']);
      } else if (st.sub === 1) {
        if (id === 'water' && onClay) { st.wetT = 1; st.sub = 2; st.sq = 1; }
        else if (id === 'water') Work.hint(['물이 흙에 스며들도록', '흙 위에 놓아 주세요']);
        else Work.hint(['흙은 이미 올렸어요', '이제 물을 흙 위에 부어 주세요']);
      } else Work.hint(['이제 재료 대신', '젖은 흙을 직접 터치해 치대어 주세요']);
    },

    onTap() {
      if (st.sub !== 2 || st.doneAt) return;
      st.taps++; st.sq = 1;
      if (st.taps >= TAPS) st.doneAt = performance.now() + 1500;                     // 잠깐 완료 문구를 보여 준 뒤 2단계로
    },
  };

  Scenes.register('stage1-knead', {
    enter(ctx) {
      Object.assign(st, { sub: 0, taps: 0, appear: 0, wetT: 0, sq: 0, doneAt: 0, left: false });
      Object.assign(Work.S.clay, { wet: 0, smooth: 0 });
      Work.setInventory(['soil', 'water'], true);       // 1단계 인벤토리: 흙과 물 두 개
      Work.inv.open = 0;                                // 처음에 펼쳐지는 모습
    },

    update(ctx, dt) {
      cb.ctx = ctx;
      Work.update(ctx, dt);
      const c = Work.S.clay, k = Math.min(1, dt * 6);
      if (st.sub >= 1) st.appear = Math.min(1, st.appear + dt * 2.2);
      c.wet += (st.wetT - c.wet) * k;
      c.smooth += (st.taps / TAPS - c.smooth) * k;       // 터치할수록 표면이 매끈해진다
      st.sq *= Math.exp(-dt * 5);
      if (st.sub >= 1) Work.setLump(ctx, R, H, P, 0.2 * (1 - c.smooth) + 0.015);
      if (st.doneAt && !st.left && performance.now() > st.doneAt) { st.left = true; setTimeout(() => ctx.go('stage2-base'), 0); }   // 전환은 프레임 사이에서
    },

    draw(ctx) {
      Work.drawScene(ctx, () => {
        if (st.sub >= 1) Work.drawLump(ctx, Work.S.clay.wet, Work.easeBack(st.appear), st.sq * Math.cos(performance.now() / 70));
      });
    },

    drawUI(ctx) {
      let lines, goal;
      if (st.doneAt) { lines = ['✓ 부드러운 반죽 완성!', '이제 이 반죽으로 바닥판을 만들어요']; goal = ''; }
      else if (st.sub === 0) { lines = ['인벤토리의 흙을 물레 위로 끌어다 놓아', '반죽할 흙을 준비하세요']; goal = '다음에는 이 흙에 물을 부어 반죽할 준비를 해요'; }
      else if (st.sub === 1) { lines = ['인벤토리의 물을 흙 위로 끌어다 놓아', '흙에 물을 부어 주세요']; goal = '물을 머금으면 흙이 촉촉하고 진한 색으로 바뀌어요'; }
      else { lines = ['젖은 흙을 터치해 발로 밟듯 치대어 주세요', `(${st.taps}/${TAPS})`]; goal = '치댈수록 울퉁불퉁한 표면이 매끈하고 쫀득한 반죽이 돼요'; }
      Work.drawGuide(ctx, '① 반죽하기', lines, goal);
      Work.drawInventory(ctx);
    },

    down(ctx, x, y, type) { cb.ctx = ctx; Work.down(ctx, x, y, type, cb); },
    move(ctx, x, y) { Work.move(ctx, x, y); },
    up(ctx, x, y) { cb.ctx = ctx; Work.up(ctx, x, y, cb); },
  });
})();