import { useEffect } from "react";
import { View, Text, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

const ACCENT = "#4AEDC4";
const ACCENT_DIM = "rgba(74, 237, 196, 0.15)";
const ACCENT_GLOW = "rgba(74, 237, 196, 0.06)";
const RED = "#FF4444";
const RED_DIM = "rgba(255, 68, 68, 0.25)";
const TEXT_DIM = "rgba(255, 255, 255, 0.2)";
const TEXT_MED = "rgba(255, 255, 255, 0.5)";
const SEG_OFF = "rgba(74, 237, 196, 0.08)";

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
  size = 380,
  note,
  octave,
  frequency = 0,
  statusColor = TEXT_DIM,
  centsDisplay = "000.0",
  isInTune = false,
}: TunerDialProps) {
  const DIAL = size;
  const activePosition = useSharedValue(0.5);
  const glowOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      const clampedCents = Math.max(-50, Math.min(50, cents));
      const normalized = (clampedCents + 50) / 100;
      activePosition.value = withSpring(normalized, {
        damping: 18,
        stiffness: 90,
        mass: 0.4,
      });
      const inTune = Math.abs(cents) <= 5;
      glowOpacity.value = withSpring(inTune ? 1 : 0, { damping: 15, stiffness: 80 });
      if (inTune) {
        glowPulse.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        );
      } else {
        glowPulse.value = withTiming(1, { duration: 300 });
      }
    } else {
      activePosition.value = withSpring(0.5, { damping: 20, stiffness: 60 });
      glowOpacity.value = withTiming(0, { duration: 400 });
      glowPulse.value = withTiming(1, { duration: 300 });
    }
  }, [cents, isActive]);

  const inTuneGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * glowPulse.value,
  }));

  const TOTAL_OUTER = 41;
  const ARC_SPAN = 150;
  const START_ANGLE = -ARC_SPAN / 2 - 90;
  const outerRadius = DIAL / 2;
  const segH = DIAL * 0.07;
  const segW = 7;
  const segGap = ARC_SPAN / TOTAL_OUTER;

  const currentNorm = (() => {
    if (!isActive) return 0.5;
    const clamped = Math.max(-50, Math.min(50, cents));
    const linear = clamped / 50;
    const eased = Math.sign(linear) * Math.pow(Math.abs(linear), 1.6);
    return Math.max(0, Math.min(1, (eased + 1) / 2));
  })();

  const outerSegments = [];
  for (let i = 0; i < TOTAL_OUTER; i++) {
    const angle = START_ANGLE + i * segGap + segGap / 2;
    const segNorm = i / (TOTAL_OUTER - 1);
    const distFromCenter = Math.abs(segNorm - 0.5) * 2;
    const isEdge = distFromCenter > 0.85;

    const distFromActive = Math.abs(segNorm - currentNorm);
    const isLit = isActive && distFromActive < 0.06;
    const isNearLit = isActive && distFromActive < 0.15;

    let color: string;
    let h = segH;
    let w = segW;

    if (isLit) {
      color = isEdge ? RED : ACCENT;
      h = segH * 1.5;
      w = 8;
    } else if (isNearLit) {
      color = isEdge ? RED_DIM : "rgba(74, 237, 196, 0.4)";
      h = segH * 1.2;
    } else if (isEdge) {
      color = "rgba(255, 68, 68, 0.12)";
      h = segH * 1.1;
    } else {
      color = SEG_OFF;
    }

    outerSegments.push(
      <View
        key={`o-${i}`}
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

  const INNER_TOTAL = 81;
  const innerSegH = DIAL * 0.03;
  const innerOffset = segH * 1.5 + 10;
  const innerSegments = [];

  for (let i = 0; i < INNER_TOTAL; i++) {
    const angle = START_ANGLE + (i / (INNER_TOTAL - 1)) * ARC_SPAN;
    const segNorm = i / (INNER_TOTAL - 1);
    const distFromCenter = Math.abs(segNorm - 0.5) * 2;
    const isEdge = distFromCenter > 0.85;

    const distFromActive = Math.abs(segNorm - currentNorm);
    const isLit = isActive && distFromActive < 0.04;
    const isNear = isActive && distFromActive < 0.12;

    let color: string;
    if (isLit) {
      color = isEdge ? "rgba(255, 68, 68, 0.6)" : "rgba(74, 237, 196, 0.6)";
    } else if (isNear) {
      color = isEdge ? "rgba(255, 68, 68, 0.2)" : "rgba(74, 237, 196, 0.2)";
    } else if (isEdge) {
      color = "rgba(255, 68, 68, 0.06)";
    } else {
      color = "rgba(74, 237, 196, 0.04)";
    }

    const isMajor = i % 4 === 0;

    innerSegments.push(
      <View
        key={`i-${i}`}
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
            width: isMajor ? 2.5 : 1,
            height: isMajor ? innerSegH * 1.5 : innerSegH,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
      </View>
    );
  }

  const freqStr = isActive && frequency > 0
    ? `${frequency.toFixed(1)}`
    : "---.-";

  const arcThickness = segH * 1.5 + innerSegH * 1.5 + 14;
  const contentStart = arcThickness + 6;

  return (
    <View style={{ width: DIAL, alignItems: "center" }}>
      {/* ARC container - clips to semicircle */}
      <View style={{ width: DIAL, height: DIAL / 2 + 10, overflow: "hidden" }}>
        <View
          style={{
            width: DIAL,
            height: DIAL,
            borderRadius: DIAL / 2,
          }}
        >
          <Animated.View
            style={[
              {
                position: "absolute",
                left: -10,
                top: -10,
                width: DIAL + 20,
                height: DIAL + 20,
                borderRadius: (DIAL + 20) / 2,
                backgroundColor: ACCENT_GLOW,
                borderWidth: 1,
                borderColor: "rgba(74, 237, 196, 0.1)",
              },
              inTuneGlowStyle,
            ]}
          />

          {outerSegments}
          {innerSegments}

          {/* b flat symbol */}
          <View style={{ position: "absolute", left: DIAL * 0.04, top: DIAL / 2 - DIAL * 0.02 }}>
            <Text style={{ color: "rgba(74, 237, 196, 0.3)", fontSize: DIAL * 0.04, fontWeight: "600" as const, fontStyle: "italic" as const }}>b</Text>
          </View>
          {/* # sharp symbol */}
          <View style={{ position: "absolute", right: DIAL * 0.04, top: DIAL / 2 - DIAL * 0.02 }}>
            <Text style={{ color: "rgba(74, 237, 196, 0.3)", fontSize: DIAL * 0.04, fontWeight: "600" as const }}>#</Text>
          </View>
        </View>
      </View>

      {/* CONTENT below the arc — uses flexbox for clean stacking */}
      <View style={{ width: DIAL, alignItems: "center", marginTop: -DIAL * 0.22 }}>
        {/* FREQUENCY LCD */}
        <View style={{
          flexDirection: "row",
          alignItems: "baseline",
          backgroundColor: "rgba(10, 10, 10, 0.9)",
          paddingHorizontal: 14,
          paddingVertical: 4,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.05)",
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
          }}>{freqStr}</Text>
          <Text style={{
            fontSize: DIAL * 0.028,
            fontWeight: "600" as const,
            color: TEXT_MED,
            marginLeft: 3,
          }}>Hz</Text>
        </View>

        {/* BIG NOTE */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 6 }}>
          <Text style={{
            fontSize: DIAL * 0.2,
            fontWeight: "200" as const,
            color: isActive ? statusColor : TEXT_DIM,
            letterSpacing: 2,
            lineHeight: DIAL * 0.22,
          }}>
            {note || "--"}
          </Text>
          {octave !== null && octave !== undefined && isActive && (
            <Text style={{
              fontSize: DIAL * 0.08,
              fontWeight: "400" as const,
              color: statusColor,
              marginTop: DIAL * 0.01,
              opacity: 0.7,
            }}>{octave}</Text>
          )}
        </View>

        {/* CENTS + STATUS ROW */}
        <View style={{ width: DIAL * 0.85, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <View>
            <Text style={{
              fontSize: DIAL * 0.042,
              fontWeight: "700" as const,
              color: isActive ? statusColor : TEXT_DIM,
              fontFamily: Platform.OS === "web" ? "'Courier New', monospace" : undefined,
              fontVariant: ["tabular-nums"] as any,
              letterSpacing: 1,
            }}>
              {cents < 0 ? "-" : isActive && cents > 0 ? "+" : ""}{centsDisplay}
            </Text>
            <Text style={{
              fontSize: DIAL * 0.025,
              color: TEXT_MED,
              fontWeight: "500" as const,
              marginTop: 1,
            }}>Cent</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 4 }}>
            <View style={{
              width: 18, height: 3, borderRadius: 1.5,
              backgroundColor: isActive && isInTune ? ACCENT : "rgba(255,255,255,0.08)",
            }} />
            <View style={{
              width: 18, height: 3, borderRadius: 1.5,
              backgroundColor: isActive && isInTune ? ACCENT : "rgba(255,255,255,0.08)",
            }} />
          </View>

          <Text style={{ color: "rgba(74, 237, 196, 0.3)", fontSize: DIAL * 0.04, fontWeight: "600" as const }}>#</Text>
        </View>
      </View>
    </View>
  );
}
