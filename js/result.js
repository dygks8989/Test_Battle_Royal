/* 결과 화면 — 순위·킬·데미지·보유 능력, "한 판 더" */
(function () {
  const { $, esc, icon, fmtTime } = LF;
  const D = LF.data;

  LF.registerScreen('result', {
    enter({ players = [], win, uses = 0, time = 0 }) {
      const me = players.find(p => p.me) || { placement: 0, kills: 0, damage: 0, abilities: [] };
      const sorted = players.slice().sort((a, b) => a.placement - b.placement);
      const chip = id => `<span class="ab-chip g-${D.abilities[id].grade}">${icon(id)}${esc(D.abilities[id].name)}</span>`;
      $('#resultMain').innerHTML = `
        <div class="result-head">
          <p class="result-rank">#${me.placement} / ${players.length}</p>
          <h1 class="result-title ${win ? 'win' : ''}">${win ? '최후의 1인!' : me.placement <= 2 ? '아깝네요!' : '다음 판엔 꼭'}</h1>
          <p class="result-sub">${win ? '섬에서 마지막까지 살아남았어요.' : `${me.placement}위로 매치를 마쳤어요.`}</p>
        </div>
        <div class="result-stats">
          <div class="stat"><small>순위</small><b>#${me.placement}</b></div>
          <div class="stat"><small>처치</small><b>${me.kills}</b></div>
          <div class="stat"><small>가한 데미지</small><b>${Math.round(me.damage)}</b></div>
          <div class="stat"><small>능력 사용</small><b>${uses}</b></div>
        </div>
        <div class="result-abilities">
          <h3>이번 판에 얻은 능력</h3>
          <div class="ab-chips">${me.abilities.length ? me.abilities.map(chip).join('') : '<span class="muted">티켓을 쓰지 않았어요.</span>'}</div>
        </div>
        <div class="result-table-wrap">
          <h3>전체 순위 <span class="muted">· 매치 시간 ${fmtTime(time)}</span></h3>
          <table class="result-table">
            <thead><tr><th>순위</th><th>플레이어</th><th>처치</th><th>데미지</th><th>보유 능력</th></tr></thead>
            <tbody>${sorted.map(p => `<tr class="${p.me ? 'me' : ''}">
              <td class="num">#${p.placement}</td><td>${esc(p.name)}${p.me ? ' (나)' : ''}</td>
              <td class="num">${p.kills}</td><td class="num">${Math.round(p.damage)}</td>
              <td><span class="mini-ab">${p.abilities.map(id => `<span title="${esc(D.abilities[id].name)}" class="g-${D.abilities[id].grade}" style="color:var(--g)">${icon(id)}</span>`).join('') || '—'}</span></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="result-actions">
          <button class="btn btn-primary btn-lg" id="playAgain">한 판 더</button>
          <button class="btn btn-lg" id="toLobby">로비로</button>
        </div>`;
      $('#playAgain').onclick = () => LF.room.session ? LF.go('room', { again: true }) : LF.go('lobby');
      $('#toLobby').onclick = () => LF.go('lobby');
    }
  });
})();
