# Win-Rate Champion Tiers

게임 내 승률 통계로 챔피언 S/A/B/C/D 티어리스트를 만들어 **내 팀에만** 적용하는 모드.

`../mod-sdk-stable`의 Stable-ABI SDK로 빌드했고, **서버 확장 하나만** 등록한다.
드래프트 점수 훅도 없고 UI 오버라이드도 없어서, 밴픽 모드를 따로 쓰더라도
Champion 화면을 두고 싸우지 않는다.

---

## 1. 왜 만들었나

기존 `draft_winrate_penalty` 모드를 쓰면서 걸린 두 가지를 고친 것이다.

### 1-1. B 티어가 너무 많다

원인은 설정값이 아니라 **지표와 컷 방식의 조합**에 있다.

```
wr     = (wins + prior*neutral) / (matches + prior)   # 베이지안 shrink
conf   = m / (m + confidence_k)                       # 0..1, 표본이 적을수록 작음
metric = neutral + (wr - neutral) * conf
```

마지막 줄이 핵심이다. `conf`가 곱해지므로 **표본이 얇은 챔피언은 무조건 `neutral`
(=0.5) 쪽으로 끌려온다.** 여기에 고정 임계값을 대면, 0.5를 걸치고 있는 밴드가
로스터를 통째로 삼킨다. 원본의 기본값에서 그 밴드가 바로 B(`[0.48, 0.52)`)였다.

이건 테스트로 못박아 뒀다 — `tiers.rs`의 `threshold_mode_piles_the_roster_into_one_band`은
승률이 44~56% 사이에 퍼진 100챔프 로스터에 원본의 기본 컷을 적용하면 **90개 이상이
B로 몰리는 것**을 확인한다.

그래서 절대 임계값 대신 **백분위 배분**을 기본으로 했다. 로스터를 지표로 정렬한 뒤
비율로 자르므로, 분포가 우연의 산물이 아니라 설정값이 된다.

| 티어 | 기본 비율 |
|:---:|:---|
| S | 10% |
| A | 20% |
| B | 30% |
| C | 25% |
| D | 15% (나머지) |

B를 더 줄이고 싶으면 `share_b=0.24`, `share_c=0.28` 정도로.

> 기존 방식이 편하면 `mode=threshold`로 되돌릴 수 있다. 그 경우에도 원본보다
> 완화된 기본 컷(`tier_b=0.50`, `tier_c=0.478`)을 쓴다.

부수적으로 두 가지를 같이 처리했다.

- **표본 미달 챔피언은 백분위 예산도 안 먹는다.** `min_matches` 미만은 티어를 못
  받는데, 그냥 제외만 하면 전적 없는 챔피언들이 S 자리를 차지해 버린다. 그래서
  등급 대상에서 빼는 동시에 비율 계산에서도 뺀다.
- **동점자는 티어 경계에서 안 갈린다.** 지표가 완전히 같은 챔피언들이 컷에 걸치면
  통째로 위쪽 티어로 묶는다. 안 그러면 id 정렬 순서 때문에 동점자가 갈려서
  리스트가 노이즈처럼 보인다.

### 1-2. 상대 팀까지 티어가 적용된다

`apply_to_ai_teams`가 **기본 `false`**다. `player_team_id`로 찾은 내 팀에만 쓴다.

하나의 "정답" 티어리스트를 리그 전체가 공유하면 모든 팀이 같은 챔피언을 밴하고
같은 챔피언을 뽑는다. 밴픽이 뻔해지는 게 그 이유다. 예전 동작이 필요하면 `true`로.

> **드래프트 훅 쪽은 팀 구분이 원천적으로 불가능하다.** SDK의 `DraftCtxV1`에는
> 팀 id가 없다 — `phase / difficulty / is_explore / ally_picks / enemy_picks`가
> 전부다. 그래서 "내 팀 차례일 때만 보정"을 훅 안에서 가려낼 방법이 없다. 밴픽 AI
> 보정을 상대에게서 빼려면 기존 모드에서 `draft_adjust=false`로 끄는 수밖에 없다.
> 이 모드는 드래프트 훅을 **아예 등록하지 않는다.**

