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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import TunerDial from "@/components/TunerDial";
import TuningSelector from "@/components/TuningSelector";
import GuitarStringNeon from "@/components/GuitarStringNeon";
import {
  ALL_TUNINGS,
  TuningConfig,
  GuitarString,
  frequencyToNote,
  findClosestString,
  getCentsFromTarget,
  getTuningStatus,
  autoCorrelate,
  FrequencyStabilizer,
} from "@/lib/tuner-engine";

export default function TunerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [currentTuning, setCurrentTuning] = useState<TuningConfig>(ALL_TUNINGS[0]);
  const [isListening, setIsListening] = useState(false);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [detectedOctave, setDetectedOctave] = useState<number | null>(null);
  const [detectedFrequency, setDetectedFrequency] = useState(0);
  const [cents, setCents] = useState(0);
  const [detectedString, setDetectedString] = useState<GuitarString | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [tunedStrings, setTunedStrings] = useState<Set<number>>(new Set());

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHapticRef = useRef<number>(0);
  const wasInTuneRef = useRef(false);
  const stabilizerRef = useRef(new FrequencyStabilizer());
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const micButtonScale = useSharedValue(1);
  const micPulseOpacity = useSharedValue(0);

  const topBarHeight = 44;
  const safeTop = Platform.OS === "web" ? 67 : insets.top;
  const safeBottom = Platform.OS === "web" ? 34 : insets.bottom;
  const guitarAreaTop = safeTop + topBarHeight;
  const bottomControlsHeight = 80;
  const guitarAreaHeight = screenHeight - guitarAreaTop - bottomControlsHeight - safeBottom;

  const headstockTopY = guitarAreaTop + guitarAreaHeight * 0.0;
  const headstockBottomY = guitarAreaTop + guitarAreaHeight * 0.1;
  const nutY = headstockBottomY;
  const neckEndY = guitarAreaTop + guitarAreaHeight * 0.36;
  const bodyTopY = guitarAreaTop + guitarAreaHeight * 0.30;
  const soundHoleCenterY = guitarAreaTop + guitarAreaHeight * 0.50;
  const soundHoleRadius = Math.min(screenWidth * 0.20, 82);
  const bridgeY = guitarAreaTop + guitarAreaHeight * 0.72;
  const bodyBottomY = guitarAreaTop + guitarAreaHeight * 0.88;

  const lowerBoutWidth = Math.min(screenWidth * 0.82, 340);
  const upperBoutWidth = lowerBoutWidth * 0.75;
  const waistWidth = lowerBoutWidth * 0.62;
  const neckWidth = Math.min(screenWidth * 0.18, 74);
  const fretboardWidth = neckWidth - 6;

  const dialSize = Math.round(soundHoleRadius * 1.9);
  const rosetteR1 = soundHoleRadius + 20;
  const rosetteR2 = soundHoleRadius + 14;
  const rosetteR3 = soundHoleRadius + 8;
  const rosetteR4 = soundHoleRadius + 4;

  const stringSpacing = fretboardWidth / 7;
  const sortedStrings = [...currentTuning.strings].sort((a, b) => b.stringNumber - a.stringNumber);
  const stringPositions = sortedStrings.map((_, i) =>
    screenWidth / 2 + (i - 2.5) * stringSpacing
  );

  const bridgeStringSpacing = stringSpacing * 1.6;
  const bridgeStringPositions = sortedStrings.map((_, i) =>
    screenWidth / 2 + (i - 2.5) * bridgeStringSpacing
  );

  const waistY = (neckEndY + soundHoleCenterY) / 2;
  const bodyHeight = bodyBottomY - bodyTopY;

  const noteDisplayY = bridgeY + 24;

  useEffect(() => {
    if (isListening) {
      micPulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      micPulseOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isListening]);

  const micPulseStyle = useAnimatedStyle(() => ({
    opacity: micPulseOpacity.value,
  }));

  const micScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micButtonScale.value }],
  }));

  const isDetecting = isListening && detectedFrequency > 0;
  const tuningStatus = isDetecting ? getTuningStatus(cents) : null;

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

  function triggerInTuneHaptic(currentCents: number) {
    const now = Date.now();
    const isInTune = Math.abs(currentCents) <= 5;
    if (isInTune && !wasInTuneRef.current && now - lastHapticRef.current > 500) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 80);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 200);
      lastHapticRef.current = now;
    }
    wasInTuneRef.current = isInTune;
  }

  const startListening = useCallback(async () => {
    if (Platform.OS !== "web") {
      setIsListening(true);
      simulateNativeTuning();
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
    } catch (err) {
      console.error("Microphone access denied:", err);
      setPermissionDenied(true);
    }
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    wasInTuneRef.current = false;
    stabilizerRef.current.reset();
    if (silenceTimeoutRef.current) { clearTimeout(silenceTimeoutRef.current); silenceTimeoutRef.current = null; }
    if (nativeIntervalRef.current) { clearInterval(nativeIntervalRef.current); nativeIntervalRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    analyserRef.current = null;
  }, []);

  useEffect(() => { return () => { stopListening(); }; }, []);

  function detectPitch() {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    if (!analyser || !audioContext) return;
    const buffer = new Float32Array(analyser.fftSize);
    stabilizerRef.current.reset();
    function tick() {
      if (!analyserRef.current) return;
      analyserRef.current.getFloatTimeDomainData(buffer);
      const rawFrequency = autoCorrelate(buffer, audioContext!.sampleRate);
      const stableFrequency = stabilizerRef.current.push(rawFrequency);
      if (stableFrequency !== null && stableFrequency > 50 && stableFrequency < 500) {
        if (silenceTimeoutRef.current) { clearTimeout(silenceTimeoutRef.current); silenceTimeoutRef.current = null; }
        const noteInfo = frequencyToNote(stableFrequency);
        const closest = findClosestString(stableFrequency, currentTuning.strings);
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
          setDetectedString(null); setCents(0); silenceTimeoutRef.current = null;
        }, 800);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();
  }

  function simulateNativeTuning() {
    if (nativeIntervalRef.current) clearInterval(nativeIntervalRef.current);
    const target = currentTuning.strings[0];
    let tick = 0;
    nativeIntervalRef.current = setInterval(() => {
      tick++;
      const variation = Math.sin(tick * 0.1) * 30 + (Math.random() - 0.5) * 10;
      const freq = target.frequency * Math.pow(2, variation / 1200);
      const noteInfo = frequencyToNote(freq);
      setDetectedFrequency(freq);
      setDetectedNote(noteInfo.note);
      setDetectedOctave(noteInfo.octave);
      const roundedVar = Math.round(variation);
      setCents(roundedVar);
      const closest = findClosestString(freq, currentTuning.strings);
      setDetectedString(closest);
      triggerInTuneHaptic(roundedVar);
    }, 100);
  }

  function toggleListening() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    micButtonScale.value = withSequence(
      withSpring(0.85, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 6, stiffness: 120 })
    );
    if (isListening) stopListening();
    else startListening();
  }

  function handleTuningSelect(tuning: TuningConfig) {
    setCurrentTuning(tuning);
    setDetectedString(null);
    setDetectedNote(null);
    setDetectedOctave(null);
    setDetectedFrequency(0);
    setCents(0);
    setTunedStrings(new Set());
  }

  const statusColor = tuningStatus === "in_tune" ? Colors.dark.neon
    : tuningStatus === "flat" || tuningStatus === "sharp"
    ? Math.abs(cents) > 25 ? Colors.dark.needleRed : Math.abs(cents) > 10 ? Colors.dark.ochre : Colors.dark.amber
    : Colors.dark.textTertiary;

  const statusText = tuningStatus === "in_tune" ? t("noteDisplay.inTune")
    : tuningStatus === "flat" ? t("noteDisplay.flat")
    : tuningStatus === "sharp" ? t("noteDisplay.sharp") : "";

  const fretPositions = [0.12, 0.23, 0.33, 0.42, 0.50, 0.57, 0.63, 0.69, 0.74, 0.79, 0.83, 0.87];
  const fretDotPositions = [2, 4, 6, 8];
  const neckLength = neckEndY - nutY;

  const headstockWidth = neckWidth + 20;
  const headstockHeight = headstockBottomY - headstockTopY;
  const pegSpacing = headstockWidth * 0.18;

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.background }]}>
      <StatusBar style="light" />

      {/* ========== GUITAR BODY - LOWER BOUT ========== */}
      <LinearGradient
        colors={["#7D5A38", "#6B4C30", "#5A3E24", "#4A3220"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          left: (screenWidth - lowerBoutWidth) / 2,
          top: soundHoleCenterY - lowerBoutWidth * 0.15,
          width: lowerBoutWidth,
          height: bodyBottomY - (soundHoleCenterY - lowerBoutWidth * 0.15),
          borderBottomLeftRadius: lowerBoutWidth * 0.42,
          borderBottomRightRadius: lowerBoutWidth * 0.42,
          borderTopLeftRadius: lowerBoutWidth * 0.1,
          borderTopRightRadius: lowerBoutWidth * 0.1,
          borderWidth: 2,
          borderColor: Colors.dark.woodHighlight,
          ...(Platform.OS === "web"
            ? { boxShadow: "inset 0 -10px 40px rgba(0,0,0,0.3), 0 12px 40px rgba(0,0,0,0.7)" }
            : { shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.7, shadowRadius: 24, elevation: 18 }),
        }}
      />

      {/* Body edge highlight - lower */}
      <View
        style={{
          position: "absolute",
          left: (screenWidth - lowerBoutWidth + 8) / 2,
          top: soundHoleCenterY - lowerBoutWidth * 0.15 + 4,
          width: lowerBoutWidth - 8,
          height: bodyBottomY - (soundHoleCenterY - lowerBoutWidth * 0.15) - 8,
          borderBottomLeftRadius: (lowerBoutWidth - 8) * 0.42,
          borderBottomRightRadius: (lowerBoutWidth - 8) * 0.42,
          borderTopLeftRadius: (lowerBoutWidth - 8) * 0.08,
          borderTopRightRadius: (lowerBoutWidth - 8) * 0.08,
          borderWidth: 1,
          borderColor: "rgba(212, 165, 116, 0.06)",
        }}
      />

      {/* ========== GUITAR BODY - UPPER BOUT ========== */}
      <LinearGradient
        colors={["#7D5A38", "#6B4C30", "#5A3E24"]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={{
          position: "absolute",
          left: (screenWidth - upperBoutWidth) / 2,
          top: bodyTopY,
          width: upperBoutWidth,
          height: soundHoleCenterY - bodyTopY + lowerBoutWidth * 0.05,
          borderTopLeftRadius: upperBoutWidth * 0.35,
          borderTopRightRadius: upperBoutWidth * 0.35,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderWidth: 2,
          borderBottomWidth: 0,
          borderColor: Colors.dark.woodHighlight,
        }}
      />

      {/* ========== WAIST CURVES ========== */}
      <View
        style={{
          position: "absolute",
          left: (screenWidth - lowerBoutWidth) / 2 - 2,
          top: waistY - 20,
          width: ((lowerBoutWidth - waistWidth) / 2) + 4,
          height: 50,
          backgroundColor: Colors.dark.background,
          borderTopRightRadius: 30,
          borderBottomRightRadius: 25,
        }}
      />
      <View
        style={{
          position: "absolute",
          right: (screenWidth - lowerBoutWidth) / 2 - 2,
          top: waistY - 20,
          width: ((lowerBoutWidth - waistWidth) / 2) + 4,
          height: 50,
          backgroundColor: Colors.dark.background,
          borderTopLeftRadius: 30,
          borderBottomLeftRadius: 25,
        }}
      />

      {/* Waist binding lines */}
      <View style={{ position: "absolute", left: (screenWidth - waistWidth) / 2 + 2, top: waistY - 18, width: 2, height: 46, backgroundColor: Colors.dark.woodHighlight, borderRadius: 1, opacity: 0.4 }} />
      <View style={{ position: "absolute", right: (screenWidth - waistWidth) / 2 + 2, top: waistY - 18, width: 2, height: 46, backgroundColor: Colors.dark.woodHighlight, borderRadius: 1, opacity: 0.4 }} />

      {/* ========== BODY WOOD GRAIN LINES ========== */}
      {[0.15, 0.3, 0.5, 0.65, 0.8].map((pos, i) => (
        <View
          key={`grain-${i}`}
          style={{
            position: "absolute",
            left: (screenWidth - lowerBoutWidth * 0.7) / 2 + (i % 2 === 0 ? 10 : -10),
            top: soundHoleCenterY + lowerBoutWidth * 0.05 + pos * (bodyBottomY - soundHoleCenterY - lowerBoutWidth * 0.2),
            width: lowerBoutWidth * 0.7 - 20,
            height: 1,
            backgroundColor: "rgba(139, 107, 66, 0.08)",
            borderRadius: 0.5,
          }}
        />
      ))}

      {/* ========== BINDING (body edge detail) ========== */}
      <View
        style={{
          position: "absolute",
          left: (screenWidth - lowerBoutWidth + 6) / 2,
          top: bodyBottomY - 50,
          width: lowerBoutWidth - 6,
          height: 50,
          borderBottomLeftRadius: (lowerBoutWidth - 6) * 0.43,
          borderBottomRightRadius: (lowerBoutWidth - 6) * 0.43,
          borderWidth: 1,
          borderTopWidth: 0,
          borderColor: "rgba(200, 169, 110, 0.12)",
        }}
      />

      {/* ========== NECK ========== */}
      <LinearGradient
        colors={[Colors.dark.woodWarm, Colors.dark.woodLight, Colors.dark.woodWarm]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: "absolute",
          left: (screenWidth - neckWidth) / 2,
          top: headstockBottomY,
          width: neckWidth,
          height: neckEndY - headstockBottomY + 30,
          borderWidth: 1,
          borderTopWidth: 0,
          borderColor: "rgba(212, 165, 116, 0.12)",
        }}
      />

      {/* ========== FRETBOARD ========== */}
      <View
        style={{
          position: "absolute",
          left: (screenWidth - fretboardWidth) / 2,
          top: nutY,
          width: fretboardWidth,
          height: neckEndY - nutY + 30,
          backgroundColor: "#1A0F08",
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
        }}
      >
        {/* Nut */}
        <View style={{ position: "absolute", top: 0, left: -1, right: -1, height: 4, backgroundColor: Colors.dark.cream, borderRadius: 1, opacity: 0.8 }} />

        {/* Frets */}
        {fretPositions.map((pos, i) => (
          <View
            key={`fret-${i}`}
            style={{
              position: "absolute",
              top: pos * neckLength,
              left: 0,
              right: 0,
              height: 2.5,
              backgroundColor: Colors.dark.brassLight,
              opacity: 0.5 - i * 0.02,
              ...(Platform.OS === "web"
                ? { boxShadow: "0 1px 2px rgba(212, 170, 74, 0.15)" }
                : {}),
            }}
          />
        ))}

        {/* Fret dot markers */}
        {fretDotPositions.map((fretIdx) => (
          <View
            key={`dot-${fretIdx}`}
            style={{
              position: "absolute",
              top: ((fretPositions[fretIdx - 1] || 0) + fretPositions[fretIdx]) / 2 * neckLength - 3.5,
              left: fretboardWidth / 2 - 3.5,
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: Colors.dark.cream,
              opacity: 0.25,
            }}
          />
        ))}

        {/* Double dots at 12th fret */}
        {fretPositions.length >= 12 && (
          <>
            <View style={{ position: "absolute", top: ((fretPositions[10] || 0) + fretPositions[11]) / 2 * neckLength - 3, left: fretboardWidth * 0.28 - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.dark.cream, opacity: 0.2 }} />
            <View style={{ position: "absolute", top: ((fretPositions[10] || 0) + fretPositions[11]) / 2 * neckLength - 3, left: fretboardWidth * 0.72 - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.dark.cream, opacity: 0.2 }} />
          </>
        )}
      </View>

      {/* ========== HEADSTOCK ========== */}
      <LinearGradient
        colors={["#5A3E24", "#4A3220", "#3D2B1A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: "absolute",
          left: (screenWidth - headstockWidth) / 2,
          top: headstockTopY,
          width: headstockWidth,
          height: headstockHeight + 4,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
          borderWidth: 1.5,
          borderColor: Colors.dark.woodHighlight,
          ...(Platform.OS === "web"
            ? { boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }
            : { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 10 }),
        }}
      >
        {/* Headstock logo area */}
        <View style={{ position: "absolute", top: 4, left: 0, right: 0, alignItems: "center" }}>
          <View style={{ width: headstockWidth * 0.5, height: 2, backgroundColor: Colors.dark.brassLight, borderRadius: 1, opacity: 0.3 }} />
        </View>
      </LinearGradient>

      {/* ========== TUNING PEGS ========== */}
      {/* Left side pegs (strings 6, 5, 4) */}
      {[0, 1, 2].map(i => {
        const pegY = headstockTopY + 10 + i * (headstockHeight * 0.28);
        return (
          <View key={`peg-l-${i}`}>
            <View style={{
              position: "absolute",
              left: (screenWidth - headstockWidth) / 2 - 14,
              top: pegY,
              width: 18,
              height: 8,
              backgroundColor: Colors.dark.pegMetal,
              borderRadius: 2,
              borderWidth: 1,
              borderColor: "rgba(180, 170, 150, 0.3)",
              ...(Platform.OS === "web"
                ? { boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }
                : {}),
            }} />
            <View style={{
              position: "absolute",
              left: (screenWidth - headstockWidth) / 2 - 20,
              top: pegY - 2,
              width: 10,
              height: 12,
              backgroundColor: Colors.dark.pegDark,
              borderRadius: 3,
              borderWidth: 1,
              borderColor: "rgba(120, 100, 80, 0.3)",
            }} />
          </View>
        );
      })}
      {/* Right side pegs (strings 3, 2, 1) */}
      {[0, 1, 2].map(i => {
        const pegY = headstockTopY + 10 + i * (headstockHeight * 0.28);
        return (
          <View key={`peg-r-${i}`}>
            <View style={{
              position: "absolute",
              right: (screenWidth - headstockWidth) / 2 - 14,
              top: pegY,
              width: 18,
              height: 8,
              backgroundColor: Colors.dark.pegMetal,
              borderRadius: 2,
              borderWidth: 1,
              borderColor: "rgba(180, 170, 150, 0.3)",
              ...(Platform.OS === "web"
                ? { boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }
                : {}),
            }} />
            <View style={{
              position: "absolute",
              right: (screenWidth - headstockWidth) / 2 - 20,
              top: pegY - 2,
              width: 10,
              height: 12,
              backgroundColor: Colors.dark.pegDark,
              borderRadius: 3,
              borderWidth: 1,
              borderColor: "rgba(120, 100, 80, 0.3)",
            }} />
          </View>
        );
      })}

      {/* ========== ROSETTE - Multi-ring ========== */}
      <View
        style={{
          position: "absolute",
          left: screenWidth / 2 - rosetteR1,
          top: soundHoleCenterY - rosetteR1,
          width: rosetteR1 * 2,
          height: rosetteR1 * 2,
          borderRadius: rosetteR1,
          backgroundColor: Colors.dark.rosetteDark,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: "rgba(200, 169, 110, 0.25)",
          ...(Platform.OS === "web"
            ? { boxShadow: "0 0 24px rgba(200, 169, 110, 0.15)" }
            : {}),
        }}
      >
        <View
          style={{
            width: rosetteR2 * 2,
            height: rosetteR2 * 2,
            borderRadius: rosetteR2,
            backgroundColor: Colors.dark.rosetteBand,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: Colors.dark.rosetteGold,
          }}
        >
          <View
            style={{
              width: rosetteR3 * 2,
              height: rosetteR3 * 2,
              borderRadius: rosetteR3,
              backgroundColor: Colors.dark.rosetteDark,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: "rgba(200, 169, 110, 0.3)",
            }}
          >
            <View
              style={{
                width: rosetteR4 * 2,
                height: rosetteR4 * 2,
                borderRadius: rosetteR4,
                backgroundColor: Colors.dark.rosetteInner,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(200, 169, 110, 0.15)",
              }}
            >
              <View
                style={{
                  width: soundHoleRadius * 2,
                  height: soundHoleRadius * 2,
                  borderRadius: soundHoleRadius,
                  backgroundColor: Colors.dark.soundHole,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: Colors.dark.soundHoleEdge,
                  ...(Platform.OS === "web"
                    ? { boxShadow: "inset 0 6px 24px rgba(0,0,0,0.9), inset 0 -2px 8px rgba(0,0,0,0.5)" }
                    : {}),
                }}
              >
                <TunerDial cents={cents} isActive={isDetecting} size={dialSize} />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ========== BRIDGE ========== */}
      <View
        style={{
          position: "absolute",
          left: screenWidth / 2 - lowerBoutWidth * 0.22,
          top: bridgeY - 5,
          width: lowerBoutWidth * 0.44,
          height: 14,
          backgroundColor: "#1A0F08",
          borderRadius: 3,
          ...(Platform.OS === "web"
            ? { boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }
            : { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 5 }),
        }}
      >
        {/* Bridge saddle */}
        <View style={{ position: "absolute", top: 3, left: 6, right: 6, height: 3, backgroundColor: Colors.dark.cream, borderRadius: 1.5, opacity: 0.7 }} />
        {/* Bridge pins */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <View
            key={`pin-${i}`}
            style={{
              position: "absolute",
              left: 10 + i * ((lowerBoutWidth * 0.44 - 24) / 5),
              top: 9,
              width: 3,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: Colors.dark.cream,
              opacity: 0.5,
            }}
          />
        ))}
      </View>

      {/* ========== PICKGUARD ========== */}
      <View
        style={{
          position: "absolute",
          left: screenWidth / 2 + soundHoleRadius * 0.3,
          top: soundHoleCenterY + soundHoleRadius * 0.2,
          width: lowerBoutWidth * 0.28,
          height: lowerBoutWidth * 0.38,
          backgroundColor: "rgba(30, 20, 12, 0.4)",
          borderRadius: lowerBoutWidth * 0.06,
          borderWidth: 1,
          borderColor: "rgba(212, 165, 116, 0.05)",
          transform: [{ rotate: "5deg" }],
        }}
      />

      {/* ========== GUITAR STRINGS ========== */}
      {sortedStrings.map((str, i) => {
        const isThisDetected = detectedString?.stringNumber === str.stringNumber;
        const isThisInTune = isThisDetected && tuningStatus === "in_tune";
        const wasThisTuned = tunedStrings.has(str.stringNumber) && !isThisDetected;

        return (
          <GuitarStringNeon
            key={str.stringNumber}
            stringIndex={i}
            note={str.note}
            stringNumber={str.stringNumber}
            isInTune={isThisInTune}
            isDetected={isThisDetected}
            wasTuned={wasThisTuned}
            xPosition={stringPositions[i]}
            headstockY={headstockTopY + 6}
            soundHoleTopY={soundHoleCenterY - soundHoleRadius}
            bridgeY={bridgeY}
          />
        );
      })}

      {/* ========== TOP BAR ========== */}
      <View style={[styles.topBar, { top: safeTop }]}>
        <Pressable
          style={styles.topButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (user) router.push("/premium");
            else router.push("/(auth)/login");
          }}
        >
          {user ? (
            <View style={styles.userBadge}>
              <Ionicons name="person" size={11} color={Colors.dark.amber} />
              <Text style={styles.userBadgeText} numberOfLines={1}>{user.username}</Text>
            </View>
          ) : (
            <Ionicons name="person-circle-outline" size={18} color={Colors.dark.textTertiary} />
          )}
        </Pressable>

        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="guitar-acoustic" size={14} color={Colors.dark.ochre} />
          <Text style={styles.brandText}>GuitarTune</Text>
        </View>

        <Pressable
          style={styles.topButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/premium");
          }}
        >
          {user?.isPremium ? (
            <View style={styles.proBadge}>
              <Ionicons name="diamond" size={9} color={Colors.dark.premium} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          ) : (
            <Ionicons name="diamond-outline" size={15} color={Colors.dark.textTertiary} />
          )}
        </Pressable>
      </View>

      {/* ========== NOTE DISPLAY + MIC BUTTON ========== */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: noteDisplayY,
          alignItems: "center",
        }}
      >
        <View style={styles.noteDisplayRow}>
          <View style={styles.noteDisplayCompact}>
            <Text style={[styles.noteText, { color: isDetecting ? statusColor : Colors.dark.textTertiary }]}>
              {detectedNote || "--"}
            </Text>
            {detectedOctave !== null && isDetecting && (
              <Text style={[styles.noteOctave, { color: statusColor }]}>{detectedOctave}</Text>
            )}
          </View>

          <Animated.View
            style={[
              {
                position: "absolute",
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: Colors.dark.neon,
              },
              micPulseStyle,
            ]}
          />
          <Animated.View style={micScaleStyle}>
            <Pressable
              style={[styles.micButton, isListening && styles.micButtonActive]}
              onPress={toggleListening}
            >
              <Ionicons
                name={isListening ? "stop" : "mic"}
                size={20}
                color={isListening ? Colors.dark.needleRed : Colors.dark.cream}
              />
            </Pressable>
          </Animated.View>

          <View style={styles.statusInfo}>
            {isDetecting && statusText ? (
              <View style={[styles.statusPill, { backgroundColor: statusColor + "20", borderColor: statusColor + "40" }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusLabel, { color: statusColor }]}>{statusText}</Text>
              </View>
            ) : (
              <Text style={styles.freqPlaceholder}>
                {permissionDenied ? t("tuner.permissionDenied") : isListening ? t("tuner.playString") : t("tuner.tapToStart")}
              </Text>
            )}
            <Text style={styles.freqText}>
              {isDetecting ? `${cents > 0 ? "+" : ""}${cents}c  |  ${detectedFrequency.toFixed(1)} Hz` : ""}
            </Text>
          </View>
        </View>
      </View>

      {/* ========== TUNING SELECTOR ========== */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: safeBottom + 10,
          alignItems: "center",
        }}
      >
        <TuningSelector
          currentTuning={currentTuning}
          onSelect={handleTuningSelect}
          isPremiumUser={!!user?.isPremium}
          onPremiumRequired={() => router.push("/premium")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 4,
    zIndex: 20,
  },
  topButton: {
    padding: 6,
    minWidth: 34,
  },
  brandMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(13, 9, 7, 0.8)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 169, 110, 0.1)",
  },
  brandText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.dark.ochre,
    letterSpacing: 1,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(13, 9, 7, 0.8)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  userBadgeText: {
    fontSize: 9,
    fontWeight: "600" as const,
    color: Colors.dark.amber,
    maxWidth: 50,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(232, 197, 71, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.15)",
  },
  proBadgeText: {
    fontSize: 8,
    fontWeight: "800" as const,
    color: Colors.dark.premium,
    letterSpacing: 0.5,
  },
  noteDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 20,
  },
  noteDisplayCompact: {
    flexDirection: "row",
    alignItems: "flex-start",
    minWidth: 60,
    justifyContent: "flex-end",
  },
  noteText: {
    fontSize: 36,
    fontWeight: "300" as const,
    letterSpacing: 2,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  noteOctave: {
    fontSize: 14,
    fontWeight: "400" as const,
    marginTop: 4,
    opacity: 0.6,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  statusInfo: {
    minWidth: 80,
    alignItems: "flex-start",
    gap: 3,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  statusLabel: {
    fontSize: 9,
    fontWeight: "700" as const,
    letterSpacing: 0.4,
  },
  freqPlaceholder: {
    fontSize: 9,
    color: Colors.dark.textTertiary,
    fontWeight: "500" as const,
  },
  freqText: {
    fontSize: 9,
    color: Colors.dark.textTertiary,
    fontWeight: "500" as const,
    letterSpacing: 0.3,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 2,
    borderColor: Colors.dark.woodLight,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3), 0 3px 12px rgba(0,0,0,0.4)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }),
  },
  micButtonActive: {
    backgroundColor: Colors.dark.warningMuted,
    borderColor: Colors.dark.needleRed,
  },
});
