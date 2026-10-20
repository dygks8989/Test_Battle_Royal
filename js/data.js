/* 정적 기획 데이터 — PRD.md / WEAPON.md / ABILITY.md 수치를 그대로 옮김 */
window.LF = window.LF || {};

LF.data = {
  /* WEAPON.md 2장 */
  weapons: {
    fists:  { name: '맨손',        family: '근접',         ammo: null,     dmg: 10, rpm: 120, mode: 'melee', mag: 0,  reload: 0,   range: 1.5 },
    p9:     { name: 'P9',          family: '권총',         ammo: 'light',  dmg: 22, rpm: 450, mode: 'semi',  mag: 15, reload: 1.6, range: 30 },
    r45:    { name: 'R45 리볼버',  family: '권총',         ammo: 'light',  dmg: 50, rpm: 120, mode: 'semi',  mag: 6,  reload: 2.8, range: 40 },
    vx9:    { name: 'VX-9',        family: '기관단총',     ammo: 'light',  dmg: 18, rpm: 900, mode: 'auto',  mag: 30, reload: 2.0, range: 25 },
    mk45:   { name: 'MK-45',       family: '기관단총',     ammo: 'light',  dmg: 26, rpm: 600, mode: 'auto',  mag: 25, reload: 2.2, range: 30 },
    ar556:  { name: 'AR-556',      family: '돌격소총',     ammo: 'rifle',  dmg: 24, rpm: 700, mode: 'auto',  mag: 30, reload: 2.4, range: 80 },
    ak762:  { name: 'AK-762',      family: '돌격소총',     ammo: 'rifle',  dmg: 31, rpm: 600, mode: 'auto',  mag: 30, reload: 2.6, range: 80 },
    sg12:   { name: 'SG-12 펌프',  family: '산탄총',       ammo: 'shell',  dmg: 99, rpm: 70,  mode: 'pump',  mag: 5,  reload: 2.5, range: 12 },
    dm14:   { name: 'DM-14',       family: '지정사수소총', ammo: 'rifle',  dmg: 48, rpm: 180, mode: 'semi',  mag: 10, reload: 2.8, range: 200 },
    br300:  { name: 'BR-300',      family: '저격총',       ammo: 'sniper', dmg: 90, rpm: 45,  mode: 'bolt',  mag: 5,  reload: 3.5, range: 600 },
    sv98:   { name: 'SV-98',       family: '저격총',       ammo: 'sniper', dmg: 78, rpm: 55,  mode: 'bolt',  mag: 5,  reload: 3.2, range: 500 },
    amr50:  { name: 'AMR-50 대물', family: '저격총',       ammo: 'sniper', dmg: 125, rpm: 30, mode: 'bolt',  mag: 4,  reload: 4.2, range: 600 },
    lm60:   { name: 'LM-60',       family: '경기관총',     ammo: 'rifle',  dmg: 25, rpm: 750, mode: 'auto',  mag: 60, reload: 5.0, range: 70 },
    machete:{ name: '정글도',      family: '근접',         ammo: null,     dmg: 50, rpm: 60,  mode: 'melee', mag: 0,  reload: 0,   range: 2 }
  },

  /* WEAPON.md 7장 투척물 — 무기 슬롯과 별개로 종류별로 들고 다님 */
  throwables: {
    frag:  { name: '수류탄', color: '#4f6b3a', fuse: 2.5, radius: 7,  dmg: 100, max: 3 },
    smoke: { name: '연막탄', color: '#9aa3a8', fuse: 1.5, radius: 6,  dur: 14,  max: 3 },
    flash: { name: '섬광탄', color: '#d8d2b8', fuse: 1.5, radius: 15, blind: 3.5, max: 3 }
  },
  throwSpeed: 15, // m/s

  /* WEAPON.md 8장 스코프 — 배율, 붙일 수 있는 계열. 조준 시 퍼짐 −40%, 4배율 이상은 스코프 화면 */
  scopes: {
    2: { name: '2배율 스코프', fam: ['기관단총', '돌격소총', '경기관총', '지정사수소총', '저격총'] },
    4: { name: '4배율 스코프', fam: ['돌격소총', '경기관총', '지정사수소총', '저격총'] },
    8: { name: '8배율 스코프', fam: ['지정사수소총', '저격총'] }
  },

  /* WEAPON.md 4장 */
  ammo: {
    light:  { name: '경탄',   bundle: 30, max: 180 },
    rifle:  { name: '소총탄', bundle: 30, max: 180 },
    shell:  { name: '산탄',   bundle: 10, max: 40 },
    sniper: { name: '저격탄', bundle: 5,  max: 20 }
  },

  /* WEAPON.md 5장 */
  armorReduce: { 0: 0, 1: 0.25, 2: 0.40 },

  /* ABILITY.md 3장 — cd: 초, dur: 유지형 효과 시간(쿨타임은 끝난 뒤 시작) */
  abilities: {
    blink_dash:  { name: '번개 대쉬',   type: 'active',  grade: 'common',    p: 0, cd: 10, charges: 2, desc: '바라보는 방향으로 10m 순간이동. 충전 2회.' },
    high_jump:   { name: '고공 점프',   type: 'active',  grade: 'common',    p: 0, cd: 18, desc: '수직으로 12m 도약, 이번 착지 낙하 데미지 면제.' },
    barrier:     { name: '방벽',        type: 'active',  grade: 'common',    p: 0, cd: 25, dur: 12, desc: '전방 3m에 4×2.5m 벽 생성. HP 300, 12초 유지.' },
    clone:       { name: '분신술',      type: 'active',  grade: 'rare',      p: 0, cd: 30, dur: 6,  desc: '나를 본뜬 분신 2개가 ±45°로 달림. 각 HP 1, 6초.' },
    turret:      { name: '터렛 설치',   type: 'active',  grade: 'rare',      p: 0, cd: 45, dur: 20, desc: '자동 터렛 설치. 데미지 7, 400RPM, 사거리 25m, 20초.' },
    xray:        { name: '투시',        type: 'active',  grade: 'rare',      p: 0, cd: 35, dur: 4,  desc: '반경 50m 벽 너머 적 실루엣 4초 표시.' },
    rewind:      { name: '시간 되감기', type: 'active',  grade: 'legendary', p: 0, cd: 60, desc: '3초 전 위치·체력·탄창으로 되돌아감.' },
    charge:      { name: '돌진',        type: 'active',  grade: 'common',    p: 0, cd: 12, desc: '바라보는 방향으로 12m 돌진. 부딪힌 적에게 40 피해 + 밀쳐냄.' },
    ground_slam: { name: '지면 강타',   type: 'active',  grade: 'rare',      p: 0, cd: 22, desc: '뛰어올랐다 내리찍어 반경 6m에 최대 50 피해. 공중에서 쓰면 바로 내리꽂음.' },
    chain_lightning: { name: '연쇄 번개', type: 'active', grade: 'rare',     p: 0, cd: 20, desc: '조준선 근처 적(40m)에게 번개 35 피해, 주변 12m 적 2명에게 튀며 20 피해.' },
    meteor:      { name: '유성 낙하',   type: 'active',  grade: 'legendary', p: 0, cd: 50, desc: '조준 지점(최대 45m)에 1.2초 뒤 유성 낙하. 반경 8m에 최대 90 피해.' },
    swift:       { name: '질주',        type: 'passive', grade: 'common',    p: 0, short: '이동 속도 +10%',        desc: '이동 속도 +10%.' },
    quick_hands: { name: '재빠른 손',   type: 'passive', grade: 'common',    p: 0, short: '재장전·교체 −25%',      desc: '재장전·무기 교체 시간 −25%.' },
    regen:       { name: '재생',        type: 'passive', grade: 'common',    p: 0, short: '6초 무피격 시 회복',    desc: '6초간 피격 없으면 초당 3 회복 (체력 70까지).' },
    eagle_eye:   { name: '매의 눈',     type: 'passive', grade: 'common',    p: 0, short: '조준 퍼짐 −35%',        desc: '조준 중 탄 퍼짐 −35%, 조준 중 이동 속도 감소 없음.' },
    iron_skin:   { name: '강철 피부',   type: 'passive', grade: 'rare',      p: 0, short: '받는 피해 −10%',        desc: '몸통·팔다리 피해 −10% (머리 제외).' },
    vampire:     { name: '흡혈',        type: 'passive', grade: 'rare',      p: 0, short: '준 피해 15% 회복',      desc: '가한 최종 데미지의 15% 회복.' },
    demolition:  { name: '폭파 전문가', type: 'passive', grade: 'rare',      p: 0, short: '폭발 +25% · 투척 +1',   desc: '폭발 피해 +25%, 투척물 종류별 최대 소지 +1, 투척 거리 +30%.' },
    hunter:      { name: '사냥꾼',      type: 'passive', grade: 'legendary', p: 0, short: '처치 시 쿨 초기화',     desc: '처치 시 액티브 쿨타임 초기화 + 체력 25 회복.' },
    /* P1 — 뽑기에서 제외 */
    grapple:     { name: '갈고리',      type: 'active',  grade: 'common',    p: 1, cd: 14 },
    heal_field:  { name: '치유 장판',   type: 'active',  grade: 'common',    p: 1, cd: 40, dur: 6 },
    shockwave:   { name: '충격파',      type: 'active',  grade: 'rare',      p: 1, cd: 25 },
    stealth:     { name: '은신',        type: 'active',  grade: 'legendary', p: 1, cd: 45, dur: 6 },
    keen_ears:   { name: '청각 강화',   type: 'passive', grade: 'common',    p: 1 },
    storm_born:  { name: '자기장 적응', type: 'passive', grade: 'rare',      p: 1 },
    focus:       { name: '집중',        type: 'passive', grade: 'rare',      p: 1 }
  },

  /* ABILITY.md 2.3 */
  gradeRates: [['common', 0.55], ['rare', 0.35], ['legendary', 0.10]],
  gradeNames: { common: '일반', rare: '희귀', legendary: '전설' },

  /* 24x24 아이콘 path */
  icons: {
    blink_dash:  '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    high_jump:   '<path d="M12 2l7 7h-4.5v7h-5V9H5z"/><rect x="3" y="19" width="18" height="2.5" rx="1"/>',
    barrier:     '<path d="M2 5h20v4H2zM2 10h9v4H2zm11 0h9v4h-9zM2 15h20v4H2z"/>',
    clone:       '<circle cx="8" cy="6" r="3"/><path d="M2 21c0-5 3-8 6-8s6 3 6 8z"/><circle cx="16" cy="6" r="3" opacity=".55"/><path d="M14.5 13.3c.5-.2 1-.3 1.5-.3 3 0 6 3 6 8h-6" opacity=".55"/>',
    turret:      '<rect x="7" y="7" width="9" height="7" rx="1.5"/><rect x="15" y="9" width="7" height="2.6" rx="1"/><path d="M11 14 5 22h2.6l4.4-5.6 4.4 5.6H19l-6-8z"/>',
    xray:        '<path d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z"/><circle cx="12" cy="12" r="2"/>',
    rewind:      '<path d="M12 3a9 9 0 11-8.5 6h3.2A6 6 0 1012 6v3L7 4.5 12 0z"/><path d="M11 8h2v4.4l3 1.8-1 1.7-4-2.4z"/>',
    swift:       '<path d="M3 5l7 7-7 7V5zm9 0l7 7-7 7V5z"/>',
    quick_hands: '<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="10" y="1" width="4" height="3" rx="1"/><path d="M12 8v5l3 2"  fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    regen:       '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    iron_skin:   '<path d="M12 2l9 3.5v6c0 5.3-3.8 9.6-9 10.5-5.2-.9-9-5.2-9-10.5v-6z"/>',
    vampire:     '<path d="M12 2s7 8 7 13a7 7 0 01-14 0c0-5 7-13 7-13z"/>',
    hunter:      '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M11 1h2v6h-2zm0 16h2v6h-2zM1 11h6v2H1zm16 0h6v2h-6z"/><circle cx="12" cy="12" r="2"/>',
    charge:      '<path d="M2 9h7v6H2zM10 6l12 6-12 6z"/><path d="M2 5h5M2 19h5" stroke="currentColor" stroke-width="2"/>',
    ground_slam: '<path d="M12 1l3 7h-2v5h-2V8H9z"/><path d="M2 21l4-5 3 3 3-4 3 4 3-3 4 5z"/>',
    chain_lightning: '<path d="M8 1 3 11h5l-2 7 7-10H8l3-7z"/><path d="M17 9l-3 6h3l-1 6 5-8h-3l2-4z" opacity=".7"/>',
    meteor:      '<circle cx="15" cy="15" r="6"/><path d="M2 2l9 9M6 1l7 7M1 6l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    eagle_eye:   '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.6"/>',
    demolition:  '<circle cx="11" cy="14" r="7.5"/><path d="M14 6l3-3m0 0 2 1m-2-1 1-2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    frag:        '<ellipse cx="12" cy="14" rx="7" ry="8"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M15 4h5v3" stroke="currentColor" stroke-width="2" fill="none"/>',
    smoke:       '<rect x="7" y="9" width="10" height="13" rx="2"/><rect x="9" y="6" width="6" height="3"/><circle cx="7" cy="5" r="3" opacity=".6"/><circle cx="13" cy="3" r="2.4" opacity=".5"/><circle cx="18" cy="5" r="2.6" opacity=".4"/>',
    flash:       '<rect x="8" y="8" width="8" height="14" rx="2"/><rect x="10" y="5" width="4" height="3"/><path d="M12 0v3M5 3l2 2M19 3l-2 2" stroke="currentColor" stroke-width="2"/>',
    scope:       '<rect x="2" y="9" width="20" height="6" rx="3"/><circle cx="4" cy="12" r="3.5"/><circle cx="20" cy="12" r="3.5"/><rect x="9" y="5" width="4" height="4"/>',
    ticket:      '<path d="M3 6h18v4a2 2 0 000 4v4H3v-4a2 2 0 000-4z"/><path d="M12 8.5l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4L8.6 11l2.4-.3z" fill="#000" opacity=".45"/>'
  },

  /* PRD 4장 설정 창 기본 키 */
  defaultKeys: [
    { id: 'move_forward',    label: '앞으로 이동',          key: 'KeyW' },
    { id: 'move_left',       label: '왼쪽 이동',            key: 'KeyA' },
    { id: 'move_back',       label: '뒤로 이동',            key: 'KeyS' },
    { id: 'move_right',      label: '오른쪽 이동',          key: 'KeyD' },
    { id: 'sprint',          label: '달리기',               key: 'ShiftLeft' },
    { id: 'crouch',          label: '앉기',                 key: 'KeyC' },
    { id: 'jump',            label: '점프',                 key: 'Space' },
    { id: 'fire',            label: '사격',                 key: 'Mouse0' },
    { id: 'aim',             label: '조준',                 key: 'Mouse2' },
    { id: 'reload',          label: '재장전',               key: 'KeyR' },
    { id: 'interact',        label: '줍기·상호작용',        key: 'KeyF' },
    { id: 'ability_1',       label: '액티브 능력 1',        key: 'KeyQ' },
    { id: 'ability_2',       label: '액티브 능력 2',        key: 'KeyE' },
    { id: 'use_ticket',      label: '랜덤 능력 티켓 사용',  key: 'KeyT' },
    { id: 'throw',           label: '투척',                 key: 'KeyG' },
    { id: 'cycle_throw',     label: '투척물 바꾸기',        key: 'Digit4' },
    { id: 'discard_ability', label: '새 능력 버리기',       key: 'KeyX' },
    { id: 'weapon_1',        label: '무기 1',               key: 'Digit1' },
    { id: 'weapon_2',        label: '무기 2',               key: 'Digit2' },
    { id: 'weapon_3',        label: '무기 3',               key: 'Digit3' },
    { id: 'inventory',       label: '인벤토리',             key: 'Tab' },
    { id: 'map',             label: '지도',                 key: 'KeyM' },
    { id: 'freelook',        label: '자유 둘러보기',        key: 'AltLeft' },
    { id: 'chat',            label: '채팅',                 key: 'Enter' }
  ],

  /* PRD 4장 캐릭터 커스터마이징: 슬롯 5개, 슬롯당 4~6종, 8색 */
  parts: {
    hat:    { label: '모자·헤어', items: [['short', '짧은 머리'], ['long', '긴 머리'], ['beanie', '비니'], ['cap', '야구모자'], ['bucket', '버킷햇']] },
    top:    { label: '상의',      items: [['tee', '티셔츠'], ['hoodie', '후드'], ['jacket', '전술 재킷'], ['shirt', '셔츠'], ['tank', '민소매']] },
    bottom: { label: '하의',      items: [['cargo', '카고 바지'], ['jeans', '청바지'], ['shorts', '반바지'], ['jogger', '트레이닝'], ['camo', '위장 바지']] },
    shoes:  { label: '신발',      items: [['sneaker', '운동화'], ['boots', '군화'], ['hightop', '하이탑'], ['sandal', '샌들']] },
    acc:    { label: '악세사리',  items: [['none', '없음'], ['shades', '선글라스'], ['mask', '마스크'], ['goggles', '고글'], ['pack', '배낭 장식']] }
  },
  palette: ['#e7e3d6', '#2b2d31', '#c8443a', '#e2a33b', '#4f8a4b', '#3f6fb5', '#7b55a6', '#8a6a4a'],

  /* PRD 3장 랜덤 스폰 구역 (600m 섬 좌표, 0~600) */
  spawnZones: [
    { name: '북쪽 해안 초소', x: 300, y: 70 },
    { name: '등대',           x: 500, y: 110 },
    { name: '항구',           x: 540, y: 330 },
    { name: '마을 동쪽',      x: 450, y: 500 },
    { name: '마을 서쪽',      x: 230, y: 520 },
    { name: '숲 캠프',        x: 80,  y: 420 },
    { name: '레이더 기지',    x: 70,  y: 180 },
    { name: '정비창',         x: 170, y: 90 }
  ],
  /* 건물 22채 (PRD: 20~30채) — x,y는 섬 좌표(m) 중심, w=동서 폭, d=남북 깊이
     doors: 출입구가 있는 벽(n/s/e/w), big: 큰 출입구, rooms: 내부 방 개수, roof: flat|gable|arch */
  buildings: [
    { name: '해안 초소',   x: 300, y: 78,  w: 6,  d: 5,  h: 3,   doors: ['s'],      roof: 'flat',  color: '#b9b08f' },
    { name: '등대지기 집', x: 486, y: 122, w: 7,  d: 6,  h: 3,   doors: ['w'],      roof: 'gable', color: '#e8e2d0' },
    { name: '항구 창고',   x: 526, y: 330, w: 16, d: 10, h: 5,   doors: ['w', 'e'], roof: 'flat',  color: '#7f8c8d', big: true },
    { name: '민가',        x: 440, y: 490, w: 8,  d: 7,  h: 3,   doors: ['s'],      roof: 'gable', color: '#d8c3a5' },
    { name: '민가',        x: 462, y: 487, w: 8,  d: 7,  h: 3,   doors: ['s'],      roof: 'gable', color: '#c9d6c3' },
    { name: '큰 민가',      x: 446, y: 512, w: 10, d: 7,  h: 3.2, doors: ['n'],      roof: 'gable', color: '#e3d2c0', rooms: 2 },
    { name: '민가',        x: 471, y: 512, w: 7,  d: 7,  h: 3,   doors: ['n'],      roof: 'gable', color: '#c8b6a6' },
    { name: '민가',        x: 220, y: 508, w: 8,  d: 7,  h: 3,   doors: ['s'],      roof: 'gable', color: '#d6cbb0' },
    { name: '민가',        x: 244, y: 511, w: 8,  d: 7,  h: 3,   doors: ['s'],      roof: 'gable', color: '#bfcfd6' },
    { name: '마을 회관',   x: 232, y: 533, w: 11, d: 7,  h: 3.2, doors: ['n'],      roof: 'gable', color: '#e0d6c6', rooms: 2 },
    { name: '숲 오두막',   x: 86,  y: 418, w: 7,  d: 6,  h: 3,   doors: ['e'],      roof: 'gable', color: '#7a5a3a' },
    { name: '레이더 벙커', x: 76,  y: 186, w: 10, d: 8,  h: 3,   doors: ['e'],      roof: 'flat',  color: '#8a8f86', rooms: 2 },
    { name: '정비창',      x: 172, y: 94,  w: 14, d: 10, h: 5,   doors: ['s'],      roof: 'flat',  color: '#9aa0a6', big: true },
    { name: '격납고',      x: 360, y: 232, w: 36, d: 26, h: 8,   doors: ['s'],      roof: 'arch',  color: '#8f969b', hangar: true },
    { name: '소형 격납고', x: 401, y: 236, w: 16, d: 14, h: 6,   doors: ['s'],      roof: 'arch',  color: '#9ca3a8', hangar: true },
    { name: '관제탑',      x: 262, y: 262, w: 6,  d: 6,  h: 3,   doors: ['e'],      roof: 'flat',  color: '#c9c4b8', tower: true },
    { name: '막사',        x: 205, y: 185, w: 20, d: 8,  h: 3.2, doors: ['s', 'n'], roof: 'gable', color: '#a59f88', rooms: 3 },
    { name: '보급 창고',   x: 300, y: 390, w: 10, d: 8,  h: 3.5, doors: ['n'],      roof: 'flat',  color: '#8d8a7c' },
    { name: '민가',        x: 150, y: 300, w: 8,  d: 7,  h: 3,   doors: ['e'],      roof: 'gable', color: '#d9c7a7' },
    { name: '민가',        x: 432, y: 386, w: 8,  d: 7,  h: 3,   doors: ['w'],      roof: 'gable', color: '#cbbfa8' },
    { name: '식당',        x: 330, y: 168, w: 14, d: 9,  h: 3.2, doors: ['s'],      roof: 'flat',  color: '#b7ad98', rooms: 2 },
    { name: '보급소',      x: 420, y: 152, w: 8,  d: 8,  h: 3.2, doors: ['s'],      roof: 'flat',  color: '#9b9480' }
  ],
  forests: [{ x: 88, y: 425, r: 50 }, { x: 118, y: 300, r: 30 }, { x: 455, y: 120, r: 22 }, { x: 160, y: 470, r: 32 }, { x: 505, y: 435, r: 28 }, { x: 250, y: 120, r: 24 }, { x: 360, y: 470, r: 22 }],
  runway: { x: 300, y: 300, len: 220, wid: 30, rot: -20 },

  /* PRD 3장 자기장 */
  zonePhases: [
    { from: 600, to: 360, wait: 120, shrink: 60, dps: 1 },
    { from: 360, to: 180, wait: 90,  shrink: 45, dps: 3 },
    { from: 180, to: 70,  wait: 60,  shrink: 40, dps: 6 },
    { from: 70,  to: 0,   wait: 45,  shrink: 60, dps: 10 }
  ],

  /* 목업용 데이터 */
  mockRoomNames: ['초보 환영 한 판', '저녁 내전 5인', '전설 능력 뽑자', '10비 점심 배그', '조용히 할 사람', '번개 대쉬 장인방', '아무나 ㄱㄱ', '스나 금지 ㅋㅋ', '한 판만 하고 잠', '격납고 착지 금지'],
  mockNicknames: ['매버릭', '구스', '아이스맨', '바이퍼', '피닉스', '루스터', '행맨', '밥', '페이백', '코요테'],
  profanity: ['시발', '씨발', '병신', '개새', 'fuck', 'shit']
};
