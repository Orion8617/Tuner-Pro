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
import NoteDisplay from "@/components/NoteDisplay";
import StringSelector from "@/components/StringSelector";
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
  const [selectedString, setSelectedString] = useState<GuitarString | null>(null);
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

  useEffect(() => {
    if (isListening) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 300 });
    }
  }, [isListening]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: isListening ? 0.3 : 0,
  }));

  const micScale = useAnimatedStyle(() => ({
    transform: [{ scale: micButtonScale.value }],
  }));

  function triggerInTuneHaptic(currentCents: number) {
    const now = Date.now();
    const isInTune = Math.abs(currentCents) <= 5;

    if (isInTune && !wasInTuneRef.current && now - lastHapticRef.current > 600) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    const target = selectedString || currentTuning.strings[0];
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
      setDetectedString(target);
      triggerInTuneHaptic(roundedVar);
    }, 100);
  }

  function toggleListening() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    micButtonScale.value = withSequence(
      withSpring(0.85, { damping: 10 }),
      withSpring(1, { damping: 8 })
    );

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function handleStringSelect(s: GuitarString) {
    setSelectedString(s);
  }

  function handleTuningSelect(tuning: TuningConfig) {
    setCurrentTuning(tuning);
    setSelectedString(null);
    setDetectedString(null);
    setDetectedNote(null);
    setDetectedOctave(null);
    setDetectedFrequency(0);
    setCents(0);
  }

  const targetFreq = selectedString?.frequency || detectedString?.frequency || null;
  const activeCents = selectedString
    ? (detectedFrequency > 0 ? getCentsFromTarget(detectedFrequency, selectedString.frequency) : 0)
    : cents;

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
              <Ionicons name="person" size={16} color={Colors.dark.primary} />
              <Text style={styles.userBadgeText} numberOfLines={1}>
                {user.username}
              </Text>
            </View>
          ) : (
            <Ionicons name="person-circle-outline" size={26} color={Colors.dark.textSecondary} />
          )}
        </Pressable>

        <Pressable
          style={styles.topButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/premium");
          }}
        >
          {user?.isPremium ? (
            <View style={styles.proBadge}>
              <Ionicons name="diamond" size={14} color={Colors.dark.premium} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          ) : (
            <Ionicons name="diamond-outline" size={22} color={Colors.dark.premium} />
          )}
        </Pressable>
      </View>

      <View style={styles.tunerArea}>
        <TunerDial cents={activeCents} isActive={isListening && detectedFrequency > 0} />
      </View>

      <NoteDisplay
        note={detectedNote}
        octave={detectedOctave}
        cents={activeCents}
        frequency={detectedFrequency}
        isActive={isListening && detectedFrequency > 0}
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
              size={32}
              color={isListening ? Colors.dark.warning : Colors.dark.text}
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

      <View style={[styles.stringArea, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <StringSelector
          strings={currentTuning.strings}
          selectedString={selectedString}
          detectedString={detectedString}
          onSelect={handleStringSelect}
          isListening={isListening}
        />

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
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  topButton: {
    padding: 8,
  },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.dark.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  userBadgeText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.dark.primary,
    maxWidth: 100,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 215, 0, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: Colors.dark.premium,
    letterSpacing: 0.5,
  },
  tunerArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
    paddingBottom: 10,
  },
  micSection: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  micPulse: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.dark.primary,
    top: 10,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.surface,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: {
    backgroundColor: Colors.dark.warningMuted,
    borderColor: Colors.dark.warning,
  },
  micLabel: {
    fontSize: 13,
    color: Colors.dark.textTertiary,
  },
  stringArea: {
    flex: 1,
    justifyContent: "flex-end",
    gap: 12,
  },
});
