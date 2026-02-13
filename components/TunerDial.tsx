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
    opacity: glowOpacity.value * 0.6,
    transform: [{ scale: glowPulse.value }],
  }));

  const centerGlowStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      glowOpacity.value,
      [0, 1],
      ["rgba(57, 255, 20, 0.0)", "rgba(57, 255, 20, 0.1)"]
    );
    return { backgroundColor: color };
  });

  const tickMarks = [];
  for (let i = -10; i <= 10; i++) {
    const angle = (i / 10) * 45;
    const isMajor = i === 0;
    const isQuarter = Math.abs(i) === 5;
    const isEdge = Math.abs(i) === 10;

    let height = DIAL * 0.046;
    let width = 1;
    let color = "rgba(212, 165, 116, 0.2)";

    if (isMajor) {
      height = DIAL * 0.108;
      width = 2.5;
      color = Colors.dark.neon;
    } else if (isEdge) {
      height = DIAL * 0.085;
      width = 2;
      color = Colors.dark.needleRed;
    } else if (isQuarter) {
      height = DIAL * 0.069;
      width = 1.5;
      color = Colors.dark.ochre;
    }

    tickMarks.push(
      <View
        key={i}
        style={{
          position: "absolute" as const,
          top: DIAL * 0.046,
          width: 3,
          height: DIAL / 2 - DIAL * 0.046,
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
    <View style={{ width: DIAL + 50, height: (DIAL + 50) / 2 + 30, alignItems: "center", justifyContent: "flex-end" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: DIAL + 40,
            height: DIAL + 40,
            borderRadius: (DIAL + 40) / 2,
            bottom: -((DIAL + 40) / 2) + 30,
            backgroundColor: "rgba(57, 255, 20, 0.06)",
            borderWidth: 1,
            borderColor: "rgba(57, 255, 20, 0.15)",
          },
          glowStyle,
        ]}
      />

      <View
        style={{
          position: "absolute",
          bottom: -(DIAL / 2) + 30,
          width: DIAL + 12,
          height: DIAL + 12,
          borderRadius: (DIAL + 12) / 2,
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
        }}
      >
        <View
          style={{
            width: DIAL + 6,
            height: DIAL + 6,
            borderRadius: (DIAL + 6) / 2,
            backgroundColor: Colors.dark.surfaceHighlight,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(212, 165, 116, 0.15)",
          }}
        >
          <View
            style={{
              width: DIAL,
              height: DIAL,
              borderRadius: DIAL / 2,
              backgroundColor: Colors.dark.soundHole,
              alignItems: "center",
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(212, 165, 116, 0.08)",
            }}
          >
            <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: DIAL / 2 }, centerGlowStyle]} />

            <View
              style={{
                position: "absolute",
                top: DIAL / 2 - DIAL * 0.115,
                left: 0,
                right: 0,
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: DIAL * 0.135,
              }}
            >
              <Text style={[styles.dialLabelFlat, { fontSize: DIAL * 0.062 }]}>b</Text>
              <Text style={[styles.dialLabelSharp, { fontSize: DIAL * 0.062 }]}>{"#"}</Text>
            </View>

            {tickMarks}

            <Animated.View
              style={[
                {
                  position: "absolute",
                  bottom: DIAL / 2 - 6,
                  width: 6,
                  height: DIAL / 2 - DIAL * 0.108,
                  alignItems: "center",
                  transformOrigin: "center bottom",
                },
                needleStyle,
              ]}
            >
              <Animated.View style={[{ width: 2.5, height: "100%" as any, borderRadius: 1.5 }, needleColorStyle]} />
              <View style={styles.needleShadow} />
            </Animated.View>

            <View
              style={{
                position: "absolute",
                bottom: DIAL / 2 - DIAL * 0.054,
                width: DIAL * 0.108,
                height: DIAL * 0.108,
                borderRadius: DIAL * 0.054,
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
              }}
            >
              <View
                style={{
                  width: DIAL * 0.062,
                  height: DIAL * 0.062,
                  borderRadius: DIAL * 0.031,
                  backgroundColor: Colors.dark.woodMedium,
                  borderWidth: 1,
                  borderColor: "rgba(212, 165, 116, 0.1)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: Colors.dark.brass,
                }}
              />
            </View>
          </View>
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
    width: 3,
    height: "100%" as any,
    borderRadius: 1.5,
    backgroundColor: "rgba(0,0,0,0.2)",
    left: 3,
    top: 2,
  },
});
