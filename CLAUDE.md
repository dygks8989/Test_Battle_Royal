# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

「라스트 파이브」(가제) — 5인 온라인 3D 능력자 배틀로얄 FPS의 **기획 문서 + HTML/CSS/JS 웹 프로토타입**입니다. 실제 게임은 Godot 4로 만들 예정이고, 웹 코드는 화면 흐름·UI 확인용이면서 **Supabase Realtime으로 실제 사람끼리 2~5인 온라인 대전**이 됩니다(Vercel에 정적 사이트로 배포).

- 기획의 기준(source of truth)은 마크다운 문서입니다: [PRD.md](PRD.md)(전체), [WEAPON.md](WEAPON.md)(무기 수치), [ABILITY.md](ABILITY.md)(능력·티켓), [DB_DESIGN.md](DB_DESIGN.md)(DB가 필요한 기능과 테이블). 수치를 바꿀 때는 문서와 [js/data.js](js/data.js)를 함께 맞춥니다.
- 판정·봇·자기장은 브라우저 안에서 흉내 낸 것입니다. 온라인 대전도 서버 없이 각 브라우저가 판정하고 결과를 서로 알리는 방식입니다. 실제 게임은 서버 권한형(헤드리스 Godot)이라는 전제를 문서와 코드 주석에서 유지합니다.
- UI 문구, 코드 주석, 문서는 모두 한국어입니다.

## 실행

빌드·린트·테스트 도구는 없습니다(의존성 설치 없음, 순수 정적 파일).

```bash
python -m http.server 5173 --bind 127.0.0.1
```

- `.claude/launch.json`에 같은 설정(`static`)이 있어 미리보기 창에서 바로 띄울 수 있습니다.
- `http://localhost:5173/` = 로비, `#hud` = 봇 4명과 혼자 연습(로비의 "혼자 연습"과 같음), `#custom` = 캐릭터 꾸미기.
- 온라인 대전 확인: 같은 주소를 탭 두 개로 열고, 한쪽에서 방 만들기 → 다른 쪽에서 입장 → 둘 다 준비. 닉네임은 localStorage를 공유하므로 각 탭에서 입장 직전에 바꿉니다. 미리보기 창에서는 배경 탭의 렌더 루프가 멈추므로 아래 디버깅 메모의 `requestAnimationFrame` 대체를 두 탭 모두에 적용합니다.
- 공유·검색용 메타정보(탭 제목, description, Open Graph·Twitter 카드, schema.org `VideoGame` JSON-LD, SVG 파비콘)는 [index.html](index.html) `<head>`에 있습니다. 인원(2~5명)·장르·소개 문구를 바꾸면 여기와 로비 히어로 문구도 함께 맞춥니다. 배포 주소가 정해지면 `og:url`·`og:image`를 추가합니다.
- 배포: 빌드 없는 정적 사이트라 Vercel에서 이 저장소를 가져오기만 하면 됩니다(Framework Preset: Other, 빌드 명령 없음).
- 3D는 Three.js **r128**(cdnjs, 전역 `THREE`가 있는 마지막 비모듈 빌드), 온라인은 supabase-js **2.45.4** UMD(jsdelivr, 전역 `supabase`)를 불러옵니다. 인터넷이 막힌 환경에서는 인게임이 뜨지 않고, 온라인 연결만 실패하면 로비에 "연결 안 됨"이 뜨고 혼자 연습만 됩니다.
- 문법 확인: `for f in js/*.js; do node --check "$f" || echo "FAIL $f"; done`
- 여러 곳을 한 번에 고치는 파이썬 스크립트는 heredoc 대신 scratchpad에 파일로 저장해 `PYTHONIOENCODING=utf-8 python -I <스크립트> <대상 파일>`로 실행합니다(Windows Git Bash에서 한글+따옴표 heredoc이 깨지고 콘솔이 cp949라 출력도 깨짐).
- 커밋할 때 나오는 "LF will be replaced by CRLF" 경고는 무시해도 됩니다.
- CSS/JS를 고친 뒤 브라우저 캐시 때문에 반영이 안 되면 [index.html](index.html)의 `?v=N` 버전을 올립니다.

