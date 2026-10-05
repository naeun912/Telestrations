// Web Audio API 로 직접 만든 효과음 + 잔잔한 BGM (외부 음원 파일 없음)

const LS_MUTE = 'tele_mute';
const LS_BGM = 'tele_bgm';

class SoundManager {
  private ctx: AudioContext | null = null;
  private muted = localStorage.getItem(LS_MUTE) === '1';
  private bgmOn = localStorage.getItem(LS_BGM) === '1';
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private lastScratch = 0;

  private ac(): AudioContext | null {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  isMuted() {
    return this.muted;
  }
  isBgmOn() {
    return this.bgmOn;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(LS_MUTE, this.muted ? '1' : '0');
    if (this.muted) this.stopBgmLoop();
    else if (this.bgmOn) this.startBgmLoop();
    return this.muted;
  }

  toggleBgm(): boolean {
    this.bgmOn = !this.bgmOn;
    localStorage.setItem(LS_BGM, this.bgmOn ? '1' : '0');
    if (this.bgmOn && !this.muted) this.startBgmLoop();
    else this.stopBgmLoop();
    return this.bgmOn;
  }

  /** 사용자 첫 클릭 이후 BGM 자동 재생 복구 */
  resumeBgmIfNeeded() {
    if (this.bgmOn && !this.muted && this.bgmTimer === null) this.startBgmLoop();
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    const ctx = this.ac();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(start: number, dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType) {
    const ctx = this.ac();
    if (!ctx) return;
    const size = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(f0, start);
    filter.frequency.exponentialRampToValueAtTime(f1, start + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(start);
  }

  click() {
    if (this.muted) return;
    const ctx = this.ac();
    if (ctx) this.tone(620, ctx.currentTime, 0.07, 'sine', 0.15, 320);
  }

  pop() {
    if (this.muted) return;
    const ctx = this.ac();
    if (ctx) this.tone(380, ctx.currentTime, 0.12, 'triangle', 0.22, 760);
  }

  /** 마커로 그리는 소리 (너무 자주 울리지 않도록 제한) */
  scratch() {
    if (this.muted) return;
    const ctx = this.ac();
    if (!ctx) return;
    const now = performance.now();
    if (now - this.lastScratch < 70) return;
    this.lastScratch = now;
    this.noise(ctx.currentTime, 0.06, 0.05, 1800 + Math.random() * 900, 900, 'bandpass');
  }

  flip() {
    if (this.muted) return;
    const ctx = this.ac();
    if (ctx) this.noise(ctx.currentTime, 0.16, 0.2, 700, 3200, 'lowpass');
  }

  tick(urgent = false) {
    if (this.muted) return;
    const ctx = this.ac();
    if (ctx) this.tone(urgent ? 920 : 520, ctx.currentTime, 0.07, 'triangle', urgent ? 0.25 : 0.12);
  }

  whistle() {
    if (this.muted) return;
    const ctx = this.ac();
    if (!ctx) return;
    this.tone(900, ctx.currentTime, 0.12, 'sine', 0.22, 1400);
    this.tone(1400, ctx.currentTime + 0.12, 0.28, 'sine', 0.22, 1050);
  }

  /** 주사위가 굴러가는 소리 */
  dice() {
    if (this.muted) return;
    const ctx = this.ac();
    if (!ctx) return;
    for (let i = 0; i < 9; i++) {
      this.noise(ctx.currentTime + i * 0.085, 0.05, 0.22, 400 + Math.random() * 500, 150, 'lowpass');
    }
  }

  fanfare() {
    if (this.muted) return;
    const ctx = this.ac();
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, ctx.currentTime + i * 0.12, 0.3, 'triangle', 0.22);
    });
  }

  /* ---------- BGM ---------- */
  private startBgmLoop() {
    if (this.bgmTimer !== null) return;
    const ctx = this.ac();
    if (!ctx) return;
    const melody = [523.25, 587.33, 659.25, 783.99, 880, 783.99, 659.25, 587.33];
    const bass = [261.63, 261.63, 220, 220, 196, 196, 220, 220];
    this.bgmTimer = window.setInterval(() => {
      const c = this.ac();
      if (!c || this.muted) return;
      const t = c.currentTime;
      const i = this.bgmStep % melody.length;
      this.tone(melody[i], t, 0.28, 'triangle', 0.045);
      if (this.bgmStep % 2 === 0) this.tone(bass[i], t, 0.5, 'sine', 0.05);
      this.bgmStep++;
    }, 300);
  }

  private stopBgmLoop() {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const soundFx = new SoundManager();
