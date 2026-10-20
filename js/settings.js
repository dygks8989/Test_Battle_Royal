/* 설정 창 — 키 재지정(중복 시 경고 후 기존 키 비움), 감도, FOV, 그래픽, 음량 */
(function () {
  const { $, $$, store, keyLabel, toast } = LF;
  const D = LF.data;
  const box = $('#settings');
  let listening = null; // 키 입력을 기다리는 동작 id
  let swallowClick = false; // 마우스로 키를 지정한 직후 따라오는 click 무시

  function renderKeys() {
    const keys = store.get('keys');
    $('#keylist').innerHTML = D.defaultKeys.map(k => `
      <div class="keyrow" data-row="${k.id}">
        <span>${k.label}</span>
        <button class="keybtn ${keys[k.id] ? '' : 'empty'}" data-bind="${k.id}">${keys[k.id] ? keyLabel(keys[k.id]) : '지정 안 됨'}</button>
      </div>`).join('');
  }

  function assign(action, code) {
    const keys = Object.assign({}, store.get('keys'));
    const prev = Object.keys(keys).find(a => a !== action && keys[a] === code);
    if (prev) {
      keys[prev] = null;
      const label = D.defaultKeys.find(k => k.id === prev).label;
      toast(`${keyLabel(code)} 키는 '${label}'에 쓰이고 있어서 그쪽 키를 비웠어요.`, 'warn');
    }
    keys[action] = code;
    store.set('keys', keys);
    renderKeys();
    if (prev) { const row = $(`[data-row="${prev}"]`); row.classList.add('flash'); row.scrollIntoView({ block: 'nearest' }); }
  }

  function stopListening() {
    listening = null;
    $$('.keybtn.listening').forEach(b => b.classList.remove('listening'));
    renderKeys();
  }

  $('#keylist').addEventListener('click', e => {
    const b = e.target.closest('[data-bind]');
    if (swallowClick) { swallowClick = false; e.stopPropagation(); return; }
    if (!b || listening) return;
    listening = b.dataset.bind;
    b.classList.add('listening');
    b.textContent = '키를 누르세요…';
  });

  // 키·마우스 입력 캡처 (설정 창이 열려 있을 때만)
  window.addEventListener('keydown', e => {
    if (!listening) return;
    e.preventDefault(); e.stopPropagation();
    if (e.code === 'Escape') { stopListening(); return; }
    const a = listening; listening = null; assign(a, e.code);
  }, true);
  window.addEventListener('mousedown', e => {
    if (!listening) return;
    e.preventDefault(); e.stopPropagation();
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 400);
    const a = listening; listening = null; assign(a, 'Mouse' + e.button);
  }, true);
  box.addEventListener('contextmenu', e => { if (listening || e.target.closest('.keybtn')) e.preventDefault(); });

  /* ----- 일반 설정 ----- */
  const ranges = [['sSens', 'sens', v => v.toFixed(2)], ['sSensAds', 'sensAds', v => v.toFixed(2)], ['sFov', 'fov', v => v],
    ['sVolMaster', 'volMaster', v => v], ['sVolEffect', 'volEffect', v => v], ['sVolMusic', 'volMusic', v => v]];
  function syncFields() {
    ranges.forEach(([id, key, fmt]) => { const el = $('#' + id); el.value = store.get(key); el.nextElementSibling.textContent = fmt(+el.value); });
    $('#sInvert').checked = store.get('invertY');
    $('#sShake').checked = store.get('shake');
    $$('#sQuality button').forEach(b => b.classList.toggle('is-active', b.dataset.v === store.get('quality')));
  }
  ranges.forEach(([id, key, fmt]) => {
    $('#' + id).addEventListener('input', e => { const v = +e.target.value; store.set(key, v); e.target.nextElementSibling.textContent = fmt(v); });
  });
  $('#sInvert').addEventListener('change', e => store.set('invertY', e.target.checked));
  $('#sShake').addEventListener('change', e => store.set('shake', e.target.checked));
  $('#sQuality').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { store.set('quality', b.dataset.v); syncFields(); } });

  /* ----- 탭 ----- */
  $('.settings-nav').addEventListener('click', e => {
    const b = e.target.closest('[data-stab]'); if (!b) return;
    $$('.settings-nav button').forEach(x => x.classList.toggle('is-active', x === b));
    $$('.spage').forEach(p => p.classList.toggle('is-active', p.dataset.spage === b.dataset.stab));
  });

  $('#settingsReset').addEventListener('click', () => {
    LF.modal({
      title: '기본값으로 초기화', body: '<p>모든 키 배치와 설정을 기본값으로 되돌릴까요?</p>',
      actions: [{ label: '취소' }, { label: '초기화', primary: true, onClick: () => {
        const d = store.defaults();
        ['keys', 'sens', 'sensAds', 'invertY', 'fov', 'quality', 'shake', 'volMaster', 'volEffect', 'volMusic'].forEach(k => store.set(k, d[k]));
        renderKeys(); syncFields(); toast('기본값으로 되돌렸어요.', 'ok');
      } }]
    });
  });

  function open() { renderKeys(); syncFields(); box.hidden = false; document.dispatchEvent(new CustomEvent('lf:settings', { detail: true })); }
  function close() { stopListening(); box.hidden = true; document.dispatchEvent(new CustomEvent('lf:settings', { detail: false })); }
  $('#settingsClose').addEventListener('click', close);
  $('#settingsDone').addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', e => { if (!box.hidden && !listening && e.key === 'Escape') { e.stopPropagation(); close(); } }, true);
  document.addEventListener('click', e => { if (e.target.closest('[data-open-settings]')) open(); });

  LF.settings = { open, close, get isOpen() { return !box.hidden; } };
})();
