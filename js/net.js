/* 온라인 통신 — Supabase Realtime 채널 (presence = 누가 접속해 있나, broadcast = 메시지)
   - 로비 채널 'lf-lobby': 방장이 자기 방 정보를 presence로 올려 두고, 로비 화면은 목록만 구독
   - 방 채널 'lf-room-<id>': 대기실 인원·준비 상태(presence)와 채팅·시작 신호·인게임 패킷(broadcast)
   서버가 판정하는 실제 게임과 달리, 여기서는 각 브라우저가 자기 판정을 하고 결과를 서로 알림 */
(function () {
  const C = LF.config;
  const myId = 'u' + Math.random().toString(36).slice(2, 10); // 탭마다 새 아이디
  let client = null;

  function sb() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) return null;
    client = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { realtime: { params: { eventsPerSecond: 20 } } });
    return client;
  }

  /* 간단한 이벤트 연결: on('members', fn) → off 함수 반환 */
  const subs = {};
  function on(evt, fn) { (subs[evt] = subs[evt] || new Set()).add(fn); return () => subs[evt].delete(fn); }
  function emit(evt, ...args) { (subs[evt] || []).forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } }); }

  /* ---------- 로비 ---------- */
  const lobby = { ch: null, rooms: [], status: 'off', mine: null };
  function lobbyOpen() {
    const c = sb();
    if (!c) { lobby.status = 'error'; emit('lobby', lobby.rooms, lobby.status); return; }
    if (lobby.ch) { emit('lobby', lobby.rooms, lobby.status); return; }
    const ch = c.channel('lf-lobby', { config: { presence: { key: myId } } });
    ch.on('presence', { event: 'sync' }, () => {
      lobby.rooms = Object.values(ch.presenceState()).flat().map(p => p.room).filter(Boolean);
      emit('lobby', lobby.rooms, lobby.status);
    });
    ch.subscribe(st => {
      if (lobby.ch !== ch) return;
      lobby.status = st === 'SUBSCRIBED' ? 'on' : 'error';
      // 목록만 보는 쪽도 무언가를 track해야 서버가 접속 현황(presence)을 보내 줌
      if (st === 'SUBSCRIBED') { lobby.sent = JSON.stringify(lobby.mine); ch.track(lobby.mine ? { room: lobby.mine } : { viewer: 1 }); }
      else { // 끊기면(백그라운드 탭·네트워크) 잠시 뒤 다시 연결 — 방장이면 방도 다시 올라감
        lobby.ch = null;
        c.removeChannel(ch);
        setTimeout(lobbyOpen, 2000);
      }
      emit('lobby', lobby.rooms, lobby.status);
    });
    lobby.ch = ch;
  }
  // 방장만: 내 방을 공개 목록에 올림/갱신 (인원·게임 중 여부가 실제로 바뀔 때만)
  function publishRoom(info) {
    lobby.mine = info;
    if (!lobby.ch) { lobbyOpen(); return; }
    if (lobby.status !== 'on' || JSON.stringify(info) === lobby.sent) return;
    lobby.sent = JSON.stringify(info);
    lobby.ch.track({ room: info });
  }
  function unpublishRoom() { lobby.mine = null; lobby.sent = 'null'; if (lobby.ch && lobby.status === 'on') lobby.ch.track({ viewer: 1 }); }

  /* ---------- 방 ---------- */
  const room = { ch: null, id: null, me: null, members: [] };
  function roomJoin(id, me) {
    const c = sb();
    if (!c) return Promise.reject(new Error('온라인 연결을 쓸 수 없어요 (Supabase 스크립트를 못 불러옴)'));
    roomLeave();
    room.id = id;
    room.me = Object.assign({ id: myId, at: Date.now() }, me);
    const ch = c.channel('lf-room-' + id, { config: { presence: { key: myId }, broadcast: { self: false } } });
    room.ch = ch;
    ch.on('presence', { event: 'sync' }, () => {
      room.members = Object.values(ch.presenceState()).map(a => a[a.length - 1]).sort((a, b) => a.at - b.at);
      emit('members', room.members);
    });
    // 상태를 다시 track하면 '나감 + 들어옴'이 함께 오므로, 1.5초 뒤에도 없을 때만 진짜로 나간 것으로 봄
    ch.on('presence', { event: 'leave' }, ({ key }) => setTimeout(() => { if (room.ch === ch && !ch.presenceState()[key]) emit('left', key); }, 1500));
    ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (payload && payload.t) emit('msg:' + payload.t, payload); });
    return new Promise((resolve, reject) => {
      let done = false;
      ch.subscribe(async st => {
        if (st === 'SUBSCRIBED' && !done) { done = true; await ch.track(room.me); resolve(); }
        else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !done) { done = true; reject(new Error('방에 연결하지 못했어요')); }
        else if (done && st !== 'SUBSCRIBED') emit('disconnected', st);
      });
    });
  }
  function roomTrack(patch) {
    if (!room.ch) return;
    Object.assign(room.me, patch);
    room.ch.track(room.me);
  }
  function roomSend(t, data) {
    if (!room.ch) return;
    room.ch.send({ type: 'broadcast', event: 'm', payload: Object.assign({ t, f: myId }, data) });
  }
  function roomLeave() {
    if (!room.ch) return;
    const ch = room.ch;
    room.ch = null; room.id = null; room.members = [];
    ch.untrack().finally(() => { if (client) client.removeChannel(ch); });
  }

  LF.net = {
    myId, on, available: () => !!sb(),
    lobbyOpen, publishRoom, unpublishRoom,
    roomJoin, roomTrack, roomSend, roomLeave,
    get rooms() { return lobby.rooms; }, get lobbyStatus() { return lobby.status; },
    get members() { return room.members; }, get inRoom() { return !!room.ch; }, get roomId() { return room.id; }
  };
})();
