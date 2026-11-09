// src/shared/wheel.js — 물레 (1~6단계가 모두 물레 위에서 진행되므로 공유 소품)

const Wheel = (() => {
  const { mat4 } = glMatrix;

  const RADIUS = 1.0;
  const THICK = 0.1;

  function create(gl, potShader) {
    const locs = potShader.locs;
    // 물레: 옆 테두리(아래→위 단면) + 윗판(바깥→중심 단면, 법선이 위)
    const rim = Mesh.uploadMesh(gl, Mesh.createRevolution([
      { r: RADIUS, y: -THICK }, { r: RADIUS, y: 0 },
    ], 64), locs);
    const top = Mesh.uploadMesh(gl, Mesh.createRevolution(Mesh.diskProfile(RADIUS, 0).reverse(), 64), locs);
    const model = mat4.create();

    /** 물레 그리기. angle: 물레 회전각 (돌리는 연출이 필요한 단계에서 사용) */
    function draw(angle = 0) {
      mat4.fromYRotation(model, angle);
      potShader.draw(rim, model, PotShader.WOOD, { ridge: -1 });
      potShader.draw(top, model, PotShader.WOOD, { ridge: -1 });
    }

    return { draw, model };
  }

  return { create, RADIUS };
})();
