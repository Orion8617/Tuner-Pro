import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
  interpolateColor,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import Colors from "@/constants/colors";
import { getTuningStatus } from "@/lib/tuner-engine";
import { t } from "@/lib/i18n";

interface NoteDisplayProps {
  note: string | null;
  octave: number | null;
  cents: number;
  frequency: number;
  isActive: boolean;
  targetFrequency: number | null;
}

export default function NoteDisplay({
  note,
  octave,
  cents,
  frequency,
  isActive,
  targetFrequency,
}: NoteDisplayProps) {
  const status = isActive ? getTuningStatus(cents) : null;
  const pulseScale = useSharedValue(1);
  const statusOpacity = useSharedValue(0);
  const noteOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (status === "in_tune") {
      pulseScale.value = withSpring(1.08, { damping: 6, stiffness: 80 });
      setTimeout(() => {
        pulseScale.value = withSpring(1, { damping: 10 });
      }, 250);
    }
  }, [status]);

  useEffect(() => {
    if (isActive && note) {
      noteOpacity.value = withTiming(1, { duration: 200 });
      statusOpacity.value = withTiming(1, { duration: 300 });
    } else {
      noteOpacity.value = withTiming(0.3, { duration: 400 });
      statusOpacity.value = withTiming(0.5, { duration: 300 });
    }
  }, [isActive, note]);

  const noteStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: noteOpacity.value,
  }));

  const statusBarStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  const statusColor =
    status === "in_tune"
      ? Colors.dark.accent
      : status === "flat" || status === "sharp"
      ? Math.abs(cents) > 25
        ? Colors.dark.warning
        : Math.abs(cents) > 10
        ? Colors.dark.primary
        : "#90CAF9"
      : Colors.dark.textTertiary;

  const statusText =
    status === "in_tune"
      ? t("noteDisplay.inTune")
      : status === "flat"
      ? t("noteDisplay.flat")
      : status === "sharp"
      ? t("noteDisplay.sharp")
      : "";

  const centsLabel = isActive
    ? cents > 0
      ? `+${cents}`
      : `${cents}`
    : "--";

  const centsBarWidth = Math.min(Math.abs(cents), 50);
  const centsBarDirection = cents >= 0 ? "right" : "left";

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.noteContainer, noteStyle]}>
        <Text style={[styles.note, { color: isActive ? statusColor : Colors.dark.textTertiary }]}>
          {note || "--"}
        </Text>
        {octave !== null && isActive && (
          <Text style={[styles.octave, { color: statusColor }]}>{octave}</Text>
        )}
      </Animated.View>

      <Animated.View style={[styles.centsBarContainer, statusBarStyle]}>
        <View style={styles.centsBarTrack}>
          <View style={styles.centsBarCenter} />
          {isActive && Math.abs(cents) > 0 && (
            <View
              style={[
                styles.centsBarFill,
                {
                  width: `${centsBarWidth}%`,
                  backgroundColor: statusColor,
                  [centsBarDirection === "right" ? "left" : "right"]: "50%",
                },
              ]}
            />
          )}
        </View>
      </Animated.View>

      <Animated.View style={[styles.infoRow, statusBarStyle]}>
        <View style={styles.infoPill}>
          <Text style={styles.infoLabel}>CENTS</Text>
          <Text style={[styles.infoValue, { color: statusColor }]}>{centsLabel}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: statusColor + "18", borderColor: statusColor + "30" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {isActive ? statusText : t("noteDisplay.listening")}
          </Text>
        </View>

        <View style={styles.infoPill}>
          <Text style={styles.infoLabel}>Hz</Text>
          <Text style={[styles.infoValue, { color: Colors.dark.textSecondary }]}>
            {isActive ? frequency.toFixed(1) : "--"}
          </Text>
        </View>
      </Animated.View>

      {targetFrequency && isActive && (
        <View style={styles.targetRow}>
          <View style={styles.targetDot} />
          <Text style={styles.targetFreq}>
            {t("noteDisplay.target")} {targetFrequency.toFixed(2)} Hz
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  note: {
    fontSize: 72,
    fontWeight: "800" as const,
    letterSpacing: 3,
  },
  octave: {
    fontSize: 26,
    fontWeight: "600" as const,
    marginTop: 10,
    opacity: 0.7,
  },
  centsBarContainer: {
    width: "100%",
    paddingHorizontal: 30,
  },
  centsBarTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
    position: "relative",
  },
  centsBarCenter: {
    position: "absolute",
    left: "50%",
    top: 0,
    width: 2,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginLeft: -1,
  },
  centsBarFill: {
    position: "absolute",
    top: 0,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  infoPill: {
    alignItems: "center",
    minWidth: 56,
  },
  infoLabel: {
    fontSize: 9,
    color: Colors.dark.textTertiary,
    letterSpacing: 1.5,
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 7,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  targetDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.textTertiary,
  },
  targetFreq: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    fontWeight: "500" as const,
  },
});
