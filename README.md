# 나율이의 대모험

나율이가 주인공인 2D 액션 플랫포머 게임입니다. (슈퍼마리오 스타일)
외부 라이브러리 없이 순수 HTML5 + 캔버스 + 자바스크립트로 만들었고, 캐릭터와 적은
전부 코드에 적힌 도트(픽셀) 그림입니다. 이미지·사운드 파일이 하나도 없습니다.

## 실행 방법

- **가장 쉬운 방법**: `dist/나율이의대모험.html` 파일을 더블클릭 (한 파일로 다 들어있음)
- 개발용: `index.html` 을 브라우저로 열기

## 조작

| 동작 | 키보드 | 휴대폰 |
|---|---|---|
| 이동 | ← → (또는 A / D) | 화면 왼쪽 버튼 |
| 점프 | 스페이스 / ↑ / W | 점프 버튼 |
| 달리기 | Shift | 달리기 버튼 |
| 일시정지 | P | — |
| 소리 켜기/끄기 | M | — |
| 처음부터 | R | — |

적은 위에서 **밟으면** 이깁니다. `?` 블록은 머리로 치면 코인, `★` 블록은 하트가 나옵니다.
하트를 먹으면 몸이 커져서 한 대는 버틸 수 있고, 벽돌도 부술 수 있습니다.
코인 25개를 모으면 목숨이 하나 늘어납니다.

## 기록

지금까지의 작업 내용, 결정 이유, 고친 버그, 남은 일은
[`docs/작업기록.md`](docs/작업기록.md) 에 정리해 두었습니다.

## 폴더 구조

```
index.html          게임 화면 틀
css/style.css       화면 배치, 터치 버튼
js/config.js        ★ 이름·색깔·물리값 설정 (여기부터 고쳐 보세요)
js/levels.js        ★ 스테이지 지도 (글자로 그려져 있습니다)
js/sprites.js       ★ 도트 그림 (글자 한 칸 = 도트 한 개)
js/audio.js         효과음·배경음 (WebAudio로 직접 생성)
js/input.js         키보드 / 터치 입력
js/entities.js      물리, 충돌, 주인공과 적
js/game.js          게임 진행, 화면, 점수
tools/build.js      한 파일짜리 HTML로 합치는 빌드 (node tools/build.js)
tools/png2sprite.js PNG 그림을 도트 코드로 변환 (Piskel 등에서 그린 그림 가져오기)
tools/spritelab.html 도트 확인판 (확대 / 실제크기 / 실루엣 / 애니메이션)
tools/shot.js       확인판을 PNG로 저장
tools/lint-sprites.js 도트 규칙 자동 검사
docs/PIXEL_STYLE.md 도트 스타일 규칙
dist/editor.html    브라우저 도트 편집기 (게임 스프라이트를 직접 찍어 고침)
```

## 도트 그림 고치기

직접 찍고 싶으면 두 가지 방법이 있습니다.

1. **편집기로 바로 찍기** — `dist/editor.html` 을 브라우저로 엽니다.
   게임에 들어 있는 그림이 그대로 불러와지고, 고친 뒤 `코드 내보내기` 를 누르면
   `js/sprites/player.js` 에 붙여 넣을 코드가 나옵니다.

2. **다른 프로그램에서 그리기** — [Piskel](https://www.piskelapp.com)(무료·브라우저),
   [Aseprite](https://www.aseprite.org)(유료·업계 표준), [Pixilart](https://www.pixilart.com)(모바일) 등.
   PNG 로 내보낸 뒤:

   ```bash
   node tools/png2sprite.js 그림.png --frames=4 --names=walk1,walk2,walk3,walk4
   ```

   팔레트에서 가장 가까운 색으로 자동 정리되어 코드가 나옵니다.

## 고쳐 보기

- **이름 바꾸기**: `js/config.js` 의 `PLAYER_NAME`
- **원피스 색 바꾸기**: `js/config.js` 의 `DRESS`, 또는 `js/sprites.js` 의 팔레트 `P`, `p`
- **어렵다 / 쉽다**: `js/config.js` 의 `PHYS` (점프 높이 `JUMP`, 중력 `GRAVITY`, 속도 `MAX_WALK`)
- **새 스테이지 만들기**: `js/levels.js` 의 글자 지도를 고치면 그대로 지형이 됩니다

```
공백 빈칸   #  땅    =  돌블록   B  벽돌    ?  코인블록  !  아이템블록
-  얇은발판  ^  가시  o  코인     E  걷는적  F  나는적    P  시작   G  골
```

고친 뒤에는 `node tools/build.js` 를 실행하면 `dist/나율이의대모험.html` 이 새로 만들어집니다.
