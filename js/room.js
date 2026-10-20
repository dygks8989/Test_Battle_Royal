/* 방 대기실 — 5슬롯, 준비, 10초 카운트다운, 방장 강퇴, 개인 뮤트, 로비 채팅 */
(function () {
  const { $, esc, store, toast, randInt, pick, shuffle, createChat, character } = LF;
  const D = LF.data;
  const MAX = 5, MIN = 2, COUNTDOWN = 10;
  const BOT_LINES = ['ㅎㅇ', '준비 ㄱㄱ', '전설 뽑고 싶다', '격납고 가는 사람?', '이번 판은 분신술 나와라', '저 핑 괜찮나요', 'ㄱㄱ', '한 판만 하고 잠'];

  let session = null;
  let timers = [];
  let countdown = null;
  const chat = createChat($('#roomChat'), { onSend: () => maybeBotReply() });

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const me = () => session.players.find(p => p.me);
  const host = () => session.players.find(p => p.host);

  function makeBot(name) {
    return { id: 'p' + Math.random().toString(36).slice(2, 8), name, me: false, host: false, ready: false, ping: randInt(20, 120), outfit: character.randomOutfit(), muted: false };
  }

  function botJoin() {
    if (session.players.length >= MAX) return;
    const used = session.players.map(p => p.name);
    const name = shuffle(D.mockNicknames).find(n => !used.includes(n));
    const bot = makeBot(name);
    session.players.push(bot);
    chat.add(null, `${name} 님이 들어왔어요.`, 'sys');
    later(() => { bot.ready = true; render(); }, randInt(2500, 7000));
    if (Math.random() < 0.5) later(() => chat.add(bot.name, pick(BOT_LINES)), randInt(1500, 5000));
    render();
  }

  function maybeBotReply() {
    const bots = session.players.filter(p => !p.me && !p.muted);
    if (bots.length && Math.random() < 0.6) later(() => chat.add(pick(bots).name, pick(BOT_LINES)), randInt(800, 2500));
  }

  function render() {
    const ps = session.players;
    const amHost = me().host;
    $('#roomName').textContent = session.room.name;
    $('#roomMeta').textContent = `${ps.length}/${MAX}명 · 공개 방`;
    $('#slots').innerHTML = Array.from({ length: MAX }, (_, i) => {
      const p = ps[i];
      if (!p) return `<li class="slot empty">빈 자리</li>`;
      const menu = p.me ? '' : `<div class="slot-menu">
          <button data-mute="${p.id}">${p.muted ? '뮤트 해제' : '뮤트'}</button>
          ${amHost ? `<button data-kick="${p.id}">강퇴</button>` : ''}
        </div>`;
      return `<li class="slot ${p.me ? 'me' : ''} ${p.ready ? 'ready' : ''} ${p.muted ? 'muted-p' : ''}">
        <span class="slot-ping">${p.ping}ms</span>${menu}
        <div class="slot-char">${character.render(p.outfit)}</div>
        <div class="slot-name">${p.host ? '<span class="slot-host" title="방장">★</span>' : ''}<span>${esc(p.name)}</span>${p.me ? '<small class="muted">(나)</small>' : ''}</div>
        <div class="slot-state">${p.ready ? '준비 완료' : '대기 중'}</div>
      </li>`;
    }).join('');
    const rb = $('#readyBtn');
    rb.textContent = me().ready ? '준비 취소' : '준비';
    rb.classList.toggle('is-ready', me().ready);
    checkStart();
  }

  function checkStart() {
    const ps = session.players;
    const allReady = ps.length >= MIN && ps.every(p => p.ready);
    const shouldRun = ps.length === MAX || allReady;
    if (shouldRun && !countdown) startCountdown();
    else if (!shouldRun && countdown) stopCountdown('카운트다운이 취소됐어요.');
    if (!countdown) {
      const readyN = ps.filter(p => p.ready).length;
      $('#roomStatus').innerHTML = ps.length < MIN
        ? `다른 플레이어를 기다리는 중… (최소 ${MIN}명)`
        : `준비 ${readyN}/${ps.length} — 모두 준비하거나 5명이 차면 시작해요`;
    }
  }

  function startCountdown() {
    let left = COUNTDOWN;
    const tick = () => {
      $('#roomStatus').innerHTML = `<b>${left}</b> 초 뒤 게임을 시작합니다`;
      if (left-- <= 0) { stopCountdown(); LF.go('hud', { session }); }
    };
    countdown = setInterval(tick, 1000);
    tick();
  }
  function stopCountdown(msg) {
    clearInterval(countdown); countdown = null;
    if (msg) chat.add(null, msg, 'sys');
  }

  $('#readyBtn').addEventListener('click', () => { me().ready = !me().ready; render(); });
  $('#slots').addEventListener('click', e => {
    const m = e.target.closest('[data-mute]'), k = e.target.closest('[data-kick]');
    if (m) { const p = session.players.find(x => x.id === m.dataset.mute); p.muted = !p.muted; toast(p.muted ? `${p.name} 님의 채팅을 가렸어요.` : `${p.name} 님 뮤트를 해제했어요.`); render(); }
    if (k) { const p = session.players.find(x => x.id === k.dataset.kick); session.players = session.players.filter(x => x !== p); chat.add(null, `${p.name} 님을 강퇴했어요.`, 'sys'); render(); }
  });
  $('#leaveRoom').addEventListener('click', () => LF.go('lobby'));
  document.addEventListener('keydown', e => {
    if (LF.currentScreen === 'room' && e.key === 'Enter' && document.activeElement !== chat.input && !LF.settings.isOpen) { e.preventDefault(); chat.input.focus(); }
  });

  LF.registerScreen('room', {
    enter(params) {
      if (params.room) {
        const self = { id: 'me', name: store.get('nickname'), me: true, host: false, ready: false, ping: params.room.ping, outfit: store.get('outfit'), muted: false };
        session = { room: params.room, players: [] };
        if (params.asHost) { self.host = true; session.players.push(self); }
        else {
          for (let i = 0; i < Math.min(params.room.count, MAX - 1); i++) {
            const b = makeBot(i === 0 ? params.room.host : shuffle(D.mockNicknames).find(n => !session.players.some(p => p.name === n) && n !== params.room.host));
            b.host = i === 0; b.ready = Math.random() < 0.5;
            session.players.push(b);
          }
          session.players.push(self);
        }
        chat.clear();
        chat.add(null, `'${session.room.name}' 방에 들어왔어요. Enter로 채팅할 수 있어요.`, 'sys');
      } else if (session) {
        // 결과 화면의 "한 판 더" 또는 커스터마이징에서 복귀
        me().outfit = store.get('outfit');
        if (params.again) { session.players.forEach(p => { p.ready = false; }); chat.add(null, '같은 방으로 돌아왔어요. 한 판 더?', 'sys'); }
      } else { LF.go('lobby'); return; }
      session.players.filter(p => !p.me && !p.ready).forEach(p => later(() => { p.ready = true; render(); }, randInt(2000, 6000)));
      // 빈자리는 시간차로 다른 플레이어가 채움
      const need = MAX - session.players.length;
      for (let i = 0; i < need; i++) if (Math.random() < 0.8) later(botJoin, randInt(1500, 4000) * (i + 1));
      render();
    },
    leave() { timers.forEach(clearTimeout); timers = []; stopCountdown(); }
  });

  LF.room = { get session() { return session; } };
})();
