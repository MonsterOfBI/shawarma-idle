// Звуки генерируются кодом через Web Audio, без файлов: так сборка остаётся маленькой.

let ctx: AudioContext | null = null;
let muted = false;
let paused = false;
// До первого действия игрока звук не создаём: браузер всё равно не даст его запустить
// и засыпает консоль предупреждениями на каждый звук.
let unlocked = false;
let sfxVol = 1;
let musicVol = 0.7;

function audio(): AudioContext | null {
  if (!unlocked) return null;
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
  if (muted || paused || sfxVol < 0.01) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + Math.max(0, delay);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(Math.max(0.0002, volume * sfxVol), t);
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

// ---------- музыка: весёлая, но мягкая, сочиняется на ходу, без файлов ----------
// Бодрый темп (100 ударов в минуту), мажорные аккорды, прыгающий бас, укулеле на слабых долях
// и мелодия маримбы. Мелодия строится из короткого мотива, который повторяется с вариациями
// («вопрос — ответ»), поэтому запоминается, но каждый раз новый. Части сменяют друг друга
// в случайном порядке, раз в несколько минут меняется тональность. Тембры мягкие, без писка.

const BPM = 100;
const EIGHTH = 60 / BPM / 2; // секунды на восьмую
const SWING = 0.14; // лёгкий шаффл: ритм «подпрыгивает»

type ChordKind = 'maj' | 'add9' | 'six' | 'm7' | 'dom7';
const CHORD: Record<ChordKind, number[]> = {
  maj: [0, 4, 7, 12],
  add9: [0, 4, 7, 14],
  six: [0, 4, 7, 9],
  m7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
};
// весёлые последовательности аккордов: ступень от тоники и вид аккорда, по аккорду на такт
const PROGRESSIONS: [number, ChordKind][][] = [
  [[0, 'maj'], [7, 'maj'], [9, 'm7'], [5, 'add9']],
  [[0, 'add9'], [5, 'maj'], [7, 'dom7'], [5, 'six']],
  [[0, 'six'], [9, 'm7'], [5, 'maj'], [7, 'dom7']],
  [[5, 'add9'], [7, 'maj'], [4, 'm7'], [9, 'm7']],
  [[0, 'maj'], [4, 'm7'], [5, 'add9'], [7, 'dom7']],
  [[2, 'm7'], [7, 'dom7'], [0, 'add9'], [0, 'six']],
  [[0, 'maj'], [2, 'dom7'], [5, 'add9'], [0, 'maj']],
];
const SCALE = [0, 2, 4, 5, 7, 9, 11]; // мажор; на сильных долях — только звуки аккорда

type Part = 'intro' | 'bounce' | 'skip' | 'break';
interface Section { part: Part; prog: number; bars: number }

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let musicOn = false;
let musicGain: GainNode | null = null;
let musicBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextAt = 0;
let step = 0; // восьмая внутри части
let section: Section = { part: 'intro', prog: 0, bars: 4 };
let key = 60; // до мажор (C4)
let sectionsInKey = 0;
let motif: (number | null)[] = []; // мотив на такт: ступени гаммы или пауза
let answer: (number | null)[] = [];

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

// маримба: круглый тон и короткий деревянный призвук сверху
function marimba(n: number, at: number, vol: number, out: AudioNode) {
  voice(midi(n), at, 0.45, 'sine', vol, 0.004, out);
  voice(midi(n) * 4, at, 0.06, 'sine', vol * 0.25, 0.002, out);
}

// укулеле: короткий щипок, ноты аккорда чуть врассыпную
function strum(notes: number[], at: number, vol: number, out: AudioNode) {
  notes.forEach((n, i) => voice(midi(n), at + i * 0.012, 0.22, 'triangle', vol, 0.003, out, (i % 2 ? 4 : -4)));
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

function kick(at: number, vol: number, out: AudioNode) {
  const a = ctx!;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.frequency.setValueAtTime(130, at);
  osc.frequency.exponentialRampToValueAtTime(50, at + 0.12);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + 0.25);
}

// общий тракт: фильтр срезает резкие верха, немного «комнаты» для объёма
function bus(): GainNode {
  if (musicBus) return musicBus;
  const a = ctx!;
  musicBus = a.createGain();
  const soft = a.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 3600;
  const len = Math.floor(a.sampleRate * 1.4);
  const ir = a.createBuffer(2, len, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  }
  const verb = a.createConvolver();
  verb.buffer = ir;
  const wet = a.createGain();
  wet.gain.value = 0.2;
  musicBus.connect(soft);
  soft.connect(musicGain!);
  soft.connect(verb).connect(wet).connect(musicGain!);
  return musicBus;
}

// новый мотив на такт: 4–6 нот, ходят рядом, иногда прыжок вверх для «улыбки»
function makeMotif(): (number | null)[] {
  const m: (number | null)[] = [];
  let deg = rand([2, 4, 4, 7]);
  for (let i = 0; i < 8; i++) {
    const play = i === 0 || Math.random() < (i % 2 ? 0.45 : 0.75);
    if (!play) { m.push(null); continue; }
    deg = Math.max(0, Math.min(11, deg + rand([-2, -1, -1, 1, 1, 2, 3])));
    m.push(deg);
  }
  m[7] = null; // вдох в конце такта
  return m;
}

function nextSection() {
  const prev = section;
  sectionsInKey++;
  // раз в 5–7 частей — новая тональность, чтобы слух не уставал
  if (sectionsInKey >= 5 + Math.floor(Math.random() * 3)) {
    sectionsInKey = 0;
    key = 60 + rand([-3, -1, 0, 2, 5].filter((k) => k !== key - 60));
  }
  const parts: Part[] = ['intro', 'bounce', 'skip', 'break'];
  const weights: Record<Part, number> = { intro: 1, bounce: 4, skip: 3, break: 2 };
  let part: Part = prev.part;
  while (part === prev.part) {
    let r = Math.random() * parts.reduce((n, p) => n + weights[p], 0);
    for (const p of parts) if ((r -= weights[p]) < 0) { part = p; break; }
  }
  let prog = prev.prog;
  while (prog === prev.prog) prog = Math.floor(Math.random() * PROGRESSIONS.length);
  section = { part, prog, bars: part === 'intro' ? 4 : rand([8, 8, 16]) };
  motif = makeMotif();
  answer = makeMotif();
  step = 0;
}

// ступень гаммы → нота; на сильной доле притягиваем к ближайшему звуку аккорда
function melodyNote(deg: number, strong: boolean, chord: number[]): number {
  let n = key + 12 + SCALE[deg % 7] + 12 * Math.floor(deg / 7);
  if (strong) n = chord.reduce((best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best), chord[0]);
  return n;
}

function playStep(at: number) {
  const out = bus();
  const bar = Math.floor(step / 8);
  const pos = step % 8;
  const [deg, kind] = PROGRESSIONS[section.prog][bar % 4];
  const root = key + deg - 12;
  const tones = CHORD[kind];
  const p = section.part;
  const chordHigh = tones.map((t) => root + 24 + t);

  // тихая подложка аккорда в начале такта, чтобы гармония не пропадала
  if (pos === 0) for (const t of tones.slice(0, 3)) voice(midi(root + 12 + t), at, EIGHTH * 7, 'sine', p === 'intro' ? 0.018 : 0.011, 0.08, out);

  // бас: «ум-па» — тоника и квинта, коротко и упруго
  if (p !== 'intro' || bar >= 2) {
    if (pos === 0) voice(midi(root - 12), at, 0.28, 'triangle', 0.09, 0.006, out);
    if (pos === 4) voice(midi(root - 12 + 7), at, 0.24, 'triangle', 0.075, 0.006, out);
    if (p === 'bounce' && pos === 7 && Math.random() < 0.5) voice(midi(root - 12 + rand([4, 9, 12])), at, 0.14, 'triangle', 0.05, 0.006, out);
  }

  // укулеле на слабые доли
  if (p === 'bounce' || p === 'intro') {
    if (pos === 2 || pos === 6 || (pos === 7 && Math.random() < 0.3)) strum(tones.map((t) => root + 24 + t), at, p === 'intro' ? 0.02 : 0.016, out);
  }
  // в «перерыве» — щипки аккорда по четвертям, мягко
  if (p === 'break' && pos % 2 === 0) strum([chordHigh[pos / 2 % tones.length]], at, 0.022, out);

  // ударные: мягкая бочка, щелчок пальцами, шейкер
  if (p === 'bounce' || p === 'skip') {
    if (pos === 0 || pos === 4 || (p === 'bounce' && pos === 5 && Math.random() < 0.3)) kick(at, 0.085, out);
    if (pos === 2 || pos === 6) hiss(at, 0.07, p === 'bounce' ? 0.03 : 0.02, 'bandpass', 2400, out);
    hiss(at, 0.035, pos % 2 ? 0.006 : 0.01, 'highpass', 6500, out);
  }

  // перебор маримбы в «вприпрыжку»
  if (p === 'skip') {
    const order = [0, 1, 2, 3, 2, 1, 2, 3];
    marimba(root + 24 + tones[order[pos] % tones.length], at, 0.022, out);
  }

  // мелодия: мотив — ответ — мотив — новая концовка; в «перерыве» реже
  if (p !== 'intro' || bar >= 2) {
    const phraseBar = bar % 4;
    const src = phraseBar === 1 ? answer : motif;
    let d = src[pos];
    if (phraseBar === 2 && d !== null && Math.random() < 0.3) d = Math.max(0, d + rand([-1, 1]));
    if (phraseBar === 3) d = pos < 4 ? src[pos] : pos === 4 ? 0 : null; // концовка приходит домой
    if (p === 'break' && Math.random() < 0.5) d = null;
    if (d !== null && d !== undefined) {
      const n = melodyNote(d, pos === 0 || pos === 4, chordHigh);
      const vol = p === 'skip' ? 0.04 : 0.055;
      marimba(n, at, vol, out);
    }
  }

  step++;
  if (step >= section.bars * 8) nextSection();
}

function scheduleMusic() {
  const a = ctx;
  if (!a || !musicGain || muted || paused || !musicOn || a.state !== 'running') return;
  if (nextAt < a.currentTime) nextAt = a.currentTime + 0.1;
  while (nextAt < a.currentTime + 0.3) {
    if (motif.length === 0) { motif = makeMotif(); answer = makeMotif(); }
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
  musicGain.gain.setTargetAtTime(2 * musicVol, a.currentTime, 0.4);
  if (!timer) timer = setInterval(scheduleMusic, 60);
}

// Громкость из окна настроек (0..1). Музыка сразу плавно подстраивается.
export function setVolumes(music: number, sounds: number) {
  musicVol = music;
  sfxVol = sounds;
  if (musicGain && ctx && musicOn) musicGain.gain.setTargetAtTime(2 * musicVol, ctx.currentTime, 0.1);
}

// Первый тап: разбудить звук и, если можно, запустить музыку.
export function unlockAudio(withMusic: boolean): boolean {
  unlocked = true;
  const a = audio();
  if (withMusic) setMusic(true);
  return a?.state === 'running';
}

// Пауза от площадки (реклама, свёрнутая вкладка): звук обязан замолчать.
export function setAudioPaused(p: boolean) {
  paused = p;
  if (!ctx) return;
  if (p) void ctx.suspend();
  else if (!muted) void ctx.resume();
}
