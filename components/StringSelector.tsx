import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import Colors from "@/constants/colors";
import { GuitarString } from "@/lib/tuner-engine";

interface StringSelectorProps {
  strings: GuitarString[];
  selectedString: GuitarString | null;
  detectedString: GuitarString | null;
  onSelect: (s: GuitarString) => void;
  isListening: boolean;
}

function StringButton({
  str,
  isSelected,
  isDetected,
  onPress,
}: {
  str: GuitarString;
  isSelected: boolean;
  isDetected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  useEffect(() => {
    bgOpacity.value = withTiming(isSelected ? 1 : isDetected ? 0.5 : 0, { duration: 200 });
  }, [isSelected, isDetected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 });
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Animated.View style={[styles.stringButton, animatedStyle]}>
        <Animated.View
          style={[
            styles.stringButtonBg,
            { backgroundColor: isSelected ? Colors.dark.primary : Colors.dark.surfaceHighlight },
            bgStyle,
          ]}
        />
        <Text style={[styles.stringNote, isSelected && styles.stringNoteActive]}>
          {str.note}
        </Text>
        <Text style={[styles.stringOctave, isSelected && styles.stringOctaveActive]}>
          {str.octave}
        </Text>
        <Text style={[styles.stringNumber, isSelected && styles.stringNumberActive]}>
          {str.stringNumber}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function StringSelector({
  strings,
  selectedString,
  detectedString,
  onSelect,
  isListening,
}: StringSelectorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.guitarNeck}>
        {strings.map((str) => (
          <StringButton
            key={str.stringNumber}
            str={str}
            isSelected={selectedString?.stringNumber === str.stringNumber}
            isDetected={isListening && detectedString?.stringNumber === str.stringNumber}
            onPress={() => onSelect(str)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  guitarNeck: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  stringButton: {
    width: 52,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: "hidden",
  },
  stringButtonBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  stringNote: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.dark.text,
  },
  stringNoteActive: {
    color: Colors.dark.background,
  },
  stringOctave: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginTop: -2,
  },
  stringOctaveActive: {
    color: "rgba(0,0,0,0.5)",
  },
  stringNumber: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  stringNumberActive: {
    color: "rgba(0,0,0,0.4)",
  },
});
