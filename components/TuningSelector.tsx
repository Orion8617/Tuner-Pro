import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { TuningConfig, getFreeTunings, getPremiumTunings } from "@/lib/tuner-engine";

interface TuningSelectorProps {
  currentTuning: TuningConfig;
  onSelect: (tuning: TuningConfig) => void;
  isPremiumUser: boolean;
  onPremiumRequired: () => void;
}

export default function TuningSelector({
  currentTuning,
  onSelect,
  isPremiumUser,
  onPremiumRequired,
}: TuningSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const freeTunings = getFreeTunings();
  const premiumTunings = getPremiumTunings();

  function handleSelect(tuning: TuningConfig) {
    if (tuning.isPremium && !isPremiumUser) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onPremiumRequired();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(tuning);
    setModalVisible(false);
  }

  function renderTuningItem(tuning: TuningConfig) {
    const isSelected = tuning.id === currentTuning.id;
    const isLocked = tuning.isPremium && !isPremiumUser;

    return (
      <Pressable
        key={tuning.id}
        style={[
          styles.tuningItem,
          isSelected && styles.tuningItemSelected,
          isLocked && styles.tuningItemLocked,
        ]}
        onPress={() => handleSelect(tuning)}
      >
        <View style={styles.tuningItemLeft}>
          <View style={styles.tuningNameRow}>
            <Text
              style={[
                styles.tuningName,
                isSelected && styles.tuningNameSelected,
              ]}
            >
              {tuning.name}
            </Text>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={18} color={Colors.dark.accent} />
            )}
          </View>
          <Text style={styles.tuningNotes}>{tuning.shortName}</Text>
          <Text style={styles.tuningGenre}>{tuning.genre}</Text>
        </View>
        <View style={styles.tuningItemRight}>
          {isLocked ? (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={14} color={Colors.dark.premium} />
              <Text style={styles.lockText}>PRO</Text>
            </View>
          ) : tuning.isPremium ? (
            <View style={styles.unlockedBadge}>
              <Ionicons name="lock-open" size={12} color={Colors.dark.accent} />
            </View>
          ) : (
            <Text style={styles.freeText}>Gratis</Text>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <>
      <Pressable
        style={styles.selectorButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setModalVisible(true);
        }}
      >
        <MaterialCommunityIcons
          name="guitar-acoustic"
          size={16}
          color={Colors.dark.primary}
        />
        <Text style={styles.selectorText}>{currentTuning.name}</Text>
        <Text style={styles.selectorNotes}>{currentTuning.shortName}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.dark.textTertiary} />
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setModalVisible(false)} />
          <View
            style={[
              styles.modalContent,
              { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 },
            ]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Afinaciones</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={Colors.dark.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.sectionTitle}>Gratis</Text>
              {freeTunings.map(renderTuningItem)}

              <View style={styles.sectionDivider} />

              <View style={styles.premiumHeaderRow}>
                <Text style={styles.sectionTitle}>Premium</Text>
                <View style={styles.premiumBadgeSmall}>
                  <Ionicons name="diamond" size={12} color={Colors.dark.premium} />
                  <Text style={styles.premiumBadgeText}>PRO</Text>
                </View>
              </View>
              {!isPremiumUser && (
                <Text style={styles.premiumHint}>
                  Las afinaciones más populares para profesionales
                </Text>
              )}
              {premiumTunings.map(renderTuningItem)}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.dark.primaryMuted,
    borderRadius: 20,
    alignSelf: "center",
  },
  selectorText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.dark.primary,
  },
  selectorNotes: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingHorizontal: 20,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 16,
  },
  premiumHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  premiumBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255, 215, 0, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: Colors.dark.premium,
    letterSpacing: 0.3,
  },
  premiumHint: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginBottom: 12,
  },
  tuningItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tuningItemSelected: {
    borderColor: Colors.dark.accent,
    backgroundColor: "rgba(0, 230, 118, 0.06)",
  },
  tuningItemLocked: {
    opacity: 0.7,
  },
  tuningItemLeft: {
    flex: 1,
    gap: 2,
  },
  tuningNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tuningName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
  tuningNameSelected: {
    color: Colors.dark.accent,
  },
  tuningNotes: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: "500" as const,
    letterSpacing: 1,
  },
  tuningGenre: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  tuningItemRight: {
    paddingLeft: 12,
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 215, 0, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  lockText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: Colors.dark.premium,
    letterSpacing: 0.3,
  },
  unlockedBadge: {
    padding: 6,
  },
  freeText: {
    fontSize: 11,
    color: Colors.dark.accent,
    fontWeight: "600" as const,
  },
});
