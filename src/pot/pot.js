// src/pot/pot.js — 옹기를 만드는 공통 틀: 형태 상태(6구간 반지름 + 높이), 옆면 곡선 규칙, 메시 갱신
// 관람객의 옹기(pot_main)도, 전시실의 박물관 옹기도 모두 이 틀로 만든다 (Unity의 프리팹 같은 역할)

const Pot = (() => {
  const { mat4 } = glMatrix;

  const BANDS = 6;                     // 높이를 6등분
  const R_MIN = 0.2, R_MAX = 0.9;      // 구간 반지름 범위 (세로 화면에서 잘리지 않게)
  const H_MIN = 0.7, H_MAX = 2.0;      // 전체 높이 범위
  const DEFAULT_RADII = [0.5, 0.56, 0.6, 0.6, 0.56, 0.5]; // 위만 뚫린 적당히 둥근 기본형
  const DEFAULT_HEIGHT = 1.3;
  const RINGS = 60;                    // 높이 방향 분할 수
  const SEGMENTS = 64;                 // 둘레 분할 수

  /**
   * 옹기 옆면 단면: 높이를 6등분한 각 구간의 "중심 높이"에 조절점을 두고 부드럽게 잇는다.
   * 맨 아래(y=0)와 맨 위(y=H)는 가장 가까운 구간의 반지름을 그대로 쓴다.
   * 단면을 높이 기준으로 균일하게 나누므로 v = 높이 비율이 된다 (구간 강조 표시에 사용).
   */
  function wallProfile(radii, height, rings) {
    const n = radii.length;
    const ys = [0];
    const rs = [radii[0]];
    for (let i = 0; i < n; i++) { ys.push(((i + 0.5) / n) * height); rs.push(radii[i]); }
    ys.push(height); rs.push(radii[n - 1]);

    const pts = [];
    for (let i = 0; i < rings; i++) {
      const y = (i / (rings - 1)) * height;
      let k = 0;
      while (k < ys.length - 2 && y > ys[k + 1]) k++;
      const t = (y - ys[k]) / (ys[k + 1] - ys[k]);
      const r = Mesh.catmullRom(rs[Math.max(k - 1, 0)], rs[k], rs[k + 1], rs[Math.min(k + 2, rs.length - 1)], t);
      pts.push({ r: Math.max(r, 0.08), y });
    }
    return pts;
  }

  /**
   * @param data  (선택) 이전 단계나 저장된 데이터 { height, radii } — 없으면 기본형
   */
  function create(gl, locs, data) {
    const shape = {
      height: data ? data.height : DEFAULT_HEIGHT,
      radii: data ? data.radii.slice() : DEFAULT_RADII.slice(),
    };

    // 옆면과 바닥 모두 형태에 따라 바뀌므로 동적 메시 (바닥 반지름 = 옆면 맨 아래 반지름)
    let wallMesh = Mesh.createRevolution(wallProfile(shape.radii, shape.height, RINGS), SEGMENTS);
    let floorMesh = Mesh.createRevolution(Mesh.diskProfile(shape.radii[0], 0), SEGMENTS);
    const wallGpu = Mesh.uploadMesh(gl, wallMesh, locs, true);
    const floorGpu = Mesh.uploadMesh(gl, floorMesh, locs, true);
    let dirty = false;

    // 물레 윗판과 겹쳐 깜빡이지 않게 살짝 띄운다
    const model = mat4.fromTranslation(mat4.create(), [0, 0.003, 0]);

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    return {
      shape,
      model,

      /** i번 구간 중심의 높이 (월드 단위) */
      bandY(i) { return ((i + 0.5) / BANDS) * shape.height; },

      setRadius(i, r) {
        const next = clamp(r, R_MIN, R_MAX);
        if (next !== shape.radii[i]) { shape.radii[i] = next; dirty = true; }
      },

      setHeight(h) {
        const next = clamp(h, H_MIN, H_MAX);
        if (next !== shape.height) { shape.height = next; dirty = true; }
      },

      reset() {
        shape.radii = DEFAULT_RADII.slice();
        shape.height = DEFAULT_HEIGHT;
        dirty = true;
      },

      /** 다른 데이터로 형태를 통째로 바꾼다 (단계 이동, 저장 불러오기) */
      load(d) {
        shape.radii = d.radii.slice();
        shape.height = d.height;
        dirty = true;
      },

      /** 변경이 있을 때만 메시를 다시 계산한다 (같은 배열을 재사용) */
      update() {
        if (!dirty) return;
        wallMesh = Mesh.createRevolution(wallProfile(shape.radii, shape.height, RINGS), SEGMENTS, wallMesh);
        floorMesh = Mesh.createRevolution(Mesh.diskProfile(shape.radii[0], 0), SEGMENTS, floorMesh);
        Mesh.updateMesh(gl, wallGpu, wallMesh);
        Mesh.updateMesh(gl, floorGpu, floorMesh);
        dirty = false;
      },

      /**
       * 그리기. opt.activeBand 를 주면 그 구간을 강조한다
       */
      draw(potShader, color = PotShader.CLAY, opt = {}) {
        const band = opt.activeBand;
        const activeV = band !== undefined && band >= 0 ? (band + 0.5) / BANDS : -1;
        potShader.draw(floorGpu, model, color);
        potShader.draw(wallGpu, model, color, { ridge: 1, activeV, bandHalf: 0.5 / BANDS });
      },

      /** 다음 단계로 넘길 데이터 — 화면 간 약속 형식 */
      toData() { return { height: shape.height, radii: shape.radii.slice() }; },
    };
  }

  return { create, wallProfile, BANDS, R_MIN, R_MAX, H_MIN, H_MAX };
})();
