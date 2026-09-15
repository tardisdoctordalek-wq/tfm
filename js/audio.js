/* ============================================================
 *  효과음 / 배경음 — 오디오 파일 없이 WebAudio로 직접 소리를 만듭니다.
 * ========================================================== */

const Sound = {
  ctx: null,
  master: null,
  muted: false,
  bgmOn: false,
  _timer: null,
  _next: 0,
  _step: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.28;
    this.master.connect(this.ctx.destination);
    try {
      this.muted = localStorage.getItem('nayul_muted') === '1';
    } catch (e) { /* 저장소를 못 쓰는 환경도 있음 */ }
  },

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('nayul_muted', this.muted ? '1' : '0'); } catch (e) {}
    if (this.muted) { this.stopBgm(); this.vacuumOff(); }
    else if (this.bgmOn) this.startBgm();
    return this.muted;
  },

  /* 한 음 재생 */
  tone(freq, dur, type = 'square', vol = 0.5, at = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  noise(dur = 0.18, vol = 0.35) {
    if (!this.ctx || this.muted) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g).connect(this.master);
    src.start();
  },

  jump()    { this.tone(420, 0.16, 'square', 0.4, 0, 760); },
  coin()    { this.tone(1180, 0.07, 'square', 0.35); this.tone(1580, 0.12, 'square', 0.32, 0.07); },
  stomp()   { this.tone(260, 0.1, 'square', 0.4, 0, 90); this.noise(0.1, 0.2); },
  bump()    { this.tone(160, 0.08, 'square', 0.35, 0, 110); },
  brick()   { this.noise(0.22, 0.4); this.tone(200, 0.12, 'square', 0.25, 0, 70); },
  powerup() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.12, 'square', 0.35, i * 0.07)); },
  hurt()    { this.tone(520, 0.3, 'sawtooth', 0.35, 0, 120); },
  die()     { [660, 560, 460, 330, 220].forEach((f, i) => this.tone(f, 0.2, 'square', 0.4, i * 0.12)); },
  clear()   { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, 'square', 0.38, i * 0.14)); },
  start()   { [523, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.4, i * 0.09)); },

  /* 청소기 "웅~" 하는 모터 소리.
     버튼을 누르고 있는 동안 계속 나야 해서, 한 번 만든 노드를 켜고 끕니다.
     (프레임마다 noise() 를 새로 만들면 소리가 지직거리고 CPU 도 먹습니다.) */
  vacuumOn() {
    if (!this.ctx || this.muted || this._vacNodes) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = 78;
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.16, this.ctx.currentTime + 0.08);
    osc.connect(lp).connect(g).connect(this.master);
    osc.start();
    this._vacNodes = { osc, g };
  },

  vacuumOff() {
    if (!this._vacNodes) return;
    const { osc, g } = this._vacNodes;
    this._vacNodes = null;
    try {
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
      osc.stop(this.ctx.currentTime + 0.14);
    } catch (e) {}
  },

  /* 적이 통 안으로 빨려 들어간 순간 */
  suck()    { this.tone(300, 0.14, 'square', 0.3, 0, 1100); this.noise(0.12, 0.18); },

  /* ── 배경음: 밝은 8비트 멜로디 반복 ── */
  MELODY: [
    [659, 1], [659, 1], [0, 1], [659, 1], [0, 1], [523, 1], [659, 1], [0, 1],
    [784, 2], [0, 2], [392, 2], [0, 2],
    [523, 2], [0, 1], [392, 2], [0, 1], [330, 2], [0, 1],
    [440, 1], [494, 1], [466, 1], [440, 1],
    [392, 1], [659, 1], [784, 1], [880, 1], [0, 1],
    [698, 1], [784, 1], [0, 1], [659, 1], [0, 1], [523, 1], [587, 1], [494, 1], [0, 2],
  ],
  BASS: [131, 131, 165, 165, 196, 196, 165, 131],

  startBgm() {
    this.bgmOn = true;
    if (!this.ctx || this.muted || this._timer) return;
    this._next = this.ctx.currentTime + 0.1;
    this._step = 0;
    this._timer = setInterval(() => this._schedule(), 60);
  },

  stopBgm() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  pauseBgm() { this.stopBgm(); },

  _schedule() {
    if (!this.ctx || this.muted) return;
    const beat = 0.14;
    while (this._next < this.ctx.currentTime + 0.3) {
      const note = this.MELODY[this._step % this.MELODY.length];
      const at = this._next - this.ctx.currentTime;
      if (note[0] > 0) this.tone(note[0], beat * note[1] * 0.85, 'square', 0.13, Math.max(0, at));
      if (this._step % 2 === 0) {
        const b = this.BASS[Math.floor(this._step / 4) % this.BASS.length];
        this.tone(b, beat * 1.6, 'triangle', 0.17, Math.max(0, at));
      }
      this._next += beat * note[1];
      this._step++;
    }
  },
};
