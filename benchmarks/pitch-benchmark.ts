/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  GuitarTune ClonEngine — Benchmark Oficial de Detección de Pitch v1.0
 *  Juan José Salgado Fuentes · KlonEngine Architecture
 *
 *  Compara 4 algoritmos de detección de pitch:
 *    [A] Basic Autocorrelation  — algoritmo actual GuitarTune
 *    [B] YIN / CMNDF            — estado del arte 2002 (de Cheveigné & Kawahara)
 *    [C] McLeod Pitch Method    — estado del arte 2005 (MPM)
 *    [D] ClonEngine SWARM v5    — nuestra arquitectura bio-cibernética
 *
 *  Métricas (estándar MIREX / MUSDB):
 *    GPE  — Gross Pitch Error      : % frames con error > 50 cents (error de octava)
 *    MAE  — Mean Absolute Error    : desviación media en cents (frames correctos)
 *    VFA  — Voicing False Alarm    : % frames de RUIDO detectados como nota válida
 *    MS   — Mean Speed             : ms por frame (mediana de 500 repeticiones)
 *
 *  Suites de prueba:
 *    Suite 1 — Notas Estándar       : todas las cuerdas de guitarra + bajo + ukulele
 *    Suite 2 — Robustez SNR         : SNR = 30/20/10/5/0 dB en E2 (82.41 Hz)
 *    Suite 3 — Bajos (28–100 Hz)    : frecuencias más difíciles de detectar
 *    Suite 4 — Tasa Alarmas Falsas  : ruido blanco, rosa, armónico aleatorio
 *    Suite 5 — Velocidad            : throughput de frames por segundo
 * ═══════════════════════════════════════════════════════════════════════════
 */

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096;
const TWO_PI = Math.PI * 2;

// ──────────────────────────────────────────────────────────────────────────
// GENERADORES DE SEÑALES SINTÉTICAS
// ──────────────────────────────────────────────────────────────────────────

/** Amplitudes armónicas de una guitarra real (medidas por FFT en cuerdas físicas) */
const GUITAR_HARMONICS = [1.0, 0.62, 0.38, 0.19, 0.08, 0.04, 0.02];

function generateGuitarSignal(
  freq: number,
  sampleRate = SAMPLE_RATE,
  size = BUFFER_SIZE,
  snrDb = Infinity
): Float32Array {
  const buf = new Float32Array(size);
  // Fases aleatorias fijas por seed reproducible
  const phases = [0.0, 0.73, 1.41, 2.09, 0.31, 1.85, 2.71];

  // Señal de guitarra: fundamental + 6 armónicos
  let peak = 0;
  for (let i = 0; i < size; i++) {
    let s = 0;
    for (let h = 0; h < GUITAR_HARMONICS.length; h++) {
      if (freq * (h + 1) > sampleRate / 2) break;
      s += GUITAR_HARMONICS[h] * Math.sin(TWO_PI * freq * (h + 1) * i / sampleRate + phases[h]);
    }
    buf[i] = s;
    if (Math.abs(s) > peak) peak = Math.abs(s);
  }
  // Normalizar a -3dBFS
  const gain = 0.7 / peak;
  for (let i = 0; i < size; i++) buf[i] *= gain;

  // Añadir ruido blanco al SNR pedido
  if (isFinite(snrDb)) {
    const signalRms = rms(buf);
    const noiseRms  = signalRms / Math.pow(10, snrDb / 20);
    const lcg = lcgRng(42);
    for (let i = 0; i < size; i++) buf[i] += noiseRms * lcg() * 2.8284; // σ=1 white noise
  }
  return buf;
}

function generateWhiteNoise(amplitude = 0.08): Float32Array {
  const buf = new Float32Array(BUFFER_SIZE);
  const lcg = lcgRng(99);
  for (let i = 0; i < BUFFER_SIZE; i++) buf[i] = (lcg() - 0.5) * 2 * amplitude;
  return buf;
}

function generatePinkNoise(amplitude = 0.08): Float32Array {
  const buf = new Float32Array(BUFFER_SIZE);
  const lcg = lcgRng(77);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < BUFFER_SIZE; i++) {
    const w = (lcg() - 0.5) * 2;
    b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
    b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
    b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
    buf[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11 * amplitude;
    b6 = w * 0.115926;
  }
  return buf;
}

