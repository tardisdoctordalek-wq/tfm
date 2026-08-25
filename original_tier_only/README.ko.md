# 원본 모드를 티어리스트 전용으로

`draft_winrate_penalty`(Win-Rate Ban/Pick AI + Champion Tiers)의 **알고리즘을 그대로 두고**
밴픽 AI 보정만 끄는 설정. 새 코드는 없고 `config.ini` 한 줄이 답이다.

## 답

원본 DLL에 박혀 있는 config 첫 블록이 그대로 말해준다.

```
# This mod has TWO independent features. Turn either off here.
#   draft_adjust : Feature 1 - adjust the competition AI's ban/pick evaluation
#   tier_assign  : Feature 2 - set your team's champion Tier list from stats
#   enabled      : master switch; false disables BOTH features
```

두 기능이 **독립**이라고 명시돼 있으므로:

```ini
enabled=true
draft_adjust=false   ← 밴픽 AI 보정 끔
tier_assign=true     ← 티어리스트만 유지
```

이 폴더의 `config.ini`가 그 상태로 맞춰둔 것이다. 원본 기본값에서 **딱 두 군데**만 바꿨고
파일 안에 `CHANGED`로 표시해 뒀다.

| 키 | 기본값 | 여기 | 이유 |
|:---|:---|:---|:---|
| `draft_adjust` | `true` | `false` | 밴픽 AI 보정 끔 |
| `tier_b` | `0.48` | `0.500` | B 축소 |
| `tier_c` | `0.45` | `0.478` | C·D 확대 |

## 설치

모드 폴더의 `config.ini`를 이 파일로 교체한다.

```
steamapps\workshop\content\3009300\3741141600\config.ini
```

몇 초 안에 핫리로드되므로 재시작은 필요 없다.
원본 기본값 전문은 `reference/original_defaults.ini`에 그대로 보관해 뒀다 (DLL에서 추출).

## `draft_adjust=false`에서도 살아있는 것

티어 계산은 **공유 승률 모델**을 쓰므로 아래는 계속 동작한다.

| 키 | 역할 |
|:---|:---|
| `neutral` | 승률 기준선 (shrink 중심이자 티어 지표 중앙값) |
| `prior` | 베이지안 prior 강도 |
| `confidence_k` | 신뢰도 계수 K |
| `min_matches` | 이 판수 미만은 No Tier |
| `solo_weight` | 솔로랭크 가중 (`유효 판수 = 대회 + w×솔로`) |
| `prev_weight` | 이전 패치 블렌딩 최대 가중 |
| `tier_s/a/b/c` | 티어 경계 |
| `auto_tier` | `true`=자동 적용 / `false`=수동 버튼만 |

공유 모델의 패치 블렌딩 공식도 그대로다.

```
유효 판수 m,w = 현재 패치 + pf × 이전 패치
pf = (1 - mc/(mc+confidence_k)) × prev_weight × (mp/(mp+confidence_k))
```

**무력화되는 것:** `scale`, `max_pen`, `bonus_scale`, `max_bonus`, `ban_weight`,
`low_threat_gate`, `position_flex`, `min_pos_ratio`, `min_pos_matches`.
전부 밴픽 점수 계산에만 쓰인다. 되돌리기 쉽게 파일에는 남겨뒀다.

`patch_strength` / `patch_nerf_ratio` / `patch_prev_weight`는 **확실하지 않다.**
공유 모델 구역에 있지만 설명이 전부 "bias"(= Feature 1 용어) 기준이고, 티어 지표는
`adjusted_wr = neutral + (wr-neutral)×conf`로 패치 항이 없다. 티어에는 영향이 없을
가능성이 높지만 소스가 없어 단정할 수 없다.

## 알아둘 점

**UI 오버라이드는 config로 못 끈다.** `mod.override_info`가
`asset/base/ui/layout/champion_info`를 정적으로 교체하는데, 이건 설정이 아니라 모드 패키지
구조라 `draft_adjust`나 `tier_assign`을 꺼도 그대로 로드된다. 원본 설명도 같은 얘기를 한다.
다른 티어리스트 모드와 같이 쓰면 **나중에 로드된 쪽이 화면을 가져간다.** 순서는 게임 설치
폴더의 `config\game\mods.json`의 `enable_mods` 목록으로 정한다.

**`winrate_tiers`와 동시에 켜지 마라.** 둘 다 팀 레코드의 같은 `champion_tiers` 필드에
쓰기 때문에 서로 덮어쓴다. 하나만 티어를 쓰게 할 것.

**B 편중은 완화일 뿐 해결이 아니다.** 원본은 절대 임계값 방식이라, 지표가
`neutral + (wr-neutral)×conf`로 표본이 얇을수록 0.5로 끌려오는 구조상 0.5를 걸친 밴드에
몰리는 성질이 남는다. `tier_b`/`tier_c`를 올린 건 그걸 밀어낸 것이지 없앤 게 아니다.
분포 자체를 지정하려면 백분위 방식이 필요하다.

**관여율 게이트가 없다.** 대회에서 픽도 밴도 안 되는 챔피언이 솔로랭크 승률만으로 S에
올라오는 문제(`ogre`, `cf_zeus` 사례)는 원본에 그대로 남아 있다. 완화하려면 `min_matches`를
올리거나 `solo_weight`를 낮추는 정도가 전부다.

## `winrate_tiers`와 비교

| | 원본 (티어 전용) | `winrate_tiers` |
|:---|:---|:---|
| 티어 배분 | 절대 임계값 | 백분위 (분포를 지정) |
| 관여율(픽+밴) 게이트 | 없음 | 있음 (`min_presence`) |
| 패치 가중 | 있음 (공유 모델) | 있음 (같은 공식) |
| 적용 대상 | 내 팀 | 내 팀 (`apply_to_ai_teams`로 전환) |
| Champion 화면 UI | 교체함 (끌 수 없음) | 안 건드림 |
| 밴픽 AI | 끔 (`draft_adjust=false`) | 애초에 없음 |
| 수동 버튼 | 있음 (`auto_tier=false`) | 없음 (자동) |
| 소스 | 없음 (DLL만) | 있음 |

원본 알고리즘을 그대로 쓰고 싶고 Champion 화면 교체가 문제되지 않으면 이쪽이 간단하다.
B 편중이나 관여율이 걸리면 `winrate_tiers` 쪽이다.
