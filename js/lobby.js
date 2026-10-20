/* 로비 — 공개 방 목록(인원·상태, 새로고침), 방 만들기, 빠른 입장, 닉네임 */
(function () {
  const { $, esc, store, toast, randInt, shuffle, modal } = LF;
  const D = LF.data;
  let rooms = [];

  function makeRooms() {
    const names = shuffle(D.mockRoomNames);
    const hosts = shuffle(D.mockNicknames);
    return names.slice(0, randInt(6, 9)).map((name, i) => {
      const playing = Math.random() < 0.3;
      return { id: 'r' + Date.now() + i, name, host: hosts[i], count: playing ? randInt(2, 5) : randInt(1, 5), playing, ping: randInt(12, 160) };
    });
  }

  function pingClass(p) { return p < 60 ? 'good' : p < 110 ? 'mid' : 'bad'; }

  function render() {
    const q = $('#roomSearch').value.trim().toLowerCase();
    const onlyWaiting = $('#onlyWaiting').checked;
    const list = rooms.filter(r => (!q || r.name.toLowerCase().includes(q)) && (!onlyWaiting || !r.playing));
    $('#roomCount').textContent = `${list.length}개`;
    $('#roomRows').innerHTML = list.length ? list.map(r => {
      const full = r.count >= 5;
      const disabled = r.playing || full;
      return `<tr>
        <td class="room-name">${esc(r.name)}</td>
        <td class="muted">${esc(r.host)}</td>
        <td><span class="pcount">${r.count}/5</span><span class="pdots">${[0, 1, 2, 3, 4].map(i => `<i class="${i < r.count ? 'on' : ''}"></i>`).join('')}</span></td>
        <td><span class="status ${r.playing ? 'playing' : ''}">${r.playing ? '게임 중' : '대기'}</span></td>
        <td><span class="ping ${pingClass(r.ping)}">${r.ping}ms</span></td>
        <td><button class="btn btn-sm ${disabled ? '' : 'btn-primary'}" data-join="${r.id}" ${disabled ? 'disabled' : ''} title="${r.playing ? '게임 중인 방은 들어갈 수 없어요' : full ? '인원이 가득 찼어요' : ''}">${r.playing ? '게임 중' : full ? '가득 참' : '입장'}</button></td>
      </tr>`;
    }).join('') : '<tr class="empty-row"><td colspan="6">조건에 맞는 방이 없어요. 새로 만들어 보세요.</td></tr>';
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

  function join(room, asHost) {
    if (!requireNickname()) return;
    LF.go('room', { room, asHost });
  }

  $('#roomRows').addEventListener('click', e => {
    const b = e.target.closest('[data-join]'); if (!b) return;
    join(rooms.find(r => r.id === b.dataset.join), false);
  });
  $('#refreshRooms').addEventListener('click', () => { rooms = makeRooms(); render(); toast('방 목록을 새로 불러왔어요.'); });
  $('#roomSearch').addEventListener('input', render);
  $('#onlyWaiting').addEventListener('change', render);
  $('#nickname').addEventListener('input', () => $('.nick-field').classList.remove('invalid'));
  $('#nickname').addEventListener('change', e => store.set('nickname', e.target.value.trim()));

  $('#quickJoin').addEventListener('click', () => {
    const open = rooms.filter(r => !r.playing && r.count < 5).sort((a, b) => b.count - a.count);
    if (!open.length) { toast('들어갈 수 있는 방이 없어 새 방을 만들어요.', 'warn'); join(newRoom(`${$('#nickname').value.trim() || '나'}의 방`), true); return; }
    join(open[0], false);
  });

  function newRoom(name) { return { id: 'r' + Date.now(), name, host: store.get('nickname'), count: 0, playing: false, ping: randInt(8, 30) }; }

  $('#createRoom').addEventListener('click', () => {
    if (!requireNickname()) return;
    modal({
      title: '방 만들기',
      body: `<label for="newRoomName">방 이름</label>
        <input type="text" id="newRoomName" maxlength="20" value="${esc(store.get('nickname'))}의 방">
        <p class="muted" style="margin-top:12px;font-size:13px">모든 방은 공개 목록에 표시돼요. 최소 2명, 최대 5명이 모두 준비하면 10초 뒤 시작합니다.</p>`,
      actions: [{ label: '취소' }, { label: '만들기', primary: true, onClick: wrap => {
        const name = $('#newRoomName', wrap).value.trim();
        if (!name) { toast('방 이름을 입력하세요.', 'err'); return false; }
        join(newRoom(name), true);
      } }],
      onOpen: wrap => { const i = $('#newRoomName', wrap); i.addEventListener('keydown', e => { if (e.key === 'Enter') $('.btn-primary', wrap).click(); }); setTimeout(() => i.select(), 0); }
    });
  });

  LF.registerScreen('lobby', {
    enter() {
      $('#nickname').value = store.get('nickname') || '';
      if (!rooms.length) rooms = makeRooms();
      render();
    }
  });
})();