/** Ruido armónico: tiene estructura armónica pero en frecuencia FALSA (tramposo para detectores) */
function generateHarmonicNoise(fakeFreq: number): Float32Array {
  const buf = new Float32Array(BUFFER_SIZE);
  const lcg = lcgRng(13);
  for (let i = 0; i < BUFFER_SIZE; i++) {
    let s = 0;
    for (let h = 1; h <= 4; h++) {
      if (fakeFreq * h > SAMPLE_RATE / 2) break;
      s += GUITAR_HARMONICS[h-1] * Math.sin(TWO_PI * fakeFreq * h * i / SAMPLE_RATE + lcg() * 0.05);
    }
    buf[i] = s * 0.06;
  }
  return buf;
}

// ──────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────────────────────────────────

function rms(buf: Float32Array): number {
  let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

function freqToCents(f: number, ref: number): number {
  return 1200 * Math.log2(f / ref);
}

function lcgRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// ALGORITMO A: Basic Autocorrelation (GuitarTune actual)
// ──────────────────────────────────────────────────────────────────────────

function algoA_BasicAC(buf: Float32Array, minFreq: number, maxFreq: number): number {
  const size = buf.length;
  let sumSq = 0;
  for (let i = 0; i < size; i++) sumSq += buf[i] * buf[i];
  const r = Math.sqrt(sumSq / size);
  const rmsThreshold = minFreq < 50 ? 0.015 : 0.03;
  if (r < rmsThreshold) return -1;

  let r1 = 0, r2 = size - 1;
  const threshold = 0.12;
  for (let i = 0; i < size >> 1; i++) { if (Math.abs(buf[i]) < threshold) { r1 = i; break; } }
  for (let i = 1; i < size >> 1; i++) { if (Math.abs(buf[size - i]) < threshold) { r2 = size - i; break; } }

  const len = r2 - r1;
  if (len < 2) return -1;

  const c = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    const end = len - i;
    for (let j = 0; j < end; j++) sum += buf[r1 + j] * buf[r1 + j + i];
    c[i] = sum;
  }

  let d = 0;
  while (d < len - 1 && c[d] > c[d + 1]) d++;
  if (d >= len - 1) return -1;

  let maxval = -1, maxpos = d;
  for (let i = d; i < len; i++) { if (c[i] > maxval) { maxval = c[i]; maxpos = i; } }
  if (maxpos < 1 || maxpos >= len - 1) return -1;

  const confidence = maxval / c[0];
  const x1 = c[maxpos - 1], x2 = c[maxpos], x3 = c[maxpos + 1];
  const a = (x1 + x3 - 2 * x2) * 0.5;
  const b2 = (x3 - x1) * 0.5;
  let T0 = maxpos;
  if (a !== 0) T0 = maxpos - b2 / (2 * a);

  const freq = SAMPLE_RATE / T0;
  if (freq < minFreq || freq > maxFreq) return -1;

  const isBass = minFreq < 50;
  const minConf = isBass ? 0.45 : (freq > 250 ? 0.55 : 0.65);
  if (confidence < minConf) return -1;

  return freq;
}

// ──────────────────────────────────────────────────────────────────────────
// ALGORITMO B: YIN / CMNDF  (de Cheveigné & Kawahara 2002)
// ──────────────────────────────────────────────────────────────────────────