## 아키텍처

### 전역 네임스페이스와 로드 순서
ES 모듈 없이 클래식 `<script>`로 로드하고(파일로 직접 열어도 동작하도록), 모든 모듈이 전역 `LF`에 붙습니다. 순서가 의존성입니다:
`three` → `supabase` → `config` → `data` → `core` → `net` → `character` → `settings` → `lobby` → `room` → `custom` → `world3d` → `hud` → `result` → `app`.

- [js/core.js](js/core.js): 유틸(`$`, `pick`, `icon`, `keyLabel` …), 저장소 `LF.store`, 화면 전환 `LF.registerScreen(name, {enter, leave})` / `LF.go(name, params)`, 토스트·모달, 공용 채팅(`createChat`: 100자, 초당 2개, 비속어 필터).
  - getter는 `Object.assign`으로 복사되지 않으므로 `LF.currentScreen`·`LF.previousScreen`은 `Object.defineProperty`로 정의돼 있습니다. 새 getter도 같은 방식으로 붙입니다.
- 화면은 [index.html](index.html)의 `<section class="screen" data-screen="…">` 하나씩이고, 각 JS 파일이 자기 화면을 등록합니다. 설정 창(`#settings`)만 화면이 아닌 전역 오버레이(`LF.settings.open()`, `[data-open-settings]`)입니다.
- 화면 간 데이터: 방 세션은 `LF.room.session`이 들고 있고, `LF.go('hud', { session })` → 결과 화면 `LF.go('result', { players, win, … })` → "한 판 더"는 `LF.go('room', { again: true })`.

### 온라인 (net.js · room.js · hud.js)
- [js/config.js](js/config.js): Supabase 프로젝트 `last-five`(서울, ref `nrzfqribjpmcoribblqe`)의 URL과 anon 키, 패킷 주기 `tickMs`. DB 테이블은 없고 Realtime 채널만 씁니다. anon 키는 공개용이라 저장소에 있어도 되지만 service_role 키는 절대 넣지 않습니다.
- [js/net.js](js/net.js) (`LF.net`): 채널 두 종류. `lf-lobby`는 방장이 presence로 방 정보(`{id, name, host, count, playing}`)를 올리고 로비가 구독합니다. 목록만 보는 쪽도 `{viewer: 1}`을 track해야 서버가 presence를 보내 줍니다. `lf-room-<id>`는 대기실 인원·준비(presence)와 메시지(broadcast 이벤트 `m`, `payload.t`가 종류)를 나릅니다. 구독은 `LF.net.on('members' | 'left' | 'lobby' | 'msg:<t>', fn)`.
  - presence를 다시 track하면 leave+join이 함께 오므로 `left`는 1.5초 뒤에도 없을 때만 냅니다. 방장 부재 판정(room.js)도 2초 유예가 있습니다.
- 방 흐름: 방장 브라우저가 카운트다운(`cd`/`cdx`)과 시작 신호 `start {seed, roster}`를 냅니다. 모두 같은 `seed`로 `hud.js`의 `RNG`(`sr`/`sp`/`sshuffle`)를 돌려 스폰 구역·아이템·자기장을 똑같이 만듭니다. **시드 RNG 호출 순서가 바뀌면 사람마다 맵이 달라지니**, 판 도중 무작위(퍼짐·드롭 위치 등)는 `Math.random`/`rand`를 쓰고 `sr`/`sp`는 판 준비와 `enterWait`에만 씁니다.
- 인게임: 다른 사람은 `G.bots[id]`에 `remote: true`로 들어가 봇과 같은 메시·판정 경로를 씁니다. 각자 `netStep`에서 자기 상태 + 쌓인 이벤트를 패킷 `g`로 보내고(무료 플랜 초당 100메시지 한도 때문에 약 4.5Hz), `onPacket`/`onEvent`가 받습니다. 명중은 쏜 쪽이 판정해 `hit`(부위 배율 포함, 방어구 전)를 보내고 맞은 쪽이 방어구를 적용합니다. 사망은 본인이 `death`를 알립니다. 아이템 줍기는 접속 중인 참가자 중 아이디가 가장 앞선 사람(`arbiter`)이 `pick`으로 허락합니다. 능력·투척 연출은 `fx(kind, data)` → `applyFx`.
- 새 능력·투척물을 만들면 상대 화면에도 보이도록 `fx(...)` 호출과 `applyFx`의 case를 함께 추가합니다. 상대에게 주는 피해·넉백은 `damageBot`/`knock`이 알아서 네트워크로 보냅니다.

