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
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import TunerDial from "@/components/TunerDial";
import TuningSelector from "@/components/TuningSelector";
import PitchDetectorBridge from "@/components/PitchDetectorBridge";
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

const ACCENT = "#4AEDC4";
const ACCENT_DIM = "rgba(74, 237, 196, 0.15)";
const ACCENT_MED = "rgba(74, 237, 196, 0.35)";
const ACCENT_BRIGHT = "rgba(74, 237, 196, 0.8)";
const RED = "#FF4444";
const ORANGE = "#FF9544";
const BG = "#0A0A0A";
const SURFACE = "#111111";
const SURFACE_LIGHT = "#1A1A1A";
const TEXT_DIM = "rgba(255, 255, 255, 0.25)";
const TEXT_MED = "rgba(255, 255, 255, 0.5)";

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
  const lastHapticRef = useRef<number>(0);
  const wasInTuneRef = useRef(false);
  const stabilizerRef = useRef(new FrequencyStabilizer());
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const micPulseOpacity = useSharedValue(0);
  const micButtonScale = useSharedValue(1);

  const safeTop = Platform.OS === "web" ? 67 : insets.top;
  const safeBottom = Platform.OS === "web" ? 34 : insets.bottom;

  const isDetecting = isListening && detectedFrequency > 0;
  const tuningStatus = isDetecting ? getTuningStatus(cents) : null;
  const isInTune = tuningStatus === "in_tune";

  const dialSize = Math.min(screenWidth * 0.95, 380);

  useEffect(() => {
    if (isListening) {
      micPulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      micPulseOpacity.value = withTiming(0, { duration: 300 });
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

  const handleNativePitch = useCallback((data: { frequency: number; note: string; octave: number; cents: number }) => {
    if (silenceTimeoutRef.current) { clearTimeout(silenceTimeoutRef.current); silenceTimeoutRef.current = null; }
    const freq = data.frequency;
    const closest = findClosestString(freq, currentTuning.strings);
    setDetectedFrequency(freq);
    setDetectedNote(data.note);
    setDetectedOctave(data.octave);
    setDetectedString(closest);
    if (closest) {
      const c = getCentsFromTarget(freq, closest.frequency);
      setCents(c);
      triggerInTuneHaptic(c);
    } else {
      setCents(data.cents);
    }
  }, [currentTuning]);

  const handleNativeSilence = useCallback(() => {
    if (!silenceTimeoutRef.current) {
      silenceTimeoutRef.current = setTimeout(() => {
        setDetectedFrequency(0); setDetectedNote(null); setDetectedOctave(null);
        setDetectedString(null); setCents(0); silenceTimeoutRef.current = null;
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
    } catch {
      setPermissionDenied(true);
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


  function toggleListening() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    micButtonScale.value = withSequence(
      withSpring(0.85, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 6, stiffness: 120 })
    );
    if (isListening) stopListening(); else startListening();
  }

  function handleTuningSelect(tuning: TuningConfig) {
    setCurrentTuning(tuning);
    setDetectedString(null); setDetectedNote(null); setDetectedOctave(null);
    setDetectedFrequency(0); setCents(0); setTunedStrings(new Set());
  }

  const statusColor = isInTune ? ACCENT
    : tuningStatus === "flat" || tuningStatus === "sharp"
    ? Math.abs(cents) > 25 ? RED : Math.abs(cents) > 10 ? ORANGE : ACCENT_BRIGHT
    : TEXT_DIM;

  const centsDisplay = isDetecting
    ? `${cents >= 0 ? (cents > 0 ? "+" : "") : ""}${String(Math.abs(cents)).padStart(3, "0")}.0`
    : "000.0";

  const sortedStrings = [...currentTuning.strings].sort((a, b) => a.stringNumber - b.stringNumber);

  const stringAreaWidth = Math.min(screenWidth - 40, 360);
  const stringSpacing = stringAreaWidth / 7;

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <StatusBar style="light" />

      <PitchDetectorBridge
        isListening={isListening}
        onPitchDetected={handleNativePitch}
        onSilence={handleNativeSilence}
        onError={handleNativeError}
      />

      {/* ===== TOP BAR ===== */}
      <View style={[styles.topBar, { top: safeTop }]}>
        <Pressable
          style={styles.topBtn}
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
                  color={isListening ? RED : "#FFF"}
                />
              </Pressable>
            </Animated.View>
          </View>

          <Pressable
            style={styles.topBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/premium");
            }}
          >
            {user?.isPremium ? (
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

        {/* ===== STATUS INDICATOR ===== */}
        <View style={styles.statusRow}>
          {isDetecting && tuningStatus ? (
            <View style={[styles.statusIndicator, { borderColor: statusColor + "40", backgroundColor: statusColor + "10" }]}>
              <Ionicons
                name={isInTune ? "checkmark-circle" : tuningStatus === "flat" ? "arrow-down" : "arrow-up"}
                size={16}
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
          {sortedStrings.map((str) => {
            const isActive = detectedString?.stringNumber === str.stringNumber;
            const isTuned = tunedStrings.has(str.stringNumber);
            const strColor = isActive
              ? (isInTune ? ACCENT : statusColor)
              : isTuned ? ACCENT_MED : TEXT_DIM;

            return (
              <View key={str.stringNumber} style={styles.stringItem}>
                <Text style={[styles.stringNote, { color: strColor }]}>
                  {str.note}
                  <Text style={styles.stringOctaveSub}>{str.octave}</Text>
                </Text>
                <Text style={[styles.stringFreq, { color: isActive ? strColor : TEXT_DIM }]}>
                  {str.frequency.toFixed(1)}Hz
                </Text>
              </View>
            );
          })}
        </View>

        {/* ===== STRINGS VISUAL ===== */}
        <View style={[styles.stringsVisual, { width: stringAreaWidth, marginBottom: safeBottom + 10 }]}>
          {sortedStrings.map((str, i) => {
            const isActive = detectedString?.stringNumber === str.stringNumber;
            const isTuned = tunedStrings.has(str.stringNumber);
            const thicknesses = [3.5, 3, 2.5, 2, 1.5, 1.2];
            const thickness = thicknesses[i] || 2;
            const xPos = stringSpacing * (i + 1);
            const baseColor = isActive
              ? (isInTune ? ACCENT : statusColor)
              : isTuned ? ACCENT_MED : "rgba(255,255,255,0.12)";

            return (
              <View
                key={str.stringNumber}
                style={{
                  position: "absolute" as const,
                  left: xPos - thickness / 2,
                  top: 0,
                  bottom: 0,
                  width: thickness,
                  backgroundColor: baseColor,
                  borderRadius: thickness / 2,
                  ...(isActive && Platform.OS === "web"
                    ? { boxShadow: `0 0 ${isInTune ? 12 : 6}px ${isInTune ? ACCENT_DIM : "rgba(255,255,255,0.05)"}` }
                    : {}),
                }}
              />
            );
          })}
        </View>
      </View>
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
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: SURFACE_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
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
    borderColor: "rgba(74, 237, 196, 0.2)",
  },
  proChipText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: ACCENT,
    letterSpacing: 0.5,
  },
  dialContainer: {
    alignItems: "center",
    marginTop: 0,
  },
  statusRow: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    minHeight: 28,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  placeholderText: {
    fontSize: 10,
    color: TEXT_DIM,
    fontWeight: "500" as const,
  },
  stringSelector: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  stringItem: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: 6,
  },
  stringNote: {
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  stringOctaveSub: {
    fontSize: 10,
    fontWeight: "400" as const,
  },
  stringFreq: {
    fontSize: 8,
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
    borderTopColor: "rgba(255,255,255,0.06)",
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
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: "rgba(255, 68, 68, 0.15)",
    borderColor: "rgba(255, 68, 68, 0.3)",
  },
});