---

## 2. 설치

게임 폴더의 `mods/winrate_tiers/`에 넣는다.

```
mods/winrate_tiers/
  winrate_tiers.dll     # Windows
  winrate_tiers.so      # Linux (둘 중 안 쓰는 쪽은 지워도 된다)
  mod.mod_info
  config.ini            # 없으면 첫 실행 때 기본값으로 생성됨
```

폴더 이름이 곧 mod id이므로 `winrate_tiers` 그대로 둘 것.

---

## 3. 설정 (`config.ini`)

모드 바이너리 옆에 있다. 저장하면 몇 관리 틱 안에 **핫리로드**되므로 재시작이 필요 없다.
오타가 난 값은 그 항목만 기본값으로 되돌아가고 나머지는 정상 동작한다.

### 스위치

| 키 | 기본 | 설명 |
|:---|:---|:---|
| `enabled` | `true` | 마스터 스위치 |
| `tier_assign` | `true` | 계산한 티어를 팀에 기록 |
| `apply_to_ai_teams` | `false` | AI 팀에도 같은 리스트를 기록 (1-2 참고) |

### 티어 모양

| 키 | 기본 | 설명 |
|:---|:---|:---|
| `mode` | `percentile` | `percentile` = 순위 비율로 배분 / `threshold` = 절대 컷 |
| `share_s` | `0.10` | S 비율 (percentile 모드) |
| `share_a` | `0.20` | A 비율 |
| `share_b` | `0.30` | B 비율 |
| `share_c` | `0.25` | C 비율 (D는 나머지) |
| `tier_s` | `0.55` | S 컷 (threshold 모드) |
| `tier_a` | `0.52` | A 컷 |
| `tier_b` | `0.50` | B 컷 |
| `tier_c` | `0.478` | C 컷 (미만은 D) |

`share_*` 네 개는 합이 1.0을 넘지만 않으면 된다. 넘겨도 뒤쪽 티어가 0개가 될 뿐
깨지지는 않는다 (`shares_over_one_do_not_produce_negative_bands` 테스트).

### 승률 모델

| 키 | 기본 | 설명 |
|:---|:---|:---|
| `neutral` | `0.5` | 승률 기준선. shrink 중심이자 지표의 중앙값 |
| `prior` | `10` | 베이지안 prior 강도 (`neutral`로 치른 가상 판수) |
| `confidence_k` | `50` | 클수록 적은 표본을 강하게 끌어당김 |
| `min_matches` | `5` | 이 판수 미만은 No Tier (+ 비율 계산에서 제외) |
| `solo_weight` | `0.5` | **예약됨 — 현재 동작 안 함** (5장 참고) |
| `prev_weight` | `0.8` | **예약됨 — 현재 동작 안 함** |

### 기타

| 키 | 기본 | 설명 |
|:---|:---|:---|
| `recompute_interval` | `4` | 재계산 사이 최소 관리 틱 수 |
| `dump` | `true` | `tier_table.txt` / `schema_dump.txt` 기록 |

---

## 4. 모드가 만드는 파일

전부 모드 바이너리 옆에 생긴다.

| 파일 | 내용 |
|:---|:---|
| `config.ini` | 설정. 없으면 기본값 + 주석으로 생성 |
| `winrate_tiers.log` | 무엇을 찾았고 무엇을 썼는지 |
| `tier_table.txt` | 배정 결과 — 챔피언별 판수/지표 + 최종 분포 |
| `schema_dump.txt` | 세이브에서 서버 측이 볼 수 있는 것 전부 (읽기 전용) |

> 로그가 호스트 로그가 아니라 파일로 가는 이유: 서버 훅은 `StableServerCtx`를 받는데
> 여기엔 로그 슬롯이 없고, `StableHost`는 SDK가 "콜백 밖으로 들고 나가지 말 것"이라고
> 명시한 타입이라 보관할 수 없다.

---

## 5. 현재 한계 — 스키마가 아직 안 박혔다

**이 부분은 분명히 알고 쓸 것.**

