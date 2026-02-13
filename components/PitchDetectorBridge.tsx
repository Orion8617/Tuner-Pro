import { useRef, useCallback, useEffect } from "react";
import { View, Platform } from "react-native";
import { WebView } from "react-native-webview";

interface PitchData {
  frequency: number;
  note: string;
  octave: number;
  cents: number;
}

interface PitchDetectorBridgeProps {
  isListening: boolean;
  onPitchDetected: (data: PitchData) => void;
  onSilence: () => void;
  onError: (error: string) => void;
  onReady?: () => void;
}

const PITCH_DETECTOR_HTML = `
<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000">
<script>
const ALL_NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
let audioContext = null;
let analyser = null;
let stream = null;
let running = false;
let silenceCount = 0;
const history = [];
const MAX_HIST = 6;
const MIN_READINGS = 3;

function frequencyToNote(freq) {
  const noteNum = 12 * Math.log2(freq / 440);
  const rounded = Math.round(noteNum);
  const cents = Math.round((noteNum - rounded) * 100);
  let idx = ((rounded % 12) + 12 + 9) % 12;
  const octave = Math.floor((rounded + 9) / 12) + 4;
  return { note: ALL_NOTES[idx], octave, cents };
}

function autoCorrelate(buf, sampleRate) {
  let size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.025) return -1;

  let r1 = 0, r2 = size - 1;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buf[i]) < 0.1) { r1 = i; break; }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buf[size - i]) < 0.1) { r2 = size - i; break; }
  }

  const tb = buf.slice(r1, r2);
  size = tb.length;
  if (size < 2) return -1;

  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] += tb[j] * tb[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) { d++; if (d >= size - 1) return -1; }

  let maxval = -1, maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }

  if (maxpos < 1 || maxpos >= size - 1) return -1;
  const conf = maxval / c[0];

  let T0 = maxpos;
  const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b2 = (x3 - x1) / 2;
  if (a) T0 = T0 - b2 / (2 * a);

  const freq = sampleRate / T0;
  if (freq < 50 || freq > 500) return -1;
  const minConf = freq > 250 ? 0.5 : 0.6;
  if (conf < minConf) return -1;
  return freq;
}

function stabilize(freq) {
  if (freq <= 0) {
    silenceCount++;
    if (silenceCount >= 8) { history.length = 0; return null; }
    return history.length >= MIN_READINGS ? getMedian() : null;
  }
  silenceCount = 0;
  if (history.length > 0) {
    const last = history[history.length - 1];
    if (Math.abs(1200 * Math.log2(freq / last)) > 400) {
      history.length = 0;
      history.push(freq);
      return null;
    }
  }
  history.push(freq);
  if (history.length > MAX_HIST) history.shift();
  if (history.length < MIN_READINGS) return null;
  const sorted = [...history].sort((a, b) => a - b);
  const range = 1200 * Math.log2(sorted[sorted.length - 1] / sorted[0]);
  if (range > 60) return null;
  return getMedian();
}

function getMedian() {
  const sorted = [...history].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function send(msg) {
  try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {}
}

async function startAudio() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    running = true;
    history.length = 0;
    silenceCount = 0;
    send({ type: "ready" });
    tick();
  } catch (e) {
    send({ type: "error", message: e.message || "Microphone access denied" });
  }
}

function tick() {
  if (!running || !analyser) return;
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  const raw = autoCorrelate(buf, audioContext.sampleRate);
  const stable = stabilize(raw);
  if (stable !== null && stable > 50 && stable < 500) {
    const info = frequencyToNote(stable);
    send({ type: "pitch", frequency: stable, note: info.note, octave: info.octave, cents: info.cents });
  } else if (raw <= 0 && silenceCount >= 8) {
    send({ type: "silence" });
  }
  requestAnimationFrame(tick);
}

function stopAudio() {
  running = false;
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (audioContext) { audioContext.close(); audioContext = null; }
  analyser = null;
  history.length = 0;
}

document.addEventListener("message", function(e) {
  try {
    const msg = JSON.parse(e.data);
    if (msg.command === "start") startAudio();
    else if (msg.command === "stop") stopAudio();
  } catch(err) {}
});

window.addEventListener("message", function(e) {
  try {
    const msg = JSON.parse(e.data);
    if (msg.command === "start") startAudio();
    else if (msg.command === "stop") stopAudio();
  } catch(err) {}
});
</script>
</body>
</html>
`;

export default function PitchDetectorBridge({
  isListening,
  onPitchDetected,
  onSilence,
  onError,
  onReady,
}: PitchDetectorBridgeProps) {
  const webViewRef = useRef<WebView>(null);
  const wasListening = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    if (isListening && !wasListening.current) {
      setTimeout(() => {
        webViewRef.current?.postMessage(JSON.stringify({ command: "start" }));
      }, 300);
    } else if (!isListening && wasListening.current) {
      webViewRef.current?.postMessage(JSON.stringify({ command: "stop" }));
    }
    wasListening.current = isListening;
  }, [isListening]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "pitch") {
        onPitchDetected({
          frequency: data.frequency,
          note: data.note,
          octave: data.octave,
          cents: data.cents,
        });
      } else if (data.type === "silence") {
        onSilence();
      } else if (data.type === "error") {
        onError(data.message);
      } else if (data.type === "ready") {
        onReady?.();
      }
    } catch {}
  }, [onPitchDetected, onSilence, onError, onReady]);

  if (Platform.OS === "web") return null;

  return (
    <View style={{ width: 0, height: 0, overflow: "hidden", position: "absolute" }}>
      <WebView
        ref={webViewRef}
        source={{ html: PITCH_DETECTOR_HTML }}
        originWhitelist={["*"]}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        mediaCapturePermissionGrantType="grant"
        style={{ width: 1, height: 1 }}
      />
    </View>
  );
}
