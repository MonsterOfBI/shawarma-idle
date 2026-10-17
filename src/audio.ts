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

function beep(freq: number, duration: number, type: OscillatorType, volume: number, delay = 0, out?: AudioNode) {
  if (muted || paused) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + Math.max(0, delay);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(out ?? a.destination);
  osc.start(t);
  osc.stop(t + duration);
}

export const sfx = {
  // чем длиннее серия, тем выше звук тапа
  tap(combo = 0) {
    beep(440 + Math.min(combo, 50) * 9 + Math.random() * 30, 0.06, 'triangle', 0.08);
  },
  golden() {
    [1046, 1318, 1568, 2093].forEach((f, i) => beep(f, 0.18, 'sine', 0.07, i * 0.06));
  },
  rush() {
    [392, 523, 392, 523, 659].forEach((f, i) => beep(f, 0.1, 'square', 0.04, i * 0.09));
  },
  achievement() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => beep(f, 0.16, 'triangle', 0.07, i * 0.08));
  },
  buy() {
    beep(660, 0.08, 'square', 0.05);
    beep(990, 0.12, 'square', 0.05, 0.07);
  },
  move() {
    [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.2, 'triangle', 0.08, i * 0.12));
  },
  // ящик трясётся: дробь из коротких щелчков, всё чаще
  shake() {
    for (let i = 0; i < 12; i++) beep(180 + i * 25, 0.05, 'square', 0.035, i * 0.085 - i * i * 0.002);
  },
  // открытие: чем редче брейнрот, тем длиннее и выше фанфара (rank 0..5)
  reveal(rank: number) {
    const base = [523, 587, 659, 784, 880, 1046][rank] ?? 523;
    const steps = 3 + rank;
    for (let i = 0; i < steps; i++) beep(base * Math.pow(1.122, i), 0.18 + rank * 0.03, i % 2 ? 'triangle' : 'sine', 0.07, i * 0.07);
    if (rank >= 3) [0, 0.5].forEach((d) => beep(base * 2, 0.5, 'triangle', 0.05, steps * 0.07 + d));
  },
  crit() {
    beep(1320, 0.07, 'square', 0.05);
    beep(1760, 0.12, 'triangle', 0.06, 0.05);
  },
  claim() {
    [659, 784, 1046, 1318].forEach((f, i) => beep(f, 0.12, 'triangle', 0.07, i * 0.06));
  },
  reward() {
    [784, 988, 1175].forEach((f, i) => beep(f, 0.15, 'sine', 0.08, i * 0.09));
  },
};

export function setMuted(m: boolean) {
  muted = m;
}

// ---------- музыка: маленькая тарантелла по кругу, тоже без файлов ----------

const NOTE: Record<string, number> = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, i) => {
  for (let o = 1; o <= 6; o++) NOTE[`${n}${o}`] = 440 * Math.pow(2, (i - 9 + (o - 4) * 12) / 12);
});

// 6/8, по шесть восьмых в такте
const MELODY = [
  'A4', 'C5', 'E5', 'A5', 'E5', 'C5',
  'G#4', 'B4', 'E5', 'G#5', 'E5', 'B4',
  'A4', 'C5', 'E5', 'A5', 'B5', 'C6',
  'B5', 'A5', 'G#5', 'A5', 'E5', 'C5',
  'D5', 'F5', 'A5', 'D6', 'A5', 'F5',
  'C5', 'E5', 'A5', 'C6', 'A5', 'E5',
  'B4', 'D5', 'E5', 'G#5', 'B5', 'D6',
  'C6', 'B5', 'A5', 'E5', 'A4', '',
];
const BASS = ['A2', 'E3', 'E2', 'B2', 'A2', 'E3', 'E2', 'E3', 'D3', 'A2', 'A2', 'E3', 'E2', 'B2', 'A2', 'A2'];
const STEP = 0.135; // секунды на восьмую

let musicOn = false;
let musicGain: GainNode | null = null;
let step = 0;
let nextAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function scheduleMusic() {
  const a = ctx;
  if (!a || !musicGain || muted || paused || !musicOn || a.state !== 'running') return;
  if (nextAt < a.currentTime) nextAt = a.currentTime + 0.05;
  while (nextAt < a.currentTime + 0.25) {
    const delay = nextAt - a.currentTime;
    const note = MELODY[step % MELODY.length];
    if (note) beep(NOTE[note], STEP * 0.9, 'triangle', 0.05, delay, musicGain);
    if (step % 3 === 0) beep(NOTE[BASS[Math.floor(step / 3) % BASS.length]], STEP * 2.6, 'sine', 0.09, delay, musicGain);
    if (step % 3 === 0) beep(2400, 0.03, 'square', 0.012, delay, musicGain);
    step++;
    nextAt += STEP;
  }
}

// Включить или выключить музыку. Контекст звука создаётся только после действия игрока.
export function setMusic(on: boolean) {
  musicOn = on;
  if (!on) {
    if (musicGain && ctx) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    return;
  }
  const a = ctx;
  if (!a) return;
  if (!musicGain) {
    musicGain = a.createGain();
    musicGain.connect(a.destination);
  }
  musicGain.gain.setTargetAtTime(1, a.currentTime, 0.05);
  if (!timer) timer = setInterval(scheduleMusic, 60);
}

// Первый тап: разбудить звук и, если можно, запустить музыку.
export function unlockAudio(withMusic: boolean) {
  audio();
  if (withMusic) setMusic(true);
}

// Пауза от площадки (реклама, свёрнутая вкладка): звук обязан замолчать.
export function setAudioPaused(p: boolean) {
  paused = p;
  if (!ctx) return;
  if (p) void ctx.suspend();
  else if (!muted) void ctx.resume();
}