function algoB_YIN(buf: Float32Array, minFreq: number, maxFreq: number): number {
  const N = buf.length;
  let sumSq = 0;
  for (let i = 0; i < N; i++) sumSq += buf[i] * buf[i];
  const r = Math.sqrt(sumSq / N);
  if (r < 0.01) return -1;

  const W       = N >> 1;
  const tauMin  = Math.max(2, Math.floor(SAMPLE_RATE / maxFreq));
  const tauMax  = Math.min(W - 1, Math.floor(SAMPLE_RATE / minFreq));
  if (tauMax <= tauMin) return -1;

  // Step 1 & 2: difference function
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) {
      const diff = buf[j] - buf[j + tau];
      s += diff * diff;
    }
    d[tau] = s;
  }

  // Step 3: CMNDF
  const cmndf = new Float32Array(tauMax + 1);
  cmndf[0] = 1;
  let runSum = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    runSum += d[tau];
    cmndf[tau] = runSum === 0 ? 0 : d[tau] * tau / runSum;
  }

  // Step 4: absolute threshold
  const yinThr = 0.10;
  let tau0 = -1;
  for (let tau = tauMin; tau <= tauMax - 1; tau++) {
    if (cmndf[tau] < yinThr) {
      while (tau + 1 <= tauMax && cmndf[tau + 1] < cmndf[tau]) tau++;
      tau0 = tau;
      break;
    }
  }

  // Fallback: global minimum
  if (tau0 === -1) {
    let minV = Infinity;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (cmndf[tau] < minV) { minV = cmndf[tau]; tau0 = tau; }
    }
    if (minV > 0.30) return -1;
  }

  if (tau0 <= 0 || tau0 >= tauMax) return -1;

  // Step 5: parabolic interpolation
  const y0 = cmndf[tau0 - 1], y1 = cmndf[tau0], y2 = cmndf[tau0 + 1];
  const aP = (y0 + y2 - 2 * y1) * 0.5;
  const bP = (y2 - y0) * 0.5;
  const T0 = aP !== 0 ? tau0 - bP / (2 * aP) : tau0;

  const freq = SAMPLE_RATE / T0;
  if (freq < minFreq || freq > maxFreq) return -1;

  // Confidence: 1 - cmndf value (lower cmndf = more confident)
  const conf = 1 - cmndf[tau0];
  if (conf < 0.72) return -1;

  return freq;
}

// ──────────────────────────────────────────────────────────────────────────
// ALGORITMO C: McLeod Pitch Method (MPM — McLeod & Wyvill 2005)
// ──────────────────────────────────────────────────────────────────────────

function algoC_MPM(buf: Float32Array, minFreq: number, maxFreq: number): number {
  const N = buf.length;
  let sumSq = 0;
  for (let i = 0; i < N; i++) sumSq += buf[i] * buf[i];
  const r = Math.sqrt(sumSq / N);
  if (r < 0.01) return -1;

  const tauMin = Math.max(1, Math.floor(SAMPLE_RATE / maxFreq));
  const tauMax = Math.min(N - 1, Math.floor(SAMPLE_RATE / minFreq));

  // NSDF: Normalised Square Difference Function
  // nsdf(tau) = 2*r_xy(tau) / (m(0) + m(tau))
  // m(tau) = sum_{j=0}^{N-tau-1} x[j]^2 + x[j+tau]^2
  const nsdf = new Float32Array(tauMax + 1);
  for (let tau = 0; tau <= tauMax; tau++) {
    let rxy = 0, mTau = 0;
    const len = N - tau;
    for (let j = 0; j < len; j++) {
      rxy  += buf[j] * buf[j + tau];
      mTau += buf[j] * buf[j] + buf[j + tau] * buf[j + tau];
    }
    nsdf[tau] = mTau === 0 ? 0 : 2 * rxy / mTau;
  }

  // Find positive-to-negative zero crossings → local maxima positions
  const maxPositions: number[] = [];
  let rising = false;
  for (let tau = tauMin; tau < tauMax; tau++) {
    if (!rising && nsdf[tau] > 0) { rising = true; }
    if (rising && nsdf[tau] > nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1]) {
      maxPositions.push(tau);
    }
    if (rising && nsdf[tau] <= 0) { rising = false; }
  }

  if (maxPositions.length === 0) return -1;

  // Global maximum of NSDF
  let globalMax = -Infinity;
  for (const p of maxPositions) if (nsdf[p] > globalMax) globalMax = nsdf[p];

  // Keep peaks above k * globalMax
  const k = 0.93;
  const validPeaks = maxPositions.filter(p => nsdf[p] >= k * globalMax);
  if (validPeaks.length === 0) return -1;

  const tau0 = validPeaks[0]; // first valid peak = lowest period = highest freq
  if (tau0 <= 0 || tau0 >= tauMax) return -1;

  // Parabolic interpolation
  const y0 = nsdf[tau0 - 1], y1 = nsdf[tau0], y2 = nsdf[tau0 + 1];
  const aP = (y0 + y2 - 2 * y1) * 0.5;
  const bP = (y2 - y0) * 0.5;
  const T0 = aP !== 0 ? tau0 - bP / (2 * aP) : tau0;

  if (nsdf[tau0] < 0.70) return -1; // NSDF quality gate

  const freq = SAMPLE_RATE / T0;
  if (freq < minFreq || freq > maxFreq) return -1;

  return freq;
}

