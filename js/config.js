/* ============================================================
 *  나율이의 대모험 — 기본 설정
 *  주인공 이름이나 색깔을 바꾸고 싶으면 이 파일만 고치면 됩니다.
 * ========================================================== */

const CONFIG = {
  PLAYER_NAME: '나율',          // 주인공 이름
  TITLE: '나율이의 대모험',      // 게임 제목
  LIVES: 3,                     // 시작 목숨
  DRESS: '#ff5d8f',             // 원피스 색
  DRESS_DARK: '#d63f6f',
  HAIR: '#3b2416',              // 머리 색
  RIBBON: '#ffd86b',            // 리본 색
  SKIN: '#ffd9b8',
  SHOES: '#ffffff',
};

/* 화면 / 타일 */
const TILE = 32;
const VIEW_W = 960;
const VIEW_H = 512;
const ROWS = 16;

/* 물리값 (1프레임 = 1/60초 기준) */
const PHYS = {
  GRAVITY: 0.55,
  MAX_FALL: 13,
  ACCEL: 0.62,
  AIR_ACCEL: 0.42,
  FRICTION: 0.80,
  MAX_WALK: 3.3,
  MAX_RUN: 4.9,
  JUMP: -11.3,
  JUMP_CUT: -4.2,      // 점프 버튼을 일찍 떼면 이 속도로 깎임
  STOMP_BOUNCE: -8.2,
  COYOTE: 6,           // 발판에서 떨어진 뒤에도 점프 가능한 프레임
  JUMP_BUFFER: 7,      // 착지 직전에 누른 점프를 기억하는 프레임
  INVULN: 100,         // 피격 후 무적 프레임
};

/* 점수 */
const SCORE = {
  COIN: 100,
  STOMP: 200,
  POWERUP: 500,
  BRICK: 50,
  TIME_BONUS: 10,
};

/* 타일 종류 */
const SOLID = '#=B?!X';   // 못 지나가는 블록
const ONEWAY = '-';       // 아래에서 통과되는 얇은 발판
const HAZARD = '^';       // 가시
