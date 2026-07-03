import { loadSave } from './storage';

export type SoundName = 'pour' | 'invalid' | 'catalyst' | 'crystal' | 'win' | 'click';

let audioContext: AudioContext | null = null;
let settings = loadSave().settings;

function ctx(): AudioContext {
  if (!audioContext) {
    try {
      const Ctor =
        window.AudioContext ||
        ((window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      audioContext = new Ctor();
    } catch (err) {
      // AudioContext unsupported
      void err;
    }
  }
  return audioContext as AudioContext;
}

export function refreshSettings() {
  settings = loadSave().settings;
}

export function unlockAudio() {
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') {
    try {
      void c.resume();
    } catch {
      // ignore
    }
  }
}

let unlockAttached = false;

export function listenForAudioUnlock() {
  if (unlockAttached) return;
  unlockAttached = true;
  const handler = () => {
    unlockAudio();
    if (settings.music && !isMusicPlaying) startMusic();
  };
  document.addEventListener('pointerdown', handler, { once: true });
  document.addEventListener('keydown', handler, { once: true });
  document.addEventListener('touchstart', handler, { once: true });
}

export function play(name: SoundName) {
  unlockAudio();

  if (!settings.sound) return;

  const c = ctx();
  if (!c) return;

  if (c.state !== 'running') {
    requestAnimationFrame(() => {
      if (ctx().state === 'running') {
        scheduleSound(name);
      }
    });
    return;
  }

  scheduleSound(name);
}

function scheduleSound(name: SoundName) {
  switch (name) {
    case 'pour':
      playPour();
      break;
    case 'invalid':
      playInvalid();
      break;
    case 'catalyst':
      playCatalyst();
      break;
    case 'crystal':
      playCrystal();
      break;
    case 'win':
      playWin();
      break;
    case 'click':
      playClick();
      break;
  }
}

function whiteNoise(duration: number, gainValue: number): AudioBufferSourceNode {
  const c = ctx();
  const len = Math.ceil(c.sampleRate * duration);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(gainValue, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.connect(g).connect(c.destination);
  return src;
}

function playPour() {
  const c = ctx();
  const len = Math.ceil(c.sampleRate * 0.35);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.8;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, c.currentTime);
  filter.frequency.linearRampToValueAtTime(200, c.currentTime + 0.35);
  const g = c.createGain();
  g.gain.setValueAtTime(0.25, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
  src.connect(filter).connect(g).connect(c.destination);
  src.start();
}

function playInvalid() {
  const c = ctx();
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(120, c.currentTime);
  o.frequency.linearRampToValueAtTime(80, c.currentTime + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.15, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.18);
}

function playCatalyst() {
  const c = ctx();
  const noise = whiteNoise(0.45, 0.18);
  noise.start();
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(220, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(660, c.currentTime + 0.35);
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.5);
}

function playCrystal() {
  const c = ctx();
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(2600, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(1800, c.currentTime + 0.1);
  const g = c.createGain();
  g.gain.setValueAtTime(0.22, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.3);
  const click = whiteNoise(0.03, 0.08);
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;
  click.disconnect();
  click.connect(filter).connect(c.destination);
  click.start();
}

function playWin() {
  const c = ctx();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime + i * 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime + i * 0.12);
    g.gain.linearRampToValueAtTime(0.18, c.currentTime + i * 0.12 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.12 + 0.45);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + i * 0.12);
    o.stop(c.currentTime + i * 0.12 + 0.55);
  });
}

function playClick() {
  const c = ctx();
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(350, c.currentTime);
  const g = c.createGain();
  g.gain.setValueAtTime(0.08, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.08);
}

// Ambient music drone
let musicNodes: (OscillatorNode | GainNode)[] | null = null;
let isMusicPlaying = false;

export function startMusic() {
  const c = ctx();
  if (!c) return;
  if (isMusicPlaying) return;
  if (!settings.music) return;

  unlockAudio();
  isMusicPlaying = true;

  const drone1 = c.createOscillator();
  drone1.type = 'sine';
  drone1.frequency.value = 65.41; // C2

  const drone2 = c.createOscillator();
  drone2.type = 'triangle';
  drone2.frequency.value = 98.0; // G2

  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.12;

  const lfoGain = c.createGain();
  lfoGain.gain.value = 2.5;

  const masterGain = c.createGain();
  masterGain.gain.value = 0.0;
  masterGain.gain.linearRampToValueAtTime(0.06, c.currentTime + 1.5);

  drone1.connect(masterGain);
  drone2.connect(masterGain);
  lfo.connect(lfoGain);
  lfoGain.connect(drone2.detune);
  masterGain.connect(c.destination);

  drone1.start();
  drone2.start();
  lfo.start();

  musicNodes = [drone1, drone2, lfo, masterGain];
}

export function stopMusic() {
  if (!isMusicPlaying || !musicNodes) return;
  const c = ctx();
  musicNodes.forEach((node) => {
    try {
      if (node instanceof OscillatorNode) {
        node.stop(c.currentTime + 0.1);
      }
    } catch {
      // ignore
    }
  });
  isMusicPlaying = false;
  musicNodes = null;
}
