// Tiny procedural sound engine — everything is synthesized with WebAudio so
// the game ships with zero binary audio assets and works fully offline.
export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
    return this.ctx;
  }

  _noiseBuffer(duration, ctx) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  shotgunBlast(distanceGain = 1) {
    if (!this.unlocked) return;
    const ctx = this.ensure();
    const t0 = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(0.9 * distanceGain, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.4, ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t0);
    filter.frequency.exponentialRampToValueAtTime(300, t0 + 0.35);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + 0.4);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(120, t0);
    thump.frequency.exponentialRampToValueAtTime(40, t0 + 0.2);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.7 * distanceGain, t0);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
    thump.connect(thumpGain).connect(ctx.destination);
    thump.start(t0);
    thump.stop(t0 + 0.25);
  }

  reloadClack() {
    if (!this.unlocked) return;
    const ctx = this.ensure();
    const t0 = ctx.currentTime;
    for (const dt of [0, 0.09]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, t0 + dt);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.05);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.06);
    }
  }

  hitYelp() {
    if (!this.unlocked) return;
    const ctx = this.ensure();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, t0);
    osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }

  jumpYip() {
    if (!this.unlocked) return;
    const ctx = this.ensure();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t0);
    osc.frequency.exponentialRampToValueAtTime(900, t0 + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  }

  coinChime(positive = true) {
    if (!this.unlocked) return;
    const ctx = this.ensure();
    const t0 = ctx.currentTime;
    const freqs = positive ? [660, 880, 1320] : [300, 220];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      const start = t0 + idx * 0.07;
      g.gain.setValueAtTime(0.001, start);
      g.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(g).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  deathThud() {
    if (!this.unlocked) return;
    const ctx = this.ensure();
    const t0 = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.25, ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    noise.connect(filter).connect(g).connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + 0.3);
  }
}
