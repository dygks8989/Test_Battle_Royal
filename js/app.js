/* 진입점 — 공통 버튼 연결 후 로비 표시 (#hud, #custom 으로 바로 열어 볼 수 있음) */
(function () {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) LF.go(b.dataset.go);
  });

  const start = location.hash.slice(1);
  if (start === 'hud') {
    if (!LF.store.get('nickname')) LF.store.set('nickname', '테스터');
    // 방을 거치지 않고 바로 열 때는 가상의 5인 방을 만듦
    const bots = LF.shuffle(LF.data.mockNicknames).slice(0, 4).map((name, i) => ({ id: 'b' + i, name }));
    LF.go('hud', { session: { room: { name: '테스트 방' }, players: [{ id: 'me', name: LF.store.get('nickname'), me: true }, ...bots] } });
  } else if (start === 'custom') LF.go('custom');
  else LF.go('lobby');
})();
