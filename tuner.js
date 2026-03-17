/**
 * Tuner Pro – Pitch detection engine & UI
 *
 * Uses the Web Audio API with an autocorrelation-based
 * fundamental frequency estimator (McLeod Pitch Method, simplified).
 */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const NOTE_NAMES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const A4_INDEX     = 69;   // MIDI note number for A4
const CENTS_RANGE  = 50;   // ±50 cents shown on the meter

const TUNINGS = {
  standard: {
    label: 'Standard (EADGBE)',
    strings: ['E2','A2','D3','G3','B3','E4'],
  },
  dropD: {
    label: 'Drop D (DADGBE)',
    strings: ['D2','A2','D3','G3','B3','E4'],
  },
  openG: {
    label: 'Open G (DGDGBD)',
    strings: ['D2','G2','D3','G3','B3','D4'],
  },
  halfDown: {
    label: 'Half Step Down (Eb)',
    strings: ['Eb2','Ab2','Db3','Gb3','Bb3','Eb4'],
  },
  fullDown: {
    label: 'Full Step Down (D)',
    strings: ['D2','G2','C3','F3','A3','D4'],
  },
  openE: {
    label: 'Open E (EBEG#BE)',
    strings: ['E2','B2','E3','G#3','B3','E4'],
  },
};

// ── State ──────────────────────────────────────────────────────────────────
let audioCtx       = null;
let analyser       = null;
let mediaStream    = null;
let animFrame      = null;
let referencePitch = 440;
let isRunning      = false;
let buffer         = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const noteNameEl      = document.getElementById('note-name');
const octaveEl        = document.getElementById('octave');
const frequencyEl     = document.getElementById('frequency');
const needleEl        = document.getElementById('meter-needle');
const statusEl        = document.getElementById('tuning-status');
const startBtn        = document.getElementById('start-btn');
const stopBtn         = document.getElementById('stop-btn');
const refPitchInput   = document.getElementById('reference-pitch');
const refPitchValueEl = document.getElementById('reference-pitch-value');
const tuningNotesEl   = document.getElementById('tuning-notes');
const presetBtns      = document.querySelectorAll('.preset-btn');

// ── Reference pitch control ────────────────────────────────────────────────
refPitchInput.addEventListener('input', () => {
  referencePitch = parseInt(refPitchInput.value, 10);
  refPitchValueEl.textContent = `${referencePitch} Hz`;
});

// ── Preset buttons ─────────────────────────────────────────────────────────
presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    presetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showTuningNotes(btn.dataset.tuning);
  });
});

function showTuningNotes(tuningKey) {
  const tuning = TUNINGS[tuningKey];
  if (!tuning) return;
  tuningNotesEl.innerHTML = tuning.strings
    .map(s => `<span class="string-badge">${s}</span>`)
    .join('');
}

// Initialise with standard tuning
showTuningNotes('standard');

// ── Start / Stop ───────────────────────────────────────────────────────────
startBtn.addEventListener('click', async () => {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    statusEl.textContent = 'Microphone access denied.';
    return;
  }

  audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
  analyser  = audioCtx.createAnalyser();
  analyser.fftSize        = 2048;
  analyser.smoothingTimeConstant = 0.8;

  const source = audioCtx.createMediaStreamSource(mediaStream);
  source.connect(analyser);

  buffer    = new Float32Array(analyser.fftSize);
  isRunning = true;

  startBtn.disabled = true;
  stopBtn.disabled  = false;
  statusEl.textContent = 'Listening…';
  statusEl.className   = 'tuning-status';

  updateTuner();
});

stopBtn.addEventListener('click', stopTuner);

function stopTuner() {
  isRunning = false;
  cancelAnimationFrame(animFrame);

  if (mediaStream)  { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  if (audioCtx)     { audioCtx.close(); audioCtx = null; }

  startBtn.disabled = false;
  stopBtn.disabled  = true;

  noteNameEl.textContent  = '–';
  octaveEl.textContent    = '';
  frequencyEl.textContent = '– Hz';
  needleEl.style.left     = '50%';
  statusEl.textContent    = 'Press Start and play a note';
  statusEl.className      = 'tuning-status';
}

// ── Detection loop ─────────────────────────────────────────────────────────
function updateTuner() {
  if (!isRunning) return;
  animFrame = requestAnimationFrame(updateTuner);

  analyser.getFloatTimeDomainData(buffer);

  const frequency = autoCorrelate(buffer, audioCtx.sampleRate);

  if (frequency === -1) {
    // Silence
    noteNameEl.textContent  = '–';
    octaveEl.textContent    = '';
    frequencyEl.textContent = '– Hz';
    needleEl.style.left     = '50%';
    statusEl.textContent    = 'Listening…';
    statusEl.className      = 'tuning-status';
    return;
  }

  const { note, octave, cents } = frequencyToNote(frequency, referencePitch);

  noteNameEl.textContent  = note;
  octaveEl.textContent    = octave;
  frequencyEl.textContent = `${frequency.toFixed(1)} Hz`;

  // Needle position: 0% = far flat, 100% = far sharp, 50% = in tune
  const clampedCents = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, cents));
  const pct = ((clampedCents + CENTS_RANGE) / (2 * CENTS_RANGE)) * 100;
  needleEl.style.left = `${pct}%`;

  if (Math.abs(cents) <= 5) {
    statusEl.textContent = '✓ In Tune!';
    statusEl.className   = 'tuning-status in-tune';
  } else if (cents < 0) {
    statusEl.textContent = `↑ Tune Up  (${Math.abs(cents).toFixed(0)} ¢ flat)`;
    statusEl.className   = 'tuning-status flat';
  } else {
    statusEl.textContent = `↓ Tune Down  (${cents.toFixed(0)} ¢ sharp)`;
    statusEl.className   = 'tuning-status sharp';
  }
}

// ── Autocorrelation pitch detector ────────────────────────────────────────
function autoCorrelate(buf, sampleRate) {
  const SIZE     = buf.length;
  let rms        = 0;

  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;   // silence threshold

  let r1 = 0, r2 = SIZE - 1;
  const THRESHOLD = 0.2;

  // Trim silence from the edges
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) >= THRESHOLD) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) >= THRESHOLD) { r2 = SIZE - i; break; }
  }

  const trimmed = buf.slice(r1, r2);
  const c       = new Float32Array(trimmed.length * 2);

  // Autocorrelation
  for (let i = 0; i < trimmed.length; i++) {
    for (let j = 0; j < trimmed.length; j++) {
      c[i] = (c[i] || 0) + trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;

  let maxval = -1, maxpos = -1;
  for (let i = d; i < trimmed.length; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }

  let T0 = maxpos;

  // Parabolic interpolation for sub-sample precision
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a   = (x1 + x3 - 2 * x2) / 2;
  const b   = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

// ── Frequency → note name + cents ─────────────────────────────────────────
function frequencyToNote(freq, a4 = 440) {
  const semitones = 12 * Math.log2(freq / a4);
  const midiNote  = Math.round(semitones) + A4_INDEX;
  const cents     = Math.round((semitones - Math.round(semitones)) * 100);

  const noteIndex = ((midiNote % 12) + 12) % 12;
  const octave    = Math.floor(midiNote / 12) - 1;

  return { note: NOTE_NAMES[noteIndex], octave, cents };
}
