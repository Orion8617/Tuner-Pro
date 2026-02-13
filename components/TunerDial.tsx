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

const ACCENT = "#4AEDC4";
const ACCENT_DIM = "rgba(74, 237, 196, 0.15)";
const ACCENT_MED = "rgba(74, 237, 196, 0.35)";
const ACCENT_GLOW = "rgba(74, 237, 196, 0.06)";
const RED = "#FF4444";
const RED_DIM = "rgba(255, 68, 68, 0.3)";
const ORANGE = "#FF9544";
const TEXT_DIM = "rgba(255, 255, 255, 0.25)";
const TEXT_MED = "rgba(255, 255, 255, 0.5)";

interface TunerDialProps {
  cents: number;
  isActive: boolean;
  size?: number;
  note?: string | null;
  octave?: number | null;
  frequency?: number;
  statusColor?: string;
  centsDisplay?: string;
  isInTune?: boolean;
}

export default function TunerDial({
  cents,
  isActive,
  size = 340,
  note,
  octave,
  frequency = 0,
  statusColor = TEXT_DIM,
  centsDisplay = "000.0",
  isInTune = false,
}: TunerDialProps) {
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
  const ARC_SPAN = 140;
  const START_ANGLE = -ARC_SPAN / 2 - 90;
  const outerRadius = DIAL / 2;
  const segmentHeight = DIAL * 0.075;
  const segmentWidth = 6;
  const segmentGap = ARC_SPAN / TOTAL_SEGMENTS;

  const segments = [];
  for (let i = 0; i < TOTAL_SEGMENTS; i++) {
    const angle = START_ANGLE + i * segmentGap + segmentGap / 2;
    const normalizedPos = i / (TOTAL_SEGMENTS - 1);
    const distFromCenter = Math.abs(normalizedPos - 0.5) * 2;

    const isCenterZone = distFromCenter < 0.15;
    const isMidZone = distFromCenter < 0.5;
    const isEdgeZone = distFromCenter > 0.85;

    let color = "rgba(74, 237, 196, 0.15)";
    let h = segmentHeight;
    let w = segmentWidth;

    if (isCenterZone) {
      color = ACCENT;
      h = segmentHeight * 1.5;
      w = 7;
    } else if (isMidZone) {
      color = ACCENT_MED;
      h = segmentHeight * 1.15;
    } else if (isEdgeZone) {
      color = RED_DIM;
      h = segmentHeight * 1.3;
      w = 7;
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
  const innerSegmentH = DIAL * 0.035;
  const innerOffset = segmentHeight * 1.5 + 8;

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
            width: i % 4 === 0 ? 2.5 : 1,
            height: i % 4 === 0 ? innerSegmentH * 1.4 : innerSegmentH,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
      </View>
    );
  }

  const needleLength = outerRadius - DIAL * 0.15;

  const freqDisplay = isActive && frequency > 0
    ? `${frequency.toFixed(1)}`
    : "---.-";

  const dialHeight = DIAL * 0.62;

  return (
    <View style={{ width: DIAL, height: dialHeight, alignItems: "center", overflow: "hidden" }}>
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
            left: DIAL * 0.06,
            top: DIAL / 2 - DIAL * 0.03,
          }}
        >
          <Text style={{ color: ACCENT_MED, fontSize: DIAL * 0.045, fontWeight: "600" as const, fontStyle: "italic" as const }}>b</Text>
        </View>
        <View
          style={{
            position: "absolute",
            right: DIAL * 0.06,
            top: DIAL / 2 - DIAL * 0.03,
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
            width: DIAL * 0.05,
            height: DIAL * 0.05,
            borderRadius: DIAL * 0.025,
            backgroundColor: "#1A1A1A",
            borderWidth: 2,
            borderColor: ACCENT_MED,
            ...(Platform.OS === "web"
              ? { boxShadow: `0 0 12px ${ACCENT_DIM}` }
              : {}),
          }}
        />

        {/* === FREQUENCY inside arc, above center === */}
        <View
          style={{
            position: "absolute",
            top: DIAL * 0.28,
            alignItems: "center",
          }}
        >
          <View style={{
            flexDirection: "row",
            alignItems: "baseline",
            backgroundColor: "rgba(17, 17, 17, 0.85)",
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 5,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
          }}>
            <Text style={{
              fontSize: DIAL * 0.045,
              fontWeight: "700" as const,
              color: TEXT_DIM,
              fontFamily: Platform.OS === "web" ? "'Courier New', monospace" : undefined,
              fontVariant: ["tabular-nums"] as any,
            }}>0</Text>
            <Text style={{
              fontSize: DIAL * 0.045,
              fontWeight: "700" as const,
              color: ACCENT,
              fontFamily: Platform.OS === "web" ? "'Courier New', monospace" : undefined,
              fontVariant: ["tabular-nums"] as any,
            }}>{freqDisplay}</Text>
            <Text style={{
              fontSize: DIAL * 0.028,
              fontWeight: "600" as const,
              color: TEXT_MED,
              marginLeft: 3,
            }}>Hz</Text>
          </View>
        </View>

        {/* === BIG NOTE inside arc, center-bottom area === */}
        <View
          style={{
            position: "absolute",
            top: DIAL * 0.36,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Text style={{
              fontSize: DIAL * 0.22,
              fontWeight: "200" as const,
              color: isActive ? statusColor : TEXT_DIM,
              letterSpacing: 2,
              lineHeight: DIAL * 0.24,
            }}>
              {note || "--"}
            </Text>
            {octave !== null && octave !== undefined && isActive && (
              <Text style={{
                fontSize: DIAL * 0.08,
                fontWeight: "400" as const,
                color: statusColor,
                marginTop: DIAL * 0.02,
                opacity: 0.7,
              }}>{octave}</Text>
            )}
          </View>
        </View>

        {/* === CENTS inside arc, bottom-left === */}
        <View
          style={{
            position: "absolute",
            left: DIAL * 0.08,
            top: DIAL * 0.52,
          }}
        >
          <Text style={{
            fontSize: DIAL * 0.05,
            fontWeight: "700" as const,
            color: isActive ? statusColor : TEXT_DIM,
            fontFamily: Platform.OS === "web" ? "'Courier New', monospace" : undefined,
            fontVariant: ["tabular-nums"] as any,
            letterSpacing: 1,
          }}>
            {cents < 0 ? "-" : isActive && cents > 0 ? "+" : ""}{centsDisplay}
          </Text>
          <Text style={{
            fontSize: DIAL * 0.028,
            color: TEXT_MED,
            fontWeight: "500" as const,
            marginTop: 1,
          }}>Cent</Text>
        </View>

        {/* === STATUS DOTS center-bottom === */}
        <View
          style={{
            position: "absolute",
            top: DIAL * 0.56,
            flexDirection: "row",
            gap: 4,
          }}
        >
          <View style={{
            width: 16,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: isActive && isInTune ? ACCENT : "rgba(255,255,255,0.1)",
          }} />
          <View style={{
            width: 16,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: isActive && isInTune ? ACCENT : "rgba(255,255,255,0.1)",
          }} />
        </View>
      </View>
    </View>
  );
}
