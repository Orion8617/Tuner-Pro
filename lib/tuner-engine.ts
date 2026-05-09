export interface GuitarString {
  name: string;
  note: string;
  octave: number;
  frequency: number;
  stringNumber: number;
}

export interface TuningConfig {
  id: string;
  name: string;
  shortName: string;
  strings: GuitarString[];
  isPremium: boolean;
  genre: string;
  instrument: "guitar" | "bass" | "ukulele" | "other";
}

export type ReferenceA4 = 432 | 434 | 436 | 438 | 440 | 442 | 444 | 446;
export const REFERENCE_A4_OPTIONS: ReferenceA4[] = [432, 434, 436, 438, 440, 442, 444, 446];

export function getInstrumentFreqRange(tuning: TuningConfig): { min: number; max: number } {
  switch (tuning.instrument) {
    case "bass":    return { min: 28, max: 350 };
    case "ukulele": return { min: 180, max: 1400 };
    default:        return { min: 50,  max: 600  };
  }
}

export const STANDARD_TUNING: GuitarString[] = [
  { name: "6", note: "E", octave: 2, frequency: 82.41,  stringNumber: 6 },
  { name: "5", note: "A", octave: 2, frequency: 110.0,  stringNumber: 5 },
  { name: "4", note: "D", octave: 3, frequency: 146.83, stringNumber: 4 },
  { name: "3", note: "G", octave: 3, frequency: 196.0,  stringNumber: 3 },
  { name: "2", note: "B", octave: 3, frequency: 246.94, stringNumber: 2 },
  { name: "1", note: "E", octave: 4, frequency: 329.63, stringNumber: 1 },
];

