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

const STRING_THICKNESSES = [3.5, 3, 2.5, 2, 1.5, 1.2];

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
  const stringHeight = bridgeY - headstockY;
  const glowSectionHeight = soundHoleTopY - headstockY;

  const glowProgress = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const stringBrightness = useSharedValue(0);
  const labelOpacity = useSharedValue(0);
  const labelScale = useSharedValue(0.5);
  const neonPulse = useSharedValue(1);
  const vibrate = useSharedValue(0);

  useEffect(() => {
    if (isInTune) {
      stringBrightness.value = withTiming(1, { duration: 200 });
      glowOpacity.value = withTiming(1, { duration: 300 });
      glowProgress.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
      labelOpacity.value = withDelay(350, withTiming(1, { duration: 250 }));
      labelScale.value = withDelay(350, withTiming(1, { duration: 300 }));
      vibrate.value = withTiming(0, { duration: 100 });
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
      stringBrightness.value = withTiming(0.5, { duration: 200 });
      glowOpacity.value = withTiming(0, { duration: 300 });
      glowProgress.value = withTiming(0, { duration: 400 });
      labelOpacity.value = withTiming(0, { duration: 200 });
      labelScale.value = withTiming(0.5, { duration: 200 });
      neonPulse.value = withTiming(1, { duration: 200 });
      vibrate.value = withRepeat(
        withSequence(
          withTiming(-1, { duration: 40 }),
          withTiming(1, { duration: 40 })
        ),
        -1,
        true
      );
    } else if (wasTuned) {
      stringBrightness.value = withTiming(0.8, { duration: 400 });
      glowOpacity.value = withTiming(0.5, { duration: 500 });
      glowProgress.value = withTiming(1, { duration: 300 });
      labelOpacity.value = withTiming(0.7, { duration: 300 });
      labelScale.value = withTiming(1, { duration: 300 });
      vibrate.value = withTiming(0, { duration: 100 });
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
      labelOpacity.value = withTiming(0, { duration: 200 });
      labelScale.value = withTiming(0.5, { duration: 200 });
      neonPulse.value = withTiming(1, { duration: 200 });
      vibrate.value = withTiming(0, { duration: 100 });
    }
  }, [isInTune, isDetected, wasTuned]);

  const stringStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + stringBrightness.value * 0.75,
    transform: [{ translateX: vibrate.value }],
  }));

  const glowBeamStyle = useAnimatedStyle(() => ({
    height: glowProgress.value * glowSectionHeight,
    opacity: glowOpacity.value * neonPulse.value,
  }));

  const glowHaloStyle = useAnimatedStyle(() => ({
    height: glowProgress.value * glowSectionHeight,
    opacity: glowOpacity.value * 0.4 * neonPulse.value,
  }));

  const labelAnimStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ scale: labelScale.value }],
  }));

  const glowWidth = thickness + 4;
  const haloWidth = thickness + 14;

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
            backgroundColor: Colors.dark.amber,
            borderRadius: thickness / 2,
          },
          stringStyle,
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
        }}
        pointerEvents="none"
      >
        <Animated.View
          style={[
            {
              position: "absolute" as const,
              bottom: 0,
              left: (haloWidth - haloWidth) / 2,
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

      <Animated.View
        style={[
          {
            position: "absolute" as const,
            left: xPosition - 16,
            top: headstockY - 28,
            width: 32,
            height: 24,
            borderRadius: 6,
            backgroundColor: "rgba(57, 255, 20, 0.15)",
            borderWidth: 1,
            borderColor: Colors.dark.neonSoft,
            alignItems: "center" as const,
            justifyContent: "center" as const,
          },
          labelAnimStyle,
        ]}
      >
        <Text
          style={{
            color: Colors.dark.neon,
            fontSize: 11,
            fontWeight: "800" as const,
            letterSpacing: 0.5,
            fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
          }}
        >
          {note}{stringNumber}
        </Text>
      </Animated.View>
    </>
  );
}
