import { useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  interpolateColor,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface TunerDialProps {
  cents: number;
  isActive: boolean;
}

export default function TunerDial({ cents, isActive }: TunerDialProps) {
  const needleRotation = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(1);
  const ringProgress = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      const clampedCents = Math.max(-50, Math.min(50, cents));
      needleRotation.value = withSpring(clampedCents, {
        damping: 18,
        stiffness: 90,
        mass: 0.6,
      });
      const inTune = Math.abs(cents) <= 5;
      glowOpacity.value = withSpring(inTune ? 1 : 0, { damping: 15, stiffness: 80 });
      ringProgress.value = withTiming(1 - Math.min(Math.abs(cents) / 50, 1), { duration: 400 });

      if (inTune) {
        glowPulse.value = withRepeat(
          withSequence(
            withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        );
      } else {
        glowPulse.value = withTiming(1, { duration: 300 });
      }
    } else {
      needleRotation.value = withSpring(0, { damping: 20, stiffness: 60 });
      glowOpacity.value = withTiming(0, { duration: 400 });
      glowPulse.value = withTiming(1, { duration: 300 });
      ringProgress.value = withTiming(0, { duration: 400 });
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
      [0, 5, 15, 35, 50],
      [Colors.dark.accent, Colors.dark.accent, "#90CAF9", Colors.dark.primary, Colors.dark.warning]
    );
    return { backgroundColor: color };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.8,
    transform: [{ scale: glowPulse.value }],
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.4,
    transform: [{ scale: glowPulse.value * 0.95 }],
  }));

  const centerDotStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      glowOpacity.value,
      [0, 1],
      [Colors.dark.textTertiary, Colors.dark.accent]
    );
    return { borderColor: color };
  });

  const tickMarks = [];
  for (let i = -10; i <= 10; i++) {
    const angle = (i / 10) * 45;
    const isMajor = i === 0;
    const isQuarter = Math.abs(i) === 5;
    const isEdge = Math.abs(i) === 10;
    const isMinor = !isMajor && !isQuarter && !isEdge;

    let height = 14;
    let width = 1.5;
    let color = "rgba(255,255,255,0.15)";

    if (isMajor) {
      height = 30;
      width = 3;
      color = Colors.dark.accent;
    } else if (isEdge) {
      height = 24;
      width = 2;
      color = Colors.dark.warning;
    } else if (isQuarter) {
      height = 20;
      width = 2;
      color = Colors.dark.primary;
    }

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
            {
              height,
              width,
              backgroundColor: color,
              borderRadius: width / 2,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.outerGlow, glowStyle]} />
      <Animated.View style={[styles.innerGlow, innerGlowStyle]} />

      <Animated.View style={[styles.glowRing, glowStyle]} />

      <View style={styles.dialFace}>
        <View style={styles.dialGradientInner} />

        {tickMarks}

        <Animated.View style={[styles.needlePivot, needleStyle]}>
          <Animated.View style={[styles.needle, needleColorStyle]} />
          <Animated.View style={[styles.needleTip, needleColorStyle]} />
        </Animated.View>

        <Animated.View style={[styles.centerDot, centerDotStyle]}>
          <View style={styles.centerDotInner} />
        </Animated.View>
      </View>
    </View>
  );
}

const DIAL_SIZE = 270;

const styles = StyleSheet.create({
  container: {
    width: DIAL_SIZE + 60,
    height: (DIAL_SIZE + 60) / 2 + 35,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  outerGlow: {
    position: "absolute",
    width: DIAL_SIZE + 60,
    height: DIAL_SIZE + 60,
    borderRadius: (DIAL_SIZE + 60) / 2,
    bottom: -((DIAL_SIZE + 60) / 2) + 35,
    backgroundColor: "rgba(0, 230, 118, 0.06)",
  },
  innerGlow: {
    position: "absolute",
    width: DIAL_SIZE + 30,
    height: DIAL_SIZE + 30,
    borderRadius: (DIAL_SIZE + 30) / 2,
    bottom: -((DIAL_SIZE + 30) / 2) + 35,
    backgroundColor: "rgba(0, 230, 118, 0.08)",
  },
  glowRing: {
    position: "absolute",
    width: DIAL_SIZE + 20,
    height: DIAL_SIZE + 20,
    borderRadius: (DIAL_SIZE + 20) / 2,
    bottom: -((DIAL_SIZE + 20) / 2) + 35,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "rgba(0, 230, 118, 0.5)",
    ...(Platform.OS === "web"
      ? { boxShadow: `0 0 20px rgba(0, 230, 118, 0.25), 0 0 50px rgba(0, 230, 118, 0.1), inset 0 0 20px rgba(0, 230, 118, 0.05)` }
      : {
          shadowColor: Colors.dark.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 25,
        }),
  },
  dialFace: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.06)",
    position: "absolute",
    bottom: -(DIAL_SIZE / 2) + 35,
    alignItems: "center",
    overflow: "hidden",
  },
  dialGradientInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DIAL_SIZE / 2,
    backgroundColor: "rgba(0,0,0,0.3)",
    opacity: 0.5,
  },
  tickContainer: {
    position: "absolute",
    top: 12,
    width: 3,
    height: DIAL_SIZE / 2 - 12,
    alignItems: "center",
    left: DIAL_SIZE / 2 - 1.5,
    transformOrigin: "center bottom",
  },
  tick: {
    borderRadius: 1,
  },
  needlePivot: {
    position: "absolute",
    bottom: DIAL_SIZE / 2 - 6,
    width: 4,
    height: DIAL_SIZE / 2 - 30,
    alignItems: "center",
    transformOrigin: "center bottom",
  },
  needle: {
    width: 2.5,
    height: "85%" as any,
    borderRadius: 1.5,
  },
  needleTip: {
    position: "absolute",
    top: 0,
    width: 4,
    height: 8,
    borderRadius: 2,
    opacity: 0.7,
  },
  centerDot: {
    position: "absolute",
    bottom: DIAL_SIZE / 2 - 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  centerDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.textTertiary,
  },
});