export const ALL_TUNINGS: TuningConfig[] = [
  {
    id: "standard",
    name: "Standard",
    shortName: "EADGBE",
    strings: STANDARD_TUNING,
    isPremium: false,
    genre: "All Genres",
    instrument: "guitar",
  },
  {
    id: "double_drop_d",
    name: "Double Drop D",
    shortName: "DADGBD",
    strings: [
      { name: "6", note: "D", octave: 2, frequency: 73.42,  stringNumber: 6 },
      { name: "5", note: "A", octave: 2, frequency: 110.0,  stringNumber: 5 },
      { name: "4", note: "D", octave: 3, frequency: 146.83, stringNumber: 4 },
      { name: "3", note: "G", octave: 3, frequency: 196.0,  stringNumber: 3 },
      { name: "2", note: "B", octave: 3, frequency: 246.94, stringNumber: 2 },
      { name: "1", note: "D", octave: 4, frequency: 293.66, stringNumber: 1 },
    ],
    isPremium: false,
    genre: "Folk / Acoustic",
    instrument: "guitar",
  },
  {
    id: "open_c",
    name: "Open C",
    shortName: "CGCGCE",
    strings: [
      { name: "6", note: "C", octave: 2, frequency: 65.41,  stringNumber: 6 },
      { name: "5", note: "G", octave: 2, frequency: 98.0,   stringNumber: 5 },
      { name: "4", note: "C", octave: 3, frequency: 130.81, stringNumber: 4 },
      { name: "3", note: "G", octave: 3, frequency: 196.0,  stringNumber: 3 },
      { name: "2", note: "C", octave: 4, frequency: 261.63, stringNumber: 2 },
      { name: "1", note: "E", octave: 4, frequency: 329.63, stringNumber: 1 },
    ],
    isPremium: false,
    genre: "Alternative / Folk",
    instrument: "guitar",
  },
  {
    id: "all_fourths",
    name: "All Fourths",
    shortName: "EADGCF",
    strings: [
      { name: "6", note: "E", octave: 2, frequency: 82.41,  stringNumber: 6 },
      { name: "5", note: "A", octave: 2, frequency: 110.0,  stringNumber: 5 },
      { name: "4", note: "D", octave: 3, frequency: 146.83, stringNumber: 4 },
      { name: "3", note: "G", octave: 3, frequency: 196.0,  stringNumber: 3 },
      { name: "2", note: "C", octave: 4, frequency: 261.63, stringNumber: 2 },
      { name: "1", note: "F", octave: 4, frequency: 349.23, stringNumber: 1 },
    ],
    isPremium: false,
    genre: "Jazz / Fusion",
    instrument: "guitar",
  },
  {
    id: "drop_d",
    name: "Drop D",
    shortName: "DADGBE",
    strings: [
      { name: "6", note: "D", octave: 2, frequency: 73.42,  stringNumber: 6 },
      { name: "5", note: "A", octave: 2, frequency: 110.0,  stringNumber: 5 },
      { name: "4", note: "D", octave: 3, frequency: 146.83, stringNumber: 4 },
      { name: "3", note: "G", octave: 3, frequency: 196.0,  stringNumber: 3 },
      { name: "2", note: "B", octave: 3, frequency: 246.94, stringNumber: 2 },
      { name: "1", note: "E", octave: 4, frequency: 329.63, stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Rock / Metal / Grunge",
    instrument: "guitar",
  },
  {
    id: "open_g",
    name: "Open G",
    shortName: "DGDGBD",
    strings: [
      { name: "6", note: "D", octave: 2, frequency: 73.42,  stringNumber: 6 },
      { name: "5", note: "G", octave: 2, frequency: 98.0,   stringNumber: 5 },
      { name: "4", note: "D", octave: 3, frequency: 146.83, stringNumber: 4 },
      { name: "3", note: "G", octave: 3, frequency: 196.0,  stringNumber: 3 },
      { name: "2", note: "B", octave: 3, frequency: 246.94, stringNumber: 2 },
      { name: "1", note: "D", octave: 4, frequency: 293.66, stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Blues / Rock / Country",
    instrument: "guitar",
  },
  {
    id: "dadgad",
    name: "DADGAD",
    shortName: "DADGAD",
    strings: [
      { name: "6", note: "D", octave: 2, frequency: 73.42,  stringNumber: 6 },
      { name: "5", note: "A", octave: 2, frequency: 110.0,  stringNumber: 5 },
      { name: "4", note: "D", octave: 3, frequency: 146.83, stringNumber: 4 },
      { name: "3", note: "G", octave: 3, frequency: 196.0,  stringNumber: 3 },
      { name: "2", note: "A", octave: 3, frequency: 220.0,  stringNumber: 2 },
      { name: "1", note: "D", octave: 4, frequency: 293.66, stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Celtic / Folk / Rock",
    instrument: "guitar",
  },
  {
    id: "open_d",
    name: "Open D",
    shortName: "DADF#AD",
    strings: [
      { name: "6", note: "D", octave: 2, frequency: 73.42,  stringNumber: 6 },
      { name: "5", note: "A", octave: 2, frequency: 110.0,  stringNumber: 5 },
      { name: "4", note: "D", octave: 3, frequency: 146.83, stringNumber: 4 },
      { name: "3", note: "F#", octave: 3, frequency: 185.0, stringNumber: 3 },
      { name: "2", note: "A", octave: 3, frequency: 220.0,  stringNumber: 2 },
      { name: "1", note: "D", octave: 4, frequency: 293.66, stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Blues / Folk / Slide",
    instrument: "guitar",
  },
  {
    id: "open_e",
    name: "Open E",
    shortName: "EBE G#BE",
    strings: [
      { name: "6", note: "E",  octave: 2, frequency: 82.41,  stringNumber: 6 },
      { name: "5", note: "B",  octave: 2, frequency: 123.47, stringNumber: 5 },
      { name: "4", note: "E",  octave: 3, frequency: 164.81, stringNumber: 4 },
      { name: "3", note: "G#", octave: 3, frequency: 207.65, stringNumber: 3 },
      { name: "2", note: "B",  octave: 3, frequency: 246.94, stringNumber: 2 },
      { name: "1", note: "E",  octave: 4, frequency: 329.63, stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Blues / Rock / Slide",
    instrument: "guitar",
  },
  {
    id: "drop_c",
    name: "Drop C",
    shortName: "CGCFAD",
    strings: [
      { name: "6", note: "C", octave: 2, frequency: 65.41,  stringNumber: 6 },
      { name: "5", note: "G", octave: 2, frequency: 98.0,   stringNumber: 5 },
      { name: "4", note: "C", octave: 3, frequency: 130.81, stringNumber: 4 },
      { name: "3", note: "F", octave: 3, frequency: 174.61, stringNumber: 3 },
      { name: "2", note: "A", octave: 3, frequency: 220.0,  stringNumber: 2 },
      { name: "1", note: "D", octave: 4, frequency: 293.66, stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Metal / Hard Rock",
    instrument: "guitar",
  },

  // ─── 7-STRING GUITAR ────────────────────────────────────────────────────────
  {
    id: "seven_standard",
    name: "7-String Standard",
    shortName: "BEADGBE",
    strings: [
      { name: "7", note: "B",  octave: 1, frequency: 61.74,  stringNumber: 7 },
      { name: "6", note: "E",  octave: 2, frequency: 82.41,  stringNumber: 6 },
      { name: "5", note: "A",  octave: 2, frequency: 110.0,  stringNumber: 5 },
      { name: "4", note: "D",  octave: 3, frequency: 146.83, stringNumber: 4 },
      { name: "3", note: "G",  octave: 3, frequency: 196.0,  stringNumber: 3 },
      { name: "2", note: "B",  octave: 3, frequency: 246.94, stringNumber: 2 },
      { name: "1", note: "E",  octave: 4, frequency: 329.63, stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Metal / Progressive / Djent",
    instrument: "guitar",
  },
  {
    id: "seven_drop_a",
    name: "7-String Drop A",
    shortName: "AEADGBE",
    strings: [
      { name: "7", note: "A",  octave: 1, frequency: 55.0,   stringNumber: 7 },
      { name: "6", note: "E",  octave: 2, frequency: 82.41,  stringNumber: 6 },
      { name: "5", note: "A",  octave: 2, frequency: 110.0,  stringNumber: 5 },
      { name: "4", note: "D",  octave: 3, frequency: 146.83, stringNumber: 4 },
      { name: "3", note: "G",  octave: 3, frequency: 196.0,  stringNumber: 3 },
      { name: "2", note: "B",  octave: 3, frequency: 246.94, stringNumber: 2 },
      { name: "1", note: "E",  octave: 4, frequency: 329.63, stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Metal / Djent",
    instrument: "guitar",
  },

  // ─── BASS GUITAR ─────────────────────────────────────────────────────────────
  {
    id: "bass_standard",
    name: "Bass Standard",
    shortName: "EADG",
    strings: [
      { name: "4", note: "E", octave: 1, frequency: 41.20,  stringNumber: 4 },
      { name: "3", note: "A", octave: 1, frequency: 55.0,   stringNumber: 3 },
      { name: "2", note: "D", octave: 2, frequency: 73.42,  stringNumber: 2 },
      { name: "1", note: "G", octave: 2, frequency: 98.0,   stringNumber: 1 },
    ],
    isPremium: true,
    genre: "All Genres",
    instrument: "bass",
  },
  {
    id: "bass_drop_d",
    name: "Bass Drop D",
    shortName: "DADG",
    strings: [
      { name: "4", note: "D", octave: 1, frequency: 36.71,  stringNumber: 4 },
      { name: "3", note: "A", octave: 1, frequency: 55.0,   stringNumber: 3 },
      { name: "2", note: "D", octave: 2, frequency: 73.42,  stringNumber: 2 },
      { name: "1", note: "G", octave: 2, frequency: 98.0,   stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Rock / Metal",
    instrument: "bass",
  },
  {
    id: "bass_5string",
    name: "Bass 5-String",
    shortName: "BEADG",
    strings: [
      { name: "5", note: "B", octave: 0, frequency: 30.87,  stringNumber: 5 },
      { name: "4", note: "E", octave: 1, frequency: 41.20,  stringNumber: 4 },
      { name: "3", note: "A", octave: 1, frequency: 55.0,   stringNumber: 3 },
      { name: "2", note: "D", octave: 2, frequency: 73.42,  stringNumber: 2 },
      { name: "1", note: "G", octave: 2, frequency: 98.0,   stringNumber: 1 },
    ],
    isPremium: true,
    genre: "All Genres",
    instrument: "bass",
  },
  {
    id: "bass_5string_drop_a",
    name: "Bass 5-String Drop A",
    shortName: "AEADG",
    strings: [
      { name: "5", note: "A", octave: 0, frequency: 27.5,   stringNumber: 5 },
      { name: "4", note: "E", octave: 1, frequency: 41.20,  stringNumber: 4 },
      { name: "3", note: "A", octave: 1, frequency: 55.0,   stringNumber: 3 },
      { name: "2", note: "D", octave: 2, frequency: 73.42,  stringNumber: 2 },
      { name: "1", note: "G", octave: 2, frequency: 98.0,   stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Metal / Funk",
    instrument: "bass",
  },

  // ─── UKULELE ──────────────────────────────────────────────────────────────
  {
    id: "ukulele_standard",
    name: "Ukulele Standard",
    shortName: "GCEA",
    strings: [
      { name: "4", note: "G", octave: 4, frequency: 392.0,  stringNumber: 4 },
      { name: "3", note: "C", octave: 4, frequency: 261.63, stringNumber: 3 },
      { name: "2", note: "E", octave: 4, frequency: 329.63, stringNumber: 2 },
      { name: "1", note: "A", octave: 4, frequency: 440.0,  stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Pop / Folk / Hawaiian",
    instrument: "ukulele",
  },
  {
    id: "ukulele_low_g",
    name: "Ukulele Low G",
    shortName: "GCEA (Low)",
    strings: [
      { name: "4", note: "G", octave: 3, frequency: 196.0,  stringNumber: 4 },
      { name: "3", note: "C", octave: 4, frequency: 261.63, stringNumber: 3 },
      { name: "2", note: "E", octave: 4, frequency: 329.63, stringNumber: 2 },
      { name: "1", note: "A", octave: 4, frequency: 440.0,  stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Fingerpicking / Jazz",
    instrument: "ukulele",
  },
  {
    id: "ukulele_baritone",
    name: "Baritone Ukulele",
    shortName: "DGBE",
    strings: [
      { name: "4", note: "D", octave: 3, frequency: 146.83, stringNumber: 4 },
      { name: "3", note: "G", octave: 3, frequency: 196.0,  stringNumber: 3 },
      { name: "2", note: "B", octave: 3, frequency: 246.94, stringNumber: 2 },
      { name: "1", note: "E", octave: 4, frequency: 329.63, stringNumber: 1 },
    ],
    isPremium: true,
    genre: "Classical / Jazz",
    instrument: "ukulele",
  },
];

export function getFreeTunings(): TuningConfig[] {
  return ALL_TUNINGS.filter(t => !t.isPremium);
}

export function getPremiumTunings(): TuningConfig[] {
  return ALL_TUNINGS.filter(t => t.isPremium);
}

export function getTuningsByInstrument(instrument: TuningConfig["instrument"]): TuningConfig[] {
  return ALL_TUNINGS.filter(t => t.instrument === instrument);
}

export const ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const LOG2 = Math.log(2);

export function frequencyToNote(
  frequency: number,
  referenceA4: ReferenceA4 = 440
): { note: string; octave: number; cents: number } {
  const noteNum = 12 * (Math.log(frequency / referenceA4) / LOG2);
  const roundedNote = Math.round(noteNum);
  const cents = Math.round((noteNum - roundedNote) * 100);
  const noteIndex = ((roundedNote % 12) + 12 + 9) % 12;
  const octave = Math.floor((roundedNote + 9) / 12) + 4;
  return { note: ALL_NOTES[noteIndex], octave, cents };
}

export function scaleStringsToReference(
  strings: GuitarString[],
  referenceA4: ReferenceA4
): GuitarString[] {
  if (referenceA4 === 440) return strings;
  const ratio = referenceA4 / 440;
  return strings.map(s => ({ ...s, frequency: s.frequency * ratio }));
}

export function findClosestString(
  frequency: number,
  tuning: GuitarString[] = STANDARD_TUNING,
  freqMin = 50,
  freqMax = 600
): GuitarString | null {
  if (frequency < freqMin || frequency > freqMax) return null;

  let closest: GuitarString | null = null;
  let minCents = Infinity;

  for (const str of tuning) {
    const centsDiff = Math.abs(1200 * (Math.log(frequency / str.frequency) / LOG2));
    if (centsDiff < 200 && centsDiff < minCents) {
      minCents = centsDiff;
      closest = str;
    }
  }

  return closest;
}

export function getCentsFromTarget(frequency: number, targetFrequency: number): number {
  return Math.round(1200 * (Math.log(frequency / targetFrequency) / LOG2));
}

export function getTuningStatus(cents: number): "flat" | "sharp" | "in_tune" {
  if (cents < -5) return "flat";
  if (cents > 5) return "sharp";
  return "in_tune";
}

export function autoCorrelate(
  buffer: Float32Array,
  sampleRate: number,
  minFreq = 50,
  maxFreq = 600
): number {
  const size = buffer.length;

  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);

  // Lower RMS threshold for bass frequencies (weaker signal from thick strings)
  const rmsThreshold = minFreq < 50 ? 0.015 : 0.03;
  if (rms < rmsThreshold) return -1;

  let r1 = 0;
  let r2 = size - 1;
  const threshold = 0.12;

  for (let i = 0; i < size >> 1; i++) {
    if (Math.abs(buffer[i]) < threshold) { r1 = i; break; }
  }
  for (let i = 1; i < size >> 1; i++) {
    if (Math.abs(buffer[size - i]) < threshold) { r2 = size - i; break; }
  }

  const len = r2 - r1;
  if (len < 2) return -1;

  const c = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    const end = len - i;
    for (let j = 0; j < end; j++) {
      sum += buffer[r1 + j] * buffer[r1 + j + i];
    }
    c[i] = sum;
  }

  let d = 0;
  while (d < len - 1 && c[d] > c[d + 1]) d++;
  if (d >= len - 1) return -1;

  let maxval = -1;
  let maxpos = d;
  for (let i = d; i < len; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }

  if (maxpos < 1 || maxpos >= len - 1) return -1;

  const confidence = maxval / c[0];

  const x1 = c[maxpos - 1];
  const x2 = c[maxpos];
  const x3 = c[maxpos + 1];
  const a = (x1 + x3 - 2 * x2) * 0.5;
  const b = (x3 - x1) * 0.5;

  let T0: number = maxpos;
  if (a !== 0) T0 = maxpos - b / (2 * a);

  const frequency = sampleRate / T0;

  if (frequency < minFreq || frequency > maxFreq) return -1;

  // Adaptive confidence thresholds — bass requires lower threshold (harder to detect)
  const isBass = minFreq < 50;
  let minConfidence: number;
  if (isBass) {
    minConfidence = 0.45;
  } else {
    minConfidence = frequency > 250 ? 0.55 : 0.65;
  }
  if (confidence < minConfidence) return -1;

  const minRms = isBass ? 0.02 : (frequency > 250 ? 0.035 : 0.05);
  if (rms < minRms) return -1;

  return frequency;
}

// ─── FrequencyStabilizer ─────────────────────────────────────────────────────
// Zero-GC implementation inspired by VigesimalCodec Pro v2 (Juan José Salgado).
// Replaces slice().sort() + dynamic arrays with:
//   • Float32Array circular buffer  — pre-allocated, never grows
//   • Float32Array sort scratchpad  — reused every frame, no new objects
//   • Insertion sort (n≤6)          — no Array.sort closure, no GC pressure
// Result: dial animation has zero micro-pauses caused by garbage collection.
// ─────────────────────────────────────────────────────────────────────────────
export class FrequencyStabilizer {
  private readonly buf: Float32Array;
  private readonly sortBuf: Float32Array;
  private head: number = 0;
  private count: number = 0;
  private silenceCount: number = 0;

  private lastRangeCents: number = Infinity;

  private readonly maxHistory: number;
  private readonly stabilityThresholdCents: number;
  private readonly minReadings: number;
  private readonly silenceThreshold: number;

  constructor(
    maxHistory = 6,
    stabilityThresholdCents = 60,
    minReadings = 3,
    silenceThreshold = 10
  ) {
    this.maxHistory = maxHistory;
    this.stabilityThresholdCents = stabilityThresholdCents;
    this.minReadings = minReadings;
    this.silenceThreshold = silenceThreshold;
    this.buf     = new Float32Array(maxHistory);
    this.sortBuf = new Float32Array(maxHistory);
  }

  push(frequency: number): number | null {
    if (frequency <= 0) {
      this.silenceCount++;
      if (this.silenceCount >= this.silenceThreshold) {
        this.count = 0;
        this.head  = 0;
        return null;
      }
      return this.count >= this.minReadings ? this._medianNoAlloc() : null;
    }

    this.silenceCount = 0;

    if (this.count > 0) {
      const lastIdx  = (this.head - 1 + this.maxHistory) % this.maxHistory;
      const lastFreq = this.buf[lastIdx];
      const centsDiff = Math.abs(1200 * (Math.log(frequency / lastFreq) / LOG2));
      if (centsDiff > 400) {
        this.count   = 0;
        this.head    = 0;
        this.buf[0]  = frequency;
        this.head    = 1;
        this.count   = 1;
        return null;
      }
    }

    this.buf[this.head] = frequency;
    this.head = (this.head + 1) % this.maxHistory;
    if (this.count < this.maxHistory) this.count++;

    if (this.count < this.minReadings) return null;

    return this._medianNoAlloc();
  }

  private _medianNoAlloc(): number | null {
    const n = this.count;

    for (let i = 0; i < n; i++) {
      const idx = (this.head - n + i + this.maxHistory) % this.maxHistory;
      this.sortBuf[i] = this.buf[idx];
    }

    for (let i = 1; i < n; i++) {
      const key = this.sortBuf[i];
      let j = i - 1;
      while (j >= 0 && this.sortBuf[j] > key) {
        this.sortBuf[j + 1] = this.sortBuf[j];
        j--;
      }
      this.sortBuf[j + 1] = key;
    }

    const rangeCents = 1200 * (Math.log(this.sortBuf[n - 1] / this.sortBuf[0]) / LOG2);
    this.lastRangeCents = rangeCents;
    if (rangeCents > this.stabilityThresholdCents) return null;

    const mid = n >> 1;
    return n % 2 === 0
      ? (this.sortBuf[mid - 1] + this.sortBuf[mid]) * 0.5
      : this.sortBuf[mid];
  }

  // GDOP-inspired confidence: 0.0 (no signal) → 1.0 (perfect lock)
  getConfidence(): number {
    if (this.count < this.minReadings) return 0;
    const fillRatio      = this.count / this.maxHistory;
    const stabilityRatio = this.lastRangeCents === Infinity
      ? 0
      : Math.max(0, 1 - this.lastRangeCents / this.stabilityThresholdCents);
    return fillRatio * stabilityRatio;
  }

  reset() {
    this.count          = 0;
    this.head           = 0;
    this.silenceCount   = 0;
    this.lastRangeCents = Infinity;
  }
}
