/* 방 대기실 — 실제 접속자 5슬롯, 준비, 10초 카운트다운, 방장 강퇴, 개인 뮤트, 방 채팅, 빈자리 봇
   인원·준비 상태는 방 채널 presence, 카운트다운·시작·강퇴·채팅은 broadcast (net.js)
   카운트다운과 시작 신호는 방장 브라우저가 냄. 봇 목록은 방장 presence의 bots에 들어 있고,
   판이 시작되면 방장 브라우저가 봇을 움직임 (hud.js) */
(function () {
  const { $, esc, store, toast, createChat, character, pick } = LF;
  const D = LF.data;
  const N = LF.net;
  const MAX = 5, MIN = 2, COUNTDOWN = 10;

  let session = null;       // { online, room: {id, name, host}, players, seed }
  let countdown = null, cdLeft = 0;
  const muted = new Set();
  const chat = createChat($('#roomChat'), { onSend: text => N.roomSend('chat', { name: store.get('nickname'), text }) });

  const me = () => session.players.find(p => p.me);
  const amHost = () => !!(session && me() && me().host);
  const humans = () => session.players.filter(p => !p.bot);
  const botsOf = members => { const h = members.find(m => m.host); return (h && h.bots) || []; };
  function publish(playing) {
    // 로비 목록의 인원은 사람만 셈 — 봇이 찬 방에도 들어올 수 있고, 들어오면 방장이 봇 하나를 뺌
    N.publishRoom({ id: session.room.id, name: session.room.name, host: store.get('nickname'), count: humans().length, playing: !!playing });
  }
  // 방장만: 빈자리에 봇 추가·빼기 (방장 presence의 bots를 고치면 모두에게 반영됨)
  function setBots(list) { N.roomTrack({ bots: list }); }
  function addBot() {
    if (session.players.length >= MAX) return;
    const bots = botsOf(N.members);
    const used = new Set(session.players.map(p => p.name));
    const free = D.mockNicknames.filter(n => !used.has(n));
    const name = free.length ? pick(free) : `봇 ${bots.length + 1}`;
    setBots(bots.concat({ id: 'bot' + Math.random().toString(36).slice(2, 8), name, outfit: character.randomOutfit() }));
    chat.add(null, `빈자리에 봇 ${name} 입장`, 'sys');
  }

  /* presence 목록 → 화면용 플레이어 목록 (들어온 순서, 5명까지만) */
  function syncPlayers(members) {
    if (!session) return;
    const idx = members.findIndex(m => m.id === N.myId);
    if (idx < 0) return; // 막 들어와서 내 정보가 아직 목록에 안 올라옴
    if (idx >= MAX) { bail('방이 가득 찼어요.'); return; } // 6번째 이후로 들어왔으면 자리가 없음
    const people = members.slice(0, MAX).map(m => ({ id: m.id, name: m.name, me: m.id === N.myId, host: !!m.host, ready: !!m.ready, outfit: m.outfit, muted: muted.has(m.id) }));
    // 사람이 들어오면 뒤쪽 봇이 자리를 내줌 (나가면 다시 돌아옴). 방장 presence는 그대로 두고 모두가 같은 규칙으로 계산 —
    // 이때 방장이 presence를 다시 올리면 막 들어온 사람에게 '방장 나감'이 먼저 도착해 튕길 수 있음
    const bots = botsOf(members).slice(0, MAX - people.length);
    session.players = people.concat(bots.map(b => ({ id: b.id, name: b.name, bot: true, ready: true, outfit: b.outfit })));
    // 방장이 목록에서 사라져도 상태 갱신 중일 수 있어 2초 뒤에 다시 확인
    if (!session.players.some(p => p.host) && members.length && LF.currentScreen === 'room' && !session.hostCheck) {
      session.hostCheck = setTimeout(() => {
        if (session) session.hostCheck = null;
        if (session && LF.currentScreen === 'room' && !N.members.some(m => m.host)) bail('방장이 나가서 방이 닫혔어요.');
      }, 2000);
    }
    if (session.fresh && idx >= 0) {
      session.fresh = false;
      if (members.some(m => m.host && m.playing) && !me().host) { bail('이미 게임이 시작된 방이에요.'); return; }
    }
    if (amHost()) publish(session.playing);
    if (LF.currentScreen === 'room') render();
  }
  function bail(msg) {
    toast(msg, 'warn');
    leaveRoom();
    LF.go('lobby');
  }
  function leaveRoom() {
    stopCountdown();
    if (session && amHost()) N.unpublishRoom();
    N.roomLeave();
    session = null;
  }

  function render() {
    const ps = session.players;
    $('#roomName').textContent = session.room.name;
    $('#roomMeta').textContent = `${ps.length}/${MAX}명 · 공개 방 · 온라인`;
    $('#slots').innerHTML = Array.from({ length: MAX }, (_, i) => {
      const p = ps[i];
      if (!p) return amHost()
        ? `<li class="slot empty can-add" data-addbot tabindex="0" title="이 자리를 봇으로 채워요"><b class="slot-plus">＋</b><span>봇으로 채우기</span><small>친구가 들어오면 자리를 내줘요</small></li>`
        : `<li class="slot empty">빈 자리</li>`;
      if (p.bot) return `<li class="slot bot ready">
        ${amHost() ? `<div class="slot-menu"><button data-rmbot="${esc(p.id)}">봇 빼기</button></div>` : ''}
        <div class="slot-char">${character.render(p.outfit)}</div>
        <div class="slot-name"><span class="slot-bot">BOT</span><span>${esc(p.name)}</span></div>
        <div class="slot-state">준비 완료</div>
      </li>`;
      const menu = p.me ? '' : `<div class="slot-menu">
          <button data-mute="${esc(p.id)}">${p.muted ? '뮤트 해제' : '뮤트'}</button>
          ${amHost() ? `<button data-kick="${esc(p.id)}">강퇴</button>` : ''}
        </div>`;
      return `<li class="slot ${p.me ? 'me' : ''} ${p.ready ? 'ready' : ''} ${p.muted ? 'muted-p' : ''}">
        ${menu}
        <div class="slot-char">${character.render(p.outfit || store.get('outfit'))}</div>
        <div class="slot-name">${p.host ? '<span class="slot-host" title="방장">★</span>' : ''}<span>${esc(p.name)}</span>${p.me ? '<small class="muted">(나)</small>' : ''}</div>
        <div class="slot-state">${p.ready ? '준비 완료' : '대기 중'}</div>
      </li>`;
    }).join('');
    const rb = $('#readyBtn');
    rb.textContent = me().ready ? '준비 취소' : '준비';
    rb.classList.toggle('is-ready', me().ready);
    checkStart();
  }

  // 방장만 판단: 2명 이상(봇 포함)이고 사람이 모두 준비, 또는 5명이 찼고 사람 2명 이상 준비면 카운트다운 (봇은 늘 준비라 세지 않음)
  function checkStart() {
    const ps = session.players, hs = humans(), readyH = hs.filter(p => p.ready).length;
    const shouldRun = ps.length >= MIN && (readyH === hs.length || ps.length === MAX && readyH >= MIN);
    if (amHost()) {
      if (shouldRun && !countdown) { N.roomSend('cd', {}); startCountdown(); }
      else if (!shouldRun && countdown) { N.roomSend('cdx', {}); stopCountdown('카운트다운이 취소됐어요.'); }
    }
    if (!countdown) {
      const hs = humans(), readyN = hs.filter(p => p.ready).length, botN = ps.length - hs.length;
      $('#roomStatus').innerHTML = ps.length < MIN
        ? `다른 플레이어를 기다리는 중… (최소 ${MIN}명) — 친구에게 방 이름 <b>${esc(session.room.name)}</b>을 알려 주세요${amHost() ? '. 빈자리를 눌러 봇으로 채울 수도 있어요' : ''}`
        : `준비 ${readyN}/${hs.length}${botN ? ` · 봇 ${botN}` : ''} — 모두 준비하면 시작해요`;
    }
  }

  function startCountdown() {
    stopCountdown();
    cdLeft = COUNTDOWN;
    const tick = () => {
      $('#roomStatus').innerHTML = `<b>${Math.max(0, cdLeft)}</b> 초 뒤 게임을 시작합니다`;
      if (cdLeft-- > 0) return;
      stopCountdown();
      if (amHost()) {
        // 시작 신호: 같은 시드로 모두 같은 스폰·아이템·자기장을 만듦
        const seed = (Math.random() * 2 ** 31) | 0;
        const roster = session.players.map(p => ({ id: p.id, name: p.name, outfit: p.outfit, bot: p.bot ? 1 : 0 }));
        N.roomSend('start', { seed, roster, owner: N.myId });
        beginMatch(seed, roster, N.myId);
      } else $('#roomStatus').textContent = '방장의 시작 신호를 기다리는 중…';
    };
    countdown = setInterval(tick, 1000);
    tick();
  }
  function stopCountdown(msg) {
    if (countdown) clearInterval(countdown);
    countdown = null;
    if (msg) chat.add(null, msg, 'sys');
  }

  // owner: 봇을 움직이는 사람(방장) 아이디
  function beginMatch(seed, roster, owner) {
    if (!roster.some(p => p.id === N.myId)) return; // 시작 뒤에 들어온 사람
    session.started = true; session.playing = true; session.seed = seed;
    if (amHost()) { N.roomTrack({ playing: true }); publish(true); }
    LF.go('hud', { session: { online: true, seed, owner, room: session.room, players: roster.map(p => ({ id: p.id, name: p.name, outfit: p.outfit, bot: !!p.bot, me: p.id === N.myId })) } });
  }

  /* 방 채널 메시지 */
  N.on('members', syncPlayers);
  N.on('msg:chat', m => { if (session && !muted.has(m.f) && LF.currentScreen === 'room') chat.add(m.name, m.text); });
  N.on('msg:cd', () => { if (session && !amHost() && LF.currentScreen === 'room') startCountdown(); });
  N.on('msg:cdx', () => { if (session && !amHost()) stopCountdown('카운트다운이 취소됐어요.'); });
  N.on('msg:start', m => { if (session && LF.currentScreen === 'room') { stopCountdown(); beginMatch(m.seed, m.roster, m.owner || m.f); } });
  N.on('msg:kick', m => { if (session && m.id === N.myId) bail('방장이 나를 내보냈어요.'); });
  N.on('disconnected', () => { if (session && LF.currentScreen === 'room') bail('방 연결이 끊겼어요.'); });

  $('#readyBtn').addEventListener('click', () => { if (!session || !me()) return; N.roomTrack({ ready: !me().ready }); });
  $('#slots').addEventListener('click', e => {
    const add = e.target.closest('[data-addbot]'), rm = e.target.closest('[data-rmbot]');
    if (add && amHost() && !countdown) { addBot(); return; }
    if (rm && amHost()) { const p = session.players.find(x => x.id === rm.dataset.rmbot); setBots(botsOf(N.members).filter(b => b.id !== rm.dataset.rmbot)); if (p) chat.add(null, `봇 ${p.name} 퇴장`, 'sys'); return; }
    const m = e.target.closest('[data-mute]'), k = e.target.closest('[data-kick]');
    if (m) { const id = m.dataset.mute; muted.has(id) ? muted.delete(id) : muted.add(id); const p = session.players.find(x => x.id === id); toast(muted.has(id) ? `${p.name} 님의 채팅을 가렸어요.` : `${p.name} 님 뮤트를 해제했어요.`); syncPlayers(N.members); }
    if (k && amHost()) { const p = session.players.find(x => x.id === k.dataset.kick); N.roomSend('kick', { id: p.id }); chat.add(null, `${p.name} 님을 내보냈어요.`, 'sys'); }
  });
  $('#leaveRoom').addEventListener('click', () => { leaveRoom(); LF.go('lobby'); });
  $('#slots').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-addbot]')) { e.preventDefault(); e.stopPropagation(); e.target.click(); } });
  document.addEventListener('keydown', e => {
    if (LF.currentScreen === 'room' && e.key === 'Enter' && document.activeElement !== chat.input && !LF.settings.isOpen) { e.preventDefault(); chat.input.focus(); }
  });

  LF.registerScreen('room', {
    async enter(params) {
      if (params.room) {
        session = { online: true, room: { id: params.room.id, name: params.room.name, host: params.room.host }, players: [], started: false, playing: false, fresh: true };
        chat.clear();
        $('#slots').innerHTML = ''; $('#roomName').textContent = params.room.name; $('#roomMeta').textContent = '연결 중…';
        $('#roomStatus').textContent = '방에 연결하는 중…';
        try {
          await N.roomJoin(params.room.id, { name: store.get('nickname'), outfit: store.get('outfit'), ready: false, host: !!params.asHost, playing: false });
        } catch (e) { bail(e.message); return; }
        if (!session) return;
        chat.add(null, `'${session.room.name}' 방에 들어왔어요. Enter로 채팅할 수 있어요.`, 'sys');
        syncPlayers(N.members);
      } else if (session && N.inRoom) {
        // 결과 화면의 "한 판 더" 또는 커스터마이징에서 복귀
        N.roomTrack({ outfit: store.get('outfit'), ...(params.again ? { ready: false, playing: false } : {}) });
        if (params.again) {
          session.started = false; session.playing = false;
          chat.add(null, '같은 방으로 돌아왔어요. 한 판 더?', 'sys');
        }
        syncPlayers(N.members);
      } else { LF.go('lobby'); }
    },
    leave() { stopCountdown(); }
  });

  LF.room = { get session() { return session; }, leave: leaveRoom };
})();
