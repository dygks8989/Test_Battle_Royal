# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

「라스트 파이브」(가제) — 5인 온라인 3D 능력자 배틀로얄 FPS의 **기획 문서 + HTML/CSS/JS 퍼블리싱 목업**입니다. 실제 게임은 Godot 4로 만들 예정이고, 이 저장소의 웹 코드는 화면 흐름과 UI를 확인하기 위한 프로토타입입니다.

- 기획의 기준(source of truth)은 마크다운 문서입니다: [PRD.md](PRD.md)(전체), [WEAPON.md](WEAPON.md)(무기 수치), [ABILITY.md](ABILITY.md)(능력·티켓), [DB_DESIGN.md](DB_DESIGN.md)(DB가 필요한 기능과 테이블). 수치를 바꿀 때는 문서와 [js/data.js](js/data.js)를 함께 맞춥니다.
- 판정·봇·자기장은 브라우저 안에서 흉내 낸 것입니다. 실제 게임은 서버 권한형(헤드리스 Godot)이라는 전제를 문서와 코드 주석에서 유지합니다.
- UI 문구, 코드 주석, 문서는 모두 한국어입니다.

## 실행

빌드·린트·테스트 도구는 없습니다(의존성 설치 없음, 순수 정적 파일).

```bash
python -m http.server 5173 --bind 127.0.0.1
```

- `.claude/launch.json`에 같은 설정(`static`)이 있어 미리보기 창에서 바로 띄울 수 있습니다.
- `http://localhost:5173/` = 로비, `#hud` = 가상의 5인 방으로 인게임 바로 시작, `#custom` = 캐릭터 꾸미기.
- 3D는 Three.js **r128**을 cdnjs에서 불러옵니다(전역 `THREE`가 있는 마지막 비모듈 빌드). 인터넷이 막힌 환경에서는 인게임이 뜨지 않습니다.
- 문법 확인: `node --check js/hud.js` (파일마다).
- CSS/JS를 고친 뒤 브라우저 캐시 때문에 반영이 안 되면 [index.html](index.html)의 `?v=N` 버전을 올립니다.

## 아키텍처

### 전역 네임스페이스와 로드 순서
ES 모듈 없이 클래식 `<script>`로 로드하고(파일로 직접 열어도 동작하도록), 모든 모듈이 전역 `LF`에 붙습니다. 순서가 의존성입니다:
`three` → `data` → `core` → `character` → `settings` → `lobby` → `room` → `custom` → `world3d` → `hud` → `result` → `app`.

- [js/core.js](js/core.js): 유틸(`$`, `pick`, `icon`, `keyLabel` …), 저장소 `LF.store`, 화면 전환 `LF.registerScreen(name, {enter, leave})` / `LF.go(name, params)`, 토스트·모달, 공용 채팅(`createChat`: 100자, 초당 2개, 비속어 필터).
  - getter는 `Object.assign`으로 복사되지 않으므로 `LF.currentScreen`·`LF.previousScreen`은 `Object.defineProperty`로 정의돼 있습니다. 새 getter도 같은 방식으로 붙입니다.
- 화면은 [index.html](index.html)의 `<section class="screen" data-screen="…">` 하나씩이고, 각 JS 파일이 자기 화면을 등록합니다. 설정 창(`#settings`)만 화면이 아닌 전역 오버레이(`LF.settings.open()`, `[data-open-settings]`)입니다.
- 화면 간 데이터: 방 세션은 `LF.room.session`이 들고 있고, `LF.go('hud', { session })` → 결과 화면 `LF.go('result', { players, win, … })` → "한 판 더"는 `LF.go('room', { again: true })`.

### 데이터와 설정
- [js/data.js](js/data.js)의 `LF.data`에 기획 수치가 모두 있습니다: 무기·탄약·방어구, 능력(`p: 0`만 뽑기 대상, `p: 1`은 P1이라 제외), 등급 확률, 기본 키, 커스터마이징 파츠, 스폰 구역, 자기장 단계, **건물 22채·숲·활주로(맵 데이터)**.
- `LF.store`는 localStorage `lastfive.v1`에 닉네임·키 배치·감도·FOV·품질·외형을 저장합니다(Godot의 `user://settings.cfg` 대응).
- 키 배치는 `동작 id → KeyboardEvent.code`(마우스는 `Mouse0`/`Mouse2`) 형식입니다. 입력 처리와 화면 표시에 키를 하드코딩하지 말고 `store.actionFor(code)`와 `keyLabel(store.get('keys')[action])`(hud.js의 `K()`)을 씁니다. 고정 키는 `Esc`(메뉴)와 `F1`(안내)뿐입니다.

### 인게임: world3d.js ↔ hud.js
- [js/world3d.js](js/world3d.js) (`LF.world3d`): Three.js 씬, 지형, `data.buildings`로 건물(벽 구간 분할로 출입구·창문 생성, 칸막이, flat/gable/arch 지붕), 나무(InstancedMesh), 충돌(원 vs 회전 박스, `pushOut`), 플레이어 이동·점프·카메라, 레이캐스트 사격(`shoot`), 시야(`los`), 봇·아이템·능력 오브젝트 메시. **게임 규칙은 모릅니다.**
- [js/hud.js](js/hud.js): 매치 상태 `G`와 규칙 전부 — 자기장, 스폰 배정(서로 150m 이상), 아이템 배치, 무기·재장전, 티켓 뽑기·교체 창, 능력 효과, 봇 AI, 처치·사망·관전, HUD 렌더링, 입력, Pointer Lock.
- **좌표계**: 기획·미니맵·`G`는 섬 좌표(0~600m, y가 남쪽), Three.js는 월드 좌표 `x = mx − 300`, `z = my − 300`. world3d의 공개 함수는 섬 좌표를 받고 돌려줍니다. 방향은 섬 좌표 각도(`facing`)와 카메라 `yaw`(`yaw = −facing − π/2`)를 구분합니다.
- 맵(건물·나무·상자 배치)은 고정 시드 RNG라 매 판 같고, 스폰·아이템·봇·자기장 중심만 판마다 무작위입니다. 아이템 자리는 건물 생성 때 `lootSpots`로 만들어집니다.
- 미니맵·큰 지도(SVG)는 `world3d.islandPath()`와 `data.buildings`/`forests`/`runway`를 그대로 그리므로 3D와 자동으로 일치합니다. 맵을 바꿀 때는 data.js만 고치면 됩니다.
- 마우스 고정이 안 되는 환경(미리보기 창 등)에서는 `G.noLock`이 켜지고, 왼쪽 버튼 드래그로 시점을 돌리는 방식으로 대체됩니다.

### 디버깅 메모
- 콘솔에서 `LF.hudDebug()`로 매치 상태 `G`를 볼 수 있습니다(개발용, 서비스 전 제거 대상).
- 인게임 데모 패널(화면 왼쪽 "데모")로 자기장 ×10, 티켓 추가, 피격·처치·승리·사망을 바로 재현할 수 있습니다.
- 미리보기 창이 숨겨져 있으면 `requestAnimationFrame`이 멈춰 렌더·루프가 돌지 않습니다. 이때 카메라 위치 등이 갱신되지 않는 것은 버그가 아닙니다.
