/* ============================================================
 *  키보드 + 터치 입력
 * ========================================================== */

const Input = {
  down: { left: false, right: false, jump: false, run: false, crouch: false },
  pressed: {},          // 이번 프레임에 "새로" 눌린 키
  anyPressed: false,

  KEYMAP: {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'crouch', KeyS: 'crouch',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run',
  },

  init() {
    addEventListener('keydown', (e) => {
      const k = this.KEYMAP[e.code];
      if (k) {
        e.preventDefault();
        if (!this.down[k]) this.pressed[k] = true;
        this.down[k] = true;
      }
      this.anyPressed = true;
      Sound.resume();
      if (e.code === 'KeyP' || e.code === 'Escape') this.pressed.pause = true;
      if (e.code === 'KeyM') this.pressed.mute = true;
      if (e.code === 'KeyR') this.pressed.restart = true;
      if (e.code === 'Enter') this.pressed.jump = true;
    });

    addEventListener('keyup', (e) => {
      const k = this.KEYMAP[e.code];
      if (k) this.down[k] = false;
    });

    addEventListener('blur', () => {
      Object.keys(this.down).forEach((k) => { this.down[k] = false; });
    });

    // 터치 버튼
    const pad = document.getElementById('touch');
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isTouch) pad.classList.remove('hidden');

    pad.querySelectorAll('.btn').forEach((btn) => {
      const key = btn.dataset.key;
      const on = (e) => {
        e.preventDefault();
        Sound.resume();
        if (!this.down[key]) this.pressed[key] = true;
        this.down[key] = true;
        this.anyPressed = true;
        btn.classList.add('on');
      };
      const off = (e) => {
        e.preventDefault();
        this.down[key] = false;
        btn.classList.remove('on');
      };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    // 캔버스를 탭해도 시작/진행되도록
    const canvas = document.getElementById('game');
    canvas.addEventListener('pointerdown', () => {
      Sound.resume();
      this.anyPressed = true;
      this.pressed.tap = true;
    });
  },

  /* 프레임이 끝날 때 "새로 눌림" 상태를 비웁니다 */
  endFrame() {
    this.pressed = {};
    this.anyPressed = false;
  },
};
