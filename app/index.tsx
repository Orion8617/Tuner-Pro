import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import TunerDial from "@/components/TunerDial";
import TuningSelector from "@/components/TuningSelector";
import PitchDetectorBridge from "@/components/PitchDetectorBridge";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ALL_TUNINGS,
  TuningConfig,
  GuitarString,
  ReferenceA4,
  REFERENCE_A4_OPTIONS,
  frequencyToNote,
  findClosestString,
  getCentsFromTarget,
  getTuningStatus,
  autoCorrelateHybrid,
  swarmEngine,
  rstdpEngine,
  FrequencyStabilizer,
  getInstrumentFreqRange,
  scaleStringsToReference,
  computeNEATAudio,
  getMayaPitchSignature,
} from "@/lib/tuner-engine";

const RSTDP_WEIGHTS_KEY = "rstdp_weights_v1";

const ACCENT = "#4AEDC4";
const ACCENT_DIM = "rgba(74, 237, 196, 0.13)";
const ACCENT_MED = "rgba(74, 237, 196, 0.32)";
const ACCENT_BRIGHT = "rgba(74, 237, 196, 0.75)";
const RED = "#FF4444";
const ORANGE = "#FF9544";
const BG = "#080808";
const BG_SURFACE = "#0E0E0E";
const SURFACE = "#111111";
const SURFACE_LIGHT = "#181818";
const SURFACE_ELEVATED = "#1C1C1C";
const TEXT_DIM = "rgba(255, 255, 255, 0.2)";
const TEXT_MED = "rgba(255, 255, 255, 0.45)";
const TEXT_BRIGHT = "rgba(255, 255, 255, 0.85)";
const CONFIDENCE_LOCKED_THRESHOLD = 0.75;
const CONFIDENCE_SEARCHING_THRESHOLD = 0.35;

function withAlpha(color: string, alpha: number): string {
  const normalizedAlpha = Math.max(0, Math.min(1, alpha));
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const normalizedHex = hex.length === 3
      ? hex.split("").map((char) => char + char).join("")
      : hex;
    if (normalizedHex.length === 6) {
      const r = parseInt(normalizedHex.slice(0, 2), 16);
      const g = parseInt(normalizedHex.slice(2, 4), 16);
      const b = parseInt(normalizedHex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
    }
  }

  const rgbaMatch = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgbaMatch) {
    const [r = "255", g = "255", b = "255"] = rgbaMatch[1].split(",").map((part) => part.trim());
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
  }

  return color;
}

function StringVisual({
  str,
  isActive,
  isTuned,
  isInTune,
  statusColor,
  thickness,
  xPos,
}: {
  str: GuitarString;
  isActive: boolean;
  isTuned: boolean;
  isInTune: boolean;
  statusColor: string;
  thickness: number;
  xPos: number;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const prevTuned = useRef(false);

  useEffect(() => {
    if (isTuned && !prevTuned.current) {
      scale.value = withSequence(
        withSpring(1.8, { damping: 6, stiffness: 220 }),
        withSpring(1.2, { damping: 10, stiffness: 150 }),
        withTiming(1, { duration: 400 })
      );
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0.5, { duration: 600 }),
        withTiming(0.3, { duration: 800 })
      );
      checkOpacity.value = withSequence(
        withTiming(0, { duration: 80 }),
        withTiming(1, { duration: 280, easing: Easing.out(Easing.back(1.5)) })
      );
    } else if (!isTuned) {
      checkOpacity.value = withTiming(0, { duration: 200 });
      glowOpacity.value = withTiming(0, { duration: 300 });
      scale.value = withTiming(1, { duration: 200 });
    }
    prevTuned.current = isTuned;
  }, [isTuned]);

  useEffect(() => {
    if (isActive && isInTune) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else if (isActive && !isTuned) {
      glowOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isActive, isInTune]);

  const stringStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkOpacity.value }],
  }));

  const baseColor = isActive
    ? (isInTune ? ACCENT : statusColor)
    : isTuned ? ACCENT_MED : "rgba(255,255,255,0.09)";

  const glowColor = isTuned ? ACCENT : ACCENT_MED;

  return (
    <View
      style={{
        position: "absolute",
        left: xPos - thickness / 2,
        top: 0,
        bottom: 0,
        width: thickness,
        alignItems: "center",
      }}
    >
      {(isActive || isTuned) && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              width: thickness + 10,
              backgroundColor: glowColor,
              borderRadius: 6,
            },
            glowStyle,
          ]}
        />
      )}

      <Animated.View
        style={[
          {
            width: thickness,
            height: "100%",
            backgroundColor: baseColor,
            borderRadius: thickness / 2,
          },
          ...(Platform.OS === "web" && isActive
            ? [{
                boxShadow: `0 0 ${isInTune ? 14 : 6}px ${isInTune ? "rgba(74, 237, 196, 0.5)" : "rgba(255,255,255,0.06)"}`,
              } as any]
            : []),
          stringStyle,
        ]}
      />
    </View>
  );
}

