// WebAudio bleeps for the kitchen: chop, sizzle, ding, error, pickup.
// One clear job: sound only. Silent until the player first interacts.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let sizzleNodes = null;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, when = 0) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    const c = ensure();
    if (!c || muted) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start();
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopSizzle();
      return muted;
    },
    isMuted() {
      return muted;
    },
    pickup() {
      tone(660, 0.07, 'triangle', 0.12);
      tone(880, 0.09, 'triangle', 0.1, 0.06);
    },
    chop() {
      noise(0.08, 0.25, 1800);
    },
    chopDone() {
      tone(520, 0.08, 'square', 0.08);
      tone(780, 0.12, 'square', 0.08, 0.07);
    },
    grillOn() {
      noise(0.3, 0.12, 3200);
    },
    ding() {
      tone(1046, 0.25, 'sine', 0.16);
      tone(1318, 0.3, 'sine', 0.14, 0.1);
      tone(1568, 0.4, 'sine', 0.12, 0.2);
    },
    error() {
      tone(180, 0.22, 'sawtooth', 0.12);
      tone(140, 0.28, 'sawtooth', 0.1, 0.12);
    },
    startSizzle() {
      const c = ensure();
      if (!c || muted || sizzleNodes) return;
      const len = c.sampleRate;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2500;
      const gain = c.createGain();
      gain.gain.value = 0.035;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      src.start();
      sizzleNodes = { src, gain };
    },
    stopSizzle() {
      if (!sizzleNodes) return;
      try {
        sizzleNodes.src.stop();
      } catch {
        // Already stopped.
      }
      sizzleNodes = null;
    },
  };
}
