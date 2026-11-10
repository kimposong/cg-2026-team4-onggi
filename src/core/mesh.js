// src/core/mesh.js — 메시 도구: 회전체 생성(4주차 createRevolution 확장), 기본 도형, GPU 업로드
// 특정 대상(옹기 모양 규칙 등)의 코드는 넣지 않는다 → 옹기 옆면 곡선은 pot/pot.js

const Mesh = (() => {

  /**
   * 단면 곡선(profile)을 Y축 둘레로 회전시켜 메시를 만든다.
   * @param {{r:number, y:number}[]} profile  아래에서 위로(또는 중심에서 바깥으로) 가는 단면 점 목록
   * @param {number} segments                 둘레 분할 수
   * @param {object} [out]                    이전 결과를 넘기면 배열을 재사용한다 (매번 새로 할당하지 않기 → GC 멈춤 방지, 12주차)
   */
  function createRevolution(profile, segments, out) {
    const M = profile.length;
    const S = segments;
    const vertCount = M * (S + 1); // 둘레 마지막 정점을 한 번 더 만든다 → u=0과 u=1이 같은 위치지만 텍스처 좌표가 다르다

    const mesh = out || {
      positions: new Float32Array(vertCount * 3),
      normals: new Float32Array(vertCount * 3),
      uvs: new Float32Array(vertCount * 2),
      indices: buildIndices(M, S),
    };

    for (let i = 0; i < M; i++) {
      // ① 단면(2D)에서 접선을 구하고, 접선을 90° 돌려 바깥쪽 법선을 만든다
      //    접선 (dr, dy) → 법선 (dy, -dr). 부호가 반대면 옹기가 새까맣게 나온다 (4주차 「AI가 자주 틀리는 곳」)
      const prev = profile[Math.max(i - 1, 0)];
      const next = profile[Math.min(i + 1, M - 1)];
      const dr = next.r - prev.r;
      const dy = next.y - prev.y;
      const len = Math.hypot(dr, dy) || 1;
      const nr = dy / len;   // 법선의 반지름 방향 성분
      const ny = -dr / len;  // 법선의 높이 방향 성분

      const p = profile[i];
      for (let j = 0; j <= S; j++) {
        const th = (j / S) * Math.PI * 2;
        const c = Math.cos(th), s = Math.sin(th);
        const k = i * (S + 1) + j;
        // ② 단면 점을 각도 th만큼 돌려 3D 위치로
        mesh.positions[k * 3 + 0] = p.r * c;
        mesh.positions[k * 3 + 1] = p.y;
        mesh.positions[k * 3 + 2] = p.r * s;
        // ③ 법선도 같은 각도로 돌린다
        mesh.normals[k * 3 + 0] = nr * c;
        mesh.normals[k * 3 + 1] = ny;
        mesh.normals[k * 3 + 2] = nr * s;
        // ④ u = 둘레 위치(0~1), v = 단면 위치(0~1) — 5단계 문양 넣기에서 그림을 새길 좌표가 된다
        mesh.uvs[k * 2 + 0] = j / S;
        mesh.uvs[k * 2 + 1] = i / (M - 1);
      }
    }
    return mesh;
  }

  // 인덱스는 형태가 바뀌어도 그대로이므로 한 번만 만든다
  function buildIndices(M, S) {
    const idx = new Uint16Array((M - 1) * S * 6);
    let n = 0;
    for (let i = 0; i < M - 1; i++) {
      for (let j = 0; j < S; j++) {
        const a = i * (S + 1) + j; // 아래 줄 현재
        const b = a + 1;           // 아래 줄 다음 각도
        const c = a + (S + 1);     // 위 줄 현재
        const d = c + 1;           // 위 줄 다음 각도
        // 바깥에서 볼 때 반시계 방향(앞면)이 되도록 a→c→b, c→d→b 순서
        idx[n++] = a; idx[n++] = c; idx[n++] = b;
        idx[n++] = c; idx[n++] = d; idx[n++] = b;
      }
    }
    return idx;
  }

  /** Catmull-Rom 보간 — 조절점 사이를 부드럽게 잇는다 (곡선을 만드는 어디서든 쓸 수 있는 수학 도구) */
  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }

  /** 원판 단면: 중심에서 바깥으로 (법선이 아래를 향함). reverse() 하면 위를 향한다 */
  function diskProfile(radius, y, n = 6) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ r: (radius * i) / (n - 1), y });
    return pts;
  }

  /** 세로 사각형: x -0.5~0.5, y 0~1, +z를 바라봄 */
  function quadMesh() {
    return {
      positions: new Float32Array([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      indices: new Uint16Array([0, 1, 2, 2, 1, 3]),
    };
  }

  /** 메시를 GPU에 올리고 VAO로 묶는다. 셰이더에 없는 attribute는 건너뛴다 */
  function uploadMesh(gl, mesh, locs, dynamic = false) {
    const usage = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const make = (data, loc, size) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      if (loc !== undefined && loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }
      return buf;
    };
    const posBuf = make(mesh.positions, locs.aPos, 3);
    const nrmBuf = make(mesh.normals, locs.aNormal, 3);
    make(mesh.uvs, locs.aUV, 2);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    return { vao, posBuf, nrmBuf, count: mesh.indices.length };
  }

  /** 형태가 바뀌었을 때 위치·법선 버퍼만 다시 올린다 (정점 수가 같으므로 bufferSubData) */
  function updateMesh(gl, gpu, mesh) {
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.nrmBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.normals);
  }

  return { createRevolution, catmullRom, diskProfile, quadMesh, uploadMesh, updateMesh };
})();