function StringIndicator({
  str,
  isActive,
  isTuned,
  isInTune,
  statusColor,
}: {
  str: GuitarString;
  isActive: boolean;
  isTuned: boolean;
  isInTune: boolean;
  statusColor: string;
}) {
  const dotScale = useSharedValue(1);
  const dotGlow = useSharedValue(0);
  const prevTuned = useRef(false);

  useEffect(() => {
    if (isTuned && !prevTuned.current) {
      dotScale.value = withSequence(
        withSpring(1.5, { damping: 5, stiffness: 300 }),
        withSpring(1.1, { damping: 10, stiffness: 200 }),
        withTiming(1, { duration: 300 })
      );
      dotGlow.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0.5, { duration: 500 })
      );
    } else if (!isTuned) {
      dotScale.value = withTiming(1, { duration: 200 });
      dotGlow.value = withTiming(0, { duration: 200 });
    }
    prevTuned.current = isTuned;
  }, [isTuned]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity: dotGlow.value * 0.5 + 0.5,
  }));

  const strColor = isActive
    ? (isInTune ? ACCENT : statusColor)
    : isTuned ? ACCENT_MED : TEXT_DIM;

  return (
    <View style={styles.stringItem}>
      <Animated.View style={dotStyle}>
        <Text style={[styles.stringNote, { color: strColor }]}>
          {str.note}
          <Text style={styles.stringOctaveSub}>{str.octave}</Text>
        </Text>
      </Animated.View>
      <Text style={[styles.stringFreq, { color: isActive ? strColor : TEXT_DIM }]}>
        {str.frequency.toFixed(1)}Hz
      </Text>
      {isTuned && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{ marginTop: 2 }}
        >
          <Ionicons name="checkmark-circle" size={10} color={ACCENT} />
        </Animated.View>
      )}
    </View>
  );
}

