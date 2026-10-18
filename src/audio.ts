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
  // «тунг-тунг-тунг»: деревянные удары маскота
  poke() {
    for (let i = 0; i < 3; i++) beep(150 - i * 12, 0.09, 'square', 0.07, i * 0.12);
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

// ---------- музыка: спокойный лоу-фай, который сочиняется на ходу, без файлов ----------
// Медленный темп (72 удара в минуту), мягкие джазовые аккорды, тёплый бас и мелодия электропиано,
// которая каждый раз импровизируется заново. Части (только пэд, спокойно, с ритмом, перебор)
// сменяют друг друга в случайном порядке, а раз в несколько минут меняется тональность.

const BPM = 72;
const EIGHTH = 60 / BPM / 2; // секунды на восьмую
const SWING = 0.18; // сдвиг слабых восьмых для «качающего» ритма

type ChordKind = 'maj7' | 'm7' | 'dom9' | 'sus' | 'm6';
const CHORD: Record<ChordKind, number[]> = {
  maj7: [0, 4, 7, 11, 14],
  m7: [0, 3, 7, 10, 14],
  dom9: [0, 4, 7, 10, 14],
  sus: [0, 5, 7, 10, 14],
  m6: [0, 3, 7, 9, 14],
};
// последовательности аккордов: ступень от тоники и вид аккорда, по аккорду на такт
const PROGRESSIONS: [number, ChordKind][][] = [
  [[0, 'maj7'], [9, 'm7'], [2, 'm7'], [7, 'sus']],
  [[5, 'maj7'], [4, 'm7'], [9, 'm7'], [0, 'maj7']],
  [[2, 'm7'], [7, 'dom9'], [0, 'maj7'], [9, 'm7']],
  [[5, 'maj7'], [5, 'm6'], [4, 'm7'], [9, 'm7']],
  [[8, 'maj7'], [10, 'dom9'], [0, 'maj7'], [0, 'maj7']],
  [[9, 'm7'], [5, 'maj7'], [0, 'maj7'], [7, 'sus']],
  [[4, 'm7'], [9, 'm7'], [2, 'm7'], [7, 'dom9']],
];
const PENTA = [0, 2, 4, 7, 9]; // мажорная пентатоника: мелодия не бывает резкой

type Part = 'pad' | 'calm' | 'groove' | 'arp';
interface Section { part: Part; prog: number; bars: number }

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let musicOn = false;
let musicGain: GainNode | null = null;
let musicBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextAt = 0;
let step = 0; // восьмая внутри части
let section: Section = { part: 'pad', prog: 0, bars: 4 };
let key = 60; // до мажор (C4)
let sectionsInKey = 0;
let melodyNote = 0; // индекс в пентатонике
let phraseLeft = 0;
let restLeft = 0;

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// мягкая нота с атакой и затуханием
function voice(freq: number, at: number, dur: number, type: OscillatorType, vol: number, attack: number, out: AudioNode, detune = 0) {
  const a = ctx!;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  osc.detune.setValueAtTime(detune, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + dur);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + attack + dur + 0.05);
}

// пэд: плавно нарастает, держится весь такт и мягко гаснет, перетекая в следующий аккорд
function pad(freq: number, at: number, hold: number, vol: number, out: AudioNode, type: OscillatorType, detune: number) {
  const a = ctx!;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  osc.detune.setValueAtTime(detune, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.5);
  g.gain.setValueAtTime(vol, at + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, at + hold + 1.2);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + hold + 1.3);
}

