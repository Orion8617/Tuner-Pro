import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import Colors from "@/constants/colors";
import { getTuningStatus } from "@/lib/tuner-engine";

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

  useEffect(() => {
    if (status === "in_tune") {
      pulseScale.value = withSpring(1.05, { damping: 8, stiffness: 100 });
      setTimeout(() => {
        pulseScale.value = withSpring(1, { damping: 12 });
      }, 200);
    }
  }, [status]);

  const noteStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const statusColor =
    status === "in_tune"
      ? Colors.dark.accent
      : status === "flat" || status === "sharp"
      ? Math.abs(cents) > 20
        ? Colors.dark.warning
        : Colors.dark.primary
      : Colors.dark.textTertiary;

  const statusText =
    status === "in_tune"
      ? "Afinado"
      : status === "flat"
      ? "Bajo"
      : status === "sharp"
      ? "Alto"
      : "";

  const centsLabel = isActive
    ? cents > 0
      ? `+${cents}`
      : `${cents}`
    : "--";

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

      <View style={styles.infoRow}>
        <View style={styles.infoPill}>
          <Text style={styles.infoLabel}>cents</Text>
          <Text style={[styles.infoValue, { color: statusColor }]}>{centsLabel}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: statusColor + "20" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {isActive ? statusText : "Esperando..."}
          </Text>
        </View>

        <View style={styles.infoPill}>
          <Text style={styles.infoLabel}>Hz</Text>
          <Text style={[styles.infoValue, { color: Colors.dark.textSecondary }]}>
            {isActive ? frequency.toFixed(1) : "--"}
          </Text>
        </View>
      </View>

      {targetFrequency && (
        <Text style={styles.targetFreq}>
          Objetivo: {targetFrequency.toFixed(2)} Hz
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 12,
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  note: {
    fontSize: 64,
    fontWeight: "800" as const,
    letterSpacing: 2,
  },
  octave: {
    fontSize: 24,
    fontWeight: "600" as const,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoPill: {
    alignItems: "center",
    minWidth: 60,
  },
  infoLabel: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  targetFreq: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginTop: 4,
  },
});
