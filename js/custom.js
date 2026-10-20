/* 캐릭터 커스터마이징 — 슬롯 5개, 슬롯당 4~5종, 파츠별 8색, 드래그 회전 미리보기 */
(function () {
  const { $, $$, store, toast, character } = LF;
  const D = LF.data;
  const slots = Object.keys(D.parts);
  let draft, activeSlot = 'hat', from = 'lobby', angle = 0;

  function renderTabs() {
    $('#partTabs').innerHTML = slots.map(s => `<button role="tab" class="${s === activeSlot ? 'is-active' : ''}" data-slot="${s}">${D.parts[s].label}</button>`).join('');
  }
  function renderGrid() {
    const [cur, color] = draft[activeSlot];
    $('#partGrid').innerHTML = D.parts[activeSlot].items.map(([id, name]) =>
      `<button class="part ${id === cur ? 'is-active' : ''}" data-part="${id}">${character.thumb(activeSlot, id, color, draft)}<span>${name}</span></button>`).join('');
    const noColor = activeSlot === 'acc' && cur === 'none';
    $('#swatches').innerHTML = D.palette.map((c, i) =>
      `<button class="swatch ${i === color ? 'is-active' : ''}" style="background:${c}" data-color="${i}" aria-label="색상 ${i + 1}" ${noColor ? 'disabled' : ''}></button>`).join('');
  }
  function renderPreview() {
    $('#previewRot').innerHTML = character.render(draft);
    $('#previewRot').style.transform = `rotateY(${angle}deg)`;
  }
  const renderAll = () => { renderTabs(); renderGrid(); renderPreview(); };

  $('#partTabs').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (b) { activeSlot = b.dataset.slot; renderTabs(); renderGrid(); } });
  $('#partGrid').addEventListener('click', e => { const b = e.target.closest('[data-part]'); if (b) { draft[activeSlot] = [b.dataset.part, draft[activeSlot][1]]; renderGrid(); renderPreview(); } });
  $('#swatches').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (b) { draft[activeSlot] = [draft[activeSlot][0], +b.dataset.color]; renderGrid(); renderPreview(); } });
  $('#customRandom').addEventListener('click', () => { draft = character.randomOutfit(); renderAll(); });
  $('#customSave').addEventListener('click', () => { store.set('outfit', draft); toast('외형을 저장했어요. 다른 플레이어에게도 이 모습으로 보여요.', 'ok'); LF.go(from); });
  $('#customBack').addEventListener('click', () => {
    if (JSON.stringify(draft) === JSON.stringify(store.get('outfit'))) { LF.go(from); return; }
    LF.modal({ title: '저장하지 않고 나가기', body: '<p>바꾼 외형이 저장되지 않아요. 나갈까요?</p>',
      actions: [{ label: '계속 꾸미기' }, { label: '나가기', primary: true, onClick: () => LF.go(from) }] });
  });

  // 드래그 회전 (평면 SVG라 ±40°로 제한)
  let dragX = null;
  const stage = $('#previewStage');
  stage.addEventListener('pointerdown', e => { dragX = e.clientX; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (dragX === null) return; angle = LF.clamp(angle + (e.clientX - dragX) * 0.5, -40, 40); dragX = e.clientX; $('#previewRot').style.transform = `rotateY(${angle}deg)`; });
  stage.addEventListener('pointerup', () => { dragX = null; });

  LF.registerScreen('custom', {
    enter() {
      from = LF.previousScreen === 'room' ? 'room' : 'lobby';
      draft = JSON.parse(JSON.stringify(store.get('outfit')));
      angle = 0;
      renderAll();
    }
  });
})();
