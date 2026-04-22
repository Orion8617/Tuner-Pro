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
  },
];

export function getFreeTunings(): TuningConfig[] {
  return ALL_TUNINGS.filter(t => !t.isPremium);
}

export function getPremiumTunings(): TuningConfig[] {
  return ALL_TUNINGS.filter(t => t.isPremium);
}

export const ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const LOG2 = Math.log(2);

export function frequencyToNote(frequency: number): { note: string; octave: number; cents: number } {
  const noteNum = 12 * (Math.log(frequency / 440) / LOG2);
  const roundedNote = Math.round(noteNum);
  const cents = Math.round((noteNum - roundedNote) * 100);
  const noteIndex = ((roundedNote % 12) + 12 + 9) % 12;
  const octave = Math.floor((roundedNote + 9) / 12) + 4;
  return { note: ALL_NOTES[noteIndex], octave, cents };
}

export function findClosestString(frequency: number, tuning: GuitarString[] = STANDARD_TUNING): GuitarString | null {
  if (frequency < 50 || frequency > 600) return null;

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

export function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const size = buffer.length;

  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);

  if (rms < 0.03) return -1;

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

  if (frequency < 50 || frequency > 600) return -1;

  const minConfidence = frequency > 250 ? 0.55 : 0.65;
  if (confidence < minConfidence) return -1;

  const minRms = frequency > 250 ? 0.035 : 0.05;
  if (rms < minRms) return -1;

  return frequency;
}

export class FrequencyStabilizer {
  private history: number[];
  private readonly maxHistory: number;
  private readonly stabilityThresholdCents: number;
  private readonly minReadings: number;
  private silenceCount: number;
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
    this.history = [];
    this.silenceCount = 0;
  }

  push(frequency: number): number | null {
    if (frequency <= 0) {
      this.silenceCount++;
      if (this.silenceCount >= this.silenceThreshold) {
        this.history = [];
        return null;
      }
      return this.history.length >= this.minReadings ? this._median() : null;
    }

    this.silenceCount = 0;

    if (this.history.length > 0) {
      const lastFreq = this.history[this.history.length - 1];
      const centsDiff = Math.abs(1200 * (Math.log(frequency / lastFreq) / LOG2));
      if (centsDiff > 400) {
        this.history = [frequency];
        return null;
      }
    }

    this.history.push(frequency);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (this.history.length < this.minReadings) return null;

    const sorted = this.history.slice().sort((a, b) => a - b);
    const minFreq = sorted[0];
    const maxFreq = sorted[sorted.length - 1];
    const rangeCents = 1200 * (Math.log(maxFreq / minFreq) / LOG2);

    if (rangeCents > this.stabilityThresholdCents) return null;

    return this._medianOfSorted(sorted);
  }

  private _median(): number {
    const sorted = this.history.slice().sort((a, b) => a - b);
    return this._medianOfSorted(sorted);
  }

  private _medianOfSorted(sorted: number[]): number {
    const mid = sorted.length >> 1;
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) * 0.5
      : sorted[mid];
  }

  reset() {
    this.history = [];
    this.silenceCount = 0;
  }
}
