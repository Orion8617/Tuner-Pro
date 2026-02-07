import { useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface TunerDialProps {
  cents: number;
  isActive: boolean;
}

export default function TunerDial({ cents, isActive }: TunerDialProps) {
  const needleRotation = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      const clampedCents = Math.max(-50, Math.min(50, cents));
      needleRotation.value = withSpring(clampedCents, {
        damping: 15,
        stiffness: 120,
        mass: 0.8,
      });
      const inTune = Math.abs(cents) <= 5;
      glowOpacity.value = withSpring(inTune ? 1 : 0, { damping: 20 });
    } else {
      needleRotation.value = withSpring(0, { damping: 20 });
      glowOpacity.value = withSpring(0, { damping: 20 });
    }
  }, [cents, isActive]);

  const needleStyle = useAnimatedStyle(() => {
    const rotation = interpolate(needleRotation.value, [-50, 0, 50], [-45, 0, 45]);
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  const needleColorStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      Math.abs(needleRotation.value),
      [0, 5, 20, 50],
      [Colors.dark.accent, Colors.dark.accent, Colors.dark.primary, Colors.dark.warning]
    );
    return { backgroundColor: color };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const tickMarks = [];
  for (let i = -5; i <= 5; i++) {
    const angle = (i / 5) * 45;
    const isMajor = i === 0;
    const isMinor = Math.abs(i) === 5;
    tickMarks.push(
      <View
        key={i}
        style={[
          styles.tickContainer,
          { transform: [{ rotate: `${angle}deg` }] },
        ]}
      >
        <View
          style={[
            styles.tick,
            isMajor && styles.tickMajor,
            isMinor && styles.tickMinor,
            {
              backgroundColor: isMajor
                ? Colors.dark.accent
                : isMinor
                ? Colors.dark.warning
                : Colors.dark.textTertiary,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glowRing, glowStyle]} />
      <View style={styles.dialFace}>
        {tickMarks}
        <Animated.View style={[styles.needlePivot, needleStyle]}>
          <Animated.View style={[styles.needle, needleColorStyle]} />
          <View style={styles.needleDot} />
        </Animated.View>
        <View style={styles.centerDot} />
      </View>
    </View>
  );
}

const DIAL_SIZE = 260;

const styles = StyleSheet.create({
  container: {
    width: DIAL_SIZE + 40,
    height: (DIAL_SIZE + 40) / 2 + 30,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  glowRing: {
    position: "absolute",
    width: DIAL_SIZE + 30,
    height: DIAL_SIZE + 30,
    borderRadius: (DIAL_SIZE + 30) / 2,
    bottom: -((DIAL_SIZE + 30) / 2) + 30,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: Colors.dark.accent,
    ...(Platform.OS === "web"
      ? { boxShadow: `0 0 30px ${Colors.dark.accentMuted}, 0 0 60px ${Colors.dark.accentMuted}` }
      : {
          shadowColor: Colors.dark.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
        }),
  },
  dialFace: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    backgroundColor: Colors.dark.surface,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    position: "absolute",
    bottom: -(DIAL_SIZE / 2) + 30,
    alignItems: "center",
    overflow: "hidden",
  },
  tickContainer: {
    position: "absolute",
    top: 10,
    width: 2,
    height: DIAL_SIZE / 2 - 10,
    alignItems: "center",
    left: DIAL_SIZE / 2 - 1,
    transformOrigin: "center bottom",
  },
  tick: {
    width: 2,
    height: 20,
    borderRadius: 1,
  },
  tickMajor: {
    width: 3,
    height: 28,
  },
  tickMinor: {
    width: 2,
    height: 24,
  },
  needlePivot: {
    position: "absolute",
    bottom: DIAL_SIZE / 2 - 8,
    width: 4,
    height: DIAL_SIZE / 2 - 25,
    alignItems: "center",
    transformOrigin: "center bottom",
  },
  needle: {
    width: 3,
    height: "100%" as any,
    borderRadius: 2,
  },
  needleDot: {
    position: "absolute",
    bottom: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.dark.surfaceHighlight,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  centerDot: {
    position: "absolute",
    bottom: DIAL_SIZE / 2 - 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 2,
    borderColor: Colors.dark.textTertiary,
  },
});
