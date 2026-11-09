// src/core/camera.js — 궤도 카메라 도구와 월드 → 화면 좌표 변환
// 각도·거리·바라볼 점 같은 "설정값"은 각 화면(scenes)이 정해서 넘긴다

const Camera = (() => {
  const { mat4, vec4 } = glMatrix;

  const tmp = vec4.create();

  /**
   * 바라볼 점(target)을 중심으로 도는 궤도 카메라.
   * 화면마다 자기 카메라를 하나씩 만들어 쓴다 (행렬을 매 프레임 새로 만들지 않도록 객체 안에 보관)
   */
  function createOrbit() {
    const view = mat4.create();
    const proj = mat4.create();
    const viewProj = mat4.create();
    const eye = [0, 0, 0];

    /**
     * @param {number} aspect  화면 가로/세로
     * @param {object} cfg     { yaw, pitch, target:[x,y,z], dist, fovy }  — 각도는 라디안
     */
    function update(aspect, cfg) {
      const { yaw, pitch, target, dist, fovy } = cfg;
      // 구면 좌표 → 카메라 위치: 수평으로 yaw만큼 돌고, 위아래로 pitch만큼 올라간다
      eye[0] = target[0] + dist * Math.cos(pitch) * Math.sin(yaw);
      eye[1] = target[1] + dist * Math.sin(pitch);
      eye[2] = target[2] + dist * Math.cos(pitch) * Math.cos(yaw);
      // pitch가 ±90°에 닿으면 위쪽 방향(0,1,0)과 시선이 겹쳐 화면이 뒤집힌다 → 각 화면에서 pitch 범위를 제한한다
      mat4.lookAt(view, eye, target, [0, 1, 0]);
      mat4.perspective(proj, fovy, aspect, 0.1, 100);
      mat4.multiply(viewProj, proj, view);
      return cam;
    }

    const cam = { view, proj, viewProj, eye, update };
    return cam;
  }

  /** 지름 width, 높이 height인 물체가 화면에 다 들어오는 거리 (세로 화면이면 폭 기준으로 더 멀리) */
  function fitDistance(aspect, fovy, width, height) {
    const t = Math.tan(fovy / 2);
    return Math.max((height / 2) / t, (width / 2) / (t * aspect));
  }

  /** 월드 좌표 한 점이 화면의 몇 번째 픽셀에 찍히는지 (좌상단 0,0) */
  function worldToScreen(vp, p, W, H) {
    vec4.transformMat4(tmp, [p[0], p[1], p[2], 1], vp);
    const nx = tmp[0] / tmp[3];
    const ny = tmp[1] / tmp[3];
    return { x: (nx * 0.5 + 0.5) * W, y: (1 - (ny * 0.5 + 0.5)) * H };
  }

  return { createOrbit, fitDistance, worldToScreen };
})();