Stable ABI에는 **챔피언 티어 슬롯이 없다.** 티어는 팀 문서 JSON 어딘가에 있어서
`team_set_json(team_id, path, json)`으로 경로를 지정해 써야 하고, 챔피언별 승패
테이블도 레코드 문서 어딘가에 있다. **두 구조 모두 문서화돼 있지 않고**, 참고할
원본 모드는 컴파일된 DLL만 있어서 읽어낼 소스가 없었다.

그래서 양쪽 끝을 런타임 탐색으로 만들었다 (`src/schema.rs`).

- **sink (쓰는 곳)** — 팀 문서에서 티어리스트처럼 생긴 키를 찾는다. 값이 실제로
  티어리스트 모양이어야 한다: 챔피언→라벨 맵, 챔피언→인덱스 맵, 또는 티어별 버킷 배열.
- **source (읽는 곳)** — 챔피언 식별자 + 판수 + 승수를 가진 행들로 이루어진 테이블을 찾는다.

탐색은 보수적이다. 확신이 안 서면 **쓰지 않고 로그에 남긴다.** 엉뚱한 필드에 쓰는
것보다 아무것도 안 하는 게 낫기 때문이다. (예: 코치의 `tier: 3` 같은 숫자 필드는
챔피언 리스트가 아니므로 무시한다 — `ignores_a_tier_key_of_the_wrong_shape` 테스트.)

**결과적으로 실제 게임에서 티어가 적용될 수도, 안 될 수도 있다.** 게임 없이는 확인이
불가능하다. 한 번 돌린 뒤 **`schema_dump.txt`와 `winrate_tiers.log`를 확인**하면 된다.
덤프에 실제 팀 문서 구조와 전적 테이블 위치가 찍히므로, 그걸로 경로를 정확히 박은
다음 버전을 올릴 수 있다.

경로가 확정되면 같이 살아나는 것들:

- `solo_weight` — 솔로랭크와 대회 전적을 가중 합산 (지금은 발견된 테이블 하나만 씀)
- `prev_weight` — 이전 패치 전적을 감쇠 가중치로 블렌딩
- 패치 노트 기반 버프/너프 보정

---

## 6. 빌드

```bash
cargo build --release                                # Linux   → libwinrate_tiers.so
cargo build --release --target x86_64-pc-windows-gnu # Windows → winrate_tiers.dll
cargo test                                           # 게임 없이 순수 로직 검증 (31개)
```

Linux 산출물은 cargo가 `lib` 접두사를 붙이므로 설치할 때 `winrate_tiers.so`로 rename.

외부 의존성 0개다. SDK 크레이트도 의존성이 없고, 이 모드는 JSON 파서까지 직접 넣었다
(SDK의 JSON 헬퍼는 `pub(crate)`라 모드에서 못 쓴다). 오프라인에서 그대로 빌드된다.

Rust 툴체인은 아무거나 된다. `repr(C)` 계약만 DLL 경계를 넘으므로 한 번 빌드하면
이후 게임 업데이트에도 계속 로드된다.

> 참고: 원본 모드의 `rust-toolchain.toml`은 `nightly-2026-05-24`를 정확히 고정하고
> "ABI 호환성 때문에 모더는 반드시 같은 nightly를 써야 한다"고 적어 뒀는데, 이는 SDK
> README의 "어떤 툴체인이든 된다"와 상충한다. 이 모드는 SDK 문서 쪽을 따랐다.
> 만약 로딩에 실패하면 그 nightly로 다시 빌드해 보는 게 첫 번째 확인 사항이다.

---

## 7. 소스 구성

| 파일 | 역할 |
|:---|:---|
| `src/lib.rs` | 진입점, 서버 확장, 재계산 루프 |
| `src/tiers.rs` | 티어 분류 엔진 (백분위/임계값, 지표 계산) |
| `src/schema.rs` | 티어 필드 및 전적 테이블 런타임 탐색 |
| `src/probe.rs` | `schema_dump.txt` 생성 |
| `src/config.rs` | `config.ini` 파싱 + 핫리로드 |
| `src/json.rs` | 의존성 없는 JSON 리더 |
| `src/modpath.rs` | 모드 자신의 디렉터리 탐색 |
| `src/log.rs` | 파일 로그 |
