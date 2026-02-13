import { useEffect } from "react";
import { View, Text, Platform } from "react-native";
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

const ACCENT = "#4AEDC4";
const ACCENT_DIM = "rgba(74, 237, 196, 0.15)";
const ACCENT_MED = "rgba(74, 237, 196, 0.35)";
const ACCENT_GLOW = "rgba(74, 237, 196, 0.06)";
const RED = "#FF4444";
const RED_DIM = "rgba(255, 68, 68, 0.3)";
const ORANGE = "#FF9544";

export default function TunerDial({ cents, isActive, size = 300 }: TunerDialProps) {
  const DIAL = size;
  const needleRotation = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      const clampedCents = Math.max(-50, Math.min(50, cents));
      needleRotation.value = withSpring(clampedCents, {
        damping: 18,
        stiffness: 90,
        mass: 0.4,
      });
      const inTune = Math.abs(cents) <= 5;
      glowOpacity.value = withSpring(inTune ? 1 : 0, { damping: 15, stiffness: 80 });
      if (inTune) {
        glowPulse.value = withRepeat(
          withSequence(
            withTiming(0.7, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
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
    const rotation = interpolate(needleRotation.value, [-50, 0, 50], [-65, 0, 65]);
    return { transform: [{ rotate: `${rotation}deg` }] };
  });

  const needleColorStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      Math.abs(needleRotation.value),
      [0, 5, 25, 50],
      [ACCENT, ACCENT, ORANGE, RED]
    );
    return { backgroundColor: color };
  });

  const inTuneGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * glowPulse.value,
  }));

  const TOTAL_SEGMENTS = 41;
  const ARC_SPAN = 130;
  const START_ANGLE = -ARC_SPAN / 2 - 90;
  const outerRadius = DIAL / 2;
  const segmentHeight = DIAL * 0.065;
  const segmentWidth = 4;
  const segmentGap = ARC_SPAN / TOTAL_SEGMENTS;

  const segments = [];
  for (let i = 0; i < TOTAL_SEGMENTS; i++) {
    const angle = START_ANGLE + i * segmentGap + segmentGap / 2;
    const normalizedPos = i / (TOTAL_SEGMENTS - 1);
    const distFromCenter = Math.abs(normalizedPos - 0.5) * 2;

    const isCenterZone = distFromCenter < 0.15;
    const isMidZone = distFromCenter < 0.5;
    const isEdgeZone = distFromCenter > 0.85;

    let color = "rgba(74, 237, 196, 0.12)";
    let h = segmentHeight;
    let w = segmentWidth;

    if (isCenterZone) {
      color = ACCENT;
      h = segmentHeight * 1.5;
      w = 5;
    } else if (isMidZone) {
      color = ACCENT_MED;
      h = segmentHeight * 1.15;
    } else if (isEdgeZone) {
      color = RED_DIM;
      h = segmentHeight * 1.3;
      w = 5;
    }

    segments.push(
      <View
        key={`seg-${i}`}
        style={{
          position: "absolute" as const,
          left: outerRadius - w / 2,
          top: 0,
          width: w,
          height: outerRadius,
          alignItems: "center" as const,
          transformOrigin: `${w / 2}px ${outerRadius}px`,
          transform: [{ rotate: `${angle}deg` }],
        }}
      >
        <View
          style={{
            width: w,
            height: h,
            backgroundColor: color,
            borderRadius: 2,
          }}
        />
      </View>
    );
  }

  const innerSegments = [];
  const INNER_TOTAL = 81;
  const innerSegmentH = DIAL * 0.03;
  const innerOffset = segmentHeight * 1.5 + 6;

  for (let i = 0; i < INNER_TOTAL; i++) {
    const angle = START_ANGLE + (i / (INNER_TOTAL - 1)) * ARC_SPAN;
    const normalizedPos = i / (INNER_TOTAL - 1);
    const distFromCenter = Math.abs(normalizedPos - 0.5) * 2;

    let color = "rgba(74, 237, 196, 0.06)";
    if (distFromCenter < 0.12) color = "rgba(74, 237, 196, 0.25)";
    else if (distFromCenter > 0.85) color = "rgba(255, 68, 68, 0.15)";

    innerSegments.push(
      <View
        key={`inner-${i}`}
        style={{
          position: "absolute" as const,
          left: outerRadius - 1,
          top: innerOffset,
          width: 2,
          height: outerRadius - innerOffset,
          alignItems: "center" as const,
          transformOrigin: `1px ${outerRadius - innerOffset}px`,
          transform: [{ rotate: `${angle}deg` }],
        }}
      >
        <View
          style={{
            width: i % 4 === 0 ? 2 : 1,
            height: i % 4 === 0 ? innerSegmentH * 1.4 : innerSegmentH,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
      </View>
    );
  }

  const needleLength = outerRadius - DIAL * 0.18;

  return (
    <View style={{ width: DIAL, height: DIAL / 2 + 20, alignItems: "center", overflow: "hidden" }}>
      <View
        style={{
          width: DIAL,
          height: DIAL,
          borderRadius: DIAL / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
        }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              width: DIAL + 30,
              height: DIAL + 30,
              borderRadius: (DIAL + 30) / 2,
              backgroundColor: ACCENT_GLOW,
              borderWidth: 1.5,
              borderColor: "rgba(74, 237, 196, 0.15)",
            },
            inTuneGlowStyle,
          ]}
        />

        {segments}
        {innerSegments}

        <View
          style={{
            position: "absolute",
            left: DIAL * 0.08,
            top: DIAL / 2 - DIAL * 0.04,
          }}
        >
          <Text style={{ color: ACCENT_MED, fontSize: DIAL * 0.045, fontWeight: "600" as const, fontStyle: "italic" as const }}>b</Text>
        </View>
        <View
          style={{
            position: "absolute",
            right: DIAL * 0.08,
            top: DIAL / 2 - DIAL * 0.04,
          }}
        >
          <Text style={{ color: ACCENT_MED, fontSize: DIAL * 0.045, fontWeight: "600" as const }}>#</Text>
        </View>

        <Animated.View
          style={[
            {
              position: "absolute",
              width: 6,
              height: needleLength,
              left: DIAL / 2 - 3,
              top: DIAL / 2 - needleLength,
              alignItems: "center" as const,
              transformOrigin: `3px ${needleLength}px`,
            },
            needleStyle,
          ]}
        >
          <Animated.View
            style={[
              {
                width: 2.5,
                height: needleLength,
                borderRadius: 1.25,
              },
              needleColorStyle,
            ]}
          />
          <View
            style={{
              position: "absolute",
              width: 3,
              height: needleLength,
              borderRadius: 1.5,
              backgroundColor: "rgba(0,0,0,0.2)",
              left: 3,
              top: 2,
            }}
          />
        </Animated.View>

        <View
          style={{
            position: "absolute",
            width: DIAL * 0.06,
            height: DIAL * 0.06,
            borderRadius: DIAL * 0.03,
            backgroundColor: "#1A1A1A",
            borderWidth: 2,
            borderColor: ACCENT_MED,
            ...(Platform.OS === "web"
              ? { boxShadow: `0 0 12px ${ACCENT_DIM}` }
              : {}),
          }}
        />
      </View>
    </View>
  );
}
