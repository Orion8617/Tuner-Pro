import { useEffect, useMemo } from "react";
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

const ACCENT            = "#4AEDC4";
const ACCENT_GLOW       = "rgba(74, 237, 196, 0.08)";
const ACCENT_GLOW_STR   = "rgba(74, 237, 196, 0.22)";
const RED               = "#FF4444";
const RED_DIM           = "rgba(255, 68, 68, 0.28)";
const ORANGE            = "#FF9544";
const ORANGE_DIM        = "rgba(255, 149, 68, 0.22)";
const TEXT_DIM          = "rgba(255, 255, 255, 0.18)";
const TEXT_MED          = "rgba(255, 255, 255, 0.45)";
const SEG_OFF           = "rgba(74, 237, 196, 0.06)";
const SURFACE_DEEP      = "#0D0D0D";

const TOTAL_OUTER = 41;
const INNER_TOTAL = 81;
const ARC_SPAN    = 152;
const START_ANGLE = -ARC_SPAN / 2 - 90;

interface TunerDialProps {
  cents:        number;
  isActive:     boolean;
  size?:        number;
  note?:        string | null;
  octave?:      number | null;
  frequency?:   number;
  statusColor?: string;
  centsDisplay?: string;
  isInTune?:    boolean;
}

function getNormalizedPosition(cents: number, isActive: boolean): number {
  if (!isActive) return 0.5;
  const clamped = Math.max(-50, Math.min(50, cents));
  const linear  = clamped / 50;
  const eased   = Math.sign(linear) * Math.pow(Math.abs(linear), 1.5);
  return Math.max(0, Math.min(1, (eased + 1) / 2));
}

