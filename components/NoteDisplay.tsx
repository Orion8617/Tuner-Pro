import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
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
  const noteOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (status === "in_tune") {
      pulseScale.value = withSpring(1.06, { damping: 6, stiffness: 80 });
      setTimeout(() => {
        pulseScale.value = withSpring(1, { damping: 10 });
      }, 250);
    }
  }, [status]);

  useEffect(() => {
    if (isActive && note) {
      noteOpacity.value = withTiming(1, { duration: 200 });
    } else {
      noteOpacity.value = withTiming(0.3, { duration: 400 });
    }
  }, [isActive, note]);

  const noteStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: noteOpacity.value,
  }));

  const statusColor =
    status === "in_tune"
      ? Colors.dark.inTune
      : status === "flat" || status === "sharp"
      ? Math.abs(cents) > 25
        ? Colors.dark.needleRed
        : Math.abs(cents) > 10
        ? Colors.dark.ochre
        : Colors.dark.amber
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

      <View style={styles.centsBarContainer}>
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
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoPill}>
          <Text style={styles.infoLabel}>CENTS</Text>
          <Text style={[styles.infoValue, { color: statusColor }]}>{centsLabel}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: statusColor + "15", borderColor: statusColor + "25" }]}>
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
      </View>

      {targetFrequency && isActive && (
        <View style={styles.targetRow}>
          <View style={styles.targetDivider} />
          <Text style={styles.targetFreq}>
            {t("noteDisplay.target")} {targetFrequency.toFixed(2)} Hz
          </Text>
          <View style={styles.targetDivider} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  note: {
    fontSize: 72,
    fontWeight: "300" as const,
    letterSpacing: 4,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  octave: {
    fontSize: 24,
    fontWeight: "400" as const,
    marginTop: 12,
    opacity: 0.6,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  centsBarContainer: {
    width: "100%",
    paddingHorizontal: 40,
  },
  centsBarTrack: {
    height: 3,
    backgroundColor: Colors.dark.borderLight,
    borderRadius: 1.5,
    overflow: "hidden",
    position: "relative",
  },
  centsBarCenter: {
    position: "absolute",
    left: "50%",
    top: -1,
    width: 2,
    height: 5,
    backgroundColor: Colors.dark.ochre,
    marginLeft: -1,
    borderRadius: 1,
  },
  centsBarFill: {
    position: "absolute",
    top: 0,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.7,
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
    fontSize: 17,
    fontWeight: "600" as const,
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  targetDivider: {
    height: 1,
    width: 20,
    backgroundColor: Colors.dark.border,
  },
  targetFreq: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
  },
});
