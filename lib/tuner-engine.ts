export interface GuitarString {
  name: string;
  note: string;
  octave: number;
  frequency: number;
  stringNumber: number;
}

export const STANDARD_TUNING: GuitarString[] = [
  { name: "6", note: "E", octave: 2, frequency: 82.41, stringNumber: 6 },
  { name: "5", note: "A", octave: 2, frequency: 110.0, stringNumber: 5 },
  { name: "4", note: "D", octave: 3, frequency: 146.83, stringNumber: 4 },
  { name: "3", note: "G", octave: 3, frequency: 196.0, stringNumber: 3 },
  { name: "2", note: "B", octave: 3, frequency: 246.94, stringNumber: 2 },
  { name: "1", note: "E", octave: 4, frequency: 329.63, stringNumber: 1 },
];

export const ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function frequencyToNote(frequency: number): { note: string; octave: number; cents: number } {
  const noteNum = 12 * (Math.log2(frequency / 440));
  const roundedNote = Math.round(noteNum);
  const cents = Math.round((noteNum - roundedNote) * 100);

  let noteIndex = ((roundedNote % 12) + 12 + 9) % 12;
  const octave = Math.floor((roundedNote + 9) / 12) + 4;

  return {
    note: ALL_NOTES[noteIndex],
    octave,
    cents,
  };
}

export function findClosestString(frequency: number): GuitarString | null {
  if (frequency < 60 || frequency > 400) return null;

  let closest: GuitarString | null = null;
  let minDiff = Infinity;

  for (const str of STANDARD_TUNING) {
    const diff = Math.abs(frequency - str.frequency);
    const centsDiff = Math.abs(1200 * Math.log2(frequency / str.frequency));
    if (centsDiff < 200 && diff < minDiff) {
      minDiff = diff;
      closest = str;
    }
  }

  return closest;
}

export function getCentsFromTarget(frequency: number, targetFrequency: number): number {
  return Math.round(1200 * Math.log2(frequency / targetFrequency));
}

export function getTuningStatus(cents: number): "flat" | "sharp" | "in_tune" {
  if (cents < -5) return "flat";
  if (cents > 5) return "sharp";
  return "in_tune";
}

export function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  let size = buffer.length;
  let rms = 0;

  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);

  if (rms < 0.01) return -1;

  let r1 = 0;
  let r2 = size - 1;
  const threshold = 0.2;

  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }

  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buffer[size - i]) < threshold) {
      r2 = size - i;
      break;
    }
  }

  const trimmedBuffer = buffer.slice(r1, r2);
  size = trimmedBuffer.length;

  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] = c[i] + trimmedBuffer[j] * trimmedBuffer[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) {
    d++;
    if (d >= size - 1) return -1;
  }

  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;

  const x1 = c[T0 - 1] || 0;
  const x2 = c[T0];
  const x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;

  if (a) {
    T0 = T0 - b / (2 * a);
  }

  return sampleRate / T0;
}