function getSegmentColor(
  segNorm: number,
  currentNorm: number,
  isActive: boolean,
  isEdge: boolean,
  isNearEdge: boolean,
  litThreshold: number,
  nearThreshold: number,
  inTune: boolean,
): { color: string; lit: boolean; near: boolean } {
  const dist   = Math.abs(segNorm - currentNorm);
  const isLit  = isActive && dist < litThreshold;
  const isNear = isActive && dist < nearThreshold;

  let color: string;
  if (isLit) {
    if (inTune)       color = ACCENT;
    else if (isEdge)  color = RED;
    else if (isNearEdge) color = ORANGE;
    else              color = ACCENT;
  } else if (isNear) {
    if (isEdge)       color = RED_DIM;
    else if (isNearEdge) color = ORANGE_DIM;
    else              color = "rgba(74, 237, 196, 0.35)";
  } else if (isEdge) {
    color = "rgba(255, 68, 68, 0.1)";
  } else if (isNearEdge) {
    color = "rgba(255, 149, 68, 0.06)";
  } else {
    color = SEG_OFF;
  }

  return { color, lit: isLit, near: isNear };
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

  const activePosition  = useSharedValue(0.5);
  const glowOpacity     = useSharedValue(0);
  const glowPulse       = useSharedValue(1);
  const inTuneConfirm   = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      const clampedCents = Math.max(-50, Math.min(50, cents));
      activePosition.value = withSpring((clampedCents + 50) / 100, {
        damping: 22, stiffness: 110, mass: 0.35,
      });
      glowOpacity.value = withSpring(isInTune ? 1 : 0, { damping: 18, stiffness: 90 });

      if (isInTune) {
        inTuneConfirm.value = withSpring(1, { damping: 14, stiffness: 100 });
        glowPulse.value = withRepeat(
          withSequence(
            withTiming(0.45, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
            withTiming(1,    { duration: 1400, easing: Easing.inOut(Easing.sin) })
          ),
          -1, true
        );
      } else {
        inTuneConfirm.value = withTiming(0, { duration: 250 });
        glowPulse.value     = withTiming(1, { duration: 200 });
      }
    } else {
      activePosition.value  = withSpring(0.5, { damping: 24, stiffness: 55 });
      glowOpacity.value     = withTiming(0, { duration: 350 });
      glowPulse.value       = withTiming(1, { duration: 200 });
      inTuneConfirm.value   = withTiming(0, { duration: 250 });
    }
  }, [cents, isActive, isInTune]);

  const inTuneGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * glowPulse.value,
  }));

  const inTuneRingStyle = useAnimatedStyle(() => ({
    opacity: inTuneConfirm.value * glowPulse.value * 0.6,
    transform: [{ scale: 0.92 + inTuneConfirm.value * 0.08 }],
  }));

  const outerRadius   = DIAL / 2;
  const segGap        = ARC_SPAN / TOTAL_OUTER;
  const segH          = DIAL * 0.07;
  const segW          = 6;
  const innerSegH     = DIAL * 0.032;
  const innerOffset   = segH * 1.6 + 10;

  const currentNorm = getNormalizedPosition(cents, isActive);

  const outerSegments = useMemo(() => {
    return Array.from({ length: TOTAL_OUTER }, (_, i) => {
      const angle    = START_ANGLE + i * segGap + segGap / 2;
      const segNorm  = i / (TOTAL_OUTER - 1);
      const distFC   = Math.abs(segNorm - 0.5) * 2;
      const isEdge   = distFC > 0.82;
      const isNrEdge = distFC > 0.6 && !isEdge;

      const { color, lit, near } = getSegmentColor(
        segNorm, currentNorm, isActive, isEdge, isNrEdge, 0.055, 0.16, isInTune
      );

      const h = lit ? segH * 1.6 : near ? segH * 1.25 : isEdge ? segH * 1.1 : segH;
      const w = lit ? 8 : segW;

      return (
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
          <View style={{ width: w, height: h, backgroundColor: color, borderRadius: 2.5 }} />
        </View>
      );
    });
  }, [DIAL, currentNorm, isActive, isInTune]);

  const innerSegments = useMemo(() => {
    const innerH = outerRadius - innerOffset;
    return Array.from({ length: INNER_TOTAL }, (_, i) => {
      const angle    = START_ANGLE + (i / (INNER_TOTAL - 1)) * ARC_SPAN;
      const segNorm  = i / (INNER_TOTAL - 1);
      const distFC   = Math.abs(segNorm - 0.5) * 2;
      const isEdge   = distFC > 0.82;
      const isNrEdge = distFC > 0.6 && !isEdge;

      const dist   = Math.abs(segNorm - currentNorm);
      const isLit  = isActive && dist < 0.04;
      const isNear = isActive && dist < 0.13;

      let color: string;
      if (isLit) {
        color = isEdge ? "rgba(255, 68, 68, 0.65)"
               : isNrEdge ? "rgba(255, 149, 68, 0.55)"
               : "rgba(74, 237, 196, 0.65)";
      } else if (isNear) {
        color = isEdge ? "rgba(255, 68, 68, 0.18)"
               : isNrEdge ? "rgba(255, 149, 68, 0.14)"
               : "rgba(74, 237, 196, 0.2)";
      } else if (isEdge) {
        color = "rgba(255, 68, 68, 0.05)";
      } else {
        color = "rgba(74, 237, 196, 0.04)";
      }

      const isMajor = i % 4 === 0;
      const tW = isMajor ? 2.5 : 1.5;
      const tH = isMajor ? innerSegH * 1.5 : innerSegH;

      return (
        <View
          key={`i-${i}`}
          style={{
            position: "absolute" as const,
            left: outerRadius - 1,
            top: innerOffset,
            width: 2,
            height: innerH,
            alignItems: "center" as const,
            transformOrigin: `1px ${innerH}px`,
            transform: [{ rotate: `${angle}deg` }],
          }}
        >
          <View style={{ width: tW, height: tH, backgroundColor: color, borderRadius: 1 }} />
        </View>
      );
    });
  }, [DIAL, currentNorm, isActive]);

  const freqStr = isActive && frequency > 0 ? `${frequency.toFixed(1)}` : "---.-";

  const noteDisplay  = note || "--";
  const noteIsSharp  = noteDisplay.includes("#");
  const noteBase     = noteIsSharp ? noteDisplay[0] : noteDisplay;
  const noteSharp    = noteIsSharp ? "#" : "";
  const contentStart = segH * 1.6 + innerSegH * 1.5 + 18;

  return (
    <View style={{ width: DIAL, alignItems: "center" }}>
      <View style={{ width: DIAL, height: DIAL / 2 + 10, overflow: "hidden" }}>
        <View style={{ width: DIAL, height: DIAL, borderRadius: DIAL / 2 }}>
          <Animated.View
            style={[{
              position: "absolute",
              left: -14, top: -14,
              width: DIAL + 28, height: DIAL + 28,
              borderRadius: (DIAL + 28) / 2,
              backgroundColor: ACCENT_GLOW_STR,
              borderWidth: 1.5,
              borderColor: "rgba(74, 237, 196, 0.18)",
            }, inTuneGlowStyle]}
          />
          <Animated.View
            style={[{
              position: "absolute",
              left: -4, top: -4,
              width: DIAL + 8, height: DIAL + 8,
              borderRadius: (DIAL + 8) / 2,
              borderWidth: 2,
              borderColor: ACCENT,
            }, inTuneRingStyle]}
          />

          {outerSegments}
          {innerSegments}

          <View style={{ position: "absolute", left: DIAL * 0.04, top: DIAL / 2 - DIAL * 0.025 }}>
            <Text style={{ color: "rgba(74, 237, 196, 0.25)", fontSize: DIAL * 0.042, fontWeight: "600" as const, fontStyle: "italic" as const }}>b</Text>
          </View>
          <View style={{ position: "absolute", right: DIAL * 0.04, top: DIAL / 2 - DIAL * 0.025 }}>
            <Text style={{ color: "rgba(74, 237, 196, 0.25)", fontSize: DIAL * 0.042, fontWeight: "600" as const }}>#</Text>
          </View>
        </View>
      </View>

      <View style={{ width: DIAL, alignItems: "center", marginTop: -DIAL * 0.22 }}>
        <View style={{
          flexDirection: "row",
          alignItems: "baseline",
          backgroundColor: SURFACE_DEEP,
          paddingHorizontal: 14,
          paddingVertical: 5,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
        }}>
          <Text style={{
            fontSize: DIAL * 0.044, fontWeight: "700" as const, color: TEXT_DIM,
            fontFamily: Platform.OS === "web" ? "'Courier New', monospace" : undefined,
            fontVariant: ["tabular-nums"] as any,
          }}>0</Text>
          <Text style={{
            fontSize: DIAL * 0.044, fontWeight: "700" as const, color: ACCENT,
            fontFamily: Platform.OS === "web" ? "'Courier New', monospace" : undefined,
            fontVariant: ["tabular-nums"] as any,
          }}>{freqStr}</Text>
          <Text style={{ fontSize: DIAL * 0.027, fontWeight: "500" as const, color: TEXT_MED, marginLeft: 4 }}>Hz</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 8 }}>
          <Text style={{
            fontSize: DIAL * 0.19, fontWeight: "200" as const,
            color: isActive ? statusColor : TEXT_DIM,
            letterSpacing: 2, lineHeight: DIAL * 0.21,
          }}>
            {noteBase}
          </Text>
          {noteIsSharp && isActive && (
            <Text style={{
              fontSize: DIAL * 0.09, fontWeight: "300" as const,
              color: isActive ? statusColor : TEXT_DIM,
              marginTop: DIAL * 0.01, opacity: 0.8,
            }}>{noteSharp}</Text>
          )}
          {!isActive && noteDisplay === "--" && (
            <Text style={{
              fontSize: DIAL * 0.19, fontWeight: "200" as const,
              color: TEXT_DIM, letterSpacing: 2, lineHeight: DIAL * 0.21,
            }}>-</Text>
          )}
          {octave !== null && octave !== undefined && isActive && (
            <Text style={{
              fontSize: DIAL * 0.078, fontWeight: "300" as const,
              color: statusColor, marginTop: DIAL * 0.018, opacity: 0.65,
            }}>{octave}</Text>
          )}
        </View>

        <View style={{ width: DIAL * 0.85, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <View>
            <Text style={{
              fontSize: DIAL * 0.04, fontWeight: "700" as const,
              color: isActive ? statusColor : TEXT_DIM,
              fontFamily: Platform.OS === "web" ? "'Courier New', monospace" : undefined,
              fontVariant: ["tabular-nums"] as any,
              letterSpacing: 1.5,
            }}>
              {cents < 0 ? "-" : isActive && cents > 0 ? "+" : ""}{centsDisplay}
            </Text>
            <Text style={{ fontSize: DIAL * 0.024, color: TEXT_MED, fontWeight: "500" as const, marginTop: 2, letterSpacing: 0.5 }}>CENTS</Text>
          </View>

          <View style={{ alignItems: "center", gap: 4 }}>
            <View style={{ flexDirection: "row", gap: 3 }}>
              <View style={{ width: 22, height: 3, borderRadius: 1.5, backgroundColor: isActive && isInTune ? ACCENT : "rgba(255,255,255,0.07)" }} />
              <View style={{ width: 22, height: 3, borderRadius: 1.5, backgroundColor: isActive && isInTune ? ACCENT : "rgba(255,255,255,0.07)" }} />
            </View>
          </View>

          <Text style={{ color: "rgba(74, 237, 196, 0.22)", fontSize: DIAL * 0.038, fontWeight: "500" as const }}>#</Text>
        </View>
      </View>
    </View>
  );
}