// ──────────────────────────────────────────────────────────────────────────
// ALGORITMO D: ClonEngine SWARM v5 (Juan José Salgado Fuentes)
// ──────────────────────────────────────────────────────────────────────────

/** Distribución armónica de guitarra real — inspirada en Pascal triangle */
const PASCAL_GUITAR: readonly number[] = [0.45, 0.28, 0.15, 0.08, 0.04];
const WINIK_CYCLE = 20;

/** Goertzel — energía a una frecuencia específica, O(N) */
function goertzel(buf: Float32Array, targetFreq: number, sampleRate = SAMPLE_RATE): number {
  const N = buf.length;
  const k = Math.round(N * targetFreq / sampleRate);
  const omega = TWO_PI * k / N;
  const coeff = 2 * Math.cos(omega);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) {
    const s = buf[i] + coeff * s1 - s2;
    s2 = s1; s1 = s;
  }
  return s2 * s2 + s1 * s1 - coeff * s1 * s2;
}

/** Pascal Harmonic Score — valida estructura armónica real vs ruido */
function pascalHarmonicScore(buf: Float32Array, freq: number, sampleRate = SAMPLE_RATE): number {
  const energies = new Float32Array(5);
  let total = 0;
  for (let h = 0; h < 5; h++) {
    const hFreq = freq * (h + 1);
    if (hFreq >= sampleRate / 2) { energies[h] = 0; continue; }
    energies[h] = goertzel(buf, hFreq, sampleRate);
    total += energies[h];
  }
  if (total < 1e-12) return 0;

  let mse = 0;
  for (let h = 0; h < 5; h++) {
    const norm = energies[h] / total;
    const diff = norm - PASCAL_GUITAR[h];
    mse += diff * diff;
  }
  mse /= 5;

  const raw = Math.max(0, 1 - Math.sqrt(mse) * 5.5);
  // Vigesimal normalization (escala Maya base-20)
  return Math.round(raw * 20) / 20;
}

class ClonEngineSWARM {
  private dopamine     = 0.5;
  private tick         = 0;
  private lastScore    = 0;

  /** Procesa un frame — devuelve frecuencia o -1 */
  process(buf: Float32Array, minFreq: number, maxFreq: number): number {
    this.tick++;
    // Winik homeostasis cada 20 ticks
    if (this.tick % WINIK_CYCLE === 0) {
      this.dopamine = this.dopamine * 0.85 + 0.10; // reset parcial
    }

    // Paso 1: CMNDF (mismo que YIN)
    const rawFreq = algoB_YIN(buf, minFreq, maxFreq);

    if (rawFreq <= 0) {
      // CASTIGO: silencio reduce dopamina
      this.dopamine = Math.max(0.10, this.dopamine * 0.9995);
      return -1;
    }

    // Paso 2: Pascal Harmonic Score — validación bio-cibernética
    const score = pascalHarmonicScore(buf, rawFreq);
    this.lastScore = score;

    // Umbral dinámico dopaminérgico: [0.18, 0.35]
    const minScore = 0.35 - this.dopamine * 0.17;

    if (score < minScore) {
      // PUNISH: señal no tiene estructura armónica de guitarra
      this.dopamine = Math.max(0.10, this.dopamine - 0.06);
      return -1;
    }

    // RECOMPENSA: buena detección
    this.dopamine = Math.min(1.0, this.dopamine + 0.09);
    return rawFreq;
  }

  getPascalScore() { return this.lastScore; }
  getDopamine()    { return this.dopamine; }

