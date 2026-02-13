import { useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
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

  useEffect(() => {
    if (isActive) {
      const clampedCents = Math.max(-50, Math.min(50, cents));
      needleRotation.value = withSpring(clampedCents, {
        damping: 22,
        stiffness: 80,
        mass: 0.5,
      });
      const inTune = Math.abs(cents) <= 5;
      glowOpacity.value = withSpring(inTune ? 1 : 0, { damping: 15, stiffness: 80 });

      if (inTune) {
        glowPulse.value = withRepeat(
          withSequence(
            withTiming(1.04, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
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
      [Colors.dark.inTune, Colors.dark.inTune, Colors.dark.ochre, Colors.dark.needleRed]
    );
    return { backgroundColor: color };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.6,
    transform: [{ scale: glowPulse.value }],
  }));

  const centerGlowStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      glowOpacity.value,
      [0, 1],
      ["rgba(200, 169, 110, 0.0)", "rgba(141, 181, 128, 0.15)"]
    );
    return { backgroundColor: color };
  });

  const tickMarks = [];
  for (let i = -10; i <= 10; i++) {
    const angle = (i / 10) * 45;
    const isMajor = i === 0;
    const isQuarter = Math.abs(i) === 5;
    const isEdge = Math.abs(i) === 10;

    let height = 12;
    let width = 1;
    let color = "rgba(212, 165, 116, 0.2)";

    if (isMajor) {
      height = 28;
      width = 2.5;
      color = Colors.dark.inTune;
    } else if (isEdge) {
      height = 22;
      width = 2;
      color = Colors.dark.needleRed;
    } else if (isQuarter) {
      height = 18;
      width = 1.5;
      color = Colors.dark.ochre;
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
          style={{
            height,
            width,
            backgroundColor: color,
            borderRadius: width / 2,
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.inTuneGlow, glowStyle]} />

      <View style={styles.dialOuter}>
        <View style={styles.dialBezel}>
          <View style={styles.dialFace}>
            <Animated.View style={[styles.dialCenterGlow, centerGlowStyle]} />

            <View style={styles.dialLabelsRow}>
              <Text style={styles.dialLabelFlat}>b</Text>
              <Text style={styles.dialLabelSharp}>#</Text>
            </View>

            {tickMarks}

            <Animated.View style={[styles.needlePivot, needleStyle]}>
              <Animated.View style={[styles.needle, needleColorStyle]} />
              <View style={styles.needleShadow} />
            </Animated.View>

            <View style={styles.pivotCap}>
              <View style={styles.pivotCapInner} />
              <View style={styles.pivotCapDot} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const DIAL_SIZE = 260;

const styles = StyleSheet.create({
  container: {
    width: DIAL_SIZE + 50,
    height: (DIAL_SIZE + 50) / 2 + 30,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  inTuneGlow: {
    position: "absolute",
    width: DIAL_SIZE + 40,
    height: DIAL_SIZE + 40,
    borderRadius: (DIAL_SIZE + 40) / 2,
    bottom: -((DIAL_SIZE + 40) / 2) + 30,
    backgroundColor: "rgba(141, 181, 128, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(141, 181, 128, 0.2)",
  },
  dialOuter: {
    position: "absolute",
    bottom: -(DIAL_SIZE / 2) + 30,
    width: DIAL_SIZE + 12,
    height: DIAL_SIZE + 12,
    borderRadius: (DIAL_SIZE + 12) / 2,
    backgroundColor: Colors.dark.woodLight,
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.5)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 12,
          elevation: 10,
        }),
  },
  dialBezel: {
    width: DIAL_SIZE + 6,
    height: DIAL_SIZE + 6,
    borderRadius: (DIAL_SIZE + 6) / 2,
    backgroundColor: Colors.dark.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212, 165, 116, 0.15)",
  },
  dialFace: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    backgroundColor: Colors.dark.surface,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(212, 165, 116, 0.08)",
  },
  dialCenterGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DIAL_SIZE / 2,
  },
  dialLabelsRow: {
    position: "absolute",
    top: DIAL_SIZE / 2 - 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 35,
  },
  dialLabelFlat: {
    fontSize: 16,
    color: Colors.dark.textTertiary,
    fontWeight: "600" as const,
    fontStyle: "italic" as const,
  },
  dialLabelSharp: {
    fontSize: 16,
    color: Colors.dark.textTertiary,
    fontWeight: "600" as const,
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
  needlePivot: {
    position: "absolute",
    bottom: DIAL_SIZE / 2 - 6,
    width: 6,
    height: DIAL_SIZE / 2 - 28,
    alignItems: "center",
    transformOrigin: "center bottom",
  },
  needle: {
    width: 2.5,
    height: "100%" as any,
    borderRadius: 1.5,
  },
  needleShadow: {
    position: "absolute",
    width: 3,
    height: "100%" as any,
    borderRadius: 1.5,
    backgroundColor: "rgba(0,0,0,0.2)",
    left: 3,
    top: 2,
  },
  pivotCap: {
    position: "absolute",
    bottom: DIAL_SIZE / 2 - 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(212, 165, 116, 0.2)",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        }),
  },
  pivotCapInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.dark.woodMedium,
    borderWidth: 1,
    borderColor: "rgba(212, 165, 116, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  pivotCapDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.brass,
  },
});
