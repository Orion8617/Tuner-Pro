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
  size?: number;
}

export default function TunerDial({ cents, isActive, size = 260 }: TunerDialProps) {
  const DIAL = size;
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
      [Colors.dark.neon, Colors.dark.neon, Colors.dark.ochre, Colors.dark.needleRed]
    );
    return { backgroundColor: color };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.5,
    transform: [{ scale: glowPulse.value }],
  }));

  const centerGlowStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      glowOpacity.value,
      [0, 1],
      ["rgba(57, 255, 20, 0.0)", "rgba(57, 255, 20, 0.08)"]
    );
    return { backgroundColor: color };
  });

  const tickMarks = [];
  for (let i = -10; i <= 10; i++) {
    const angle = (i / 10) * 45;
    const isMajor = i === 0;
    const isQuarter = Math.abs(i) === 5;
    const isEdge = Math.abs(i) === 10;

    let height = DIAL * 0.042;
    let width = 1;
    let color = "rgba(200, 192, 176, 0.15)";

    if (isMajor) {
      height = DIAL * 0.1;
      width = 2.5;
      color = Colors.dark.neon;
    } else if (isEdge) {
      height = DIAL * 0.08;
      width = 2;
      color = Colors.dark.needleRed;
    } else if (isQuarter) {
      height = DIAL * 0.065;
      width = 1.5;
      color = Colors.dark.ochre;
    }

    tickMarks.push(
      <View
        key={i}
        style={{
          position: "absolute" as const,
          top: DIAL * 0.04,
          width: 3,
          height: DIAL / 2 - DIAL * 0.04,
          alignItems: "center" as const,
          left: DIAL / 2 - 1.5,
          transformOrigin: "center bottom",
          transform: [{ rotate: `${angle}deg` }],
        }}
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
    <View style={{ width: DIAL, height: DIAL / 2 + 10, alignItems: "center", justifyContent: "flex-end" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: DIAL + 20,
            height: DIAL + 20,
            borderRadius: (DIAL + 20) / 2,
            bottom: -((DIAL + 20) / 2) + 10,
            backgroundColor: "rgba(57, 255, 20, 0.05)",
            borderWidth: 1,
            borderColor: "rgba(57, 255, 20, 0.12)",
          },
          glowStyle,
        ]}
      />

      <View
        style={{
          position: "absolute",
          bottom: -(DIAL / 2) + 10,
          width: DIAL,
          height: DIAL,
          borderRadius: DIAL / 2,
          backgroundColor: Colors.dark.soundHole,
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: DIAL / 2 }, centerGlowStyle]} />

        <View
          style={{
            position: "absolute",
            top: DIAL / 2 - DIAL * 0.11,
            left: 0,
            right: 0,
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: DIAL * 0.12,
          }}
        >
          <Text style={[styles.dialLabelFlat, { fontSize: DIAL * 0.058 }]}>b</Text>
          <Text style={[styles.dialLabelSharp, { fontSize: DIAL * 0.058 }]}>{"#"}</Text>
        </View>

        {tickMarks}

        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: DIAL / 2 - 5,
              width: 5,
              height: DIAL / 2 - DIAL * 0.1,
              alignItems: "center",
              transformOrigin: "center bottom",
            },
            needleStyle,
          ]}
        >
          <Animated.View style={[{ width: 2, height: "100%" as any, borderRadius: 1 }, needleColorStyle]} />
          <View style={styles.needleShadow} />
        </Animated.View>

        <View
          style={{
            position: "absolute",
            bottom: DIAL / 2 - DIAL * 0.045,
            width: DIAL * 0.09,
            height: DIAL * 0.09,
            borderRadius: DIAL * 0.045,
            backgroundColor: Colors.dark.surfaceHighlight,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(200, 192, 176, 0.15)",
          }}
        >
          <View
            style={{
              width: DIAL * 0.05,
              height: DIAL * 0.05,
              borderRadius: DIAL * 0.025,
              backgroundColor: Colors.dark.woodMedium,
              borderWidth: 1,
              borderColor: "rgba(200, 192, 176, 0.08)",
            }}
          />
          <View
            style={{
              position: "absolute",
              width: 3,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: Colors.dark.brass,
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dialLabelFlat: {
    color: Colors.dark.textTertiary,
    fontWeight: "600" as const,
    fontStyle: "italic" as const,
  },
  dialLabelSharp: {
    color: Colors.dark.textTertiary,
    fontWeight: "600" as const,
  },
  needleShadow: {
    position: "absolute",
    width: 2.5,
    height: "100%" as any,
    borderRadius: 1.25,
    backgroundColor: "rgba(0,0,0,0.2)",
    left: 2.5,
    top: 2,
  },
});