### 데이터와 설정
- [js/data.js](js/data.js)의 `LF.data`에 기획 수치가 모두 있습니다: 무기·탄약·방어구, 능력(`p: 0`만 뽑기 대상, `p: 1`은 P1이라 제외), 등급 확률, 기본 키, 커스터마이징 파츠, 스폰 구역, 자기장 단계, **건물 22채·숲·활주로(맵 데이터)**.
- `LF.store`는 localStorage `lastfive.v1`에 닉네임·키 배치·감도·FOV·품질·외형을 저장합니다(Godot의 `user://settings.cfg` 대응).
- 키 배치는 `동작 id → KeyboardEvent.code`(마우스는 `Mouse0`/`Mouse2`) 형식입니다. 입력 처리와 화면 표시에 키를 하드코딩하지 말고 `store.actionFor(code)`와 `keyLabel(store.get('keys')[action])`(hud.js의 `K()`)을 씁니다. 고정 키는 `Esc`(메뉴)와 `F1`(안내)뿐입니다.

### 인게임: world3d.js ↔ hud.js
- [js/world3d.js](js/world3d.js) (`LF.world3d`): Three.js 씬, 지형, `data.buildings`로 건물(벽 구간 분할로 출입구·창문 생성, 칸막이, flat/gable/arch 지붕), 나무(InstancedMesh), 충돌(원 vs 회전 박스, `pushOut`), 플레이어 이동·점프·카메라, 레이캐스트 사격(`shoot`, 총알 궤적 포함), 시야(`los`, 연막이 가림), 봇·아이템·능력 오브젝트 메시, 투척물 물리(`throwObj`), 효과(`addFx` 기반 궤적·폭발·연막·번개·유성·화면 흔들림). **게임 규칙은 모릅니다.** 효과는 PointLight 대신 가산 혼합 메시로 빛을 흉내 냅니다(라이트를 추가하면 모든 재질이 다시 컴파일돼 끊김).
- [js/hud.js](js/hud.js): 매치 상태 `G`와 규칙 전부 — 자기장, 스폰 배정(서로 150m 이상), 아이템 배치, 무기·재장전·스코프·투척물, 티켓 뽑기·교체 창, 능력 효과, 봇 AI, 처치·사망·관전, HUD 렌더링, 입력, Pointer Lock.
- **좌표계**: 기획·미니맵·`G`는 섬 좌표(0~600m, y가 남쪽), Three.js는 월드 좌표 `x = mx − 300`, `z = my − 300`. world3d의 공개 함수는 섬 좌표를 받고 돌려줍니다. 방향은 섬 좌표 각도(`facing`)와 카메라 `yaw`(`yaw = −facing − π/2`)를 구분합니다.
- 맵(건물·나무·상자 배치)은 고정 시드 RNG라 매 판 같고, 스폰·아이템·봇·자기장 중심만 판마다 무작위입니다. 아이템 자리는 건물 생성 때 `lootSpots`로 만들어집니다.
- 미니맵·큰 지도(SVG)는 `world3d.islandPath()`와 `data.buildings`/`forests`/`runway`를 그대로 그리므로 3D와 자동으로 일치합니다. 맵을 바꿀 때는 data.js만 고치면 됩니다.
- 마우스 고정이 안 되는 환경(미리보기 창 등)에서는 `G.noLock`이 켜지고, 왼쪽 버튼 드래그로 시점을 돌리는 방식으로 대체됩니다. 이때 사격은 누를 때가 아니라 끌지 않고 뗐을 때(짧은 클릭) 한 발 나갑니다.
- 판 안에서만 의미 있는 지연 실행은 `setTimeout` 대신 hud.js의 `later(fn, ms)`를 씁니다. `G.timers`에 모였다가 화면을 떠날 때 한꺼번에 취소됩니다.
- 설정 창을 닫으면 `lf:settings` 이벤트(`detail: false`)가 나가고, hud.js가 이를 받아 키 표시·감도·화질을 다시 적용합니다.

