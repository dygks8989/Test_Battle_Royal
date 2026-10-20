/* 인게임 — 3D 월드(world3d.js) 위에 HUD, 자기장·무기·능력·티켓·봇·킬피드 로직
   실제 판정은 서버(Godot) 몫이고, 여기서는 퍼블리싱 확인용으로 클라이언트에서 흉내 냄 */
(function () {
  const { $, esc, store, toast, rand, randInt, pick, shuffle, clamp, fmtTime, icon, keyLabel, createChat } = LF;
  const D = LF.data;
  const W = D.weapons, AB = D.abilities;
  const WD = LF.world3d;
  const now = () => performance.now() / 1000;
  const P0 = Object.keys(AB).filter(id => AB[id].p === 0);
  const PREP = 10, TICKET_CAST = 1.0, SWAP_TIME = 8, MEDKIT_CAST = 3, MAX_TICKETS = 3;
  const SPREAD = { 맨손: 0, 권총: 1.0, 기관단총: 1.2, 돌격소총: 0.8, 경기관총: 1.1, 산탄총: 0, 지정사수소총: 0.25, 저격총: 0.1, 근접: 0 }; // 기본 퍼짐(도)
  const TH = D.throwables, THROW_KINDS = Object.keys(TH), THROW_CD = 0.9;
  const canvas = $('#gameCanvas');

  let G = null, raf = 0, last = 0, suppressMenu = false;
  const held = new Set();

  const chat = createChat($('#hudChat'), {
    onSend() {
      if (G && G.dead && !G.deadChatNoted) { chat.add(null, '죽은 플레이어의 채팅은 생존자에게 보이지 않아요.', 'sys'); G.deadChatNoted = true; }
      chat.input.blur();
    }
  });

  /* ================= 유틸 ================= */
  const K = action => keyLabel(store.get('keys')[action]);
  const me = () => G.players.find(p => p.me);
  const alive = () => G.players.filter(p => p.alive);
  const isAlive = id => G.players.find(p => p.id === id).alive;
  const has = id => G.passives.some(s => s && s.id === id);
  const curW = () => W[G.cur >= 0 && G.weapons[G.cur] ? G.weapons[G.cur] : 'fists'];
  const isPrep = () => G.zone.state === 'prep';
  const castKind = () => G.cast && G.cast.kind;
  const enemyName = () => { const e = alive().filter(p => !p.me); return e.length ? pick(e).name : '적'; };
  const later = (fn, ms) => { const id = setTimeout(fn, ms); G.timers.push(id); return id; };
  const overlayOpen = () => ['invOverlay', 'mapOverlay', 'menuOverlay', 'startOverlay', 'deathOverlay'].some(id => !$('#' + id).hidden);

  function banner(text, cls = '') {
    const b = $('#banner');
    b.className = 'banner show ' + cls;
    b.innerHTML = text;
    clearTimeout(banner.t);
    banner.t = setTimeout(() => { b.className = 'banner'; }, 2600);
  }
  let hintT = 0;
  function hint(msg) { if (now() - hintT < 0.6) return; hintT = now(); toast(msg, 'warn'); }

  /* ================= 조작법 ================= */
  const CONTROLS = [
    ['이동', ['move_forward', 'move_left', 'move_back', 'move_right']], ['시점', null, '마우스'], ['달리기', ['sprint']],
    ['앉기', ['crouch']], ['점프', ['jump']], ['사격', ['fire']], ['조준', ['aim']], ['재장전', ['reload']],
    ['줍기', ['interact']], ['능력 1 / 2', ['ability_1', 'ability_2']], ['랜덤 능력 티켓', ['use_ticket']], ['새 능력 버리기', ['discard_ability']],
    ['무기 선택', ['weapon_1', 'weapon_2', 'weapon_3']], ['투척 / 바꾸기', ['throw', 'cycle_throw']], ['인벤토리', ['inventory']], ['지도', ['map']],
    ['자유 둘러보기', ['freelook']], ['채팅', ['chat']], ['메뉴 · 마우스 풀기', null, 'Esc']
  ];
  function renderControls() {
    const html = CONTROLS.map(([label, acts, fixed]) => `<div><span>${label}</span><b>${acts ? acts.map(a => `<kbd>${esc(K(a))}</kbd>`).join('') : `<kbd>${fixed}</kbd>`}</b></div>`).join('');
    document.querySelectorAll('[data-controls]').forEach(el => { el.innerHTML = html; });
    $('#keyHint').innerHTML = [['이동', K('move_forward') + K('move_left') + K('move_back') + K('move_right')], ['달리기', K('sprint')], ['점프', K('jump')], ['줍기', K('interact')],
      ['티켓', K('use_ticket')], ['능력', K('ability_1') + '/' + K('ability_2')], ['투척', K('throw')], ['안내 숨기기', 'F1']].map(([l, k]) => `<span><kbd>${esc(k)}</kbd>${l}</span>`).join('');
  }

  /* ================= 마우스 고정 (Pointer Lock) ================= */
  function lock() {
    if (!G || G.over || G.dead || !canvas.requestPointerLock) return;
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { /* pointerlockerror 이벤트에서 처리 */ }); } catch (e) { /* 무시 */ }
  }
  function unlock(silent) { if (document.pointerLockElement) { suppressMenu = !!silent; document.exitPointerLock(); } }
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    document.querySelector('.screen-hud').classList.toggle('locked', locked);
    if (!G) return;
    G.locked = locked;
    if (locked) { G.everLocked = true; ['startOverlay', 'menuOverlay', 'clickHint'].forEach(id => { $('#' + id).hidden = true; }); return; }
    G.firing = false; G.aiming = false; held.clear();
    if (LF.currentScreen !== 'hud' || G.over || G.dead) return;
    if (suppressMenu) { suppressMenu = false; return; }
    if (!overlayOpen() && !LF.settings.isOpen) $('#menuOverlay').hidden = false;
  });
  document.addEventListener('pointerlockerror', () => {
    if (!G || LF.currentScreen !== 'hud') return;
    if (!G.everLocked) {
      G.noLock = true;
      $('#startOverlay').hidden = true;
      toast('이 환경에서는 마우스 고정이 안 돼요. 누른 채 끌면 시점, 짧게 클릭하면 사격이에요.', 'warn');
    } else $('#clickHint').hidden = false;
  });

  /* ================= 지도 ================= */
  function buildMap(svg, big, maskId) {
    const z = G.myZone, rw = D.runway;
    const grid = big ? Array.from({ length: 5 }, (_, i) => `<path d="M${(i + 1) * 100} 0V600M0 ${(i + 1) * 100}H600" stroke="rgba(255,255,255,.08)" stroke-width="1.5"/>`).join('') +
      'ABCDEF'.split('').map((c, i) => `<text x="${i * 100 + 50}" y="18" class="map-grid">${c}</text><text x="8" y="${i * 100 + 56}" class="map-grid">${i + 1}</text>`).join('') : '';
    const labels = big ? `<text x="300" y="282" class="map-label">활주로</text><text x="360" y="212" class="map-label">격납고</text>
      <text x="455" y="470" class="map-label sm">마을</text><text x="232" y="492" class="map-label sm">마을</text><text x="506" y="86" class="map-label sm">등대</text><text x="526" y="314" class="map-label sm">항구</text>` : '';
    svg.innerHTML = `
      <defs><mask id="${maskId}"><rect x="-200" y="-200" width="1000" height="1000" fill="#fff"/><circle data-r="hole" fill="#000"/></mask>
        <pattern id="${maskId}-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="rgba(150,40,200,.42)"/><rect width="5" height="14" fill="rgba(255,90,200,.30)"/></pattern></defs>
      <rect x="-200" y="-200" width="1000" height="1000" fill="#173a4f"/>
      <path d="${WD.islandPath()}" fill="#5f7a45" stroke="#cdbb8a" stroke-width="7"/>
      <g fill="#46623a">${D.forests.map(f => `<circle cx="${f.x}" cy="${f.y}" r="${f.r}"/>`).join('')}</g>
      <g stroke="#9a8a64" stroke-width="5" stroke-linecap="round">${WD.roads.map(([a, b, c, d]) => `<path d="M${a} ${b}L${c} ${d}"/>`).join('')}</g>
      <rect x="${rw.x - rw.len / 2}" y="${rw.y - rw.wid / 2}" width="${rw.len}" height="${rw.wid}" fill="#5d5f5c" transform="rotate(${rw.rot} ${rw.x} ${rw.y})"/>
      <g fill="#c9bda4" stroke="#3a3a36" stroke-width="1">${D.buildings.map(b => `<rect x="${b.x - b.w / 2}" y="${b.y - b.d / 2}" width="${b.w}" height="${b.d}"/>`).join('')}</g>
      <circle cx="506" cy="100" r="3.5" fill="#e9e1c8"/>
      ${grid}${labels}
      <circle cx="${z.x}" cy="${z.y}" r="26" fill="rgba(242,169,59,.14)" stroke="#f2a93b" stroke-width="2" stroke-dasharray="6 5"/>
      ${big ? `<text x="${z.x}" y="${z.y - 32}" class="map-label zone">내 스폰: ${esc(z.name)}</text>` : ''}
      <!-- 자기장 바깥: 보라 빗금, 경계: 보라 굵은 선 + 번짐, 다음 안전구역: 흰 점선 -->
      <rect x="-200" y="-200" width="1000" height="1000" fill="url(#${maskId}-hatch)" mask="url(#${maskId})"/>
      <circle data-r="glow" fill="none" stroke="rgba(214,107,255,.35)" stroke-width="${big ? 12 : 14}"/>
      <circle data-r="zone" fill="none" stroke="#d66bff" stroke-width="${big ? 4 : 5}"/>
      <circle data-r="next" fill="rgba(255,255,255,.07)" stroke="#fff" stroke-width="${big ? 2.5 : 3}" stroke-dasharray="${big ? '10 8' : '9 6'}"/>
      <line data-r="path" stroke="#fff" stroke-width="${big ? 2 : 3}" stroke-dasharray="${big ? '4 6' : '6 6'}" opacity=".85"/>
      <g data-r="me"><polygon points="0,-16 10,11 0,5 -10,11" fill="#ffd34d" stroke="#111" stroke-width="2.5"/></g>`;
    const r = k => svg.querySelector(`[data-r=${k}]`);
    return { svg, hole: r('hole'), zone: r('zone'), glow: r('glow'), next: r('next'), path: r('path'), me: r('me') };
  }
  function setCircle(el, c) { el.setAttribute('cx', c.x); el.setAttribute('cy', c.y); el.setAttribute('r', Math.max(0, c.r)); }
  function updateMap(refs, scale, follow) {
    const z = G.zone;
    setCircle(refs.hole, z.cur); setCircle(refs.zone, z.cur); setCircle(refs.glow, z.cur);
    refs.zone.setAttribute('stroke', z.state === 'shrink' && Math.floor(now() * 3) % 2 ? '#ff5ad1' : '#d66bff'); // 줄어드는 중엔 깜빡임
    const showNext = z.next && z.state !== 'closed' && z.state !== 'prep';
    if (showNext) { refs.next.style.display = ''; setCircle(refs.next, z.next); } else refs.next.style.display = 'none';
    // 다음 안전구역 밖이면 가장 가까운 경계까지 길 안내 선
    const tgt = showNext ? z.next : z.cur, d = Math.hypot(G.pos.x - tgt.x, G.pos.y - tgt.y);
    if (z.state !== 'prep' && d > tgt.r && d > 0) {
      const k = tgt.r / d;
      refs.path.style.display = '';
      refs.path.setAttribute('x1', G.pos.x); refs.path.setAttribute('y1', G.pos.y);
      refs.path.setAttribute('x2', tgt.x + (G.pos.x - tgt.x) * k); refs.path.setAttribute('y2', tgt.y + (G.pos.y - tgt.y) * k);
    } else refs.path.style.display = 'none';
    refs.me.setAttribute('transform', `translate(${G.pos.x} ${G.pos.y}) rotate(${G.facing * 180 / Math.PI + 90}) scale(${scale})`);
    if (follow) refs.svg.setAttribute('viewBox', `${G.pos.x - follow / 2} ${G.pos.y - follow / 2} ${follow} ${follow}`);
  }

  /* ================= 자기장 (PRD 3장) ================= */
  function enterWait(i) {
    const z = G.zone, ph = D.zonePhases[i], nr = ph.to / 2;
    z.idx = i; z.state = 'wait'; z.t = 0; z.dur = ph.wait;
    let x, y;
    if (i === 0) { const a = rand(0, Math.PI * 2), d = rand(0, 200); x = clamp(300 + Math.cos(a) * d, nr, 600 - nr); y = clamp(300 + Math.sin(a) * d, nr, 600 - nr); }
    else { const a = rand(0, Math.PI * 2), d = rand(0, Math.max(0, z.cur.r - nr)); x = z.cur.x + Math.cos(a) * d; y = z.cur.y + Math.sin(a) * d; }
    z.next = { x, y, r: nr };
    if (i > 0) banner(`${i + 1}단계 안전구역이 표시됐어요`);
  }
  function zoneStep(dt) {
    const z = G.zone;
    z.t += dt;
    if (z.state !== 'prep') G.clock += dt;
    if (z.state === 'shrink') {
      const k = clamp(z.t / z.dur, 0, 1);
      z.cur = { x: z.from.x + (z.next.x - z.from.x) * k, y: z.from.y + (z.next.y - z.from.y) * k, r: z.from.r + (z.next.r - z.from.r) * k };
    }
    if (z.t < z.dur) return;
    if (z.state === 'prep') { enterWait(0); banner('전투 시작!', 'go'); renderAbilities(); }
    else if (z.state === 'wait') { z.state = 'shrink'; z.t = 0; z.dur = D.zonePhases[z.idx].shrink; z.from = Object.assign({}, z.cur); banner('자기장이 줄어듭니다', 'warn'); }
    else if (z.state === 'shrink') { z.cur = Object.assign({}, z.next); if (z.idx < 3) enterWait(z.idx + 1); else { z.state = 'closed'; z.dur = Infinity; banner('자기장이 완전히 닫혔어요', 'warn'); } }
  }
  function zoneLabel() {
    const z = G.zone;
    if (z.state === 'prep') return ['준비 단계', PREP - z.t, 'prep'];
    if (z.state === 'wait') return [`${z.idx + 1}단계 대기`, z.dur - z.t, ''];
    if (z.state === 'shrink') return [`${z.idx + 1}단계 축소 중`, z.dur - z.t, 'shrink'];
    return ['자기장 닫힘', 0, 'shrink'];
  }
  const zoneDps = () => G.zone.state === 'prep' ? 0 : D.zonePhases[Math.min(G.zone.idx, 3)].dps;

  /* ================= 스폰 배정 (서로 다른 구역, 최소 150m) ================= */
  function assignZones(n) {
    const zs = D.spawnZones;
    for (let tries = 0; tries < 300; tries++) {
      const z = shuffle(zs).slice(0, n);
      if (z.every((a, i) => z.every((b, j) => i === j || Math.hypot(a.x - b.x, a.y - b.y) >= 150))) return z;
    }
    return shuffle(zs).slice(0, n);
  }

  /* ================= 아이템 배치 (WEAPON 9장 스폰 확률) ================= */
  const GRADE_POOL = { common: ['p9', 'vx9', 'sg12', 'machete'], normal: ['r45', 'mk45', 'ar556', 'ak762'], rare: ['dm14', 'br300', 'sv98', 'lm60'], legend: ['amr50'] };
  function rollWeapon(central) {
    const r = Math.random();
    if (central && r < 0.03) return pick(GRADE_POOL.legend); // 대물 저격총은 중앙에만, 아주 드물게
    if (central && r < 0.15) return pick(GRADE_POOL.rare);   // 희귀 무기는 중앙 위험 지역에 많이
    if (!central && r < 0.05) return pick(['sv98', 'dm14']);
    return pick(r < 0.6 ? GRADE_POOL.common : GRADE_POOL.normal);
  }
  function rollLoot(central) {
    const r = Math.random();
    if (r < 0.30) return { kind: 'weapon', id: rollWeapon(central) };
    if (r < 0.50) return { kind: 'ammo', id: pick(['light', 'light', 'rifle', 'rifle', 'shell', 'sniper']) };
    if (r < 0.62) return { kind: 'armor', slot: pick(['vest', 'helmet']), lv: Math.random() < 0.7 ? 1 : 2 };
    if (r < 0.71) return { kind: 'medkit' };
    if (r < 0.83) { const t = Math.random(); return { kind: 'throw', id: t < 0.45 ? 'frag' : t < 0.75 ? 'smoke' : 'flash' }; }
    if (r < 0.90) { const t = Math.random(); return { kind: 'scope', lv: t < 0.55 ? 2 : t < 0.88 || !central ? 4 : 8 }; } // 8배율은 중앙에만
    return central ? { kind: 'ticket' } : { kind: 'ammo', id: pick(['light', 'rifle']) }; // 티켓은 중앙 쪽에 많이
  }
  function putItem(loot, mx, my) { G.items.push({ loot, mx, my, mesh: WD.addItem(loot.kind, mx, my) }); }
  function placeLoot(zones) {
    const firstOfZone = new Set();
    WD.lootSpots.forEach(s => {
      const zoneHere = zones.find(z => Math.hypot(z.x - s.mx, z.y - s.my) < 45);
      // 스폰 구역 건물에는 권총·기관단총·산탄총 중 하나가 반드시 (30초 안에 첫 무기)
      if (zoneHere && !firstOfZone.has(zoneHere.name)) { firstOfZone.add(zoneHere.name); putItem({ kind: 'weapon', id: pick(['p9', 'vx9', 'sg12']) }, s.mx, s.my); return; }
      putItem(rollLoot(Math.hypot(s.mx - 300, s.my - 300) < 150), s.mx, s.my);
    });
    zones.forEach(z => {
      const [wx, wy] = WD.findFree(z.x + rand(-6, 6), z.y + rand(-6, 6));
      putItem({ kind: 'weapon', id: pick(['p9', 'vx9', 'sg12']) }, wx, wy);
      const [ax, ay] = WD.findFree(wx + 2, wy + 1.5);
      putItem({ kind: 'ammo', id: 'light' }, ax, ay);
    });
  }

  /* ================= 시작 ================= */
  function start(session) {
    WD.init(canvas);
    WD.reset();
    const roster = session ? session.players : [{ id: 'me', name: store.get('nickname') || '나', me: true }];
    const zones = assignZones(roster.length);
    const myZone = zones[roster.findIndex(p => p.me)];
    G = {
      players: roster.map(p => ({ id: p.id, name: p.name, me: !!p.me, alive: true, kills: 0, damage: 0, abilities: [], placement: 0 })),
      hp: 100, lagHp: 100, helmet: 0, vest: 0,
      weapons: [null, null, null], cur: -1, mags: [0, 0, 0], reserve: { light: 0, rifle: 0, shell: 0, sniper: 0 }, medkits: 0,
      throws: { frag: 0, smoke: 0, flash: 0 }, throwSel: 'frag', nextThrow: 0, scopes: [], zoom: 1,
      charge: null, slam: null, procT: {},
      tickets: 2, actives: [null, null], passives: [null, null], swap: null, everOwned: [],
      zone: { idx: -1, state: 'prep', t: 0, dur: PREP, cur: { x: 300, y: 300, r: 300 }, next: null, from: null },
      clock: 0, speed: 1, myZone, pos: { x: 0, y: 0 }, facing: 0,
      crouch: false, aiming: false, firing: false, nextShot: 0, moving: false, sprinting: false, jumpReq: false,
      cast: null, lastHit: -99, hist: [], histT: 0, bots: {}, items: [], nearItem: null,
      botDeaths: [], dead: false, spectate: null, over: false, abilityUses: 0, turret: null, turretNext: 0,
      timers: [], locked: false, everLocked: false, noLock: false, startT: now(), showHint: true
    };
    roster.forEach((p, i) => {
      const z = zones[i];
      const [x, y] = WD.findFree(z.x + rand(-10, 10), z.y + rand(-10, 10));
      if (p.me) { WD.setPlayer(x, y, Math.atan2(300 - y, 300 - x)); return; }
      G.bots[p.id] = { id: p.id, name: p.name, hp: 100, vest: randInt(0, 1), helmet: randInt(0, 1), x, y, yaw: 0, tx: x, ty: y, nextThink: 0, nextShot: 0, stuck: 0, alertUntil: 0, target: null };
      WD.addBot(p.id, pick(D.palette), x, y);
    });
    placeLoot(zones);
    // 다른 플레이어끼리의 교전(멀리서 일어남) — 마지막 단계 전에 정리
    const ids = Object.keys(G.bots);
    const times = ids.map(() => rand(60, 480)).sort((a, b) => a - b);
    G.botDeaths = shuffle(ids).map((id, i) => ({ id, t: times[i] }));
    G.pos = WD.playerMap(); G.facing = WD.facing();

    G.mini = buildMap($('#minimapSvg'), false, 'mmask');
    G.big = buildMap($('#bigmapSvg'), true, 'bmask');
    $('#myZoneName').textContent = myZone.name;
    $('#killfeed').innerHTML = '';
    chat.clear();
    chat.add(null, `${myZone.name}에 스폰했어요. 10초 준비 단계에는 이동과 티켓 사용만 가능해요.`, 'sys');
    ['invOverlay', 'mapOverlay', 'menuOverlay', 'deathOverlay', 'roulette', 'swap', 'clickHint'].forEach(id => { $('#' + id).hidden = true; });
    $('#fxLayer').innerHTML = '';
    $('#demo').classList.remove('open');
    $('[data-demo=speed]').textContent = '자기장 ×10 속도';
    renderControls();
    $('#keyHint').classList.remove('hide');
    $('#startOverlay').hidden = false;
    renderAll();
    banner(`준비 단계 — <b>${PREP}</b>초 뒤 전투 시작<br><small>${esc(myZone.name)}</small>`, 'prep');
    last = now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  /* ================= 메인 루프 ================= */
  function loop() {
    const t = now();
    const dt = Math.min(0.1, t - last); last = t;
    if (!G.over) {
      zoneStep(dt * G.speed);
      if (!G.dead) {
        move(dt);
        if (G.firing && curW().mode === 'auto') tryFire();
      }
      G.pos = WD.playerMap(); G.facing = WD.facing();
      if (!G.dead) { zoneDamage(dt); regen(dt); recordHist(dt); nearItem(); turretStep(t); chargeStep(t); slamStep(t); }
      botsStep(dt, t);
      botDeaths();
      castStep(t);
      rechargeStep(t);
      swapStep(t);
      if (G.showHint && t - G.startT > 45) { G.showHint = false; $('#keyHint').classList.add('hide'); }
      updateHud(t);
      WD.render(dt);
    }
    raf = requestAnimationFrame(loop);
  }

  function move(dt) {
    const keys = store.get('keys');
    const typing = document.activeElement === chat.input;
    const f = typing ? 0 : (held.has(keys.move_forward) ? 1 : 0) - (held.has(keys.move_back) ? 1 : 0);
    const s = typing ? 0 : (held.has(keys.move_right) ? 1 : 0) - (held.has(keys.move_left) ? 1 : 0);
    const moving = !!(f || s);
    const sprint = moving && f > 0 && held.has(keys.sprint) && !G.crouch && !G.aiming && castKind() !== 'heal';
    let speed = G.crouch ? 2.2 : sprint ? 6.4 : 4.6;
    if (G.aiming && !has('eagle_eye')) speed *= 0.6;
    if (has('swift')) speed *= 1.1;
    const jump = G.jumpReq ? 7 : 0; G.jumpReq = false;
    const res = WD.stepPlayer(dt, { f, s, speed, jump, crouch: G.crouch });
    G.moving = res.moving; G.sprinting = sprint;
    const stance = !WD.onGround ? '공중' : G.crouch ? '앉기' : sprint ? '달리기' : moving ? '걷기' : '서기';
    if ($('#stance').textContent !== stance) $('#stance').textContent = stance;
    $('#viewmodel').classList.toggle('walking', moving && !sprint);
    $('#viewmodel').classList.toggle('sprinting', sprint);
  }

  function zoneDamage(dt) {
    const z = G.zone;
    const out = z.state !== 'prep' && Math.hypot(G.pos.x - z.cur.x, G.pos.y - z.cur.y) > z.cur.r;
    $('#zoneWarn').classList.toggle('show', out);
    if (!out) return;
    $('#zoneDps').textContent = zoneDps();
    hurt(zoneDps() * dt, '자기장');
  }
  function regen(dt) {
    if (!has('regen') || now() - G.lastHit < 6 || G.hp >= 70) return;
    G.hp = Math.min(70, G.hp + 3 * dt);
    proc('regen');
  }
  /* 패시브가 실제로 효과를 냈을 때 슬롯을 반짝여 알려 줌 */
  function proc(id, text) {
    const i = G.passives.findIndex(s => s && s.id === id);
    if (i < 0 || now() - (G.procT[id] || 0) < 0.9) return;
    G.procT[id] = now();
    const el = document.querySelector(`[data-pslot="${i}"]`);
    if (!el) return;
    el.classList.remove('proc'); void el.offsetWidth; el.classList.add('proc');
    if (text) { const s = el.querySelector('small'); s.textContent = text; later(() => { if (s.isConnected) s.textContent = AB[id].short; }, 1100); }
  }
  function recordHist(dt) {
    G.histT += dt;
    if (G.histT < 0.1) return;
    G.histT = 0;
    G.hist.push({ t: now(), hp: G.hp, mag: G.mags.slice(), pos: WD.playerMap() });
    while (G.hist.length && now() - G.hist[0].t > 3.5) G.hist.shift();
  }

  /* ================= 피해 ================= */
  function hurt(amount, source) {
    if (G.dead) return;
    G.hp -= amount;
    if (source !== '자기장') G.lastHit = now();
    if (G.hp <= 0) { G.hp = 0; die(source); }
  }
  function takeShot(base, part, attacker, from) {
    let dmg = base * (part === 'head' ? 2 : part === 'limb' ? 0.8 : 1);
    const armor = part === 'head' ? G.helmet : part === 'body' ? G.vest : 0;
    dmg *= 1 - D.armorReduce[armor];
    if (part !== 'head' && has('iron_skin')) { dmg *= 0.9; proc('iron_skin', `피해 −${Math.max(1, Math.round(dmg / 9))}`); }
    hurt(dmg, attacker);
    // 맞은 방향 표시: 0° = 정면
    const ang = from ? (Math.atan2(from.y - G.pos.y, from.x - G.pos.x) - G.facing) * 180 / Math.PI : randInt(0, 359);
    const dir = $('#dmgDir');
    dir.style.setProperty('--a', ang + 'deg');
    dir.classList.remove('show'); void dir.offsetWidth; dir.classList.add('show');
    const v = $('#vignette'); v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit');
    if (store.get('shake')) { const w = $('#world'); w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); }
  }

  /* ================= 봇 AI (배회 → 발견하면 사격) ================= */
  function botsStep(dt, t) {
    const z = G.zone, eye = WD.eyePos();
    Object.values(G.bots).forEach(b => {
      if (!isAlive(b.id)) return;
      let moving = false;
      if (!isPrep()) {
        if (t < (b.blindUntil || 0)) b.target = null; // 섬광탄에 눈이 멀면 쏘지 못하고 헤맴
        else if (t >= b.nextThink) {
          b.nextThink = t + 0.25;
          const range = t < b.alertUntil ? 90 : 55;
          const dist = Math.hypot(b.x - G.pos.x, b.y - G.pos.y);
          const cands = [];
          if (!G.dead && dist < range) cands.push({ x: G.pos.x, y: G.pos.y, h: eye.y, d: dist });
          WD.clones().forEach(c => { const d = Math.hypot(c.x - b.x, c.y - b.y); if (d < 40) cands.push({ x: c.x, y: c.y, h: 1.5, d, clone: c.ref }); });
          cands.sort((a, c) => a.d - c.d);
          b.target = cands.find(c => WD.los(b.x, 1.6, b.y, c.x, c.h, c.y)) || null;
        }
        if (b.target) {
          b.yaw = Math.atan2(-(b.target.x - b.x), -(b.target.y - b.y));
          if (t >= b.nextShot) {
            b.nextShot = t + rand(0.55, 1.2);
            const d = b.target.d, tg = b.target;
            if (tg.clone) {
              const hit = tg.clone.alive && Math.random() < 0.5;
              WD.botFire(b.id, tg.x, 1.3, tg.y, hit);
              if (hit) WD.removeClone(tg.clone);
            } else {
              const chance = 0.2 * (d < 15 ? 1.3 : d < 35 ? 1 : 0.65) * (G.moving ? 0.7 : 1) * (G.crouch ? 0.8 : 1);
              const hit = Math.random() < chance;
              WD.botFire(b.id, G.pos.x, eye.y - 0.35, G.pos.y, hit); // 빗나간 총알도 내 주변으로 날아오는 게 보임
              if (hit) takeShot(randInt(18, 26), Math.random() < 0.12 ? 'head' : Math.random() < 0.25 ? 'limb' : 'body', b.name, { x: b.x, y: b.y });
            }
          }
        } else {
          // 다음 안전구역 쪽으로 배회
          if (Math.hypot(b.tx - b.x, b.ty - b.y) < 1.5 || b.stuck > 1.2) {
            const c = z.next || z.cur, a = rand(0, Math.PI * 2), d = rand(0, Math.max(10, c.r * 0.6));
            b.tx = c.x + Math.cos(a) * d; b.ty = c.y + Math.sin(a) * d; b.stuck = 0;
          }
          const dx = b.tx - b.x, dy = b.ty - b.y, len = Math.hypot(dx, dy) || 1;
          const p = { x: b.x - 300, z: b.y - 300 };
          WD.moveCircle(p, dx / len * 3.4 * dt, dy / len * 3.4 * dt);
          const moved = Math.hypot(p.x + 300 - b.x, p.z + 300 - b.y);
          b.stuck = moved < 3.4 * dt * 0.3 ? b.stuck + dt : 0;
          b.x = p.x + 300; b.y = p.z + 300;
          b.yaw = Math.atan2(-dx, -dy);
          moving = true;
        }
      }
      WD.poseBot(b.id, b.x, b.y, b.yaw, moving);
    });
  }
  // pt: 맞은 지점(섬 좌표 {x, h, y}) — 피해 숫자를 띄울 위치. 없으면 봇 머리 위
  function damageBot(id, dmg, head, source, viaAbility, pt) {
    const b = G.bots[id]; if (!b || !isAlive(id)) return;
    dmg *= 1 - D.armorReduce[head ? b.helmet : b.vest];
    b.hp -= dmg;
    b.alertUntil = now() + 4;
    const hm = $('#hitmarker');
    hm.className = 'hitmarker'; void hm.offsetWidth; hm.className = 'hitmarker show' + (head ? ' head' : '');
    dmgNumber(pt || { x: b.x, h: 1.9, y: b.y }, dmg, head, b.hp <= 0);
    me().damage += dmg;
    if (!viaAbility && has('vampire') && G.hp < 100) { G.hp = Math.min(100, G.hp + dmg * 0.15); proc('vampire', `+${Math.round(dmg * 0.15)} 회복`); }
    if (b.hp <= 0) kill(id, me().id, source, viaAbility);
  }
  function dmgNumber(pt, dmg, head, lethal) {
    const p = WD.project(pt.x, pt.h, pt.y);
    if (!p.on) return;
    const el = document.createElement('div');
    el.className = 'dmg-num' + (head ? ' head' : '') + (lethal ? ' lethal' : '');
    el.textContent = Math.max(1, Math.round(dmg));
    el.style.left = (p.x + rand(-14, 14)) + 'px'; el.style.top = (p.y + rand(-8, 4)) + 'px';
    $('#fxLayer').appendChild(el);
    later(() => el.remove(), 800);
  }

  /* ================= 사격 (화면 중앙에서 레이캐스트) ================= */
  function spreadDeg(w) {
    if (w.mode === 'melee') return 0;
    const air = !WD.onGround;
    if (w.family === '저격총' && !G.aiming) return air ? 8 : 4; // 저격총 지향사격은 크게 빗나감
    let m = air ? 8 : G.aiming ? (G.moving ? 1.5 : 1) : G.sprinting ? 5 : (w.family === '기관단총' ? 2 : 3) * (G.moving ? 1.4 : 1);
    if (G.crouch && !air) m *= 0.8;
    if (G.aiming && scopeFor(w)) m *= 0.6;
    if (G.aiming && has('eagle_eye')) m *= 0.65;
    return SPREAD[w.family] * m;
  }
  /* 스코프: 가진 것 중 지금 무기에 붙일 수 있는 가장 높은 배율 (없으면 0) */
  function scopeFor(w) {
    return G.scopes.filter(lv => D.scopes[lv].fam.includes(w.family)).reduce((a, b) => Math.max(a, b), 0);
  }
  function zoomFor(w) {
    if (!G.aiming) return 1;
    return scopeFor(w) || (w.family === '저격총' || w.family === '지정사수소총' ? 1.6 : 1.25);
  }
  const TRACER = { 저격총: { color: '#9fe3ff', width: 0.05 }, 지정사수소총: { color: '#bfe9ff', width: 0.04 }, 산탄총: { color: '#ffd27a', width: 0.018 } };
  function canFire() {
    if (G.dead) return false;
    if (isPrep()) { hint('준비 단계에는 사격할 수 없어요'); return false; }
    if (castKind() === 'ticket') { hint('티켓 사용 중에는 사격할 수 없어요'); return false; }
    if (castKind() === 'reload') return false;
    return true;
  }
  function tryFire() {
    if (!canFire()) return;
    const t = now(), w = curW();
    if (t < G.nextShot) return;
    if (w.mag && G.mags[G.cur] <= 0) { G.firing = false; startReload(); return; }
    if (castKind() === 'heal') G.cast = null;
    G.nextShot = t + 60 / w.rpm;
    if (w.mag) G.mags[G.cur]--;
    const vm = $('#viewmodel');
    vm.classList.remove('recoil'); void vm.offsetWidth; vm.classList.add('recoil');
    const ch = $('#crosshair'); ch.classList.remove('kick'); void ch.offsetWidth; ch.classList.add('kick');
    const shotgun = w.family === '산탄총';
    const pellets = shotgun ? 9 : 1, perPellet = shotgun ? 11 : w.dmg;
    const cone = shotgun ? (G.aiming ? 3.6 : 4.5) : spreadDeg(w);
    const tracer = w.mode === 'melee' ? null : TRACER[w.family] || { color: '#ffe08a', width: 0.03 };
    if (w.family === '저격총') WD.fovKick(0.03);
    for (let i = 0; i < pellets; i++) {
      const hit = WD.shoot(cone * Math.PI / 180, w.mode === 'melee' ? w.range : 600, tracer);
      if (!hit || !hit.botId) continue;
      let fall = 1; // 거리 감쇠 (WEAPON 3장)
      if (hit.dist > w.range) {
        if (shotgun && hit.dist > w.range * 2) continue;
        fall = hit.dist >= w.range * 2 ? 0.6 : 1 - 0.4 * (hit.dist - w.range) / w.range;
      }
      const head = hit.part === 'head';
      const mult = head ? (w.family === '저격총' ? 2.5 : shotgun ? 1.5 : 2) : 1;
      damageBot(hit.botId, perPellet * mult * fall, head, w.name, false, { x: hit.point.x + 300, h: hit.point.y, y: hit.point.z + 300 });
    }
  }

  /* ================= 투척물 (WEAPON 7장) ================= */
  const throwMax = k => TH[k].max + (has('demolition') ? 1 : 0);
  function cycleThrow() {
    const order = THROW_KINDS.slice(THROW_KINDS.indexOf(G.throwSel) + 1).concat(THROW_KINDS.slice(0, THROW_KINDS.indexOf(G.throwSel) + 1));
    const next = order.find(k => G.throws[k] > 0);
    if (!next) { hint('투척물이 없어요'); return; }
    G.throwSel = next;
    renderThrow();
  }
  function throwNow() {
    if (G.dead || castKind() === 'ticket') return;
    if (isPrep()) { hint('준비 단계에는 던질 수 없어요'); return; }
    const k = G.throwSel, t = now();
    if (G.throws[k] <= 0) { const other = THROW_KINDS.find(x => G.throws[x] > 0); if (!other) { hint('투척물이 없어요'); return; } G.throwSel = other; return throwNow(); }
    if (t < G.nextThrow) return;
    G.nextThrow = t + THROW_CD;
    if (castKind() === 'reload' || castKind() === 'heal') cancelCast();
    G.throws[k]--;
    G.aiming = false;
    const vm = $('#viewmodel'); vm.classList.remove('throwing'); void vm.offsetWidth; vm.classList.add('throwing');
    WD.throwObj(TH[k].color, D.throwSpeed * (has('demolition') ? 1.3 : 1), TH[k].fuse, p => detonate(k, p));
    if (G.throws[k] <= 0) { const other = THROW_KINDS.find(x => G.throws[x] > 0); if (other) G.throwSel = other; }
    renderThrow();
  }
  // 폭발 피해: 반경 안, 가로막는 벽이 없으면 거리에 따라 줄어듦
  function blast(p, r, base, source, viaAbility, hitSelf) {
    const mul = !viaAbility && has('demolition') ? 1.25 : 1;
    if (mul > 1) proc('demolition', '폭발 +25%');
    Object.values(G.bots).forEach(b => {
      if (!isAlive(b.id)) return;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d > r || !WD.los(p.x, p.h + 0.4, p.y, b.x, 1.0, b.y)) return;
      damageBot(b.id, base * (1 - 0.75 * d / r) * mul, false, source, viaAbility, { x: b.x, h: 1.9, y: b.y });
      if (G.bots[b.id] && isAlive(b.id)) knock(b, p, 2.5 * (1 - d / r));
    });
    if (hitSelf && !G.dead) {
      const d = Math.hypot(G.pos.x - p.x, G.pos.y - p.y), e = WD.eyePos();
      if (d < r && WD.los(p.x, p.h + 0.4, p.y, e.x, e.y - 0.6, e.z)) takeShot(base * (1 - 0.75 * d / r), 'body', '내 수류탄', p);
    }
  }
  function knock(b, from, dist) { // 봇 밀쳐내기
    const dx = b.x - from.x, dy = b.y - from.y, len = Math.hypot(dx, dy) || 1;
    const q = { x: b.x - 300, z: b.y - 300 };
    WD.moveCircle(q, dx / len * dist, dy / len * dist);
    b.x = q.x + 300; b.y = q.z + 300;
  }
  function detonate(kind, p) {
    if (!G || G.over) return;
    const t = TH[kind];
    if (kind === 'frag') { WD.explosion(p.x, p.h, p.y, t.radius); blast(p, t.radius, t.dmg, '수류탄', false, true); }
    else if (kind === 'smoke') WD.addSmoke(p.x, p.y, t.radius, t.dur);
    else if (kind === 'flash') {
      WD.flashBurst(p.x, p.h, p.y);
      Object.values(G.bots).forEach(b => {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (isAlive(b.id) && d < t.radius && WD.los(p.x, p.h + 0.3, p.y, b.x, 1.6, b.y)) { b.blindUntil = now() + t.blind * (1 - 0.5 * d / t.radius); b.target = null; }
      });
      // 나도 보고 있었으면 눈이 멂 (등지고 있으면 약하게)
      const e = WD.eyePos(), d = Math.hypot(G.pos.x - p.x, G.pos.y - p.y);
      if (!G.dead && d < t.radius && WD.los(p.x, p.h + 0.3, p.y, e.x, e.y, e.z)) {
        const a = WD.aimDir(), v = { x: p.x - e.x, h: p.h - e.y, y: p.y - e.z }, len = Math.hypot(v.x, v.h, v.y) || 1;
        const facingIt = (a.x * v.x + a.h * v.h + a.y * v.y) / len > 0.3;
        const dur = (facingIt ? t.blind : 0.8) * (1 - 0.5 * d / t.radius);
        const el = document.createElement('div');
        el.className = 'fx screen fx-flashbang';
        el.style.animationDuration = dur + 's';
        $('#fxLayer').appendChild(el);
        later(() => el.remove(), dur * 1000);
      }
    }
  }
  function renderThrow() {
    const k = G.throwSel, n = G.throws[k], total = THROW_KINDS.reduce((s, x) => s + G.throws[x], 0);
    $('#throwSlot').className = 'throw-slot' + (total ? '' : ' none');
    $('#throwSlot').innerHTML = `${icon(k)}<span><b>${TH[k].name} ×${n}</b><small>${THROW_KINDS.filter(x => x !== k && G.throws[x]).map(x => `${TH[x].name} ${G.throws[x]}`).join(' · ') || '&nbsp;'}</small></span><kbd>${esc(K('throw'))}</kbd><kbd class="sub">${esc(K('cycle_throw'))}</kbd>`;
  }

  function startReload() {
    const w = curW();
    if (!w.mag || G.dead || castKind() === 'ticket') return;
    const mag = G.mags[G.cur];
    if (mag >= w.mag) return;
    if (G.reserve[w.ammo] <= 0) { hint(`${D.ammo[w.ammo].name}이 없어요`); return; }
    let time = w.family === '산탄총' ? 0.5 * Math.min(w.mag - mag, G.reserve[w.ammo]) : w.reload;
    if (has('quick_hands')) { time *= 0.75; proc('quick_hands', `재장전 −${(time / 3).toFixed(1)}초`); }
    const slot = G.cur;
    G.aiming = false;
    startCast('reload', '재장전', time, () => {
      const need = Math.min(w.mag - G.mags[slot], G.reserve[w.ammo]);
      G.mags[slot] += need; G.reserve[w.ammo] -= need; renderWeapons();
    });
    $('#viewmodel').classList.add('reloading');
  }

  function switchWeapon(i) {
    if (G.dead || castKind() === 'ticket') return;
    if (!G.weapons[i]) { hint(`${i + 1}번 슬롯이 비어 있어요`); return; }
    if (G.cur === i) return;
    if (castKind() === 'reload') cancelCast();
    G.cur = i; G.firing = false;
    G.nextShot = now() + (W[G.weapons[i]].family === '권총' ? 0.3 : 0.6) * (has('quick_hands') ? 0.75 : 1);
    renderViewmodel();
  }

  /* ================= 캐스팅 (티켓·재장전·구급상자) ================= */
  function startCast(kind, label, time, done) { cancelCast(); G.cast = { kind, label, start: now(), end: now() + time, done }; }
  function cancelCast() {
    if (!G.cast || G.cast.kind === 'ticket') return; // 티켓은 피격돼도 취소되지 않음 (ABILITY 2.2)
    G.cast = null;
    $('#viewmodel').classList.remove('reloading');
  }
  function castStep(t) {
    const c = G.cast, box = $('#cast');
    if (!c || c.kind === 'ticket') box.classList.remove('show');
    if (!c) return;
    if (c.kind !== 'ticket') {
      box.classList.add('show');
      $('#castLabel').textContent = `${c.label} ${Math.max(0, c.end - t).toFixed(1)}초`;
      $('#castFill').style.width = (clamp((t - c.start) / (c.end - c.start), 0, 1) * 100) + '%';
    }
    if (t >= c.end) { G.cast = null; $('#viewmodel').classList.remove('reloading'); c.done(); }
  }

  /* ================= 랜덤 능력 티켓 (ABILITY 2장) ================= */
  function useTicket() {
    if (G.dead) return;
    if (G.tickets <= 0) { hint('티켓이 없어요'); return; }
    if (G.swap) { hint('교체 선택을 먼저 끝내세요'); return; }
    if (castKind() === 'ticket') return;
    const owned = [...G.actives, ...G.passives].filter(Boolean).map(s => s.id);
    const result = drawAbility(owned);
    G.tickets--;
    G.aiming = false; G.firing = false;
    if (castKind()) { G.cast = null; $('#viewmodel').classList.remove('reloading'); }
    startCast('ticket', '티켓', TICKET_CAST, () => revealTicket(result));
    spinRoulette(result);
    renderAbilities();
  }
  function drawAbility(owned) {
    let r = Math.random(), grade = 'common';
    for (const [g, p] of D.gradeRates) { if (r < p) { grade = g; break; } r -= p; }
    const order = ['common', 'rare', 'legendary'];
    for (const g of [grade, ...order.filter(x => x !== grade)]) {
      const pool = P0.filter(id => AB[id].grade === g && !owned.includes(id));
      if (pool.length) return pick(pool);
    }
    return null;
  }
  function spinRoulette(result) {
    const reel = $('#reel');
    const seq = Array.from({ length: 14 }, () => pick(P0)).concat(result);
    reel.innerHTML = seq.map(id => `<div class="reel-item g-${AB[id].grade}">${icon(id)}</div>`).join('');
    reel.style.transition = 'none'; reel.style.transform = 'translateY(0)';
    $('#rouletteResult').textContent = ''; $('#rouletteResult').className = 'roulette-result';
    $('#roulette').hidden = false; $('#roulette').classList.remove('done');
    void reel.offsetWidth;
    reel.style.transition = `transform ${TICKET_CAST * 0.95}s cubic-bezier(.15,.7,.2,1)`;
    reel.style.transform = `translateY(-${(seq.length - 1) * 84}px)`;
  }
  function revealTicket(id) {
    const a = AB[id], res = $('#rouletteResult');
    res.innerHTML = `<span class="grade-tag">${D.gradeNames[a.grade]}</span> ${esc(a.name)}`;
    res.className = `roulette-result g-${a.grade}`;
    $('#roulette').classList.add('done');
    later(() => { $('#roulette').hidden = true; }, 1300);
    if (!G.everOwned.includes(id)) G.everOwned.push(id);
    const list = a.type === 'active' ? G.actives : G.passives;
    const empty = list.findIndex(s => !s);
    if (empty >= 0) {
      list[empty] = newSlot(id);
      toast(`${a.name} 획득 — ${a.type === 'active' ? `${K(empty ? 'ability_2' : 'ability_1')} 키로 발동` : '패시브 적용'}`, 'ok');
      renderAbilities();
    } else openSwap(id);
  }
  function newSlot(id) { return { id, cdEnd: 0, activeUntil: 0, charges: AB[id].charges || 0, rechargeEnd: null }; }

  /* 교체 선택 창: 8초 안에 안 고르면 새 능력을 버림. 마우스가 고정돼 있어도 Q/E/X 키로 선택 */
  function openSwap(id) {
    G.swap = { id, until: now() + SWAP_TIME };
    const a = AB[id];
    const list = a.type === 'active' ? G.actives : G.passives;
    const names = a.type === 'active' ? ['액티브 1', '액티브 2'] : ['패시브 1', '패시브 2'];
    const box = $('#swap');
    box.innerHTML = `
      <div class="swap-head"><b>${a.type === 'active' ? '액티브' : '패시브'} 슬롯이 가득 찼어요</b><span id="swapLeft">${SWAP_TIME}</span></div>
      <div class="swap-new g-${a.grade}">${icon(id)}<div><span class="grade-tag">${D.gradeNames[a.grade]}</span><strong>${esc(a.name)}</strong><p>${esc(a.desc)}</p></div></div>
      <div class="swap-opts">${list.map((s, i) => `<button class="swap-opt g-${AB[s.id].grade}" data-swap="${i}">${icon(s.id)}<span><small><kbd>${esc(K(i ? 'ability_2' : 'ability_1'))}</kbd> ${names[i]}과 교체</small>${esc(AB[s.id].name)}</span></button>`).join('')}</div>
      <button class="btn btn-sm swap-discard" data-swap="discard">새 능력 버리기 <kbd>${esc(K('discard_ability'))}</kbd></button>
      <div class="swap-timer"><i id="swapBar"></i></div>`;
    box.hidden = false;
  }
  function resolveSwap(choice) {
    if (!G.swap) return;
    const a = AB[G.swap.id];
    if (choice === 'discard' || choice == null) toast(`${a.name}을(를) 버렸어요`);
    else {
      const list = a.type === 'active' ? G.actives : G.passives;
      toast(`${AB[list[choice].id].name} → ${a.name} 교체`, 'ok');
      list[choice] = newSlot(G.swap.id);
    }
    G.swap = null;
    $('#swap').hidden = true;
    renderAbilities();
  }
  function swapStep(t) {
    if (!G.swap) return;
    const left = G.swap.until - t;
    const el = $('#swapLeft'); if (el) el.textContent = Math.ceil(left);
    const bar = $('#swapBar'); if (bar) bar.style.width = (clamp(left / SWAP_TIME, 0, 1) * 100) + '%';
    if (left <= 0) resolveSwap(null);
  }
  $('#swap').addEventListener('click', e => { const b = e.target.closest('[data-swap]'); if (b) resolveSwap(b.dataset.swap === 'discard' ? 'discard' : +b.dataset.swap); });
  $('#swap').addEventListener('mousedown', e => e.stopPropagation());

  /* ================= 액티브 능력 발동 ================= */
  function useAbility(i) {
    if (G.dead) return;
    const s = G.actives[i];
    if (!s) { hint(`${K(i ? 'ability_2' : 'ability_1')} 슬롯이 비어 있어요`); return; }
    const a = AB[s.id], t = now();
    if (isPrep()) { hint('준비 단계에는 능력을 쓸 수 없어요'); return; }
    if (castKind() === 'ticket') { hint('티켓 사용 중에는 능력을 쓸 수 없어요'); return; }
    if (!WD.onGround && !['blink_dash', 'rewind', 'ground_slam', 'chain_lightning', 'meteor'].includes(s.id)) { hint('공중에서는 쓸 수 없는 능력이에요'); return; }
    const why = PRECHECK[s.id] && PRECHECK[s.id]();
    if (why) { hint(why); return; }
    if (a.charges) {
      if (s.charges <= 0) { hint(`${a.name} 충전 중 (${Math.ceil(s.rechargeEnd - t)}초)`); return; }
      s.charges--;
      if (!s.rechargeEnd) s.rechargeEnd = t + a.cd;
    } else {
      if (t < s.activeUntil) { hint(`${a.name} 발동 중`); return; }
      if (t < s.cdEnd) { hint(`${a.name} 쿨타임 ${Math.ceil(s.cdEnd - t)}초`); return; }
      if (a.dur) { s.activeUntil = t + a.dur; s.cdEnd = s.activeUntil + a.cd; } else s.cdEnd = t + a.cd;
    }
    if (castKind() === 'reload' || castKind() === 'heal') cancelCast(); // 재장전·회복 취소 (ABILITY 5.2)
    G.aiming = false;
    G.abilityUses++;
    EFFECTS[s.id](a);
    flash(`fx-cast g-${a.grade}`, 500); // 화면 가장자리에 등급 색 번쩍
    const slotEl = document.querySelector(`[data-aslot="${i}"]`);
    if (slotEl) { slotEl.classList.remove('fired'); void slotEl.offsetWidth; slotEl.classList.add('fired'); }
  }
  function rechargeStep(t) {
    G.actives.forEach(s => {
      if (!s || !AB[s.id].charges || !s.rechargeEnd || t < s.rechargeEnd) return;
      s.charges++;
      s.rechargeEnd = s.charges < AB[s.id].charges ? t + AB[s.id].cd : null;
    });
  }
  function flash(cls, ms) {
    const el = document.createElement('div');
    el.className = 'fx screen ' + cls;
    $('#fxLayer').appendChild(el);
    later(() => el.remove(), ms);
  }
  // 조준선 근처(12° 안, 40m 안, 벽에 안 가린) 가장 가운데 있는 적
  function lightningTarget() {
    const dir = WD.aimDir(), e = WD.eyePos();
    let best = null, bestCos = Math.cos(12 * Math.PI / 180);
    Object.values(G.bots).forEach(b => {
      if (!isAlive(b.id)) return;
      const v = { x: b.x - e.x, h: 1.3 - e.y, y: b.y - e.z }, d = Math.hypot(v.x, v.h, v.y);
      if (d > 40 || d < 0.5) return;
      const c = (v.x * dir.x + v.h * dir.h + v.y * dir.y) / d;
      if (c > bestCos && WD.los(e.x, e.y, e.z, b.x, 1.3, b.y)) { bestCos = c; best = b; }
    });
    return best;
  }
  const PRECHECK = {
    chain_lightning: () => lightningTarget() ? null : '조준선 근처(40m)에 적이 없어요',
    charge: () => G.charge ? '이미 돌진 중이에요' : null
  };
  function chargeStep(t) {
    const c = G.charge;
    if (!c) return;
    Object.values(G.bots).forEach(b => {
      if (!isAlive(b.id) || c.hit.has(b.id) || Math.hypot(b.x - G.pos.x, b.y - G.pos.y) > 1.9) return;
      c.hit.add(b.id);
      knock(b, G.pos, 4);
      WD.shake(0.45);
      WD.ring(b.x, b.y, { color: '#ffb347', r1: 2.5, life: 0.35 });
      damageBot(b.id, 40, false, 'charge', true);
    });
    if (!WD.dashing || t > c.until) { WD.trail(c.from, '#ffb347'); G.charge = null; }
  }
  function slamStep(t) {
    const s = G.slam;
    if (!s) return;
    if (t - s.t > 4) { G.slam = null; return; }
    if (!s.down && t >= s.downAt) { s.down = true; WD.highJump(-30); }
    if (!s.down || !WD.onGround) return;
    G.slam = null;
    WD.slamImpact(6, '#ffb347');
    flash('fx-slam', 350);
    Object.values(G.bots).forEach(b => {
      const d = Math.hypot(b.x - G.pos.x, b.y - G.pos.y);
      if (!isAlive(b.id) || d > 6 || !WD.los(G.pos.x, 0.6, G.pos.y, b.x, 0.8, b.y)) return;
      knock(b, G.pos, 3.5 * (1 - d / 6) + 1);
      damageBot(b.id, 50 * (1 - 0.5 * d / 6), false, 'ground_slam', true);
    });
  }
  const EFFECTS = {
    blink_dash() { const from = G.pos; WD.blink(10); WD.trail(from, '#7fd4ff'); WD.fovKick(0.14); flash('fx-blink', 450); },
    high_jump() { WD.highJump(Math.sqrt(2 * 22 * 12)); WD.burstAtPlayer('#9fe870', 5); WD.fovKick(0.08); flash('fx-jump', 400); },
    charge() {
      G.charge = { from: G.pos, hit: new Set(), until: now() + 0.8 };
      WD.dash(12, 32); WD.fovKick(0.25); WD.burstAtPlayer('#ffb347', 2.5);
      flash('fx-charge', 550);
    },
    ground_slam() {
      const t = now();
      if (WD.onGround) { WD.highJump(9); G.slam = { t, downAt: t + 0.38, down: false }; WD.burstAtPlayer('#ffb347', 2.5); }
      else G.slam = { t, downAt: t, down: false };
    },
    chain_lightning() {
      const first = lightningTarget(); if (!first) return;
      const e = WD.eyePos();
      WD.lightning({ x: e.x, h: e.y - 0.35, y: e.z }, { x: first.x, h: 1.3, y: first.y });
      flash('fx-zap', 300);
      damageBot(first.id, 35, false, 'chain_lightning', true);
      // 주변 12m 적 2명에게 차례로 튐
      let from = first;
      const hit = new Set([first.id]);
      [1, 2].forEach(n => later(() => {
        const next = Object.values(G.bots).filter(b => isAlive(b.id) && !hit.has(b.id) && Math.hypot(b.x - from.x, b.y - from.y) < 12 && WD.los(from.x, 1.3, from.y, b.x, 1.3, b.y))
          .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
        if (!next) return;
        hit.add(next.id);
        WD.lightning({ x: from.x, h: 1.3, y: from.y }, { x: next.x, h: 1.3, y: next.y });
        damageBot(next.id, 20, false, 'chain_lightning', true);
        from = next;
      }, n * 140));
    },
    meteor() {
      const p = WD.aimPoint(45);
      flash('fx-meteor', 600);
      WD.meteor(p.x, p.y, 8, 1.2, () => {
        if (!G || G.over) return;
        blast({ x: p.x, h: 0.5, y: p.y }, 8, 90, 'meteor', true, false);
        if (!G.dead && Math.hypot(G.pos.x - p.x, G.pos.y - p.y) < 14) flash('fx-slam', 350);
      });
    },
    barrier(a) { const h = WD.addBarrier(); later(() => h.remove(), a.dur * 1000); },
    clone(a) {
      const color = D.palette[store.get('outfit').top[1]];
      [Math.PI / 4, -Math.PI / 4].forEach(off => { const c = WD.addClone(color, off); later(() => { if (c.alive) WD.removeClone(c); }, a.dur * 1000); });
      toast('분신 2개 생성');
    },
    turret(a) {
      const h = WD.addTurret();
      G.turret = { h };
      G.turretNext = now() + 1.0; // 설치 1초
      later(() => { h.remove(); G.turret = null; }, a.dur * 1000);
    },
    xray(a) {
      WD.setXray(true); flash('fx-xray-tint', a.dur * 1000); later(() => WD.setXray(false), a.dur * 1000);
      WD.pulse({ color: '#ff4d40', r0: 1, r1: 50, life: 1.0, thick: 0.03, opacity: 0.9 }); // 반경 50m로 퍼지는 탐지파
      later(() => WD.pulse({ color: '#ff8a80', r0: 1, r1: 50, life: 1.0, thick: 0.02, opacity: 0.6 }), 200);
    },
    rewind() {
      const snap = G.hist[0], from = G.pos;
      if (snap) { G.hp = Math.max(G.hp, snap.hp); G.mags = snap.mag.slice(); WD.setPos(snap.pos.x, snap.pos.y); WD.trail(from, '#b48cff'); }
      WD.burstAtPlayer('#b48cff', 3);
      flash('fx-rewind', 900);
      renderWeapons();
    }
  };
  function turretStep(t) {
    if (!G.turret || t < G.turretNext) return;
    G.turretNext = t + 0.15; // 400RPM
    const tp = G.turret.h;
    const tgt = Object.values(G.bots).filter(b => isAlive(b.id))
      .map(b => ({ b, d: Math.hypot(b.x - tp.mx, b.y - tp.my) })).filter(x => x.d < 25).sort((a, b) => a.d - b.d)
      .find(x => WD.los(tp.mx, 1.0, tp.my, x.b.x, 1.3, x.b.y));
    if (!tgt) return;
    tp.aim(tgt.b.x, tgt.b.y);
    WD.turretShot(tp, tgt.b.x + (Math.random() < 0.35 ? 0 : rand(-1, 1)), tgt.b.y + rand(-0.4, 0.4));
    if (Math.random() < 0.35) damageBot(tgt.b.id, 7, false, 'turret', true);
  }

  /* ================= 처치·사망 ================= */
  function kill(victimId, killerId, source, viaAbility) {
    const v = G.players.find(p => p.id === victimId);
    if (!v || !v.alive) return;
    v.alive = false;
    v.placement = alive().length + 1;
    const k = G.players.find(p => p.id === killerId);
    if (k) k.kills++;
    feed(k ? k.name : '자기장', v.name, source, viaAbility, k && k.me, v.me);
    G.botDeaths = G.botDeaths.filter(d => d.id !== victimId);
    const b = G.bots[victimId];
    if (b) {
      WD.killBot(victimId);
      if (Math.random() < 0.5) { const [x, y] = WD.findFree(b.x + 0.8, b.y, 0.4); putItem({ kind: 'ticket' }, x, y); } // 쓰지 않은 티켓이 떨어짐
    }
    if (k && k.me) {
      if (G.tickets < MAX_TICKETS) { G.tickets++; toast('처치 보상: 랜덤 능력 티켓 +1', 'ok'); }
      else toast('티켓이 가득 차서 보상 티켓이 바닥에 떨어졌어요', 'warn');
      if (has('hunter')) {
        G.actives.forEach(s => { if (!s) return; s.cdEnd = s.activeUntil > now() ? s.activeUntil : 0; if (AB[s.id].charges) { s.charges = AB[s.id].charges; s.rechargeEnd = null; } });
        G.hp = Math.min(100, G.hp + 25);
        toast('사냥꾼: 쿨타임 초기화 + 체력 25 회복', 'ok');
        later(() => proc('hunter', '쿨 초기화!'), 0); // 아래 renderAbilities 뒤에 반짝이도록
      }
      renderAbilities();
    }
    $('#aliveCount').textContent = alive().length;
    $('#killCount').textContent = me().kills;
    if (G.spectate === victimId) { G.spectate = (alive().find(p => !p.me) || {}).id; WD.setMode('spectate', G.spectate); }
    checkEnd();
  }
  function feed(killer, victim, source, viaAbility, mine, meDied) {
    const el = document.createElement('div');
    el.className = 'feed' + (mine ? ' mine' : '') + (meDied ? ' died' : '');
    const mid = viaAbility ? icon(source) : `<em>${esc(source)}</em>`;
    el.innerHTML = killer === '자기장' ? `${mid}<b>${esc(victim)}</b>` : `<b>${esc(killer)}</b>${mid}<b>${esc(victim)}</b>`;
    $('#killfeed').prepend(el);
    setTimeout(() => el.classList.add('out'), 6000);
    setTimeout(() => el.remove(), 6500);
  }
  function botDeaths() {
    if (isPrep()) return;
    G.botDeaths.filter(d => G.clock >= d.t).forEach(d => {
      const b = G.bots[d.id];
      if (b && !G.dead && Math.hypot(b.x - G.pos.x, b.y - G.pos.y) < 70) { d.t = G.clock + 15; return; } // 내 근처면 미룸
      const others = alive().filter(p => p.id !== d.id && !p.me);
      const byZone = G.zone.idx >= 1 && Math.random() < 0.3;
      const killer = !byZone && others.length ? pick(others) : null;
      if (killer) killer.damage += rand(100, 180);
      kill(d.id, killer && killer.id, killer ? pick(['AR-556', 'VX-9', 'AK-762', 'SG-12 펌프', 'DM-14', 'MK-45']) : '자기장');
    });
  }
  function die(source) {
    G.dead = true; G.firing = false; G.aiming = false; G.cast = null;
    const m = me();
    m.alive = false;
    m.placement = alive().length + 1;
    const env = source === '자기장' || source === '내 수류탄'; // 쏜 사람이 없는 죽음
    feed(env ? '자기장' : source, m.name, env ? source : 'AR-556', false, false, true);
    $('#aliveCount').textContent = alive().length;
    G.swap = null; $('#swap').hidden = true; $('#roulette').hidden = true; $('#prompt').classList.remove('show');
    G.actives = [null, null]; G.passives = [null, null]; // 사망하면 능력 모두 사라짐
    renderAbilities();
    WD.setMode('dead');
    unlock(true);
    const d = $('#deathOverlay');
    d.innerHTML = `<div class="death-box"><p class="death-rank">#${m.placement} / ${G.players.length}</p><h2>${source === '자기장' ? '자기장에 쓰러졌어요' : source === '내 수류탄' ? '내 수류탄에 쓰러졌어요' : `${esc(source)} 님에게 처치당했어요`}</h2>
      <p class="muted">처치 ${m.kills} · 데미지 ${Math.round(m.damage)}</p>
      <div class="death-actions"><button class="btn btn-lg" id="spectateBtn">관전하기</button><button class="btn btn-lg btn-primary" id="toResult">결과 보기</button></div></div>`;
    d.hidden = false;
    $('#spectateBtn').onclick = () => { d.hidden = true; G.spectate = (alive()[0] || {}).id; WD.setMode('spectate', G.spectate); G.speed = 10; checkEnd(); };
    $('#toResult').onclick = () => finish(false);
    checkEnd();
  }
  function checkEnd() {
    const a = alive();
    if (a.length > 1 || G.over) return;
    if (a.length === 1) a[0].placement = 1;
    if (a.length === 1 && a[0].me) { banner('최후의 1인!', 'go'); G.over = true; unlock(true); setTimeout(() => finish(true), 1800); }
    else if (G.dead && $('#deathOverlay').hidden) { G.over = true; setTimeout(() => finish(false), 1500); }
  }
  function finish(win) {
    G.over = true;
    unlock(true);
    alive().filter(p => !p.placement).forEach((p, i) => { p.placement = i + 1; });
    G.players.forEach(p => {
      if (!p.me && !p.abilities.length) p.abilities = shuffle(P0).slice(0, randInt(1, 4));
      if (!p.me && !p.damage) p.damage = p.kills * 100 + rand(20, 90);
    });
    me().abilities = G.everOwned.slice();
    LF.go('result', { players: G.players.slice(), win, uses: G.abilityUses, time: G.clock + PREP });
  }

  /* ================= 줍기 ================= */
  function lootName(l) {
    if (l.kind === 'weapon') return W[l.id].name;
    if (l.kind === 'ammo') return `${D.ammo[l.id].name} ${D.ammo[l.id].bundle}발`;
    if (l.kind === 'armor') return `${l.slot === 'vest' ? '방탄조끼' : '헬멧'} ${l.lv}단계`;
    if (l.kind === 'medkit') return '구급상자';
    if (l.kind === 'throw') return TH[l.id].name;
    if (l.kind === 'scope') return D.scopes[l.lv].name;
    return '랜덤 능력 티켓';
  }
  function nearItem() {
    let best = null, bd = 2.2;
    G.items.forEach(it => { const d = Math.hypot(it.mx - G.pos.x, it.my - G.pos.y); if (d < bd) { bd = d; best = it; } });
    if (best !== G.nearItem) { G.nearItem = best; renderPrompt(); }
  }
  function renderPrompt() {
    const p = $('#prompt');
    if (!G.nearItem || G.dead) { p.classList.remove('show'); return; }
    p.innerHTML = `<kbd>${esc(K('interact'))}</kbd> 줍기 <b>${esc(lootName(G.nearItem.loot))}</b>`;
    p.classList.add('show');
  }
  function dropItem(loot) { const [x, y] = WD.findFree(G.pos.x + rand(-0.8, 0.8), G.pos.y + rand(-0.8, 0.8), 0.4); putItem(loot, x, y); }
  function pickup() {
    const it = G.nearItem;
    if (!it || G.dead) return;
    const l = it.loot;
    if (l.kind === 'weapon') {
      const w = W[l.id];
      const secondary = w.family === '권총' || w.family === '근접';
      const slot = secondary ? 2 : (G.weapons[0] == null ? 0 : G.weapons[1] == null ? 1 : (G.cur === 1 ? 1 : 0));
      if (G.weapons[slot]) { toast(`${W[G.weapons[slot]].name}을(를) 내려놓았어요`); dropItem({ kind: 'weapon', id: G.weapons[slot] }); }
      G.weapons[slot] = l.id;
      G.mags[slot] = w.mag;
      if (w.ammo) G.reserve[w.ammo] = Math.min(D.ammo[w.ammo].max, G.reserve[w.ammo] + D.ammo[w.ammo].bundle);
      if (G.cur < 0 || !secondary || G.cur === slot) G.cur = slot;
      renderViewmodel();
    } else if (l.kind === 'ammo') {
      const a = D.ammo[l.id];
      if (G.reserve[l.id] >= a.max) { hint(`${a.name}은 최대 ${a.max}발까지 들 수 있어요`); return; }
      G.reserve[l.id] = Math.min(a.max, G.reserve[l.id] + a.bundle);
    } else if (l.kind === 'armor') {
      if (G[l.slot] >= l.lv) { hint('이미 같거나 더 좋은 장비를 입고 있어요'); return; }
      if (G[l.slot]) dropItem({ kind: 'armor', slot: l.slot, lv: G[l.slot] });
      G[l.slot] = l.lv;
    } else if (l.kind === 'medkit') {
      if (G.medkits >= 3) { hint('구급상자는 3개까지 들 수 있어요'); return; }
      G.medkits++;
    } else if (l.kind === 'ticket') {
      if (G.tickets >= MAX_TICKETS) { hint('티켓은 최대 3장까지 들 수 있어요'); return; }
      G.tickets++;
      renderAbilities();
    } else if (l.kind === 'throw') {
      if (G.throws[l.id] >= throwMax(l.id)) { hint(`${TH[l.id].name}은 ${throwMax(l.id)}개까지 들 수 있어요`); return; }
      G.throws[l.id]++;
      if (!G.throws[G.throwSel]) G.throwSel = l.id;
      renderThrow();
    } else if (l.kind === 'scope') {
      if (G.scopes.includes(l.lv)) { hint('이미 가진 스코프예요'); return; }
      G.scopes.push(l.lv);
      if (G.cur >= 0) renderViewmodel();
      const fams = D.scopes[l.lv].fam.join('·');
      toast(`${lootName(l)} 획득 — 조준(${K('aim')}) 시 ${l.lv}배 확대 · ${fams}`, 'ok');
    }
    if (l.kind !== 'scope') toast(`${lootName(l)} 획득`);
    WD.removeItem(it.mesh);
    G.items = G.items.filter(x => x !== it);
    G.nearItem = null;
    renderPrompt(); renderWeapons(); renderInv();
  }
  function useMedkit() {
    if (G.dead || G.medkits <= 0) { hint('구급상자가 없어요'); return; }
    if (G.hp >= 100) { hint('체력이 가득 차 있어요'); return; }
    if (castKind() === 'ticket') return;
    startCast('heal', '구급상자 사용', MEDKIT_CAST, () => { G.medkits--; G.hp = Math.min(100, G.hp + 75); renderInv(); });
  }

  /* ================= 렌더링 ================= */
  function renderAll() { renderAbilities(); renderViewmodel(); renderThrow(); renderPrompt(); updateHud(now()); $('#aliveCount').textContent = alive().length; $('#killCount').textContent = 0; }

  function renderAbilities() {
    const keys = [K('ability_1'), K('ability_2')];
    const slot = (s, i, kind) => {
      // 패시브: 아이콘 + 이름 + 효과 한 줄 (효과가 터지면 반짝이며 결과를 잠깐 보여 줌)
      if (kind === 'passive') {
        if (!s) return `<div class="pchip empty"><span class="pico">P</span><div><b>패시브 ${i + 1}</b><small>빈 슬롯</small></div></div>`;
        const a = AB[s.id];
        return `<div class="pchip g-${a.grade}" data-pslot="${i}" title="${esc(a.name)} — ${esc(a.desc)}"><span class="pico">${icon(s.id)}</span><div><b>${esc(a.name)}</b><small>${esc(a.short || a.desc)}</small></div></div>`;
      }
      if (!s) return `<div class="aslot empty ${kind}"><kbd>${kind === 'active' ? esc(keys[i]) : 'P'}</kbd><span>${kind === 'active' ? '빈 슬롯' : '패시브'}</span></div>`;
      const a = AB[s.id];
      return `<div class="aslot ${kind} g-${a.grade}" ${kind === 'active' ? `data-aslot="${i}"` : ''} title="${esc(a.name)} — ${esc(a.desc)}">
        ${icon(s.id)}<div class="cd"></div><b class="cd-text"></b>
        ${kind === 'active' ? `<kbd>${esc(keys[i])}</kbd>` : ''}${a.charges ? '<span class="charges"></span>' : ''}
        <span class="aname">${esc(a.name)}</span></div>`;
    };
    $('#abilityBar').innerHTML = `
      <div class="agroup">${G.actives.map((s, i) => slot(s, i, 'active')).join('')}</div>
      <div class="agroup passive-group">${G.passives.map((s, i) => slot(s, i, 'passive')).join('')}</div>
      <button class="ticket ${G.tickets ? '' : 'none'}" id="ticketBtn" title="랜덤 능력 티켓 사용 (${esc(K('use_ticket'))})">${icon('ticket')}<b>×${G.tickets}</b><kbd>${esc(K('use_ticket'))}</kbd></button>`;
    $('#ticketBtn').onclick = useTicket;
  }

  function updateCooldowns(t) {
    G.actives.forEach((s, i) => {
      const el = document.querySelector(`[data-aslot="${i}"]`);
      if (!s || !el) return;
      const a = AB[s.id];
      let ratio = 0, text = '', on = false, empty = false;
      if (a.charges) {
        if (s.charges < a.charges && s.rechargeEnd) { ratio = (s.rechargeEnd - t) / a.cd; text = s.charges === 0 ? Math.ceil(s.rechargeEnd - t) : ''; }
        empty = s.charges === 0;
        el.querySelector('.charges').textContent = s.charges;
      } else if (t < s.activeUntil) { on = true; ratio = (s.activeUntil - t) / a.dur; text = Math.ceil(s.activeUntil - t); }
      else if (t < s.cdEnd) { ratio = (s.cdEnd - t) / a.cd; text = Math.ceil(s.cdEnd - t); empty = true; }
      el.style.setProperty('--p', clamp(ratio, 0, 1));
      el.classList.toggle('cooling', empty || (a.charges && ratio > 0));
      el.classList.toggle('empty-charge', empty);
      el.classList.toggle('on', on);
      el.querySelector('.cd-text').textContent = text;
    });
  }

  function renderWeapons() {
    const names = ['주무기 1', '주무기 2', '보조무기'];
    $('#weaponSlots').innerHTML = G.weapons.map((id, i) =>
      `<div class="wslot ${G.cur === i ? 'is-active' : ''} ${id ? '' : 'empty'}"><kbd>${esc(K('weapon_' + (i + 1)))}</kbd><span>${id ? esc(W[id].name) : names[i]}</span></div>`).join('');
    const w = curW();
    $('#ammoMag').textContent = w.mag ? G.mags[G.cur] : '—';
    $('#ammoReserve').textContent = w.ammo ? G.reserve[w.ammo] : '—';
    const sc = scopeFor(w);
    $('#fireMode').textContent = { semi: '단발', auto: '자동', pump: '펌프', bolt: '볼트', melee: '근접' }[w.mode] + ' · ' + w.name + (sc ? ` · ${sc}× 스코프` : '');
  }

  function renderViewmodel() {
    const id = G.cur >= 0 ? G.weapons[G.cur] : null;
    const sleeve = D.palette[store.get('outfit').top[1]];
    const fam = id ? W[id].family : '맨손';
    const len = { 권총: 90, 기관단총: 150, 돌격소총: 210, 경기관총: 240, 산탄총: 220, 지정사수소총: 250, 저격총: 280, 근접: 0 }[fam];
    let gun;
    if (!id) gun = `
      <g transform="rotate(-18 170 300)"><rect x="140" y="220" width="64" height="150" rx="24" fill="${sleeve}"/><rect x="134" y="168" width="76" height="66" rx="22" fill="#d9a88a"/><path d="M146 186h52M146 204h52" stroke="#b98a6e" stroke-width="3" stroke-linecap="round"/></g>
      <g transform="rotate(16 450 300)"><rect x="420" y="214" width="66" height="160" rx="24" fill="${sleeve}"/><rect x="414" y="160" width="78" height="68" rx="22" fill="#d9a88a"/><path d="M426 178h54M426 196h54" stroke="#b98a6e" stroke-width="3" stroke-linecap="round"/></g>`;
    else if (fam === '근접') gun = `<path d="M330 40 380 30 300 210 280 200z" fill="#c9cdd1" stroke="#555" stroke-width="3"/><rect x="262" y="196" width="34" height="60" rx="6" fill="#4a3424" transform="rotate(24 279 226)"/><circle cx="290" cy="240" r="28" fill="#d9a88a"/><rect x="262" y="250" width="70" height="80" fill="${sleeve}" transform="rotate(-12 297 290)"/>`;
    else gun = `
      <g transform="rotate(-8 300 200)">
        <rect x="${330 - len}" y="118" width="${len}" height="20" rx="4" fill="#2b2f33"/>
        <rect x="${330 - len - 14}" y="122" width="18" height="12" rx="2" fill="#1d2023"/>
        <rect x="300" y="108" width="120" height="44" rx="6" fill="#3a3f45"/>
        ${fam !== '권총' ? `<rect x="400" y="116" width="${fam === '저격총' || fam === '지정사수소총' ? 120 : 90}" height="30" rx="6" fill="#33383d"/>` : ''}
        ${scopeFor(W[id]) ? '<rect x="300" y="86" width="110" height="20" rx="8" fill="#16181a"/><circle cx="300" cy="96" r="12" fill="#3b6b8f"/>' : '<rect x="330" y="98" width="30" height="12" rx="3" fill="#16181a"/>'}
        ${fam === '경기관총' ? '<rect x="318" y="146" width="46" height="46" rx="6" fill="#4a4f39"/><rect x="200" y="138" width="10" height="40" rx="3" fill="#1d2023" transform="rotate(10 205 140)"/>' : ''}
        ${W[id].mag && fam !== '산탄총' && fam !== '경기관총' ? `<rect x="${fam === '권총' ? 352 : 330}" y="148" width="26" height="${fam === '권총' ? 34 : 60}" rx="4" fill="#26292d" transform="rotate(8 340 150)"/>` : ''}
        <rect x="378" y="148" width="28" height="56" rx="6" fill="#26292d" transform="rotate(14 392 150)"/>
        <circle cx="${330 - len - 16}" cy="128" r="4" class="muzzle"/>
      </g>
      <circle cx="400" cy="205" r="30" fill="#d9a88a"/>
      <rect x="380" y="215" width="80" height="140" rx="20" fill="${sleeve}" transform="rotate(-26 420 285)"/>
      ${fam !== '권총' ? `<circle cx="${300 - len * 0.35}" cy="150" r="24" fill="#d9a88a"/><rect x="${250 - len * 0.35}" y="160" width="62" height="160" rx="20" fill="${sleeve}" transform="rotate(30 ${280 - len * 0.35} 240)"/>` : ''}`;
    $('#viewmodel').innerHTML = `<svg viewBox="0 0 600 340" preserveAspectRatio="xMaxYMax meet">${gun}</svg>`;
    $('#viewmodel').dataset.family = fam;
    renderWeapons();
  }

  function renderInv() {
    const box = $('#invOverlay');
    if (box.hidden) return;
    const abRow = (s, label) => s ? `<div class="inv-ab g-${AB[s.id].grade}">${icon(s.id)}<div><small>${label} · ${D.gradeNames[AB[s.id].grade]}</small><b>${esc(AB[s.id].name)}</b><p>${esc(AB[s.id].desc)}</p></div></div>`
      : `<div class="inv-ab empty"><div><small>${label}</small><b>비어 있음</b></div></div>`;
    box.innerHTML = `<div class="inv">
      <section><h3>무기</h3>${G.weapons.map((id, i) => `<div class="inv-row ${id ? '' : 'empty'}"><kbd>${i + 1}</kbd><b>${id ? esc(W[id].name) : '비어 있음'}</b><span>${id ? `${W[id].family} · ${W[id].dmg} 데미지 · ${W[id].rpm}RPM` : ''}</span></div>`).join('')}
        <h3>탄약</h3><div class="inv-ammo">${Object.keys(D.ammo).map(k => `<div><small>${D.ammo[k].name}</small><b>${G.reserve[k]}</b><span>/${D.ammo[k].max}</span></div>`).join('')}</div>
        <h3>장비·소모품</h3><div class="inv-row"><b>헬멧</b><span>${G.helmet ? `${G.helmet}단계 · 피해 −${D.armorReduce[G.helmet] * 100}%` : '없음'}</span></div>
        <div class="inv-row"><b>방탄조끼</b><span>${G.vest ? `${G.vest}단계 · 피해 −${D.armorReduce[G.vest] * 100}%` : '없음'}</span></div>
        <button class="inv-row inv-use" id="invMedkit" ${G.medkits ? '' : 'disabled'}><b>구급상자 ×${G.medkits}</b><span>클릭해서 사용 (3초, 체력 +75)</span></button>
        <h3>투척물 <small>${esc(K('throw'))} 던지기 · ${esc(K('cycle_throw'))} 바꾸기</small></h3><div class="inv-ammo">${THROW_KINDS.map(k => `<div class="${G.throwSel === k ? 'sel' : ''}"><small>${TH[k].name}</small><b>${G.throws[k]}</b><span>/${throwMax(k)}</span></div>`).join('')}</div>
        <h3>스코프</h3><div class="inv-row ${G.scopes.length ? '' : 'empty'}"><b>${G.scopes.length ? G.scopes.slice().sort((a, b) => a - b).map(lv => lv + '×').join(' · ') : '없음'}</b><span>${G.cur >= 0 && scopeFor(curW()) ? `지금 무기에 ${scopeFor(curW())}× 사용 중` : '조준할 때 맞는 배율이 자동으로 붙어요'}</span></div></section>
      <section><h3>능력</h3>${abRow(G.actives[0], `액티브 ${esc(K('ability_1'))}`)}${abRow(G.actives[1], `액티브 ${esc(K('ability_2'))}`)}${abRow(G.passives[0], '패시브 1')}${abRow(G.passives[1], '패시브 2')}
        <h3>랜덤 능력 티켓</h3><div class="inv-tickets" id="invTicket" title="우클릭으로 사용">${Array.from({ length: MAX_TICKETS }, (_, i) => `<span class="${i < G.tickets ? 'on' : ''}">${icon('ticket')}</span>`).join('')}<small>우클릭 또는 ${esc(K('use_ticket'))} 키로 사용 · 최대 3장</small></div></section>
    </div><p class="overlay-hint">${esc(K('inventory'))} 키로 닫기</p>`;
    $('#invMedkit').onclick = () => { useMedkit(); toggleOverlay('invOverlay', false); };
    $('#invTicket').oncontextmenu = e => { e.preventDefault(); useTicket(); toggleOverlay('invOverlay', false); };
  }

  function updateHud(t) {
    const [label, left, cls] = zoneLabel();
    $('#zoneLabel').textContent = label;
    $('#zoneTimer').textContent = fmtTime(left);
    $('#zonePill').className = 'zone-pill ' + cls + (G.speed > 1 ? ' fast' : '');
    $('#zonePill').dataset.speed = '×' + G.speed;
    G.lagHp += (G.hp - G.lagHp) * 0.06;
    if (G.lagHp < G.hp) G.lagHp = G.hp;
    $('#hpFill').style.width = G.hp + '%';
    $('#hpLag').style.width = G.lagHp + '%';
    $('#hpText').textContent = Math.ceil(G.hp);
    document.querySelector('.hpbar').classList.toggle('low', G.hp <= 30);
    $('#vignette').classList.toggle('low', G.hp <= 30 && !G.dead);
    document.querySelector('#gearHelmet b').textContent = G.helmet || '—';
    document.querySelector('#gearVest b').textContent = G.vest || '—';
    $('#gearHelmet').classList.toggle('on', G.helmet > 0);
    $('#gearVest').classList.toggle('on', G.vest > 0);
    const w = curW();
    if (w.mag) { $('#ammoMag').textContent = G.mags[G.cur]; $('#ammoMag').classList.toggle('low', G.mags[G.cur] <= Math.ceil(w.mag * 0.25)); }
    if (w.ammo) $('#ammoReserve').textContent = G.reserve[w.ammo];
    // 조준: 화면 확대 (스코프가 있으면 그 배율, 4배율 이상은 스코프 화면)
    G.zoom = zoomFor(w);
    WD.setAds(G.zoom);
    const scoped = G.aiming && G.zoom >= 4;
    $('#scopeView').hidden = !scoped;
    if (scoped) $('#scopeMag').textContent = G.zoom + '×';
    document.querySelector('.screen-hud').classList.toggle('scoped', scoped);
    $('#viewmodel').classList.toggle('ads', G.aiming);
    $('#crosshair').classList.toggle('ads', G.aiming);
    $('#crosshair').style.setProperty('--gap', Math.round(clamp(5 + spreadDeg(w) * 4, 5, 34)) + 'px');
    $('#abilityBar').classList.toggle('locked', isPrep());
    updateCooldowns(t);
    updateMap(G.mini, 0.3, 160);
    if (!$('#mapOverlay').hidden) updateMap(G.big, 0.9);
    const spec = G.dead && G.spectate && G.players.find(p => p.id === G.spectate);
    document.querySelector('.hud').classList.toggle('spectating', !!spec);
    if (spec) { $('#prompt').innerHTML = `관전 중 — <b>${esc(spec.name)}</b>`; $('#prompt').classList.add('show'); }
  }

  /* ================= 오버레이 ================= */
  function toggleOverlay(id, force) {
    const el = $('#' + id);
    const show = force === undefined ? el.hidden : force;
    ['invOverlay', 'mapOverlay', 'menuOverlay'].forEach(o => { if (o !== id) $('#' + o).hidden = true; });
    el.hidden = !show;
    if (show) {
      G.firing = false; G.aiming = false;
      if (id === 'invOverlay') { renderInv(); unlock(true); } // 구급상자 클릭 등을 위해 마우스를 풂
      else updateMap(G.big, 0.9);
    } else if (!G.noLock && !G.locked) { lock(); $('#clickHint').hidden = false; }
  }

  /* ================= 입력 ================= */
  function blocked() { return LF.currentScreen !== 'hud' || !G || G.over || LF.settings.isOpen || $('#modals').children.length > 0; }
  function handleAction(action, down, e) {
    if (G.dead && !['inventory', 'map', 'chat'].includes(action)) return;
    if (!down) {
      if (action === 'fire') G.firing = false;
      if (action === 'aim') G.aiming = false;
      if (action === 'freelook') WD.endFreelook();
      return;
    }
    const blocking = ['invOverlay', 'mapOverlay', 'menuOverlay', 'startOverlay'].some(id => !$('#' + id).hidden);
    if (blocking && !['inventory', 'map'].includes(action)) return;
    if (G.swap && (action === 'ability_1' || action === 'ability_2')) { resolveSwap(action === 'ability_1' ? 0 : 1); return; } // 교체 선택 중 Q/E
    switch (action) {
      case 'fire': G.firing = true; tryFire(); break;
      case 'aim': if (castKind() !== 'ticket' && castKind() !== 'reload' && !isPrep() && curW().mode !== 'melee') G.aiming = true; break;
      case 'reload': startReload(); break;
      case 'interact': pickup(); break;
      case 'ability_1': useAbility(0); break;
      case 'ability_2': useAbility(1); break;
      case 'use_ticket': useTicket(); break;
      case 'throw': throwNow(); break;
      case 'cycle_throw': cycleThrow(); break;
      case 'discard_ability': if (G.swap) resolveSwap('discard'); break;
      case 'weapon_1': switchWeapon(0); break;
      case 'weapon_2': switchWeapon(1); break;
      case 'weapon_3': switchWeapon(2); break;
      case 'inventory': toggleOverlay('invOverlay'); break;
      case 'map': toggleOverlay('mapOverlay'); break;
      case 'chat': if (e) e.preventDefault(); chat.input.focus(); break;
      case 'crouch': G.crouch = !G.crouch; break;
      case 'jump': if (WD.onGround) { G.crouch = false; G.jumpReq = true; } break;
    }
  }

  document.addEventListener('keydown', e => {
    if (blocked()) return;
    if (document.activeElement === chat.input) { if (e.key === 'Escape') chat.input.blur(); return; }
    if (e.code === 'F1') { e.preventDefault(); G.showHint = !G.showHint; G.startT = G.showHint ? Infinity : 0; $('#keyHint').classList.toggle('hide', !G.showHint); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!$('#invOverlay').hidden || !$('#mapOverlay').hidden) toggleOverlay('invOverlay', false);
      else if (!$('#menuOverlay').hidden) { $('#menuOverlay').hidden = true; if (!G.noLock) lock(); }
      else if (!G.dead) $('#menuOverlay').hidden = false;
      return;
    }
    const action = store.actionFor(e.code);
    if (action || ['Tab', 'AltLeft', 'AltRight', 'Space'].includes(e.code)) e.preventDefault();
    held.add(e.code);
    if (e.repeat) return;
    if (action) handleAction(action, true, e);
  });
  document.addEventListener('keyup', e => {
    held.delete(e.code);
    if (blocked()) return;
    const action = store.actionFor(e.code);
    if (action) handleAction(action, false, e);
  });
  window.addEventListener('blur', () => { held.clear(); if (G) { G.firing = false; G.aiming = false; } });

  // 마우스: 고정 중이면 움직임 = 시점, 버튼 = 동작. 고정 전에는 화면 클릭 = 고정 시작
  let drag = null;
  document.addEventListener('mousemove', e => {
    if (blocked() || G.dead) return;
    const free = held.has(store.get('keys').freelook);
    // 배율이 높을수록 시점이 덜 돌게 (8배율에서 손 떨림처럼 휙휙 돌지 않도록)
    const k = 0.0022 * (G.aiming ? store.get('sensAds') * Math.min(1, 1.6 / G.zoom) : store.get('sens'));
    const inv = store.get('invertY') ? -1 : 1;
    if (G.locked) WD.look(e.movementX * k, e.movementY * k * inv, free);
    else if (drag && !overlayOpen()) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.dist += Math.abs(dx) + Math.abs(dy);
      WD.look(dx * k, dy * k * inv, free); drag.x = e.clientX; drag.y = e.clientY;
    }
  });
  const hudEl = document.querySelector('.screen-hud');
  hudEl.addEventListener('mousedown', e => {
    if (blocked() || e.target.closest('button, input, .chat, .overlay, .swap, .demo, .ability-bar')) return;
    if (document.activeElement === chat.input) chat.input.blur();
    if (!G.locked) {
      if (!G.noLock) { lock(); $('#clickHint').hidden = true; return; }
      drag = { x: e.clientX, y: e.clientY, dist: 0, button: e.button };
    }
    const action = store.actionFor('Mouse' + e.button);
    if (!action) return;
    e.preventDefault();
    // 드래그 모드: 사격 버튼은 누를 때 쏘지 않고, 끌지 않고 뗐을 때(짧은 클릭) 한 발 쏨 → 시점 돌리다 총이 나가지 않음
    if (drag && action === 'fire') return;
    handleAction(action, true, e);
  });
  document.addEventListener('mouseup', e => {
    const d = drag; drag = null;
    if (blocked()) return;
    const action = store.actionFor('Mouse' + e.button);
    if (!action) return;
    if (d && action === 'fire') { if (d.button === e.button && d.dist < 6) { handleAction('fire', true, e); handleAction('fire', false, e); } return; }
    handleAction(action, false, e);
  });
  hudEl.addEventListener('contextmenu', e => e.preventDefault());

  /* 메뉴·데모 */
  $('#startPlay').addEventListener('click', () => { if (G && G.noLock) $('#startOverlay').hidden = true; else lock(); });
  $('#menuResume').addEventListener('click', () => { $('#menuOverlay').hidden = true; if (!G.noLock) lock(); });
  $('#menuQuit').addEventListener('click', () => {
    LF.modal({ title: '매치 나가기', body: '<p>지금 나가면 이번 판은 패배로 기록되고, 60초 안에만 다시 접속할 수 있어요.</p>',
      actions: [{ label: '계속하기' }, { label: '나가기', primary: true, onClick: () => { G.over = true; LF.go('lobby'); } }] });
  });
  document.addEventListener('lf:settings', e => {
    if (!G || LF.currentScreen !== 'hud' || e.detail) return;
    WD.applySettings(); renderControls(); renderAbilities(); renderWeapons(); renderPrompt();
  });
  $('#demoToggle').addEventListener('click', () => $('#demo').classList.toggle('open'));
  $('#demo').addEventListener('click', e => {
    const b = e.target.closest('[data-demo]'); if (!b || !G || G.over) return;
    const act = b.dataset.demo;
    const nearest = () => Object.values(G.bots).filter(x => isAlive(x.id)).sort((a, c) => Math.hypot(a.x - G.pos.x, a.y - G.pos.y) - Math.hypot(c.x - G.pos.x, c.y - G.pos.y))[0];
    if (act === 'speed') { G.speed = G.speed > 1 ? 1 : 10; b.textContent = G.speed > 1 ? '자기장 기본 속도' : '자기장 ×10 속도'; }
    if (act === 'ticket') { if (G.tickets < MAX_TICKETS) { G.tickets++; renderAbilities(); } else hint('티켓은 최대 3장이에요'); }
    if (act === 'hit' && !G.dead) takeShot(25, 'body', enemyName());
    if (act === 'kill' && !G.dead) { const t = nearest(); if (t) { me().damage += Math.max(0, t.hp); kill(t.id, me().id, curW().name); } }
    if (act === 'win' && !G.dead) alive().filter(p => !p.me).forEach(p => { me().damage += 100; kill(p.id, me().id, curW().name); });
    if (act === 'die' && !G.dead) { G.hp = 0; die(enemyName()); }
    if (act === 'kit' && !G.dead) { // 새 무기·투척물·스코프를 바로 시험
      G.weapons = ['lm60', pick(['br300', 'sv98', 'amr50']), 'p9'];
      G.mags = G.weapons.map(id => W[id].mag);
      Object.keys(G.reserve).forEach(k => { G.reserve[k] = D.ammo[k].max; });
      THROW_KINDS.forEach(k => { G.throws[k] = throwMax(k); });
      G.scopes = [2, 4, 8]; G.cur = 1;
      renderViewmodel(); renderThrow(); renderInv();
      toast('데모 장비 지급: 경기관총 · 저격총 · 투척물 · 스코프', 'ok');
    }
    if (act === 'abil' && !G.dead) { // 새 액티브 능력을 두 개씩 돌아가며 지급
      const sets = [['charge', 'ground_slam'], ['chain_lightning', 'meteor'], ['blink_dash', 'xray'], ['turret', 'barrier']];
      G.demoSet = ((G.demoSet ?? -1) + 1) % sets.length;
      G.actives = sets[G.demoSet].map(newSlot);
      if (!G.passives[0]) G.passives = [newSlot('eagle_eye'), newSlot('demolition')];
      sets[G.demoSet].forEach(id => { if (!G.everOwned.includes(id)) G.everOwned.push(id); });
      renderAbilities();
      toast(`능력 지급: ${sets[G.demoSet].map(id => AB[id].name).join(', ')}`, 'ok');
    }
  });

  LF.hudDebug = () => G; // 개발용: 콘솔에서 매치 상태 확인

  LF.registerScreen('hud', {
    enter(params) { held.clear(); start(params.session); },
    leave() { cancelAnimationFrame(raf); if (G) { G.over = true; G.timers.forEach(clearTimeout); } held.clear(); unlock(true); hudEl.classList.remove('scoped'); }
  });
})();
