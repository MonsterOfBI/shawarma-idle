// Звуки генерируются кодом через Web Audio, без файлов: так сборка остаётся маленькой.

let ctx: AudioContext | null = null;
let muted = false;
let paused = false;

function audio(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended' && !paused) void ctx.resume();
  return ctx;
}

function beep(freq: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
  if (muted || paused) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration);
}

export const sfx = {
  tap() {
    beep(520 + Math.random() * 80, 0.06, 'triangle', 0.08);
  },
  buy() {
    beep(660, 0.08, 'square', 0.05);
    beep(990, 0.12, 'square', 0.05, 0.07);
  },
  move() {
    [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.2, 'triangle', 0.08, i * 0.12));
  },
  reward() {
    [784, 988, 1175].forEach((f, i) => beep(f, 0.15, 'sine', 0.08, i * 0.09));
  },
};

export function setMuted(m: boolean) {
  muted = m;
}

// Пауза от площадки (реклама, свёрнутая вкладка): звук обязан замолчать.
export function setAudioPaused(p: boolean) {
  paused = p;
  if (!ctx) return;
  if (p) void ctx.suspend();
  else if (!muted) void ctx.resume();
}