### 확장할 때 함께 고칠 곳
- **액티브 능력**: data.js `abilities`(`p: 0`이면 뽑기에 자동 포함) + `icons` → hud.js `EFFECTS[id]`(필요하면 발동 전 검사 `PRECHECK[id]`, 공중 사용 허용 목록은 `useAbility`) → 3D 연출은 world3d.js 효과 함수 → ABILITY.md 표. 능력으로 준 피해는 `damageBot(id, dmg, head, 능력id, true)`로 넘겨야 킬 피드에 아이콘이 뜨고 흡혈이 적용되지 않습니다.
- **패시브 능력**: data.js에 `short`(HUD에 보이는 효과 한 줄)를 꼭 넣고, 효과가 실제로 날 때 hud.js에서 `proc(id, 문구)`를 불러 슬롯을 반짝이게 합니다. 효과 판정은 `has(id)`.
- **무기**: data.js `weapons`. 새 계열(family)이면 hud.js의 `SPREAD`, 뷰모델 길이 표(`renderViewmodel`), 필요 시 `TRACER`, data.js `scopes[].fam`도 맞춥니다. 스폰은 hud.js `GRADE_POOL`/`rollWeapon`.
- **줍는 아이템 종류**: hud.js `rollLoot` · `lootName` · `pickup` + world3d.js `ITEM_LOOK`(바닥 모양).
- **키 동작**: data.js `defaultKeys`에 추가하면 저장된 설정에도 기본값이 합쳐지고 설정 창에 자동으로 나옵니다. 처리는 hud.js `handleAction`, 안내는 `CONTROLS`.

### 디버깅 메모
- 콘솔에서 `LF.hudDebug()`로 매치 상태 `G`를 볼 수 있습니다(개발용, 서비스 전 제거 대상). 온라인 판에서는 데모 패널이 숨겨집니다.
- 인게임 데모 패널(화면 왼쪽 "데모")로 자기장 ×10, 티켓 추가, 장비 받기(경기관총·저격총·투척물·스코프), 새 능력 받기(누를 때마다 액티브 두 개씩 바뀜), 피격·처치·승리·사망을 바로 재현할 수 있습니다.
- 미리보기 창이 숨겨져 있으면 `requestAnimationFrame`이 멈춰 렌더·루프가 돌지 않습니다. 이때 카메라 위치 등이 갱신되지 않는 것은 버그가 아닙니다. 숨긴 채로 동작을 확인해야 하면 콘솔에서 `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`로 바꾼 뒤 `LF.go('hud', { session })`로 판을 다시 시작합니다(세션이 없으면 봇 없이 혼자 시작).
- 준비 단계(10초)에는 사격·능력이 막힙니다. 바로 시험하려면 `LF.hudDebug().zone.t = 99`로 건너뜁니다.
- 입력 흉내: 키는 `document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }))`(+ `keyup`), 사격은 `#gameCanvas`에 `mousedown` 후 `document`에 `mouseup`(마우스 고정이 없으면 뗄 때 한 발). 연사 간격은 `G.nextShot = 0`으로 건너뜁니다.
- 명중·스킬 시험은 대상을 고정합니다: 봇은 `setInterval(() => { b.x = X; b.y = Y; b.tx = X; b.ty = Y; }, 2)`, 나는 `WD.setPlayer(x, y, facing)` 후 `setInterval(() => WD.setPos(x, y), 20)`.
- 미리보기 창 콘솔의 `WrongDocumentError ... pointer lock`은 마우스 고정이 막힌 환경이라 나는 정상 오류입니다.
- 미리보기 스크린샷은 화면 배율(devicePixelRatio 1.25) 때문에 오른쪽·아래가 잘려 보일 수 있습니다. 레이아웃은 `getBoundingClientRect()`로 확인하고, 화면은 `resize_window`로 크기를 고정한 뒤 `zoom`으로 부분 확인합니다.