export default function TunerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [currentTuning, setCurrentTuning] = useState<TuningConfig>(ALL_TUNINGS[0]);
  const [referenceA4, setReferenceA4] = useState<ReferenceA4>(440);
  const [isListening, setIsListening] = useState(false);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [detectedOctave, setDetectedOctave] = useState<number | null>(null);
  const [detectedFrequency, setDetectedFrequency] = useState(0);
  const [cents, setCents] = useState(0);
  const [detectedString, setDetectedString] = useState<GuitarString | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [tunedStrings, setTunedStrings] = useState<Set<number>>(new Set());
  const [confidence, setConfidence] = useState(0);
  const [neatAudio, setNeatAudio] = useState(-1);
  const [gabaLevel, setGabaLevel] = useState(0);
  const [iecScore, setIecScore] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastHapticRef = useRef<number>(0);
  const wasInTuneRef = useRef(false);
  const stabilizerRef = useRef(new FrequencyStabilizer());
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTuningRef = useRef<TuningConfig>(ALL_TUNINGS[0]);

  const micPulseOpacity = useSharedValue(0);
  const micButtonScale = useSharedValue(1);
  const screenOpacity = useSharedValue(0);

  const safeTop = Platform.OS === "web" ? 67 : insets.top;
  const safeBottom = Platform.OS === "web" ? 34 : insets.bottom;

  const freqRange = getInstrumentFreqRange(currentTuning);
  const scaledStrings = scaleStringsToReference(currentTuning.strings, referenceA4);

  const isDetecting = isListening && detectedFrequency > 0;
  const tuningStatus = isDetecting ? getTuningStatus(cents) : null;
  const isInTune = tuningStatus === "in_tune";

  function cycleReferenceA4() {
    setReferenceA4(prev => {
      const idx = REFERENCE_A4_OPTIONS.indexOf(prev);
      return REFERENCE_A4_OPTIONS[(idx + 1) % REFERENCE_A4_OPTIONS.length];
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const dialSize = Math.min(screenWidth * 0.95, 380);

  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
  }, []);

  useEffect(() => {
    if (isListening) {
      micPulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.45, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      micPulseOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [isListening]);

  useEffect(() => {
    if (tuningStatus === "in_tune" && detectedString) {
      setTunedStrings(prev => {
        if (prev.has(detectedString.stringNumber)) return prev;
        const next = new Set(prev);
        next.add(detectedString.stringNumber);
        return next;
      });
    }
  }, [tuningStatus, detectedString]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    flex: 1,
  }));

  const micPulseStyle = useAnimatedStyle(() => ({
    opacity: micPulseOpacity.value,
  }));
  const micScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micButtonScale.value }],
  }));

  function triggerInTuneHaptic(currentCents: number) {
    const now = Date.now();
    const inTune = Math.abs(currentCents) <= 5;
    if (inTune && !wasInTuneRef.current && now - lastHapticRef.current > 500) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 80);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 200);
      lastHapticRef.current = now;
    }
    wasInTuneRef.current = inTune;
  }

  const referenceA4Ref = useRef<ReferenceA4>(440);
  useEffect(() => { referenceA4Ref.current = referenceA4; }, [referenceA4]);

  const handleNativePitch = useCallback((data: { frequency: number; note: string; octave: number; cents: number }) => {
    if (silenceTimeoutRef.current) { clearTimeout(silenceTimeoutRef.current); silenceTimeoutRef.current = null; }
    const rawFreq = data.frequency;
    const range = getInstrumentFreqRange(currentTuningRef.current);

    // ── SwarmEngine + FrequencyStabilizer (same pipeline as web path) ──────
    swarmEngine.updateDopamineFromFreq(rawFreq);
    const stableFreq = stabilizerRef.current.push(rawFreq, swarmEngine.getDopamine());
    setConfidence(stabilizerRef.current.getConfidence());
    setGabaLevel(stabilizerRef.current.getGabaLevel());

    // Only update display with a range-validated frequency
    const validStable = stableFreq !== null && stableFreq >= range.min && stableFreq <= range.max;
    const validRaw = rawFreq >= range.min && rawFreq <= range.max;
    const freq = validStable ? stableFreq : validRaw ? rawFreq : null;
    if (freq === null) return;

    const scaled = scaleStringsToReference(currentTuningRef.current.strings, referenceA4Ref.current);
    const closest = findClosestString(freq, scaled, range.min, range.max);
    const noteInfo = frequencyToNote(freq, referenceA4Ref.current);
    setDetectedFrequency(freq);
    setDetectedNote(noteInfo.note);
    setDetectedOctave(noteInfo.octave);
    setDetectedString(closest);
    if (closest) {
      const c = getCentsFromTarget(freq, closest.frequency);
      setCents(c);
      triggerInTuneHaptic(c);
    } else {
      setCents(noteInfo.cents);
    }
  }, []);

  const handleNativeSilence = useCallback(() => {
    swarmEngine.updateDopamineFromFreq(-1);
    stabilizerRef.current.push(-1, swarmEngine.getDopamine());
    setGabaLevel(stabilizerRef.current.getGabaLevel());
    if (!silenceTimeoutRef.current) {
      silenceTimeoutRef.current = setTimeout(() => {
        setDetectedFrequency(0); setDetectedNote(null); setDetectedOctave(null);
        setDetectedString(null); setCents(0); setConfidence(0); silenceTimeoutRef.current = null;
      }, 800);
    }
  }, []);

  const handleNativeError = useCallback((msg: string) => {
    setPermissionDenied(true);
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    if (Platform.OS !== "web") {
      setIsListening(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);
      analyserRef.current = analyser;
      setIsListening(true);
      detectPitch();
    } catch (err: any) {
      const msg = err?.name || err?.message || "unknown";
      if (msg === "NotAllowedError" || msg.includes("denied") || msg.includes("Permission")) {
        setPermissionDenied(true);
      } else if (msg === "NotFoundError" || msg.includes("device") || msg.includes("found")) {
        setPermissionDenied(true);
      } else {
        setPermissionDenied(true);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    wasInTuneRef.current = false;
    stabilizerRef.current.reset();
    if (silenceTimeoutRef.current) { clearTimeout(silenceTimeoutRef.current); silenceTimeoutRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    analyserRef.current = null;
  }, []);

  useEffect(() => () => { stopListening(); }, []);

  // ── R-STDP weight lifecycle ────────────────────────────────────────────
  // Carga pesos aprendidos de sesiones anteriores (AsyncStorage)
  // Sesión 2+ arranca ya especializada en la guitarra del usuario — cero warmup
  useEffect(() => {
    AsyncStorage.getItem(RSTDP_WEIGHTS_KEY).then((raw) => {
      if (raw) {
        try {
          const w = JSON.parse(raw) as number[];
          rstdpEngine.loadWeights(w);
        } catch {}
      }
    });
    return () => {
      // Guardar pesos al desmontar (cambio de pantalla / cerrar app)
      AsyncStorage.setItem(RSTDP_WEIGHTS_KEY, JSON.stringify(rstdpEngine.getWeights()));
    };
  }, []);

  function detectPitch() {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    if (!analyser || !audioContext) return;
    const buffer = new Float32Array(analyser.fftSize);
    stabilizerRef.current.reset();
    function tick() {
      if (!analyserRef.current) return;
      analyserRef.current.getFloatTimeDomainData(buffer);
      const range = getInstrumentFreqRange(currentTuningRef.current);
      const rawFrequency = autoCorrelateHybrid(buffer, audioContext!.sampleRate, range.min, range.max);
      const stableFrequency = stabilizerRef.current.push(rawFrequency, swarmEngine.getDopamine());
      setConfidence(stabilizerRef.current.getConfidence());
      setNeatAudio(computeNEATAudio(buffer, rawFrequency, stableFrequency));
      setGabaLevel(stabilizerRef.current.getGabaLevel());
      setIecScore(rstdpEngine.getConvergenceScore());
      if (stableFrequency !== null && stableFrequency >= range.min && stableFrequency <= range.max) {
        if (silenceTimeoutRef.current) { clearTimeout(silenceTimeoutRef.current); silenceTimeoutRef.current = null; }
        const noteInfo = frequencyToNote(stableFrequency, referenceA4Ref.current);
        const scaled = scaleStringsToReference(currentTuningRef.current.strings, referenceA4Ref.current);
        const closest = findClosestString(stableFrequency, scaled, range.min, range.max);
        setDetectedFrequency(stableFrequency);
        setDetectedNote(noteInfo.note);
        setDetectedOctave(noteInfo.octave);
        setDetectedString(closest);
        if (closest) {
          const c = getCentsFromTarget(stableFrequency, closest.frequency);
          setCents(c);
          triggerInTuneHaptic(c);
        } else {
          setCents(noteInfo.cents);
        }
      } else if (rawFrequency <= 0 && !silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          setDetectedFrequency(0); setDetectedNote(null); setDetectedOctave(null);
          setDetectedString(null); setCents(0); setConfidence(0); setNeatAudio(-1); silenceTimeoutRef.current = null;
        }, 800);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();
  }

  function toggleListening() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    micButtonScale.value = withSequence(
      withSpring(0.86, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 6, stiffness: 120 })
    );
    if (isListening) stopListening(); else startListening();
  }

  function handleTuningSelect(tuning: TuningConfig) {
    currentTuningRef.current = tuning;
    setCurrentTuning(tuning);
    setDetectedString(null); setDetectedNote(null); setDetectedOctave(null);
    setDetectedFrequency(0); setCents(0); setTunedStrings(new Set());
    stabilizerRef.current.reset();
  }

  const instrumentIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
    guitar: "musical-notes-outline",
    bass: "musical-notes-outline",
    ukulele: "musical-note-outline",
    other: "musical-notes-outline",
  };

  const instrumentLabel: Record<string, string> = {
    guitar: t("instrument.guitar"),
    bass: t("instrument.bass"),
    ukulele: t("instrument.ukulele"),
    other: t("instrument.other"),
  };

  const statusColor = isInTune ? ACCENT
    : tuningStatus === "flat" || tuningStatus === "sharp"
    ? Math.abs(cents) > 25 ? RED : Math.abs(cents) > 10 ? ORANGE : ACCENT_BRIGHT
    : TEXT_DIM;

  const centsQ20 = Math.round(cents / 5) * 5;
  const centsDisplay = isDetecting
    ? `${String(Math.abs(centsQ20)).padStart(3, "0")}.0`
    : "000.0";
  const mayaSignature = getMayaPitchSignature(cents, confidence);
  const confidenceState = confidence > CONFIDENCE_LOCKED_THRESHOLD
    ? t("tuner.signalLocked")
    : confidence > CONFIDENCE_SEARCHING_THRESHOLD
    ? t("tuner.signalSearching")
    : t("tuner.signalUnstable");

  const sortedScaledStrings = [...scaledStrings].sort((a, b) => a.stringNumber - b.stringNumber);

  const stringAreaWidth = Math.min(screenWidth - 40, 360);
  const numStrings = sortedScaledStrings.length;
  const stringSpacing = stringAreaWidth / (numStrings + 1);
  const thicknesses = [3.5, 3, 2.5, 2, 1.5, 1.2, 1.0];

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <StatusBar style="light" />

      <PitchDetectorBridge
        isListening={isListening}
        onPitchDetected={handleNativePitch}
        onSilence={handleNativeSilence}
        onError={handleNativeError}
      />

      <Animated.View style={screenStyle}>
        {/* ===== TOP BAR ===== */}
        <View style={[styles.topBar, { top: safeTop }]}>
          <Pressable
            style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (user) router.push("/premium"); else router.push("/(auth)/login");
            }}
          >
            {user ? (
              <View style={styles.userChip}>
                <Ionicons name="person" size={10} color={ACCENT} />
                <Text style={styles.userChipText} numberOfLines={1}>{user.username}</Text>
              </View>
            ) : (
              <Ionicons name="person-circle-outline" size={20} color={TEXT_MED} />
            )}
          </Pressable>

          <TuningSelector
            currentTuning={currentTuning}
            onSelect={handleTuningSelect}
            isPremiumUser={!!user?.isPremium}
            onPremiumRequired={() => router.push("/premium")}
          />

          <View style={styles.topRightGroup}>
            <View style={styles.micBtnWrap}>
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: ACCENT,
                  },
                  micPulseStyle,
                ]}
              />
              <Animated.View style={micScaleStyle}>
                <Pressable
                  style={[styles.micBtnSmall, isListening && styles.micBtnActive]}
                  onPress={toggleListening}
                >
                  <Ionicons
                    name={isListening ? "stop" : "mic"}
                    size={16}
                    color={isListening ? RED : TEXT_BRIGHT}
                  />
                </Pressable>
              </Animated.View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.topBtn, pressed && styles.topBtnPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (user?.id === "admin-juanjose-klonengine-2025") {
                  router.push("/admin");
                } else {
                  router.push("/premium");
                }
              }}
            >
              {user?.id === "admin-juanjose-klonengine-2025" ? (
                <View style={styles.adminChip}>
                  <Ionicons name="shield-checkmark" size={10} color="#E8C547" />
                  <Text style={styles.adminChipText}>ADMIN</Text>
                </View>
              ) : user?.isPremium ? (
                <View style={styles.proChip}>
                  <Ionicons name="diamond" size={10} color={ACCENT} />
                  <Text style={styles.proChipText}>PRO</Text>
                </View>
              ) : (
                <Ionicons name="settings-outline" size={18} color={TEXT_MED} />
              )}
            </Pressable>
          </View>
        </View>

        {/* ===== MAIN CONTENT ===== */}
        <View style={{ flex: 1, paddingTop: safeTop + 44 }}>
          {/* ===== DIAL with integrated displays ===== */}
          <View style={styles.dialContainer}>
            <TunerDial
              cents={cents}
              isActive={isDetecting}
              size={dialSize}
              note={detectedNote}
              octave={detectedOctave}
              frequency={detectedFrequency}
              statusColor={statusColor}
              centsDisplay={centsDisplay}
              isInTune={isInTune}
            />
          </View>

          {/* ===== CONFIDENCE BAR (GDOP-inspired) + NEAT-Audio ===== */}
          {isListening && (
            <View style={styles.signalBlock}>
              <View style={styles.confidenceWrap}>
                <Text style={styles.gdopLabel}>GDOP</Text>
                <View style={styles.confidenceTrack}>
                  <View
                    style={[
                      styles.confidenceFill,
                      {
                        width: `${Math.round(confidence * 100)}%` as any,
                        backgroundColor: isInTune ? ACCENT
                          : confidence > 0.6 ? ACCENT_BRIGHT
                          : confidence > 0.3 ? ORANGE
                          : "rgba(255,255,255,0.15)",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.confidenceLabel}>
                  {Math.round(confidence * 100)}%
                </Text>
              </View>

              <View style={styles.telemetryRow}>
                <View style={styles.mayaRow}>
                  <Text style={styles.mayaTag}>{t("tuner.mayaQ20")}</Text>
                  <Text style={styles.mayaGlyph}>
                    {isDetecting ? mayaSignature.signature : "◎ ┃ ◎"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.signalStatePill,
                    {
                      borderColor: isDetecting ? withAlpha(statusColor, 0.18) : "rgba(255,255,255,0.08)",
                      backgroundColor: isDetecting ? withAlpha(statusColor, 0.08) : "rgba(255,255,255,0.04)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.signalStateText,
                      { color: isDetecting ? statusColor : TEXT_MED },
                    ]}
                  >
                    {confidenceState}
                  </Text>
                </View>
              </View>

              {Platform.OS === "web" && neatAudio >= 0 && (
                <View style={styles.neatRow}>
                  <Text style={styles.neatTag}>ENV</Text>
                  <View style={[
                    styles.neatDot,
                    { backgroundColor: neatAudio < 30 ? ACCENT : neatAudio < 60 ? ORANGE : RED }
                  ]} />
                  <Text style={[
                    styles.neatStatus,
                    { color: neatAudio < 30 ? ACCENT : neatAudio < 60 ? ORANGE : RED }
                  ]}>
                    {neatAudio < 30 ? "IDEAL" : neatAudio < 60 ? "NOISY" : "TOO LOUD"}
                  </Text>
                  <Text style={styles.neatValue}>{neatAudio}</Text>
                </View>
              )}
            </View>
          )}

          {/* ===== INSTRUMENT + REFERENCE PITCH ROW ===== */}
          <View style={styles.metaRow}>
            {currentTuning.instrument !== "guitar" && (
              <View style={styles.instrumentBadge}>
                <Ionicons
                  name={instrumentIcon[currentTuning.instrument] ?? "musical-notes-outline"}
                  size={9}
                  color={ACCENT}
                />
                <Text style={styles.instrumentBadgeText}>
                  {instrumentLabel[currentTuning.instrument]}
                </Text>
              </View>
            )}
            <Pressable
              onPress={cycleReferenceA4}
              style={({ pressed }) => [
                styles.refPitchPill,
                referenceA4 !== 440 && styles.refPitchPillActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[
                styles.refPitchText,
                referenceA4 !== 440 && { color: ACCENT },
              ]}>
                A = {referenceA4}
              </Text>
            </Pressable>
          </View>

          {/* ===== STATUS INDICATOR ===== */}
          <View style={styles.statusRow}>
            {isDetecting && tuningStatus ? (
              <View style={[styles.statusIndicator, { borderColor: statusColor + "30", backgroundColor: statusColor + "0D" }]}>
                <Ionicons
                  name={isInTune ? "checkmark-circle" : tuningStatus === "flat" ? "arrow-down" : "arrow-up"}
                  size={14}
                  color={statusColor}
                />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {isInTune ? t("noteDisplay.inTune") : tuningStatus === "flat" ? t("noteDisplay.flat") : t("noteDisplay.sharp")}
                </Text>
              </View>
            ) : (
              <Text style={styles.placeholderText}>
                {permissionDenied ? t("tuner.permissionDenied") : isListening ? t("tuner.playString") : ""}
              </Text>
            )}
          </View>

          {/* ===== STRING SELECTOR ===== */}
          <View style={styles.stringSelector}>
            {scaledStrings
              .slice()
              .sort((a, b) => a.stringNumber - b.stringNumber)
              .map((str) => {
                const isActive = detectedString?.stringNumber === str.stringNumber;
                const isTuned = tunedStrings.has(str.stringNumber);
                return (
                  <StringIndicator
                    key={str.stringNumber}
                    str={str}
                    isActive={isActive}
                    isTuned={isTuned}
                    isInTune={isInTune}
                    statusColor={statusColor}
                  />
                );
              })}
          </View>

          {/* ===== IEC CONVERGENCE + GABA STATUS (KlonEngine R-STDP) ===== */}
          {isListening && (
            <View style={styles.iecRow}>
              <Text style={styles.iecLabel}>IEC</Text>
              <View style={styles.iecTrack}>
                <View
                  style={[
                    styles.iecFill,
                    {
                      width: `${Math.round(iecScore * 100)}%` as any,
                      backgroundColor:
                        iecScore > 0.75 ? ACCENT
                        : iecScore > 0.4 ? ORANGE
                        : "rgba(255,255,255,0.12)",
                    },
                  ]}
                />
              </View>
              <Text style={[
                styles.iecValue,
                { color: iecScore > 0.75 ? ACCENT : iecScore > 0.4 ? ORANGE : TEXT_DIM },
              ]}>
                {Math.round(iecScore * 100)}
              </Text>
              {gabaLevel > 0.6 && (
                <View style={styles.gabaTag}>
                  <Text style={styles.gabaText}>GABA</Text>
                </View>
              )}
            </View>
          )}

          {/* ===== KLONENGINE ATTRIBUTION ===== */}
          <View style={styles.attributionRow}>
            <Text style={styles.attributionText}>KlonEngine · SNN+R-STDP · GDOP · GABA · IEC</Text>
          </View>

          {/* ===== STRINGS VISUAL ===== */}
          <View style={[styles.stringsVisual, { width: stringAreaWidth, marginBottom: safeBottom + 10 }]}>
            {sortedScaledStrings.map((str, i) => {
              const isActive = detectedString?.stringNumber === str.stringNumber;
              const isTuned = tunedStrings.has(str.stringNumber);
              const thickness = thicknesses[i] || 1.0;
              const xPos = stringSpacing * (i + 1);

              return (
                <StringVisual
                  key={str.stringNumber}
                  str={str}
                  isActive={isActive}
                  isTuned={isTuned}
                  isInTune={isInTune}
                  statusColor={statusColor}
                  thickness={thickness}
                  xPos={xPos}
                />
              );
            })}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 44,
    zIndex: 20,
  },
  topBtn: { padding: 6, minWidth: 34 },
  topBtnPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: SURFACE_ELEVATED,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(74, 237, 196, 0.12)",
  },
  userChipText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: ACCENT,
    maxWidth: 50,
  },
  proChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: ACCENT_DIM,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 237, 196, 0.18)",
  },
  proChipText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: ACCENT,
    letterSpacing: 0.5,
  },
  adminChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(232,197,71,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(232,197,71,0.25)",
  },
  adminChipText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: "#E8C547",
    letterSpacing: 0.5,
  },
  dialContainer: {
    alignItems: "center",
    marginTop: 0,
  },
  statusRow: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    minHeight: 28,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  placeholderText: {
    fontSize: 11,
    color: TEXT_DIM,
    fontWeight: "500" as const,
    letterSpacing: 0.3,
  },
  stringSelector: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  stringItem: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: 6,
  },
  stringNote: {
    fontSize: 15,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  stringOctaveSub: {
    fontSize: 9,
    fontWeight: "400" as const,
  },
  stringFreq: {
    fontSize: 7.5,
    fontWeight: "500" as const,
    marginTop: 2,
    fontVariant: ["tabular-nums"] as any,
  },
  stringsVisual: {
    flex: 1,
    alignSelf: "center",
    marginTop: 10,
    minHeight: 60,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
    minHeight: 20,
  },
  instrumentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(74, 237, 196, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 237, 196, 0.15)",
  },
  instrumentBadgeText: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: ACCENT,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
  refPitchPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  refPitchPillActive: {
    borderColor: "rgba(74, 237, 196, 0.2)",
    backgroundColor: "rgba(74, 237, 196, 0.06)",
  },
  refPitchText: {
    fontSize: 9,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.4,
    fontVariant: ["tabular-nums"] as any,
  },
  topRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  micBtnWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SURFACE_LIGHT,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: "rgba(255, 68, 68, 0.12)",
    borderColor: "rgba(255, 68, 68, 0.28)",
  },
  signalBlock: {
    marginTop: 8,
    gap: 4,
  },
  confidenceWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  gdopLabel: {
    fontSize: 8,
    fontWeight: "700" as const,
    color: "rgba(74, 237, 196, 0.35)",
    letterSpacing: 0.8,
    width: 30,
  },
  confidenceTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 2,
    overflow: "hidden",
  },
  confidenceFill: {
    height: 3,
    borderRadius: 2,
  },
  confidenceLabel: {
    fontSize: 9,
    fontWeight: "600" as const,
    color: TEXT_DIM,
    letterSpacing: 0.5,
    width: 26,
    textAlign: "right" as const,
    fontVariant: ["tabular-nums"] as any,
  },
  telemetryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    gap: 10,
  },
  mayaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  mayaTag: {
    fontSize: 8,
    fontWeight: "700" as const,
    color: "rgba(74, 237, 196, 0.35)",
    letterSpacing: 0.8,
    width: 52,
  },
  mayaGlyph: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: ACCENT,
    letterSpacing: 0.3,
    flex: 1,
  },
  signalStatePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  signalStateText: {
    fontSize: 8,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  neatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 6,
  },
  neatTag: {
    fontSize: 8,
    fontWeight: "700" as const,
    color: "rgba(74, 237, 196, 0.35)",
    letterSpacing: 0.8,
    width: 30,
  },
  neatDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  neatStatus: {
    fontSize: 8,
    fontWeight: "700" as const,
    letterSpacing: 1.0,
    flex: 1,
  },
  neatValue: {
    fontSize: 8,
    fontWeight: "500" as const,
    color: TEXT_DIM,
    fontVariant: ["tabular-nums"] as any,
    width: 26,
    textAlign: "right" as const,
  },
  attributionRow: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 2,
  },
  attributionText: {
    fontSize: 7,
    fontWeight: "500" as const,
    color: "rgba(74, 237, 196, 0.14)",
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
  iecRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 4,
    gap: 6,
  },
  iecLabel: {
    fontSize: 8,
    fontWeight: "700" as const,
    color: "rgba(74, 237, 196, 0.35)",
    letterSpacing: 0.8,
    width: 24,
  },
  iecTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  iecFill: {
    height: 3,
    borderRadius: 2,
  },
  iecValue: {
    fontSize: 9,
    fontWeight: "600" as const,
    width: 22,
    textAlign: "right" as const,
    fontVariant: ["tabular-nums"] as any,
  },
  gabaTag: {
    backgroundColor: "rgba(255, 68, 68, 0.13)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.28)",
  },
  gabaText: {
    fontSize: 7,
    fontWeight: "800" as const,
    color: RED,
    letterSpacing: 0.6,
  },
});