function hiss(at: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, out: AudioNode) {
  const a = ctx!;
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

// общий тракт: тёплый фильтр и мягкая реверберация из сгенерированного «зала»
function bus(): GainNode {
  if (musicBus) return musicBus;
  const a = ctx!;
  musicBus = a.createGain();
  const warm = a.createBiquadFilter();
  warm.type = 'lowpass';
  warm.frequency.value = 2600;
  const len = Math.floor(a.sampleRate * 2.6);
  const ir = a.createBuffer(2, len, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const verb = a.createConvolver();
  verb.buffer = ir;
  const wet = a.createGain();
  wet.gain.value = 0.32;
  musicBus.connect(warm);
  warm.connect(musicGain!);
  warm.connect(verb).connect(wet).connect(musicGain!);
  return musicBus;
}

function nextSection() {
  const prev = section;
  sectionsInKey++;
  // раз в 6–8 частей — новая тональность, чтобы слух не уставал
  if (sectionsInKey >= 6 + Math.floor(Math.random() * 3)) {
    sectionsInKey = 0;
    key = 60 + rand([-4, -2, 0, 2, 3, 5].filter((k) => k !== key - 60));
  }
  const parts: Part[] = ['pad', 'calm', 'groove', 'arp'];
  const weights: Record<Part, number> = { pad: 1, calm: 3, groove: 3, arp: 2 };
  let part: Part = prev.part;
  while (part === prev.part) {
    let r = Math.random() * parts.reduce((n, p) => n + weights[p], 0);
    for (const p of parts) if ((r -= weights[p]) < 0) { part = p; break; }
  }
  let prog = prev.prog;
  while (prog === prev.prog) prog = Math.floor(Math.random() * PROGRESSIONS.length);
  section = { part, prog, bars: part === 'pad' ? 4 : rand([4, 8, 8]) };
  step = 0;
}

function playStep(at: number) {
  const out = bus();
  const bar = Math.floor(step / 8);
  const pos = step % 8;
  const [deg, kind] = PROGRESSIONS[section.prog][bar % 4];
  const root = key + deg - 12;
  const tones = CHORD[kind];
  const barLen = EIGHTH * 8;
  const p = section.part;

  // пэд: аккорд целиком на такт, мягко нарастает
  if (pos === 0) {
    const vol = p === 'pad' ? 0.022 : 0.016;
    for (const t of tones.slice(1)) {
      pad(midi(root + 12 + t), at, barLen - 0.3, vol, out, 'triangle', -6);
      pad(midi(root + 12 + t), at, barLen - 0.3, vol, out, 'sine', 7);
    }
  }
  // бас: тёплый синус на сильные доли
  if (p !== 'pad' && (pos === 0 || (pos === 5 && Math.random() < 0.6) || (pos === 4 && p === 'calm'))) {
    voice(midi(root - 12 + (pos === 5 ? 7 : 0)), at, pos === 0 ? 1.3 : 0.6, 'sine', 0.08, 0.02, out);
  }
  // мягкие барабаны только в «ритмичной» части
  if (p === 'groove') {
    if (pos === 0 || pos === 5) {
      const a = ctx!;
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.frequency.setValueAtTime(110, at);
      osc.frequency.exponentialRampToValueAtTime(45, at + 0.18);
      g.gain.setValueAtTime(0.1, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.connect(g).connect(out);
      osc.start(at);
      osc.stop(at + 0.32);
    }
    if (pos === 2 || pos === 6) hiss(at, 0.16, 0.035, 'bandpass', 1700, out);
    hiss(at, 0.05, pos % 2 ? 0.008 : 0.013, 'highpass', 7000, out);
    // аккорд-«стаб» электропиано на слабую долю
    if (pos === 3 && Math.random() < 0.7) for (const t of tones.slice(1, 4)) voice(midi(root + 24 + t), at, 0.5, 'sine', 0.014, 0.01, out);
  }
  // перебор аккорда вверх-вниз
  if (p === 'arp') {
    const order = [0, 1, 2, 3, 4, 3, 2, 1];
    voice(midi(root + 24 + tones[order[pos]]), at, 0.9, 'sine', 0.026, 0.01, out);
  }
  // мелодия: короткие фразы и паузы, ноты рядом друг с другом, сильные доли — на звуках аккорда
  if (p !== 'pad' || bar >= 2) {
    const density = p === 'arp' ? 0.12 : p === 'groove' ? 0.42 : 0.32;
    if (pos === 0 && phraseLeft <= 0 && restLeft <= 0) {
      phraseLeft = 8 + Math.floor(Math.random() * 8);
      restLeft = 4 + Math.floor(Math.random() * 12);
    }
    if (phraseLeft > 0) {
      phraseLeft--;
      if (Math.random() < density * (pos % 2 ? 0.7 : 1.2)) {
        melodyNote = Math.max(0, Math.min(9, melodyNote + rand([-2, -1, -1, 1, 1, 2, 0])));
        let n = key + 12 + PENTA[melodyNote % 5] + 12 * Math.floor(melodyNote / 5);
        if (pos === 0) {
          // на сильной доле — ближайший звук аккорда
          const chordNotes = tones.map((t) => root + t + 24);
          n = chordNotes.reduce((best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best), chordNotes[0]);
        }
        const dur = rand([0.5, 0.8, 1.2, 1.6]);
        voice(midi(n), at, dur, 'sine', 0.055, 0.012, out);
        voice(midi(n + 12), at, dur * 0.4, 'sine', 0.008, 0.01, out);
      }
    } else if (restLeft > 0) restLeft--;
  }

  step++;
  if (step >= section.bars * 8) nextSection();
}

function scheduleMusic() {
  const a = ctx;
  if (!a || !musicGain || muted || paused || !musicOn || a.state !== 'running') return;
  if (nextAt < a.currentTime) nextAt = a.currentTime + 0.1;
  while (nextAt < a.currentTime + 0.3) {
    const swing = step % 2 ? SWING * EIGHTH : 0;
    playStep(nextAt + swing);
    nextAt += EIGHTH;
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
  musicGain.gain.setTargetAtTime(0.9, a.currentTime, 0.4);
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
