import { useEffect } from "react";
import { View, Text, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface GuitarStringNeonProps {
  stringIndex: number;
  note: string;
  stringNumber: number;
  isInTune: boolean;
  isDetected: boolean;
  wasTuned: boolean;
  xPosition: number;
  headstockY: number;
  soundHoleTopY: number;
  bridgeY: number;
}

const STRING_THICKNESSES = [4.0, 3.4, 2.8, 2.2, 1.6, 1.3];
const STRING_COLORS_IDLE = [
  Colors.dark.stringWound,
  Colors.dark.stringWound,
  Colors.dark.stringWound,
  Colors.dark.stringSteel,
  Colors.dark.stringSteel,
  Colors.dark.stringSteel,
];

export default function GuitarStringNeon({
  stringIndex,
  note,
  stringNumber,
  isInTune,
  isDetected,
  wasTuned,
  xPosition,
  headstockY,
  soundHoleTopY,
  bridgeY,
}: GuitarStringNeonProps) {
  const thickness = STRING_THICKNESSES[stringIndex] || 2;
  const baseColor = STRING_COLORS_IDLE[stringIndex] || Colors.dark.stringSteel;
  const stringHeight = bridgeY - headstockY;
  const glowSectionHeight = soundHoleTopY - headstockY;

  const glowProgress = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const stringBrightness = useSharedValue(0);
  const neonPulse = useSharedValue(1);
  const vibrate = useSharedValue(0);
  const labelGlow = useSharedValue(0);

  useEffect(() => {
    if (isInTune) {
      stringBrightness.value = withTiming(1, { duration: 200 });
      glowOpacity.value = withTiming(1, { duration: 300 });
      glowProgress.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
      vibrate.value = withTiming(0, { duration: 100 });
      labelGlow.value = withDelay(300, withTiming(1, { duration: 300 }));
      neonPulse.value = withDelay(
        600,
        withRepeat(
          withSequence(
            withTiming(0.7, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    } else if (isDetected) {
      stringBrightness.value = withTiming(0.6, { duration: 200 });
      glowOpacity.value = withTiming(0, { duration: 300 });
      glowProgress.value = withTiming(0, { duration: 400 });
      neonPulse.value = withTiming(1, { duration: 200 });
      labelGlow.value = withTiming(0, { duration: 200 });
      vibrate.value = withRepeat(
        withSequence(
          withTiming(-1.5, { duration: 35 }),
          withTiming(1.5, { duration: 35 })
        ),
        -1,
        true
      );
    } else if (wasTuned) {
      stringBrightness.value = withTiming(0.8, { duration: 400 });
      glowOpacity.value = withTiming(0.5, { duration: 500 });
      glowProgress.value = withTiming(1, { duration: 300 });
      vibrate.value = withTiming(0, { duration: 100 });
      labelGlow.value = withTiming(0.7, { duration: 300 });
      neonPulse.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      stringBrightness.value = withTiming(0, { duration: 400 });
      glowOpacity.value = withTiming(0, { duration: 400 });
      glowProgress.value = withTiming(0, { duration: 500 });
      neonPulse.value = withTiming(1, { duration: 200 });
      vibrate.value = withTiming(0, { duration: 100 });
      labelGlow.value = withTiming(0, { duration: 200 });
    }
  }, [isInTune, isDetected, wasTuned]);

  const stringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + stringBrightness.value * 0.5,
    transform: [{ translateX: vibrate.value }],
  }));

  const stringHighlightStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + stringBrightness.value * 0.3,
  }));

  const glowBeamStyle = useAnimatedStyle(() => ({
    height: glowProgress.value * glowSectionHeight,
    opacity: glowOpacity.value * neonPulse.value,
  }));

  const glowHaloStyle = useAnimatedStyle(() => ({
    height: glowProgress.value * glowSectionHeight,
    opacity: glowOpacity.value * 0.4 * neonPulse.value,
  }));

  const labelGlowStyle = useAnimatedStyle(() => ({
    opacity: labelGlow.value,
  }));

  const glowWidth = thickness + 6;
  const haloWidth = thickness + 18;

  return (
    <>
      <Animated.View
        style={[
          {
            position: "absolute" as const,
            left: xPosition - thickness / 2,
            top: headstockY,
            width: thickness,
            height: stringHeight,
            backgroundColor: baseColor,
            borderRadius: thickness / 2,
          },
          stringStyle,
        ]}
      />

      <Animated.View
        style={[
          {
            position: "absolute" as const,
            left: xPosition - (thickness * 0.3) / 2,
            top: headstockY,
            width: thickness * 0.3,
            height: stringHeight,
            backgroundColor: Colors.dark.stringHighlight,
            borderRadius: thickness * 0.15,
          },
          stringHighlightStyle,
        ]}
      />

      <View
        style={{
          position: "absolute" as const,
          left: xPosition - haloWidth / 2,
          top: headstockY,
          width: haloWidth,
          height: glowSectionHeight,
          overflow: "hidden" as const,
          pointerEvents: "none" as const,
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute" as const,
              bottom: 0,
              left: 0,
              width: haloWidth,
              backgroundColor: Colors.dark.neonGlow,
              borderRadius: haloWidth / 2,
            },
            glowHaloStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              position: "absolute" as const,
              bottom: 0,
              left: (haloWidth - glowWidth) / 2,
              width: glowWidth,
              backgroundColor: Colors.dark.neon,
              borderRadius: glowWidth / 2,
            },
            glowBeamStyle,
          ]}
        />
      </View>

      <View
        style={{
          position: "absolute" as const,
          left: xPosition - 12,
          top: headstockY - 22,
          width: 24,
          height: 18,
          borderRadius: 4,
          backgroundColor: "rgba(26, 18, 11, 0.8)",
          borderWidth: 1,
          borderColor: "rgba(212, 165, 116, 0.2)",
          alignItems: "center" as const,
          justifyContent: "center" as const,
        }}
      >
        <Text
          style={{
            color: Colors.dark.amber,
            fontSize: 10,
            fontWeight: "700" as const,
            letterSpacing: 0.3,
            fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
          }}
        >
          {note}
        </Text>
      </View>

      <Animated.View
        style={[
          {
            position: "absolute" as const,
            left: xPosition - 12,
            top: headstockY - 22,
            width: 24,
            height: 18,
            borderRadius: 4,
            backgroundColor: "rgba(57, 255, 20, 0.15)",
            borderWidth: 1,
            borderColor: Colors.dark.neonSoft,
            alignItems: "center" as const,
            justifyContent: "center" as const,
          },
          labelGlowStyle,
          { pointerEvents: "none" as const },
        ]}
      >
        <Text
          style={{
            color: Colors.dark.neon,
            fontSize: 10,
            fontWeight: "800" as const,
            letterSpacing: 0.3,
            fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
          }}
        >
          {note}
        </Text>
      </Animated.View>
    </>
  );
}
