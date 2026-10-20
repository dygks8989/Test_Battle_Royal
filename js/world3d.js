/* 3D 월드 — Three.js(r128)로 섬·건물(내부 포함)·나무·충돌·봇·총알 판정을 담당
   좌표: 섬 좌표(map) 0~600m ↔ 월드 좌표 x = mx − 300, z = my − 300 (북쪽 = −z) */
(function () {
  const T = window.THREE;
  const D = LF.data;
  const EYE = 1.65, EYE_CROUCH = 1.1, GRAVITY = 22, RADIUS = 0.35;

  let renderer = null, scene, camera, sun, canvas;
  const solids = [];          // 총알·시야를 막는 정적 메시
  const colliders = [];       // 이동을 막는 박스 {x,z,hw,hd,a,top}
  const lootSpots = [];       // 건물 안 아이템 자리 (섬 좌표)
  const matCache = {};
  const dyn = { bots: {}, items: [], objs: [], colliders: [], solids: [], decals: [], clones: [] };
  const P = { x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, fl: 0, crouch: false, onGround: true, eye: EYE };
  let mode = 'play', specId = null, xrayOn = false, clock = 0, baseFov = 90, fovMul = 1;
  const ray = new T.Raycaster();

  /* ---------- 유틸 ---------- */
  function rng(seed) {
    return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const R = rng(20261020); // 맵은 매 판 같음 (아이템·스폰만 무작위)
  const rr = (a, b) => a + R() * (b - a);
  const toW = (mx, my) => [mx - 300, my - 300];
  const islandR = t => 288 + 10 * Math.sin(3 * t + 2.5) + 6 * Math.cos(5 * t);
  function islandPoints(n, scale = 1) {
    const pts = [];
    for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2, r = islandR(t) * scale; pts.push([300 + Math.cos(t) * r, 300 + Math.sin(t) * r]); }
    return pts;
  }
  function islandPath() { return islandPoints(96).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + 'Z'; }
  const ROADS = [[300, 300, 446, 498], [300, 300, 232, 520], [300, 300, 172, 100], [300, 300, 520, 330], [300, 300, 80, 186], [300, 300, 300, 86], [300, 300, 486, 128], [172, 100, 86, 418]];

  function mat(color, extra) {
    const k = color + (extra ? JSON.stringify(extra) : '');
    return matCache[k] || (matCache[k] = new T.MeshLambertMaterial(Object.assign({ color }, extra || {})));
  }
  function add(mesh, { solid = true, cast = true } = {}) {
    mesh.castShadow = cast; mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) solids.push(mesh);
    return mesh;
  }
  function box(w, h, d, x, y, z, color, o = {}) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), o.mat || mat(color));
    m.position.set(x, y, z);
    if (o.rotY) m.rotation.y = o.rotY;
    add(m, o);
    if (o.collide) colliders.push({ x, z, hw: w / 2, hd: d / 2, a: o.rotY || 0, top: y + h / 2 });
    return m;
  }

  /* ---------- 충돌 (원 vs 회전 박스) ---------- */
  function pushOut(pos, y, r) {
    const list = dyn.colliders.length ? colliders.concat(dyn.colliders) : colliders;
    for (const c of list) {
      if (c.top < y + 0.4) continue; // 공중에서 낮은 물체는 넘어감
      const dx = pos.x - c.x, dz = pos.z - c.z;
      if (Math.abs(dx) > c.hw + c.hd + r + 1 || Math.abs(dz) > c.hw + c.hd + r + 1) continue;
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
      const qx = Math.max(-c.hw, Math.min(c.hw, lx)), qz = Math.max(-c.hd, Math.min(c.hd, lz));
      let ex = lx - qx, ez = lz - qz;
      const dist = Math.hypot(ex, ez);
      if (dist >= r) continue;
      let nx, nz;
      if (dist > 1e-5) { nx = lx + ex / dist * (r - dist); nz = lz + ez / dist * (r - dist); }
      else { // 중심이 박스 안: 가장 얕은 쪽으로 밀어냄
        const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
        if (px < pz) { nx = Math.sign(lx || 1) * (c.hw + r); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (c.hd + r); }
      }
      pos.x = c.x + nx * ca + nz * sa;
      pos.z = c.z - nx * sa + nz * ca;
    }
    // 섬 밖(바다)으로 못 나감
    const d = Math.hypot(pos.x, pos.z), lim = islandR(Math.atan2(pos.z, pos.x)) - 4;
    if (d > lim) { pos.x *= lim / d; pos.z *= lim / d; }
  }
  function moveCircle(pos, dx, dz, y = 0, r = RADIUS) {
    pos.x += dx; pushOut(pos, y, r);
    pos.z += dz; pushOut(pos, y, r);
  }
  function freeAt(wx, wz, r) {
    for (const c of colliders) {
      const dx = wx - c.x, dz = wz - c.z, ca = Math.cos(c.a), sa = Math.sin(c.a);
      const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
      if (Math.abs(lx) < c.hw + r && Math.abs(lz) < c.hd + r) return false;
    }
    return true;
  }
  function insideBuilding(mx, my, margin) {
    return D.buildings.some(b => Math.abs(mx - b.x) < b.w / 2 + margin && Math.abs(my - b.y) < b.d / 2 + margin);
  }
  function onRunway(mx, my, margin) {
    const rw = D.runway, a = rw.rot * Math.PI / 180, dx = mx - rw.x, dy = my - rw.y;
    const lx = dx * Math.cos(-a) - dy * Math.sin(-a), ly = dx * Math.sin(-a) + dy * Math.cos(-a);
    return Math.abs(lx) < rw.len / 2 + margin && Math.abs(ly) < rw.wid / 2 + margin;
  }
  function landOK(mx, my, margin = 3) {
    const dx = mx - 300, dy = my - 300;
    return Math.hypot(dx, dy) < islandR(Math.atan2(dy, dx)) - 10 && !insideBuilding(mx, my, margin) && !onRunway(mx, my, 4);
  }

  /* ---------- 건물 ---------- */
  function wallSegs(len, openings, H) {
    const ops = openings.map(o => ({ a: o.at * len - o.w / 2, b: o.at * len + o.w / 2, y0: o.b, y1: o.t })).sort((p, q) => p.a - q.a);
    const segs = [];
    let cur = 0;
    for (const o of ops) {
      if (o.a > cur) segs.push([cur, o.a, 0, H]);
      if (o.y0 > 0) segs.push([Math.max(o.a, cur), o.b, 0, o.y0]);
      if (o.y1 < H) segs.push([Math.max(o.a, cur), o.b, o.y1, H]);
      cur = Math.max(cur, o.b);
    }
    if (cur < len) segs.push([cur, len, 0, H]);
    return segs.filter(s => s[1] - s[0] > 0.02);
  }

  function building(b, idx) {
    const [cx, cz] = toW(b.x, b.y);
    const H = b.h, TH = 0.25;
    const doorW = b.hangar ? b.w - 6 : b.big ? 4 : 1.3;
    const doorH = b.hangar ? H - 1.5 : b.big ? 3.6 : 2.2;
    const winOK = !b.hangar && !b.big;
    const wallMat = mat(b.color);
    [{ s: 'n', len: b.w + TH, axis: 'x', off: -b.d / 2 }, { s: 's', len: b.w + TH, axis: 'x', off: b.d / 2 },
     { s: 'w', len: b.d - TH, axis: 'z', off: -b.w / 2 }, { s: 'e', len: b.d - TH, axis: 'z', off: b.w / 2 }].forEach(sd => {
      const ops = [];
      const hasDoor = b.doors.includes(sd.s);
      if (hasDoor) ops.push({ at: 0.5, w: Math.min(doorW, sd.len - 1), b: 0, t: doorH });
      if (winOK && sd.len >= 5.5) [0.2, 0.8].forEach(at => ops.push({ at, w: 1.1, b: 1.0, t: 2.0 }));
      else if (winOK && !hasDoor && sd.len >= 4) ops.push({ at: 0.5, w: 1.1, b: 1.0, t: 2.0 });
      wallSegs(sd.len, ops, H).forEach(([a0, a1, y0, y1]) => {
        const L = a1 - a0, h = y1 - y0, mid = (a0 + a1) / 2 - sd.len / 2, y = y0 + h / 2, block = y0 < 1.5;
        if (sd.axis === 'x') box(L, h, TH, cx + mid, y, cz + sd.off, null, { mat: wallMat, collide: block });
        else box(TH, h, L, cx + sd.off, y, cz + mid, null, { mat: wallMat, collide: block });
      });
    });
    // 바닥
    box(b.w, 0.05, b.d, cx, 0.025, cz, b.hangar ? '#5d5f5c' : '#8b7a63', { solid: false, cast: false });
    // 내부 칸막이 (긴 쪽을 rooms개로 나눔, 가운데 문)
    const rooms = b.rooms || 1;
    for (let k = 1; k < rooms; k++) {
      if (b.w >= b.d) {
        const x = cx - b.w / 2 + b.w * k / rooms;
        wallSegs(b.d - TH, [{ at: 0.5, w: 1.1, b: 0, t: 2.2 }], H).forEach(([a0, a1, y0, y1]) =>
          box(0.2, y1 - y0, a1 - a0, x, y0 + (y1 - y0) / 2, cz + (a0 + a1) / 2 - (b.d - TH) / 2, '#d8d0c0', { collide: y0 < 1.5 }));
      } else {
        const z = cz - b.d / 2 + b.d * k / rooms;
        wallSegs(b.w - TH, [{ at: 0.5, w: 1.1, b: 0, t: 2.2 }], H).forEach(([a0, a1, y0, y1]) =>
          box(a1 - a0, y1 - y0, 0.2, cx + (a0 + a1) / 2 - (b.w - TH) / 2, y0 + (y1 - y0) / 2, z, '#d8d0c0', { collide: y0 < 1.5 }));
      }
    }
    roof(b, cx, cz, H);
    if (b.tower) {
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(0.3, 6, 0.3, cx + sx * 2.7, H + 3, cz + sz * 2.7, '#77746c'));
      box(7, 2.6, 7, cx, H + 7.3, cz, null, { mat: mat('#7fa6b8', { transparent: true, opacity: 0.75 }) });
      box(7.6, 0.3, 7.6, cx, H + 8.75, cz, '#55524c');
    }
    // 실내 상자와 아이템 자리
    const crates = b.hangar ? 7 : Math.max(1, rooms);
    for (let i = 0; i < crates; i++) {
      const s = b.hangar ? 1.4 : 1.0;
      const x = cx + rr(-b.w / 2 + 1.2, b.w / 2 - 1.2), z = cz + rr(-b.d / 2 + 1.2, b.d / 2 - 1.2);
      if (Math.abs(z - (cz + b.d / 2)) < 2.5 || Math.abs(z - (cz - b.d / 2)) < 2.5) continue; // 출입구 앞은 비움
      if (!freeAt(x, z, s)) continue;
      box(s, s, s, x, s / 2, z, '#8a6b3f', { collide: true });
      if (b.hangar && R() < 0.5) box(s, s, s, x, s * 1.5, z, '#7d6038', { collide: false });
    }
    const spots = (b.hangar ? 6 : rooms + 1);
    for (let i = 0, tries = 0; i < spots && tries < 40; tries++) {
      const x = cx + rr(-b.w / 2 + 1, b.w / 2 - 1), z = cz + rr(-b.d / 2 + 1, b.d / 2 - 1);
      if (!freeAt(x, z, 0.6)) continue;
      lootSpots.push({ mx: x + 300, my: z + 300, b: idx });
      i++;
    }
  }

  function roof(b, cx, cz, H) {
    if (b.roof === 'flat') { box(b.w + 0.5, 0.3, b.d + 0.5, cx, H + 0.15, cz, '#5b5a55'); return; }
    if (b.roof === 'gable') {
      const th = 0.5, col = '#7a3e32', alongX = b.w >= b.d;
      const span = (alongX ? b.d : b.w) / 2 + 0.35, slab = span / Math.cos(th), rise = (span - 0.35) * Math.tan(th);
      const L = (alongX ? b.w : b.d) + 0.6;
      [1, -1].forEach(sgn => {
        const m = alongX ? box(L, 0.18, slab, cx, H + rise / 2 + 0.1, cz + sgn * span / 2, col) : box(slab, 0.18, L, cx + sgn * span / 2, H + rise / 2 + 0.1, cz, col);
        if (alongX) m.rotation.x = sgn * th; else m.rotation.z = -sgn * th;
      });
      const half = span - 0.35;
      const shape = new T.Shape(); shape.moveTo(-half, 0); shape.lineTo(half, 0); shape.lineTo(0, rise); shape.closePath();
      [1, -1].forEach(sgn => {
        const m = new T.Mesh(new T.ShapeGeometry(shape), mat(b.color, { side: T.DoubleSide }));
        if (alongX) { m.rotation.y = Math.PI / 2; m.position.set(cx + sgn * b.w / 2, H, cz); }
        else m.position.set(cx, H, cz + sgn * b.d / 2);
        add(m);
      });
      return;
    }
    // arch (격납고)
    const r = b.w / 2 + 0.2, k = Math.min(1, (b.h * 0.55) / r);
    const geo = new T.CylinderGeometry(r, r, b.d + 0.3, 28, 1, true, -Math.PI / 2, Math.PI);
    geo.rotateX(-Math.PI / 2);
    const arch = new T.Mesh(geo, mat(b.color, { side: T.DoubleSide }));
    arch.scale.y = k; arch.position.set(cx, H, cz);
    add(arch);
    [1, -1].forEach(sgn => {
      const end = new T.Mesh(new T.CircleGeometry(r, 28, 0, Math.PI), mat(b.color, { side: T.DoubleSide }));
      end.scale.y = k; end.position.set(cx, H, cz + sgn * b.d / 2);
      add(end);
    });
  }

  /* ---------- 지형·조경 ---------- */
  function terrain() {
    const shapeOf = scale => { const s = new T.Shape(); islandPoints(120, scale).forEach(([mx, my], i) => { const [x, z] = toW(mx, my); i ? s.lineTo(x, -z) : s.moveTo(x, -z); }); return s; };
    const ground = new T.Mesh(new T.ShapeGeometry(shapeOf(1)), mat('#5f7d43'));
    ground.rotation.x = -Math.PI / 2;
    add(ground, { cast: false });
    const sand = new T.Mesh(new T.ShapeGeometry(shapeOf(1.035)), mat('#cdbb8a'));
    sand.rotation.x = -Math.PI / 2; sand.position.y = -0.06;
    add(sand, { solid: false, cast: false });
    const water = new T.Mesh(new T.PlaneGeometry(4000, 4000), mat('#2f6f8f'));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.35;
    add(water, { solid: false, cast: false });
    // 활주로
    const rw = D.runway, [rx, rz] = toW(rw.x, rw.y), rot = -rw.rot * Math.PI / 180;
    const strip = new T.Mesh(new T.PlaneGeometry(rw.len, rw.wid).rotateX(-Math.PI / 2), mat('#55575a'));
    strip.position.set(rx, 0.03, rz); strip.rotation.y = rot;
    add(strip, { solid: false, cast: false });
    for (let i = -5; i <= 5; i++) {
      const m = new T.Mesh(new T.PlaneGeometry(9, 0.6).rotateX(-Math.PI / 2), mat('#e6e3d6'));
      m.position.set(rx + Math.cos(rot) * i * 19, 0.04, rz - Math.sin(rot) * i * 19); m.rotation.y = rot;
      add(m, { solid: false, cast: false });
    }
    // 흙길
    ROADS.forEach(([x1, y1, x2, y2]) => {
      const len = Math.hypot(x2 - x1, y2 - y1), [wx, wz] = toW((x1 + x2) / 2, (y1 + y2) / 2);
      const m = new T.Mesh(new T.PlaneGeometry(len, 5).rotateX(-Math.PI / 2), mat('#9a8a64'));
      m.position.set(wx, 0.015, wz); m.rotation.y = -Math.atan2(y2 - y1, x2 - x1);
      add(m, { solid: false, cast: false });
    });
    // 멀리 보이는 섬
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 0.4, d = 760 + (i % 3) * 120;
      const m = new T.Mesh(new T.ConeGeometry(rr(90, 160), rr(40, 90), 7), mat('#4f6b4c'));
      m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); m.scale.z = 0.6;
      add(m, { solid: false, cast: false });
    }
  }

  function landmarks() {
    // 등대
    const [lx, lz] = toW(506, 100);
    add(new T.Mesh(new T.CylinderGeometry(2.2, 3, 20, 16), mat('#efece2'))).position.set(lx, 10, lz);
    [6, 14].forEach(y => add(new T.Mesh(new T.CylinderGeometry(2.75 - y * 0.035, 2.85 - y * 0.035, 1.6, 16), mat('#c0392b'))).position.set(lx, y, lz));
    add(new T.Mesh(new T.CylinderGeometry(1.8, 1.8, 2, 12), new T.MeshBasicMaterial({ color: '#fff3c4' }))).position.set(lx, 21, lz);
    add(new T.Mesh(new T.ConeGeometry(2.3, 2, 12), mat('#c0392b'))).position.set(lx, 23, lz);
    colliders.push({ x: lx, z: lz, hw: 2.8, hd: 2.8, a: 0, top: 24 });
    // 레이더
    const [rx, rz] = toW(62, 170);
    add(new T.Mesh(new T.CylinderGeometry(0.25, 0.35, 6, 8), mat('#777'))).position.set(rx, 3, rz);
    const dish = add(new T.Mesh(new T.CylinderGeometry(3.2, 0.8, 0.7, 20), mat('#d6d6d0')));
    dish.position.set(rx, 6.6, rz); dish.rotation.x = 0.9;
    colliders.push({ x: rx, z: rz, hw: 0.5, hd: 0.5, a: 0, top: 6 });
    // 컨테이너
    [[520, 349, '#b5523b'], [528, 352, '#3b6fb5'], [328, 258, '#c49a3a'], [336, 258, '#4f8a4b']].forEach(([mx, my, c], i) => {
      const [x, z] = toW(mx, my);
      box(6, 2.6, 2.4, x, 1.3, z, c, { collide: true });
      if (i === 2) box(6, 2.6, 2.4, x, 3.9, z, '#8a5a3a');
    });
    // 항구 부두 (장식)
    const [hx, hz] = toW(575, 336);
    box(26, 0.3, 4, hx, 0.05, hz, '#7d6448', { solid: false });
  }

  function trees() {
    const spots = [];
    D.forests.forEach(f => {
      for (let i = 0; i < f.r * 1.3; i++) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * f.r;
        spots.push([f.x + Math.cos(a) * d, f.y + Math.sin(a) * d]);
      }
    });
    for (let i = 0; i < 140; i++) spots.push([rr(20, 580), rr(20, 580)]);
    const ok = spots.filter(([mx, my]) => landOK(mx, my, 4) && Math.hypot(mx - 506, my - 100) > 6 && Math.hypot(mx - 62, my - 170) > 6);
    const trunkGeo = new T.CylinderGeometry(0.22, 0.32, 3, 6);
    const crownGeo = new T.ConeGeometry(1.9, 5, 7);
    const trunks = new T.InstancedMesh(trunkGeo, mat('#6b4a2e'), ok.length);
    const crowns = [new T.InstancedMesh(crownGeo, mat('#3f6b35'), ok.length), new T.InstancedMesh(crownGeo, mat('#4d7d3c'), ok.length)];
    const cnt = [0, 0];
    const m4 = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    ok.forEach(([mx, my], i) => {
      const [x, z] = toW(mx, my), s = rr(0.8, 1.4);
      m4.compose(new T.Vector3(x, 1.5 * s, z), q.setFromAxisAngle(up, R() * 6), new T.Vector3(s, s, s));
      trunks.setMatrixAt(i, m4);
      const k = R() < 0.5 ? 0 : 1;
      m4.compose(new T.Vector3(x, (3 + 2.3) * s, z), q, new T.Vector3(s, s, s));
      crowns[k].setMatrixAt(cnt[k]++, m4);
      colliders.push({ x, z, hw: 0.35 * s, hd: 0.35 * s, a: 0, top: 6 });
    });
    crowns.forEach((c, k) => { c.count = cnt[k]; });
    [trunks, ...crowns].forEach(m => add(m));
    // 바위
    for (let i = 0; i < 45; i++) {
      const mx = rr(30, 570), my = rr(30, 570);
      if (!landOK(mx, my, 3)) continue;
      const [x, z] = toW(mx, my), r = rr(0.6, 1.6);
      const m = add(new T.Mesh(new T.DodecahedronGeometry(r, 0), mat('#8c8c84')));
      m.position.set(x, r * 0.45, z); m.rotation.set(R(), R(), R());
      colliders.push({ x, z, hw: r * 0.8, hd: r * 0.8, a: 0, top: r });
    }
    // 바깥 상자 무더기
    for (let i = 0; i < 30; i++) {
      const mx = rr(40, 560), my = rr(40, 560);
      if (!landOK(mx, my, 3)) continue;
      const [x, z] = toW(mx, my);
      box(1.2, 1.2, 1.2, x, 0.6, z, '#8a6b3f', { collide: true });
      if (R() < 0.5) box(1.2, 1.2, 1.2, x + 1.3, 0.6, z + rr(-0.3, 0.3), '#7d6038', { collide: true });
    }
  }

  /* ---------- 사람 모델 (봇·분신) ---------- */
  function humanoid(color) {
    const g = new T.Group();
    const part = (geo, m, x, y, z, p) => { const me = new T.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.userData.part = p; g.add(me); return me; };
    const legs = [part(new T.BoxGeometry(0.22, 0.85, 0.24), mat('#2f3338'), -0.13, 0.43, 0, 'body'), part(new T.BoxGeometry(0.22, 0.85, 0.24), mat('#2f3338'), 0.13, 0.43, 0, 'body')];
    legs.forEach(l => { l.geometry.translate(0, -0.4, 0); l.position.y = 0.85; });
    part(new T.BoxGeometry(0.56, 0.64, 0.32), mat(color), 0, 1.18, 0, 'body');
    part(new T.SphereGeometry(0.17, 12, 10), mat('#d9a88a'), 0, 1.68, 0, 'head');
    part(new T.BoxGeometry(0.14, 0.62, 0.14), mat(color), -0.36, 1.18, -0.12, 'body').rotation.x = -0.9;
    part(new T.BoxGeometry(0.14, 0.62, 0.14), mat(color), 0.36, 1.18, -0.12, 'body').rotation.x = -0.9;
    part(new T.BoxGeometry(0.08, 0.1, 0.7), mat('#22262a'), 0.12, 1.3, -0.5, 'body');
    const flash = new T.Mesh(new T.SphereGeometry(0.12, 6, 6), new T.MeshBasicMaterial({ color: '#ffd27a' }));
    flash.position.set(0.12, 1.3, -0.9); flash.visible = false; g.add(flash);
    g.userData.legs = legs; g.userData.flash = flash;
    return g;
  }
  const xrayMat = new T.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.65, depthTest: false });
  const decoyMat = new T.MeshBasicMaterial({ color: '#aaaaaa', transparent: true, opacity: 0.5, depthTest: false });
  function setXrayLook(g, on, m) {
    g.traverse(o => {
      if (!o.isMesh || o === g.userData.flash) return;
      if (on) { o.userData.orig = o.userData.orig || o.material; o.material = m; o.renderOrder = 999; }
      else if (o.userData.orig) { o.material = o.userData.orig; o.renderOrder = 0; }
    });
  }

  /* ---------- 초기화 ---------- */
  function init(cv) {
    if (renderer) return;
    canvas = cv;
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    scene = new T.Scene();
    scene.background = new T.Color('#a9c8dc');
    scene.fog = new T.Fog('#a9c8dc', 70, 420);
    camera = new T.PerspectiveCamera(80, 1, 0.05, 1500);
    camera.rotation.order = 'YXZ';
    scene.add(new T.HemisphereLight('#e4f1ff', '#9a9682', 0.7));
    scene.add(new T.AmbientLight('#ffffff', 0.38)); // 실내도 보이도록 넉넉하게
    sun = new T.DirectionalLight('#fff1d6', 0.85);
    sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
    sun.shadow.camera.far = 300; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    terrain();
    D.buildings.forEach(building);
    landmarks();
    trees();
  }

  function applySettings() {
    if (!renderer) return;
    const q = LF.store.get('quality');
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(q === 'low' ? 0.75 : q === 'mid' ? Math.min(dpr, 1.25) : Math.min(dpr, 2));
    const shadows = q !== 'low';
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows;
      Object.values(matCache).forEach(m => { m.needsUpdate = true; });
    }
    sun.castShadow = shadows;
    const size = q === 'high' ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.fog.far = q === 'low' ? 260 : 420;
    baseFov = LF.store.get('fov');
    resize(true);
  }

  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (force || canvas.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
    }
    // 설정의 FOV는 가로 기준 → 세로 FOV로 변환
    const hf = baseFov / fovMul * Math.PI / 180;
    camera.fov = 2 * Math.atan(Math.tan(hf / 2) / camera.aspect) * 180 / Math.PI;
    camera.updateProjectionMatrix();
  }

  /* ---------- 매치 리셋 ---------- */
  function reset() {
    Object.keys(dyn.bots).forEach(removeBot);
    dyn.items.forEach(m => scene.remove(m)); dyn.items = [];
    dyn.objs.forEach(o => scene.remove(o)); dyn.objs = [];
    dyn.decals.forEach(o => scene.remove(o)); dyn.decals = [];
    dyn.clones.forEach(c => scene.remove(c.g)); dyn.clones = [];
    dyn.colliders = []; dyn.solids = [];
    mode = 'play'; specId = null; xrayOn = false; fovMul = 1;
    P.vy = 0; P.y = 0; P.onGround = true; P.crouch = false; P.pitch = 0; P.eye = EYE;
    camera.rotation.z = 0;
    applySettings();
  }

  function findFree(mx, my, r = 0.6) {
    for (let i = 0; i < 200; i++) {
      const a = i * 2.4, d = i * 0.35;
      const x = mx + Math.cos(a) * d, y = my + Math.sin(a) * d;
      if (freeAt(x - 300, y - 300, r) && !insideBuilding(x, y, 0.3)) return [x, y];
    }
    return [mx, my];
  }

  /* ---------- 플레이어 ---------- */
  function setPlayer(mx, my, facing) {
    P.x = mx - 300; P.z = my - 300;
    P.yaw = -facing - Math.PI / 2; // facing(섬 좌표 각도) → 카메라 yaw
  }
  function look(dx, dy, free) {
    if (free) { P.fl = Math.max(-1.9, Math.min(1.9, P.fl - dx)); P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - dy)); return; } // 자유 둘러보기: 이동 방향은 그대로
    P.yaw -= dx;
    P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - dy));
  }
  function stepPlayer(dt, inp) {
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    let mx = fx * inp.f + rx * inp.s, mz = fz * inp.f + rz * inp.s;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; moveCircle(P, mx * inp.speed * dt, mz * inp.speed * dt, P.y); }
    if (inp.jump && P.onGround) { P.vy = inp.jump; P.onGround = false; }
    P.vy -= GRAVITY * dt; P.y += P.vy * dt;
    if (P.y <= 0) { P.y = 0; P.vy = 0; P.onGround = true; }
    P.crouch = inp.crouch;
    P.eye += ((P.crouch ? EYE_CROUCH : EYE) - P.eye) * Math.min(1, dt * 12);
    return { moving: len > 0 };
  }
  function blink(dist) {
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    for (let d = 0; d < dist; d += 0.5) {
      const nx = P.x + fx * 0.5, nz = P.z + fz * 0.5;
      if (!freeAt(nx, nz, RADIUS)) break; // 벽·방벽에 막히면 그 앞에서 멈춤
      if (dyn.colliders.some(c => Math.hypot(nx - c.x, nz - c.z) < c.hw + RADIUS)) break;
      P.x = nx; P.z = nz;
    }
  }
  const playerMap = () => ({ x: P.x + 300, y: P.z + 300 });
  const facing = () => Math.atan2(-Math.cos(P.yaw), -Math.sin(P.yaw));
  const camDir = () => { const v = new T.Vector3(); camera.getWorldDirection(v); return v; };

  /* ---------- 사격·시야 ---------- */
  function hitList(withBots) {
    const list = solids.concat(dyn.solids);
    if (withBots) {
      Object.values(dyn.bots).forEach(b => { if (!b.dead) list.push(b.g); });
      dyn.clones.forEach(c => list.push(c.g));
    }
    return list;
  }
  function ownerOf(o) {
    while (o) { if (o.userData.botId) return { botId: o.userData.botId }; if (o.userData.cloneRef) return { clone: o.userData.cloneRef }; o = o.parent; }
    return {};
  }
  function syncCamera() {
    if (mode !== 'play') return;
    camera.position.set(P.x, P.y + P.eye, P.z);
    camera.rotation.set(P.pitch, P.yaw + P.fl, 0, 'YXZ');
    camera.updateMatrixWorld();
  }
  function shoot(spread, range = 600) {
    syncCamera(); // 이번 프레임에 시점이 바뀌었어도 정확히 화면 중앙으로
    const dir = camDir();
    if (spread > 0) {
      const up = Math.abs(dir.y) > 0.95 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0);
      const a = new T.Vector3().crossVectors(dir, up).normalize(), b = new T.Vector3().crossVectors(dir, a).normalize();
      const ang = Math.random() * Math.PI * 2, r = Math.tan(spread) * Math.sqrt(Math.random());
      dir.addScaledVector(a, Math.cos(ang) * r).addScaledVector(b, Math.sin(ang) * r).normalize();
    }
    ray.set(camera.position, dir); ray.far = range;
    const hit = ray.intersectObjects(hitList(true), true)[0];
    if (!hit) return null;
    const own = ownerOf(hit.object);
    const res = { dist: hit.distance, point: hit.point, part: hit.object.userData.part || null, botId: own.botId || null, clone: own.clone || null };
    if (!res.botId && !res.clone && hit.face) decal(hit);
    return res;
  }
  function decal(hit) {
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const m = new T.Mesh(new T.CircleGeometry(0.06, 8), new T.MeshBasicMaterial({ color: '#1b1b1b', polygonOffset: true, polygonOffsetFactor: -4 }));
    m.position.copy(hit.point).addScaledVector(n, 0.01);
    m.lookAt(m.position.clone().add(n));
    scene.add(m); dyn.decals.push(m);
    if (dyn.decals.length > 60) scene.remove(dyn.decals.shift());
  }
  function los(ax, ay, az, bx, by, bz) {
    const from = new T.Vector3(ax - 300, ay, az - 300), to = new T.Vector3(bx - 300, by, bz - 300);
    const d = from.distanceTo(to);
    ray.set(from, to.sub(from).normalize()); ray.far = d - 0.3;
    return ray.intersectObjects(hitList(false), false).length === 0;
  }
  const eyePos = () => ({ x: P.x + 300, y: P.y + P.eye, z: P.z + 300 });

  /* ---------- 봇 ---------- */
  function addBot(id, color, mx, my) {
    const g = humanoid(color);
    g.userData.botId = id;
    g.position.set(mx - 300, 0, my - 300);
    scene.add(g);
    dyn.bots[id] = { g, dead: false };
    if (xrayOn) setXrayLook(g, true, xrayMat);
  }
  function poseBot(id, mx, my, yaw, moving) {
    const b = dyn.bots[id]; if (!b || b.dead) return;
    b.g.position.set(mx - 300, 0, my - 300);
    b.g.rotation.y = yaw;
    const sw = moving ? Math.sin(clock * 9) * 0.6 : 0;
    b.g.userData.legs[0].rotation.x = sw; b.g.userData.legs[1].rotation.x = -sw;
  }
  function botFire(id) {
    const b = dyn.bots[id]; if (!b) return;
    const f = b.g.userData.flash; f.visible = true; setTimeout(() => { f.visible = false; }, 60);
  }
  function killBot(id) {
    const b = dyn.bots[id]; if (!b || b.dead) return;
    b.dead = true;
    setXrayLook(b.g, false);
    b.g.rotation.z = Math.PI / 2; b.g.position.y = 0.25;
    setTimeout(() => removeBot(id), 8000);
  }
  function removeBot(id) { const b = dyn.bots[id]; if (!b) return; scene.remove(b.g); delete dyn.bots[id]; }
  function setXray(on) {
    xrayOn = on;
    Object.values(dyn.bots).forEach(b => { if (!b.dead) setXrayLook(b.g, on, xrayMat); });
    dyn.clones.forEach(c => setXrayLook(c.g, on, decoyMat));
  }

  /* ---------- 아이템 ---------- */
  const ITEM_LOOK = { weapon: ['#3a3f45', [0.9, 0.18, 0.3]], ammo: ['#d4a72c', [0.35, 0.25, 0.25]], armor: ['#3f6fb5', [0.55, 0.45, 0.2]], medkit: ['#f0f0f0', [0.4, 0.3, 0.3]], ticket: ['#f2a93b', [0.5, 0.06, 0.3]] };
  function addItem(kind, mx, my) {
    const [c, s] = ITEM_LOOK[kind];
    const m = new T.Mesh(new T.BoxGeometry(s[0], s[1], s[2]), kind === 'ticket' ? new T.MeshBasicMaterial({ color: c }) : mat(c));
    m.position.set(mx - 300, 0.45, my - 300);
    m.userData.phase = Math.random() * 6;
    if (kind === 'medkit') { const cross = new T.Mesh(new T.BoxGeometry(0.42, 0.08, 0.1), mat('#d63a2f')); cross.position.y = 0.16; m.add(cross); }
    const ring = new T.Mesh(new T.RingGeometry(0.45, 0.55, 20).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: kind === 'ticket' ? '#f2a93b' : '#ffffff', transparent: true, opacity: 0.35 }));
    ring.position.set(mx - 300, 0.07, my - 300);
    m.userData.ring = ring;
    scene.add(m, ring); dyn.items.push(m);
    return m;
  }
  function removeItem(m) { scene.remove(m, m.userData.ring); dyn.items = dyn.items.filter(x => x !== m); }

  /* ---------- 능력 오브젝트 ---------- */
  function ahead(dist) { return [P.x - Math.sin(P.yaw) * dist, P.z - Math.cos(P.yaw) * dist]; }
  function addBarrier() {
    const [x, z] = ahead(3);
    const m = new T.Mesh(new T.BoxGeometry(4, 2.5, 0.3), new T.MeshLambertMaterial({ color: '#6ebeff', transparent: true, opacity: 0.45, emissive: '#1d4f7a' }));
    m.position.set(x, 1.25, z); m.rotation.y = P.yaw;
    scene.add(m); dyn.objs.push(m); dyn.solids.push(m);
    const col = { x, z, hw: 2, hd: 0.15, a: P.yaw, top: 2.5 };
    dyn.colliders.push(col);
    return { remove() { scene.remove(m); dyn.solids = dyn.solids.filter(s => s !== m); dyn.colliders = dyn.colliders.filter(c => c !== col); } };
  }
  function addTurret() {
    const [x, z] = ahead(3);
    const g = new T.Group();
    const base = new T.Mesh(new T.CylinderGeometry(0.15, 0.5, 0.9, 8), mat('#4b5258')); base.position.y = 0.45;
    const head = new T.Group(); head.position.y = 1.0;
    const body = new T.Mesh(new T.BoxGeometry(0.5, 0.35, 0.5), mat('#5b636a'));
    const barrel = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.7), mat('#22262a')); barrel.position.z = -0.5;
    const eye = new T.Mesh(new T.SphereGeometry(0.06, 6, 6), new T.MeshBasicMaterial({ color: '#ff4d40' })); eye.position.set(0, 0.1, -0.26);
    head.add(body, barrel, eye); g.add(base, head);
    g.position.set(x, 0, z);
    scene.add(g); dyn.objs.push(g);
    return { mx: x + 300, my: z + 300, aim(tx, ty) { head.rotation.y = Math.atan2(-(tx - 300 - x), -(ty - 300 - z)); }, remove() { scene.remove(g); } };
  }
  function addClone(color, offset) {
    const g = humanoid(color);
    const yaw = P.yaw + offset;
    g.position.set(P.x, 0, P.z); g.rotation.y = yaw;
    const c = { g, yaw, pos: { x: P.x, z: P.z }, alive: true };
    g.userData.cloneRef = c;
    scene.add(g); dyn.clones.push(c);
    if (xrayOn) setXrayLook(g, true, decoyMat);
    return c;
  }
  function removeClone(c) { c.alive = false; scene.remove(c.g); dyn.clones = dyn.clones.filter(x => x !== c); }
  const clones = () => dyn.clones.map(c => ({ ref: c, x: c.pos.x + 300, y: c.pos.z + 300 }));

  /* ---------- 카메라 모드 ---------- */
  function setMode(m, id) { mode = m; specId = id || null; }
  function setAds(mul) { fovMul = mul; resize(false); }

  function render(dt) {
    if (!renderer) return;
    clock += dt;
    resize(false);
    // 아이템 회전·둥실
    dyn.items.forEach(m => { m.rotation.y += dt * 1.4; m.position.y = 0.45 + Math.sin(clock * 2 + m.userData.phase) * 0.06; });
    // 분신: ±45°로 달림
    dyn.clones.forEach(c => {
      moveCircle(c.pos, -Math.sin(c.yaw) * 5 * dt, -Math.cos(c.yaw) * 5 * dt);
      c.g.position.set(c.pos.x, 0, c.pos.z);
      const sw = Math.sin(clock * 11) * 0.7; c.g.userData.legs[0].rotation.x = sw; c.g.userData.legs[1].rotation.x = -sw;
      if (Math.random() < dt * 1.2) { const f = c.g.userData.flash; f.visible = true; setTimeout(() => { f.visible = false; }, 60); }
    });
    if (mode === 'spectate' && specId && dyn.bots[specId] && !dyn.bots[specId].dead) {
      const g = dyn.bots[specId].g;
      camera.position.set(g.position.x + Math.sin(g.rotation.y) * 3.5, 2.6, g.position.z + Math.cos(g.rotation.y) * 3.5);
      camera.lookAt(g.position.x, 1.5, g.position.z);
    } else if (mode === 'dead') {
      camera.position.set(P.x, Math.max(0.35, camera.position.y - dt * 2), P.z);
      camera.rotation.set(P.pitch, P.yaw, Math.min(0.5, camera.rotation.z + dt), 'YXZ');
    } else {
      camera.position.set(P.x, P.y + P.eye, P.z);
      camera.rotation.set(P.pitch, P.yaw + P.fl, 0, 'YXZ');
    }
    sun.position.set(camera.position.x + 60, 110, camera.position.z + 40);
    sun.target.position.set(camera.position.x, 0, camera.position.z);
    renderer.render(scene, camera);
  }

  LF.world3d = {
    init, reset, applySettings, render, islandPath, islandR, roads: ROADS, get lootSpots() { return lootSpots; },
    findFree, setPlayer, look, endFreelook: () => { P.fl = 0; }, stepPlayer, blink, playerMap, facing, eyePos, highJump: v => { P.vy = v; P.onGround = false; },
    get onGround() { return P.onGround; }, get yaw() { return P.yaw; }, getPos: () => ({ x: P.x, z: P.z }), setPos: (mx, my) => { P.x = mx - 300; P.z = my - 300; },
    shoot, los, addBot, poseBot, botFire, killBot, removeBot, setXray, moveCircle: (p, dx, dz) => moveCircle(p, dx, dz), freeAt: (mx, my, r) => freeAt(mx - 300, my - 300, r),
    addItem, removeItem, addBarrier, addTurret, addClone, removeClone, clones, setMode, setAds
  };
})();
