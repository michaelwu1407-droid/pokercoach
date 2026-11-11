/**
 * Small synthesized table sounds through the Web Audio API: no audio files.
 * Browsers only allow audio after a user gesture, so the AudioContext is made on the first one.
 * Every call is safe without audio support: sounds are a nicety, never a reason to throw.
 */
export type Sound = "chip" | "card" | "win";

const KEY = "pokercoach.sound";
let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try { return localStorage.getItem(KEY) === "off"; } catch { return false; }
}

export const isMuted = () => muted;

export function setMuted(off: boolean) {
  muted = off;
  try { localStorage.setItem(KEY, off ? "off" : "on"); } catch { /* Blocked storage: the choice lasts for this page only. */ }
}

function unlock() {
  if (ctx) return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) ctx = new Ctor();
  } catch { ctx = null; }
}

if (typeof window !== "undefined") {
  for (const type of ["pointerdown", "keydown"] as const) window.addEventListener(type, unlock, { once: true, capture: true });
}

function tone(ac: AudioContext, at: number, freq: number, length: number, peak: number, type: OscillatorType) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/** A burst of filtered noise: the soft slide of a card onto the felt. */
function swish(ac: AudioContext, at: number) {
  const frames = Math.floor(ac.sampleRate * 0.08);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  // Own noise source, so sounds never shift the game's random deals.
  let seed = 1;
  for (let i = 0; i < frames; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 1073741823.5 - 1) * (1 - i / frames);
  }
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  src.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = 2200;
  gain.gain.value = 0.18;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(at);
}

export function play(sound: Sound) {
  if (muted || !ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    if (sound === "chip") { tone(ctx, t, 2400, 0.05, 0.12, "triangle"); tone(ctx, t + 0.035, 3100, 0.04, 0.08, "triangle"); }
    if (sound === "card") swish(ctx, t);
    if (sound === "win") [660, 880, 1320].forEach((f, i) => tone(ctx!, t + i * 0.09, f, 0.35, 0.1, "sine"));
  } catch { /* Audio failed mid-play: stay silent. */ }
}
