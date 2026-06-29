import { loadSave } from './storage';

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function resume() {
  const c = ctx();
  if (c && c.state === 'suspended') c.resume();
}

function settings(): { sound: boolean; music: boolean } {
  return loadSave().settings;
}

export function playPour() {
  const s = settings();
  if (!s.sound) return;
  const c = ctx();
  if (!c) return;
  resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(120, c.currentTime + 0.18);
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.2);
}

export function playInvalid() {
  const s = settings();
  if (!s.sound) return;
  const c = ctx();
  if (!c) return;
  resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, c.currentTime);
  osc.frequency.linearRampToValueAtTime(120, c.currentTime + 0.12);
  gain.gain.setValueAtTime(0.08, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.16);
}

export function playCatalyst() {
  const s = settings();
  if (!s.sound) return;
  const c = ctx();
  if (!c) return;
  resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.14);
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.1, c.currentTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.2);
}

export function playWin() {
  const s = settings();
  if (!s.sound) return;
  const c = ctx();
  if (!c) return;
  resume();
  const now = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + i * 0.1);
    gain.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.1 + 0.28);
    osc.connect(gain).connect(c.destination);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.3);
  });
}
