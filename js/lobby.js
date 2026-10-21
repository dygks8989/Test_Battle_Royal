/* 로비 — 실제 접속 중인 공개 방 목록(인원·상태), 방 만들기, 빠른 입장, 혼자 연습, 닉네임
   방 목록은 방장 브라우저가 로비 채널에 올려 둔 presence (net.js) */
(function () {
  const { $, esc, store, toast, shuffle, modal } = LF;
  const D = LF.data;
  const MAX = 5;
  let rooms = [];

  function render() {
    const q = $('#roomSearch').value.trim().toLowerCase();
    const onlyWaiting = $('#onlyWaiting').checked;
    const list = rooms.filter(r => (!q || r.name.toLowerCase().includes(q)) && (!onlyWaiting || !r.playing))
      .sort((a, b) => (a.playing - b.playing) || (b.count - a.count));
    $('#roomCount').textContent = `${list.length}개`;
    const st = LF.net.lobbyStatus;
    $('#netStatus').className = 'net-status ' + st;
    $('#netStatus').textContent = st === 'on' ? '온라인' : st === 'error' ? '연결 안 됨 — 혼자 연습만 가능' : '연결 중…';
    $('#roomRows').innerHTML = list.length ? list.map(r => {
      const full = r.count >= MAX;
      const disabled = r.playing || full;
      return `<tr>
        <td class="room-name">${esc(r.name)}</td>
        <td class="muted">${esc(r.host)}</td>
        <td><span class="pcount">${r.count}/${MAX}</span><span class="pdots">${[0, 1, 2, 3, 4].map(i => `<i class="${i < r.count ? 'on' : ''}"></i>`).join('')}</span></td>
        <td><span class="status ${r.playing ? 'playing' : ''}">${r.playing ? '게임 중' : '대기'}</span></td>
        <td><button class="btn btn-sm ${disabled ? '' : 'btn-primary'}" data-join="${esc(r.id)}" ${disabled ? 'disabled' : ''} title="${r.playing ? '게임 중인 방은 들어갈 수 없어요' : full ? '인원이 가득 찼어요' : ''}">${r.playing ? '게임 중' : full ? '가득 참' : '입장'}</button></td>
      </tr>`;
    }).join('') : `<tr class="empty-row"><td colspan="5">${st === 'on' ? '지금 열린 방이 없어요. 새로 만들어 보세요.' : st === 'error' ? '온라인에 연결하지 못했어요. 인터넷 연결을 확인하거나 혼자 연습을 해 보세요.' : '방 목록을 불러오는 중…'}</td></tr>`;
  }

  function requireNickname() {
    const nick = $('#nickname').value.trim();
    if (nick.length < 2) {
      $('.nick-field').classList.add('invalid');
      $('#nickname').focus();
      toast('닉네임을 2자 이상 입력하세요.', 'err');
      return false;
    }
    store.set('nickname', nick);
    return true;
  }
  function online() {
    if (LF.net.lobbyStatus === 'on') return true;
    toast('온라인에 연결되지 않았어요. 혼자 연습은 할 수 있어요.', 'err');
    return false;
  }

  function join(room, asHost) {
    if (!requireNickname() || !online()) return;
    LF.go('room', { room, asHost });
  }
  function newRoom(name) { return { id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, host: store.get('nickname'), count: 1, playing: false }; }

  $('#roomRows').addEventListener('click', e => {
    const b = e.target.closest('[data-join]'); if (!b) return;
    const r = rooms.find(x => x.id === b.dataset.join);
    if (r) join(r, false);
  });
  $('#refreshRooms').addEventListener('click', () => { rooms = LF.net.rooms; render(); toast('방 목록은 실시간으로 갱신돼요.'); });
  $('#roomSearch').addEventListener('input', render);
  $('#onlyWaiting').addEventListener('change', render);
  $('#nickname').addEventListener('input', () => $('.nick-field').classList.remove('invalid'));
  $('#nickname').addEventListener('change', e => store.set('nickname', e.target.value.trim()));

  $('#quickJoin').addEventListener('click', () => {
    if (!requireNickname() || !online()) return;
    const open = rooms.filter(r => !r.playing && r.count < MAX).sort((a, b) => b.count - a.count);
    if (!open.length) { toast('들어갈 수 있는 방이 없어 새 방을 만들어요.', 'warn'); join(newRoom(`${store.get('nickname')}의 방`), true); return; }
    join(open[0], false);
  });

  // 혼자 연습: 봇 4명과 바로 한 판 (통신 없음)
  $('#soloPlay').addEventListener('click', () => {
    if (!requireNickname()) return;
    const bots = shuffle(D.mockNicknames).slice(0, 4).map((name, i) => ({ id: 'b' + i, name }));
    LF.go('hud', { session: { room: { name: '혼자 연습' }, players: [{ id: 'me', name: store.get('nickname'), me: true }, ...bots] } });
  });

  $('#createRoom').addEventListener('click', () => {
    if (!requireNickname() || !online()) return;
    modal({
      title: '방 만들기',
      body: `<label for="newRoomName">방 이름</label>
        <input type="text" id="newRoomName" maxlength="20" value="${esc(store.get('nickname'))}의 방">
        <p class="muted" style="margin-top:12px;font-size:13px">모든 방은 공개 목록에 표시돼요. 최소 2명, 최대 5명이 모두 준비하면 10초 뒤 시작합니다. 방장이 나가면 방이 닫혀요.</p>`,
      actions: [{ label: '취소' }, { label: '만들기', primary: true, onClick: wrap => {
        const name = $('#newRoomName', wrap).value.trim();
        if (!name) { toast('방 이름을 입력하세요.', 'err'); return false; }
        join(newRoom(name), true);
      } }],
      onOpen: wrap => { const i = $('#newRoomName', wrap); i.addEventListener('keydown', e => { if (e.key === 'Enter') $('.btn-primary', wrap).click(); }); setTimeout(() => i.select(), 0); }
    });
  });

  LF.net.on('lobby', list => { rooms = list; if (LF.currentScreen === 'lobby') render(); });

  LF.registerScreen('lobby', {
    enter() {
      $('#nickname').value = store.get('nickname') || '';
      if (LF.room.session || LF.net.inRoom) LF.room.leave(); // 방·매치에서 로비로 나오면 방 연결을 끊음
      LF.net.lobbyOpen();
      rooms = LF.net.rooms;
      render();
    }
  });
})();