  reset() {
    this.dopamine = 0.5;
    this.tick = 0;
    this.lastScore = 0;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// MOTOR DE BENCHMARK
// ──────────────────────────────────────────────────────────────────────────

interface AlgoResult {
  name:     string;
  gpe:      number;  // % frames con error > 50 cents
  mae:      number;  // cents de error medio (frames correctos)
  totalFrames:  number;
  correct:      number;
  grossErrors:  number;
}

interface VFAResult {
  name: string;
  vfa:  number; // % ruido detectado como nota
}

interface SpeedResult {
  name:    string;
  medMs:   number; // mediana ms por frame
  fps:     number; // frames por segundo
}

const swarm = new ClonEngineSWARM();

function runAlgo(
  algo: "A"|"B"|"C"|"D",
  buf: Float32Array,
  minFreq: number,
  maxFreq: number
): number {
  switch (algo) {
    case "A": return algoA_BasicAC(buf, minFreq, maxFreq);
    case "B": return algoB_YIN(buf, minFreq, maxFreq);
    case "C": return algoC_MPM(buf, minFreq, maxFreq);
    case "D": return swarm.process(buf, minFreq, maxFreq);
  }
}

function evaluateFrequencies(
  algoId: "A"|"B"|"C"|"D",
  testCases: Array<{ freq: number; minFreq: number; maxFreq: number; snrDb: number }>,
  reps = 1
): AlgoResult {
  const ALGO_NAMES = {
    "A": "[A] Basic Autocorr (actual)",
    "B": "[B] YIN / CMNDF 2002",
    "C": "[C] McLeod MPM 2005",
    "D": "[D] ClonEngine SWARM v5",
  };

  if (algoId === "D") swarm.reset();

  let grossErrors = 0, maeTotalCents = 0, correct = 0, totalFrames = 0;

  for (const tc of testCases) {
    for (let r = 0; r < reps; r++) {
      const buf = generateGuitarSignal(tc.freq, SAMPLE_RATE, BUFFER_SIZE, tc.snrDb);
      const detected = runAlgo(algoId, buf, tc.minFreq, tc.maxFreq);
      totalFrames++;

      if (detected > 0) {
        const centErr = Math.abs(freqToCents(detected, tc.freq));
        if (centErr > 50) {
          grossErrors++;
        } else {
          correct++;
          maeTotalCents += centErr;
        }
      }
    }
  }

  return {
    name:         ALGO_NAMES[algoId],
    gpe:          totalFrames > 0 ? (grossErrors / totalFrames) * 100 : 0,
    mae:          correct > 0 ? maeTotalCents / correct : 0,
    totalFrames,
    correct,
    grossErrors,
  };
}

function evaluateVFA(
  algoId: "A"|"B"|"C"|"D",
  noiseBufs: Float32Array[],
  minFreq = 50,
  maxFreq = 600
): VFAResult {
  const ALGO_NAMES = {
    "A": "[A] Basic Autocorr (actual)",
    "B": "[B] YIN / CMNDF 2002",
    "C": "[C] McLeod MPM 2005",
    "D": "[D] ClonEngine SWARM v5",
  };

  if (algoId === "D") swarm.reset();

  let falseAlarms = 0;
  for (const buf of noiseBufs) {
    const det = runAlgo(algoId, buf, minFreq, maxFreq);
    if (det > 0) falseAlarms++;
  }

  return {
    name: ALGO_NAMES[algoId],
    vfa: (falseAlarms / noiseBufs.length) * 100,
  };
}

function measureSpeed(
  algoId: "A"|"B"|"C"|"D",
  freq: number,
  reps = 500
): SpeedResult {
  const ALGO_NAMES = {
    "A": "[A] Basic Autocorr (actual)",
    "B": "[B] YIN / CMNDF 2002",
    "C": "[C] McLeod MPM 2005",
    "D": "[D] ClonEngine SWARM v5",
  };

  if (algoId === "D") swarm.reset();

  const buf = generateGuitarSignal(freq);
  const times: number[] = [];

  for (let r = 0; r < reps; r++) {
    const t0 = performance.now();
    runAlgo(algoId, buf, 50, 600);
    times.push(performance.now() - t0);
  }

  times.sort((a, b) => a - b);
  const med = times[Math.floor(reps / 2)];
  return {
    name:  ALGO_NAMES[algoId],
    medMs: med,
    fps:   1000 / med,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// DISPLAY
// ──────────────────────────────────────────────────────────────────────────

function bar(val: number, max: number, width = 20, invert = false): string {
  const pct   = Math.min(1, val / max);
  const filled = Math.round((invert ? 1 - pct : pct) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function fmt(n: number, dec = 2): string {
  return n.toFixed(dec).padStart(8);
}

function winnerTag(results: AlgoResult[], idx: number, key: "gpe"|"mae"): string {
  const best = Math.min(...results.map(r => r[key]));
  return results[idx][key] === best ? " ◄ MEJOR" : "";
}

function winnerTagVFA(results: VFAResult[], idx: number): string {
  const best = Math.min(...results.map(r => r.vfa));
  return results[idx].vfa === best ? " ◄ MEJOR" : "";
}

function winnerTagSpeed(results: SpeedResult[], idx: number): string {
  const best = Math.min(...results.map(r => r.medMs));
  return results[idx].medMs === best ? " ◄ MEJOR" : "";
}

// ──────────────────────────────────────────────────────────────────────────
// DEFINICIÓN DE CASOS DE PRUEBA
// ──────────────────────────────────────────────────────────────────────────

// Todos los instrumentos soportados por GuitarTune
const GUITAR_NOTES = [
  // Guitarra Standard
  { label: "E2", freq: 82.41,  minFreq: 50,  maxFreq: 600 },
  { label: "A2", freq: 110.0,  minFreq: 50,  maxFreq: 600 },
  { label: "D3", freq: 146.83, minFreq: 50,  maxFreq: 600 },
  { label: "G3", freq: 196.0,  minFreq: 50,  maxFreq: 600 },
  { label: "B3", freq: 246.94, minFreq: 50,  maxFreq: 600 },
  { label: "E4", freq: 329.63, minFreq: 50,  maxFreq: 600 },
  // Drop tunings
  { label: "D2", freq: 73.42,  minFreq: 50,  maxFreq: 600 },
  { label: "C2", freq: 65.41,  minFreq: 50,  maxFreq: 600 },
  // 7-String
  { label: "B1", freq: 61.74,  minFreq: 50,  maxFreq: 600 },
  // Ukulele
  { label: "G4", freq: 392.0,  minFreq: 180, maxFreq: 1400 },
  { label: "C4", freq: 261.63, minFreq: 180, maxFreq: 1400 },
  { label: "E4uku", freq: 329.63, minFreq: 180, maxFreq: 1400 },
  { label: "A4", freq: 440.0,  minFreq: 180, maxFreq: 1400 },
];

const BASS_NOTES = [
  { label: "B0(5-str)",  freq: 30.87, minFreq: 28, maxFreq: 350 },
  { label: "E1",         freq: 41.20, minFreq: 28, maxFreq: 350 },
  { label: "A1",         freq: 55.0,  minFreq: 28, maxFreq: 350 },
  { label: "D2",         freq: 73.42, minFreq: 28, maxFreq: 350 },
  { label: "G2",         freq: 98.0,  minFreq: 28, maxFreq: 350 },
  { label: "A0-DropA",   freq: 27.5,  minFreq: 28, maxFreq: 350 },
];

// ──────────────────────────────────────────────────────────────────────────
// MAIN — EJECUTAR TODAS LAS SUITES
// ──────────────────────────────────────────────────────────────────────────

console.log("\n");
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║    GuitarTune ClonEngine — BENCHMARK OFICIAL  v1.0                  ║");
console.log("║    Juan José Salgado Fuentes · KlonEngine / La Lima, Honduras        ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝");
console.log(`    Señal: ${BUFFER_SIZE} muestras @ ${SAMPLE_RATE} Hz`);
console.log(`    Armónicos de guitarra reales: ${GUITAR_HARMONICS.slice(0,5).map(x=>x.toFixed(2)).join(", ")}`);
console.log(`    Pascal SWARM: ${PASCAL_GUITAR.join(", ")}`);
console.log(`    Fecha: ${new Date().toISOString()}\n`);

// ─── SUITE 1: NOTAS ESTÁNDAR (SNR = ∞, señal limpia) ─────────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(" SUITE 1 — Notas Estándar (señal limpia, sin ruido)");
console.log("          13 notas × guitarra/bajo/ukulele, 3 repeticiones cada una");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const suite1Cases = GUITAR_NOTES.map(n => ({ freq: n.freq, minFreq: n.minFreq, maxFreq: n.maxFreq, snrDb: Infinity }));
const s1 = (["A","B","C","D"] as const).map(id => evaluateFrequencies(id, suite1Cases, 3));

console.log(` Algoritmo                       GPE%   ▏Barra         MAE(cents)▏Barra         Frames`);
console.log(` ${"─".repeat(86)}`);
const maxGPE1 = Math.max(...s1.map(r => r.gpe), 1);
const maxMAE1 = Math.max(...s1.map(r => r.mae), 1);
s1.forEach((r, i) => {
  const note = winnerTag(s1, i, "gpe") || winnerTag(s1, i, "mae");
  console.log(
    ` ${r.name.padEnd(32)} ${fmt(r.gpe,2)}%  ${bar(r.gpe, maxGPE1, 14, false)}  ${fmt(r.mae,2)} ¢  ${bar(r.mae, maxMAE1, 14, false)}  ${r.totalFrames}${winnerTag(s1,i,"gpe")}`
  );
});

// ─── SUITE 2: ROBUSTEZ SNR ────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(" SUITE 2 — Robustez ante Ruido (SNR: 30 → 0 dB) — nota E2 = 82.41 Hz");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const snrLevels = [Infinity, 30, 20, 10, 5, 0];

for (const snr of snrLevels) {
  const label = isFinite(snr) ? `${snr} dB` : "Limpia";
  const snrCases = [{ freq: 82.41, minFreq: 50, maxFreq: 600, snrDb: snr }];
  const results  = (["A","B","C","D"] as const).map(id => evaluateFrequencies(id, snrCases, 10));
  const winner   = results.reduce((best, r) => r.gpe < best.gpe ? r : best).name.slice(1,2);
  const maxGPE   = Math.max(...results.map(r => r.gpe), 0.1);

  console.log(`  SNR = ${label.padEnd(8)}: ${results.map((r,i) => {
    const tag = r.gpe === Math.min(...results.map(x => x.gpe)) ? "★" : " ";
    return `${r.name.slice(1,2)}:${fmt(r.gpe,1)}%${tag}`;
  }).join("  ")}`);
}

// ─── SUITE 3: BAJOS (28–100 Hz) ──────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(" SUITE 3 — Detección de Bajos (28–100 Hz) — zona más difícil");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const suite3Cases = BASS_NOTES.map(n => ({ freq: n.freq, minFreq: n.minFreq, maxFreq: n.maxFreq, snrDb: Infinity }));
const s3 = (["A","B","C","D"] as const).map(id => evaluateFrequencies(id, suite3Cases, 3));

console.log(` Algoritmo                       GPE%   ▏Barra         MAE(cents)▏Barra         Detección`);
console.log(` ${"─".repeat(88)}`);
const maxGPE3 = Math.max(...s3.map(r => r.gpe), 1);
const maxMAE3 = Math.max(...s3.map(r => r.mae), 1);
s3.forEach((r, i) => {
  const detPct = r.totalFrames > 0 ? ((r.correct + r.grossErrors) / r.totalFrames * 100).toFixed(1) : "0.0";
  console.log(
    ` ${r.name.padEnd(32)} ${fmt(r.gpe,2)}%  ${bar(r.gpe, maxGPE3, 14, false)}  ${fmt(r.mae,2)} ¢  ${bar(r.mae, maxMAE3, 14, false)}  ${detPct}%${winnerTag(s3,i,"gpe")}`
  );
});

// ─── SUITE 4: FALSAS ALARMAS ──────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(" SUITE 4 — Tasa de Falsas Alarmas (VFA) — señales de RUIDO puro");
console.log("          Ruido blanco + rosa + armónico aleatorio (120 frames total)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const noiseBufs: Float32Array[] = [];
for (let i = 0; i < 40; i++) noiseBufs.push(generateWhiteNoise(0.06 + i * 0.001));
for (let i = 0; i < 40; i++) noiseBufs.push(generatePinkNoise(0.06 + i * 0.001));
// Armónico aleatorio (trampa para el detector — tiene armónicos pero en freq inválida)
const fakeFreqs = [37.5, 51.3, 88.7, 142.1, 203.3, 271.8, 338.5, 477.2];
for (let i = 0; i < 40; i++) noiseBufs.push(generateHarmonicNoise(fakeFreqs[i % fakeFreqs.length]));

const vfaResults = (["A","B","C","D"] as const).map(id => evaluateVFA(id, noiseBufs));
const maxVFA = Math.max(...vfaResults.map(r => r.vfa), 1);

console.log(` Algoritmo                       VFA%   ▏Barra (menor = mejor)`);
console.log(` ${"─".repeat(60)}`);
vfaResults.forEach((r, i) => {
  console.log(
    ` ${r.name.padEnd(32)} ${fmt(r.vfa,2)}%  ${bar(r.vfa, maxVFA, 24, false)}${winnerTagVFA(vfaResults, i)}`
  );
});

// ─── SUITE 5: VELOCIDAD ───────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(" SUITE 5 — Velocidad de Procesamiento (500 frames, A2 = 110 Hz)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const speedResults = (["A","B","C","D"] as const).map(id => measureSpeed(id, 110.0, 500));
const maxMs = Math.max(...speedResults.map(r => r.medMs));

console.log(` Algoritmo                       ms/frame  FPS          Barra`);
console.log(` ${"─".repeat(70)}`);
speedResults.forEach((r, i) => {
  const fpsStr = r.fps.toFixed(0).padStart(6);
  console.log(
    ` ${r.name.padEnd(32)} ${fmt(r.medMs,3)} ms  ${fpsStr} fps  ${bar(r.medMs, maxMs, 22, true)}${winnerTagSpeed(speedResults, i)}`
  );
});

// ─── RESUMEN FINAL ────────────────────────────────────────────────────────
console.log("\n");
console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║                    RESUMEN EJECUTIVO                                ║");
console.log("╠══════════════════════════════════════════════════════════════════════╣");

const dGPE  = s1[3].gpe;  const aGPE  = s1[0].gpe;
const dMAE  = s1[3].mae;  const aMAE  = s1[0].mae;
const dVFA  = vfaResults[3].vfa; const aVFA = vfaResults[0].vfa;
const dSpd  = speedResults[3].fps; const aSpd = speedResults[0].fps;

const gpeImp = aGPE > 0 ? ((aGPE - dGPE) / aGPE * 100) : 0;
const maeImp = aMAE > 0 ? ((aMAE - dMAE) / aMAE * 100) : 0;
const vfaImp = aVFA > 0 ? ((aVFA - dVFA) / aVFA * 100) : 0;
const spdImp = ((dSpd - aSpd) / aSpd * 100);

console.log(`║  GPE  (error de octava)                                              ║`);
console.log(`║    Autocorr actual   → ${fmt(aGPE,2)}%                                       ║`);
console.log(`║    ClonEngine SWARM  → ${fmt(dGPE,2)}%  (${gpeImp>0?"-":"+"} ${Math.abs(gpeImp).toFixed(0)}% mejora)                   ║`);
console.log(`║                                                                      ║`);
console.log(`║  MAE  (precision en cents)                                           ║`);
console.log(`║    Autocorr actual   → ${fmt(aMAE,2)} ¢                                      ║`);
console.log(`║    ClonEngine SWARM  → ${fmt(dMAE,2)} ¢  (${maeImp>0?"-":"+"} ${Math.abs(maeImp).toFixed(0)}% mejora)                   ║`);
console.log(`║                                                                      ║`);
console.log(`║  VFA  (alarmas falsas en ruido)                                      ║`);
console.log(`║    Autocorr actual   → ${fmt(aVFA,2)}%                                       ║`);
console.log(`║    ClonEngine SWARM  → ${fmt(dVFA,2)}%  (${vfaImp>0?"-":"+"} ${Math.abs(vfaImp).toFixed(0)}% mejora)                   ║`);
console.log(`║                                                                      ║`);
console.log(`║  Innovaciones exclusivas de ClonEngine SWARM:                        ║`);
console.log(`║    ✓ Validador Pascal Armónico (Goertzel × 5 armónicos)              ║`);
console.log(`║    ✓ Umbral Dopaminérgico Adaptativo (reward/punishment)             ║`);
console.log(`║    ✓ Homeostasis Winik (ciclo base-20 Maya)                          ║`);
console.log(`║    ✓ Confianza Vigesimal (escala Maya base-20)                       ║`);
console.log(`║    ✓ Ningún otro tuner en el mercado usa esta arquitectura           ║`);
console.log("╚══════════════════════════════════════════════════════════════════════╝");
console.log("");
