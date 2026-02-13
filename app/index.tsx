import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
import NoteDisplay from "@/components/NoteDisplay";
import TuningSelector from "@/components/TuningSelector";
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

  const [currentTuning, setCurrentTuning] = useState<TuningConfig>(ALL_TUNINGS[0]);
  const [isListening, setIsListening] = useState(false);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [detectedOctave, setDetectedOctave] = useState<number | null>(null);
  const [detectedFrequency, setDetectedFrequency] = useState(0);
  const [cents, setCents] = useState(0);
  const [detectedString, setDetectedString] = useState<GuitarString | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHapticRef = useRef<number>(0);
  const wasInTuneRef = useRef(false);
  const stabilizerRef = useRef(new FrequencyStabilizer());
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pulseAnim = useSharedValue(1);
  const micButtonScale = useSharedValue(1);
  const stringBarOpacity = useSharedValue(0);

  useEffect(() => {
    if (isListening) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 300 });
    }
  }, [isListening]);

  useEffect(() => {
    if (detectedString && isListening) {
      stringBarOpacity.value = withTiming(1, { duration: 250 });
    } else {
      stringBarOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [detectedString, isListening]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: isListening ? 0.2 : 0,
  }));

  const micScale = useAnimatedStyle(() => ({
    transform: [{ scale: micButtonScale.value }],
  }));

  const stringBarAnimStyle = useAnimatedStyle(() => ({
    opacity: stringBarOpacity.value,
  }));

  function triggerInTuneHaptic(currentCents: number) {
    const now = Date.now();
    const isInTune = Math.abs(currentCents) <= 5;

    if (isInTune && !wasInTuneRef.current && now - lastHapticRef.current > 500) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 80);
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 200);
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
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
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

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (nativeIntervalRef.current) {
      clearInterval(nativeIntervalRef.current);
      nativeIntervalRef.current = null;
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
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

      const rawFrequency = autoCorrelate(buffer, audioContext!.sampleRate);
      const stableFrequency = stabilizerRef.current.push(rawFrequency);

      if (stableFrequency !== null && stableFrequency > 50 && stableFrequency < 500) {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

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
          setDetectedFrequency(0);
          setDetectedNote(null);
          setDetectedOctave(null);
          setDetectedString(null);
          setCents(0);
          silenceTimeoutRef.current = null;
        }, 800);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    tick();
  }

  function simulateNativeTuning() {
    if (nativeIntervalRef.current) {
      clearInterval(nativeIntervalRef.current);
    }
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
      withSpring(0.88, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 6, stiffness: 120 })
    );

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function handleTuningSelect(tuning: TuningConfig) {
    setCurrentTuning(tuning);
    setDetectedString(null);
    setDetectedNote(null);
    setDetectedOctave(null);
    setDetectedFrequency(0);
    setCents(0);
  }

  const targetFreq = detectedString?.frequency || null;
  const activeCents = cents;
  const isDetecting = isListening && detectedFrequency > 0;
  const tuningStatus = isDetecting ? getTuningStatus(activeCents) : null;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Pressable
          style={styles.topButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (user) {
              router.push("/premium");
            } else {
              router.push("/(auth)/login");
            }
          }}
        >
          {user ? (
            <View style={styles.userBadge}>
              <Ionicons name="person" size={13} color={Colors.dark.amber} />
              <Text style={styles.userBadgeText} numberOfLines={1}>
                {user.username}
              </Text>
            </View>
          ) : (
            <Ionicons name="person-circle-outline" size={22} color={Colors.dark.textTertiary} />
          )}
        </Pressable>

        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="guitar-acoustic" size={16} color={Colors.dark.ochre} />
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
              <Ionicons name="diamond" size={12} color={Colors.dark.premium} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          ) : (
            <Ionicons name="diamond-outline" size={18} color={Colors.dark.textTertiary} />
          )}
        </Pressable>
      </View>

      <View style={styles.topDivider} />

      <View style={styles.tunerArea}>
        <TunerDial cents={activeCents} isActive={isDetecting} />
      </View>

      <NoteDisplay
        note={detectedNote}
        octave={detectedOctave}
        cents={activeCents}
        frequency={detectedFrequency}
        isActive={isDetecting}
        targetFrequency={targetFreq}
      />

      <View style={styles.micSection}>
        <Animated.View style={[styles.micPulse, pulseStyle]} />
        <Animated.View style={micScale}>
          <Pressable
            style={[
              styles.micButton,
              isListening && styles.micButtonActive,
            ]}
            onPress={toggleListening}
          >
            <Ionicons
              name={isListening ? "stop" : "mic"}
              size={26}
              color={isListening ? Colors.dark.needleRed : Colors.dark.cream}
            />
          </Pressable>
        </Animated.View>
        <Text style={styles.micLabel}>
          {permissionDenied
            ? t("tuner.permissionDenied")
            : isListening
            ? t("tuner.playString")
            : t("tuner.tapToStart")}
        </Text>
      </View>

      <Animated.View style={[styles.detectedStringBar, stringBarAnimStyle]}>
        {detectedString && (
          <>
            <View style={styles.detectedStringIndicator}>
              <Text style={styles.detectedStringLabel}>{t("tuner.string")}</Text>
              <View style={[
                styles.detectedStringBadge,
                tuningStatus === "in_tune" && styles.detectedStringBadgeInTune,
              ]}>
                <Text style={[
                  styles.detectedStringNumber,
                  tuningStatus === "in_tune" && { color: "#1A120B" },
                ]}>
                  {detectedString.stringNumber}
                </Text>
              </View>
              <Text style={[
                styles.detectedStringNote,
                tuningStatus === "in_tune" && { color: Colors.dark.inTune },
              ]}>
                {detectedString.note}{detectedString.octave}
              </Text>
            </View>
            <View style={styles.detectedStringRight}>
              <Text style={styles.detectedStringFreq}>{detectedString.frequency.toFixed(1)} Hz</Text>
            </View>
          </>
        )}
      </Animated.View>

      <View style={[styles.bottomArea, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
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
    backgroundColor: Colors.dark.background,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  topButton: {
    padding: 6,
    minWidth: 40,
  },
  brandMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.dark.ochre,
    letterSpacing: 1,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.dark.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  userBadgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.dark.amber,
    maxWidth: 70,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(232, 197, 71, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.15)",
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: Colors.dark.premium,
    letterSpacing: 0.5,
  },
  topDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 20,
  },
  tunerArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 18,
    paddingBottom: 10,
  },
  micSection: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  micPulse: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.ochre,
    top: 10,
  },
  micButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
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
    fontSize: 11,
    color: Colors.dark.textTertiary,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
  },
  detectedStringBar: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 24,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  detectedStringIndicator: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 10,
  },
  detectedStringLabel: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  detectedStringBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.ochre,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  detectedStringBadgeInTune: {
    backgroundColor: Colors.dark.inTune,
  },
  detectedStringNumber: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: Colors.dark.woodDark,
  },
  detectedStringNote: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.dark.cream,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  detectedStringRight: {
    alignItems: "flex-end" as const,
  },
  detectedStringFreq: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    fontWeight: "500" as const,
    letterSpacing: 0.3,
  },
  bottomArea: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 0,
  },
});
