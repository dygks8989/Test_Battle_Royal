/* 공통: 저장소, 화면 전환, 토스트, 모달, 유틸 */
(function () {
  const D = LF.data;

  /* ---------- 유틸 ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTime = sec => { sec = Math.max(0, Math.ceil(sec)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); };

  function icon(id, cls = '') {
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${D.icons[id] || ''}</svg>`;
  }

  function keyLabel(code) {
    if (!code) return '—';
    const map = { Mouse0: '마우스 왼쪽', Mouse1: '마우스 휠', Mouse2: '마우스 오른쪽', Mouse3: '마우스 4', Mouse4: '마우스 5',
      ShiftLeft: 'Shift', ShiftRight: '오른쪽 Shift', ControlLeft: 'Ctrl', ControlRight: '오른쪽 Ctrl', AltLeft: 'Alt', AltRight: '오른쪽 Alt',
      Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backquote: '`', CapsLock: 'Caps Lock', Backspace: 'Backspace',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
    return code;
  }

  /* ---------- 저장소 (Godot user://settings.cfg 대응) ---------- */
  const STORE_KEY = 'lastfive.v1';
  const defaults = () => ({
    nickname: '',
    keys: Object.fromEntries(D.defaultKeys.map(k => [k.id, k.key])),
    sens: 1.0, sensAds: 0.8, invertY: false, fov: 90, quality: 'mid', shake: true,
    volMaster: 80, volEffect: 90, volMusic: 50,
    outfit: { hat: ['short', 1], top: ['tee', 5], bottom: ['cargo', 1], shoes: ['sneaker', 0], acc: ['none', 0] }
  });

  let state;
  try { state = Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); }
  catch (e) { state = defaults(); }
  state.keys = Object.assign(defaults().keys, state.keys);

  const store = {
    get: k => state[k],
    set(k, v) { state[k] = v; this.save(); },
    save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가 환경 무시 */ } },
    defaults,
    actionFor(code) { return Object.keys(state.keys).find(a => state.keys[a] === code) || null; }
  };

  /* ---------- 화면 전환 ---------- */
  const screens = {};
  let current = null, previous = null;
  function registerScreen(name, api) { screens[name] = api; }
  function go(name, params) {
    if (current && screens[current] && screens[current].leave) screens[current].leave();
    $$('.screen').forEach(el => el.classList.toggle('is-active', el.dataset.screen === name));
    previous = current;
    current = name;
    if (screens[name] && screens[name].enter) screens[name].enter(params || {});
  }

  /* ---------- 토스트 ---------- */
  function toast(msg, type = '') {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  /* ---------- 모달 ---------- */
  function modal({ title, body, actions = [], onOpen, wide }) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="닫기">✕</button></header>
        <div class="modal-body">${body}</div>
        ${actions.length ? `<footer class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.primary ? 'btn-primary' : ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</footer>` : ''}
      </div>`;
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('[data-close]')) close();
      const b = e.target.closest('[data-act]');
      if (b) { const a = actions[+b.dataset.act]; if (!a.onClick || a.onClick(wrap) !== false) close(); }
    });
    document.addEventListener('keydown', onKey, true);
    $('#modals').appendChild(wrap);
    if (onOpen) onOpen(wrap, close);
    const first = wrap.querySelector('input, select, .btn-primary');
    if (first) first.focus();
    return { el: wrap, close };
  }

  /* ---------- 채팅 공통 (PRD 4장: 100자, 초당 2개, 비속어 필터) ---------- */
  function createChat(root, { onSend } = {}) {
    const log = $('.chat-log', root);
    const form = $('.chat-form', root);
    const input = $('input', form);
    const sent = [];
    function filter(text) {
      let t = text;
      D.profanity.forEach(w => { t = t.split(w).join('*'.repeat(w.length)); });
      return t;
    }
    function add(name, text, cls = '') {
      const line = document.createElement('div');
      line.className = 'chat-line ' + cls;
      line.innerHTML = name ? `<b>${esc(name)}</b> ${esc(filter(text))}` : esc(text);
      log.appendChild(line);
      while (log.children.length > 60) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    }
    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim().slice(0, 100);
      if (!text) { input.blur(); return; }
      const now = Date.now();
      while (sent.length && now - sent[0] > 1000) sent.shift();
      if (sent.length >= 2) { add(null, '메시지를 너무 빨리 보내고 있어요. (초당 2개)', 'sys'); return; }
      sent.push(now);
      add(store.get('nickname') || '나', text, 'me');
      input.value = '';
      if (onSend) onSend(text);
    });
    return { add, input, clear: () => { log.innerHTML = ''; } };
  }

  Object.assign(LF, { $, $$, rand, randInt, pick, shuffle, clamp, esc, fmtTime, icon, keyLabel, store, registerScreen, go, toast, modal, createChat });
  // getter는 Object.assign으로 복사되지 않으므로 직접 정의
  Object.defineProperty(LF, 'currentScreen', { get: () => current });
  Object.defineProperty(LF, 'previousScreen', { get: () => previous });
})();
