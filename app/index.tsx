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
  const bottomControlsHeight = 90;
  const guitarAreaHeight = screenHeight - guitarAreaTop - bottomControlsHeight - safeBottom;

  const headstockY = guitarAreaTop + guitarAreaHeight * 0.02;
  const nutY = guitarAreaTop + guitarAreaHeight * 0.08;
  const neckEndY = guitarAreaTop + guitarAreaHeight * 0.38;
  const bodyTopY = guitarAreaTop + guitarAreaHeight * 0.32;
  const soundHoleCenterY = guitarAreaTop + guitarAreaHeight * 0.5;
  const soundHoleRadius = Math.min(screenWidth * 0.22, 90);
  const bridgeY = guitarAreaTop + guitarAreaHeight * 0.78;
  const bodyBottomY = guitarAreaTop + guitarAreaHeight * 0.92;

  const bodyWidth = Math.min(screenWidth * 0.88, 360);
  const neckWidth = Math.min(screenWidth * 0.22, 88);
  const fretboardWidth = neckWidth - 8;

  const dialSize = Math.round(soundHoleRadius * 1.85);
  const rosetteOuterRadius = soundHoleRadius + 14;
  const rosetteInnerRadius = soundHoleRadius + 6;

  const stringSpacing = neckWidth * 0.155;
  const sortedStrings = [...currentTuning.strings].sort((a, b) => b.stringNumber - a.stringNumber);
  const stringPositions = sortedStrings.map((_, i) =>
    screenWidth / 2 + (i - 2.5) * stringSpacing
  );

  const noteDisplayY = soundHoleCenterY + soundHoleRadius + 20;
  const micButtonY = noteDisplayY + 60;

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

  const fretPositions = [0.15, 0.28, 0.39, 0.49, 0.58, 0.66, 0.73, 0.80, 0.86, 0.91, 0.95, 0.98];
  const fretDotPositions = [2, 4, 6, 8];
  const neckLength = neckEndY - nutY;

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.background }]}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[Colors.dark.woodMedium, Colors.dark.woodLight, Colors.dark.woodMedium]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          left: (screenWidth - bodyWidth) / 2,
          top: bodyTopY,
          width: bodyWidth,
          height: bodyBottomY - bodyTopY,
          borderRadius: bodyWidth * 0.4,
          borderWidth: 2,
          borderColor: Colors.dark.woodLight,
          ...(Platform.OS === "web"
            ? { boxShadow: "inset 0 0 40px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.6)" }
            : { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 15 }),
        }}
      />

      <View
        style={{
          position: "absolute",
          left: (screenWidth - bodyWidth + 20) / 2,
          top: bodyTopY + 10,
          width: bodyWidth - 20,
          height: bodyBottomY - bodyTopY - 20,
          borderRadius: (bodyWidth - 20) * 0.38,
          borderWidth: 1,
          borderColor: "rgba(212, 165, 116, 0.08)",
        }}
      />

      <View
        style={{
          position: "absolute",
          left: (screenWidth - neckWidth) / 2,
          top: headstockY,
          width: neckWidth,
          height: neckEndY - headstockY + 20,
          backgroundColor: Colors.dark.woodLight,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderWidth: 1,
          borderColor: "rgba(212, 165, 116, 0.15)",
        }}
      />

      <View
        style={{
          position: "absolute",
          left: (screenWidth - fretboardWidth) / 2,
          top: nutY,
          width: fretboardWidth,
          height: neckEndY - nutY + 20,
          backgroundColor: Colors.dark.woodDark,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
        }}
      >
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: Colors.dark.brass }} />

        {fretPositions.map((pos, i) => (
          <View
            key={`fret-${i}`}
            style={{
              position: "absolute",
              top: pos * neckLength,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: Colors.dark.brass,
              opacity: 0.6,
            }}
          />
        ))}

        {fretDotPositions.map((fretIdx) => (
          <View
            key={`dot-${fretIdx}`}
            style={{
              position: "absolute",
              top: (fretPositions[fretIdx - 1] + fretPositions[fretIdx]) / 2 * neckLength - 3,
              left: fretboardWidth / 2 - 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: Colors.dark.cream,
              opacity: 0.3,
            }}
          />
        ))}
      </View>

      <View
        style={{
          position: "absolute",
          left: (screenWidth - neckWidth - 12) / 2,
          top: headstockY - 12,
          width: neckWidth + 12,
          height: 16,
          backgroundColor: Colors.dark.woodLight,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          borderWidth: 1,
          borderColor: "rgba(212, 165, 116, 0.2)",
        }}
      />

      <View
        style={{
          position: "absolute",
          left: screenWidth / 2 - rosetteOuterRadius,
          top: soundHoleCenterY - rosetteOuterRadius,
          width: rosetteOuterRadius * 2,
          height: rosetteOuterRadius * 2,
          borderRadius: rosetteOuterRadius,
          backgroundColor: Colors.dark.rosetteBand,
          alignItems: "center",
          justifyContent: "center",
          ...(Platform.OS === "web"
            ? { boxShadow: "0 0 20px rgba(200, 169, 110, 0.2)" }
            : {}),
        }}
      >
        <View
          style={{
            width: rosetteInnerRadius * 2,
            height: rosetteInnerRadius * 2,
            borderRadius: rosetteInnerRadius,
            backgroundColor: Colors.dark.rosetteInner,
            alignItems: "center",
            justifyContent: "center",
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
              ...(Platform.OS === "web"
                ? { boxShadow: "inset 0 4px 20px rgba(0,0,0,0.8)" }
                : {}),
            }}
          >
            <TunerDial cents={cents} isActive={isDetecting} size={dialSize} />
          </View>
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          left: screenWidth / 2 - 40,
          top: bridgeY - 6,
          width: 80,
          height: 12,
          backgroundColor: Colors.dark.brass,
          borderRadius: 2,
          opacity: 0.7,
          ...(Platform.OS === "web"
            ? { boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }
            : {}),
        }}
      >
        {[0, 1, 2, 3, 4, 5].map(i => (
          <View
            key={`pin-${i}`}
            style={{
              position: "absolute",
              left: 8 + i * 12.5,
              top: 3,
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: Colors.dark.woodDark,
            }}
          />
        ))}
      </View>

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
            headstockY={headstockY}
            soundHoleTopY={soundHoleCenterY - soundHoleRadius}
            bridgeY={bridgeY}
          />
        );
      })}

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
              <Ionicons name="person" size={12} color={Colors.dark.amber} />
              <Text style={styles.userBadgeText} numberOfLines={1}>{user.username}</Text>
            </View>
          ) : (
            <Ionicons name="person-circle-outline" size={20} color={Colors.dark.textTertiary} />
          )}
        </Pressable>

        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="guitar-acoustic" size={15} color={Colors.dark.ochre} />
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
              <Ionicons name="diamond" size={10} color={Colors.dark.premium} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          ) : (
            <Ionicons name="diamond-outline" size={16} color={Colors.dark.textTertiary} />
          )}
        </Pressable>
      </View>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: noteDisplayY,
          alignItems: "center",
        }}
        pointerEvents="none"
      >
        <View style={styles.noteDisplayCompact}>
          <Text style={[styles.noteText, { color: isDetecting ? statusColor : Colors.dark.textTertiary }]}>
            {detectedNote || "--"}
          </Text>
          {detectedOctave !== null && isDetecting && (
            <Text style={[styles.noteOctave, { color: statusColor }]}>{detectedOctave}</Text>
          )}
        </View>
        <View style={styles.statusRow}>
          <Text style={[styles.centsText, { color: statusColor }]}>
            {isDetecting ? (cents > 0 ? `+${cents}` : `${cents}`) : "--"} cents
          </Text>
          {isDetecting && statusText ? (
            <View style={[styles.statusPill, { backgroundColor: statusColor + "20", borderColor: statusColor + "40" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>{statusText}</Text>
            </View>
          ) : null}
          <Text style={styles.freqText}>
            {isDetecting ? `${detectedFrequency.toFixed(1)} Hz` : ""}
          </Text>
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: micButtonY,
          alignItems: "center",
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              width: 60,
              height: 60,
              borderRadius: 30,
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
              size={22}
              color={isListening ? Colors.dark.needleRed : Colors.dark.cream}
            />
          </Pressable>
        </Animated.View>
        <Text style={styles.micLabel}>
          {permissionDenied ? t("tuner.permissionDenied") : isListening ? t("tuner.playString") : t("tuner.tapToStart")}
        </Text>
      </View>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: safeBottom + 12,
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
    minWidth: 36,
  },
  brandMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(26, 18, 11, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  brandText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.dark.ochre,
    letterSpacing: 1,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(26, 18, 11, 0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  userBadgeText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.dark.amber,
    maxWidth: 60,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(232, 197, 71, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.15)",
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: Colors.dark.premium,
    letterSpacing: 0.5,
  },
  noteDisplayCompact: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noteText: {
    fontSize: 42,
    fontWeight: "300" as const,
    letterSpacing: 3,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  noteOctave: {
    fontSize: 16,
    fontWeight: "400" as const,
    marginTop: 6,
    opacity: 0.6,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  centsText: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  freqText: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    fontWeight: "500" as const,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  micLabel: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    marginTop: 5,
  },
});
