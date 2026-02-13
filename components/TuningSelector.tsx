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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { TuningConfig, getFreeTunings, getPremiumTunings } from "@/lib/tuner-engine";
import { t } from "@/lib/i18n";

const ACCENT = "#4AEDC4";
const ACCENT_DIM = "rgba(74, 237, 196, 0.15)";
const ACCENT_MED = "rgba(74, 237, 196, 0.35)";
const BG = "#0A0A0A";
const SURFACE = "#111111";
const SURFACE_LIGHT = "#1A1A1A";
const SURFACE_ELEVATED = "#1E1E1E";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "rgba(255, 255, 255, 0.6)";
const TEXT_DIM = "rgba(255, 255, 255, 0.25)";
const BORDER = "rgba(255, 255, 255, 0.08)";
const PREMIUM_COLOR = "#FFD700";
const PREMIUM_DIM = "rgba(255, 215, 0, 0.12)";

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
              <Ionicons name="checkmark-circle" size={16} color={ACCENT} />
            )}
          </View>
          <Text style={styles.tuningNotes}>{tuning.shortName}</Text>
          <Text style={styles.tuningGenre}>{tuning.genre}</Text>
        </View>
        <View style={styles.tuningItemRight}>
          {isLocked ? (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={13} color={PREMIUM_COLOR} />
              <Text style={styles.lockText}>PRO</Text>
            </View>
          ) : tuning.isPremium ? (
            <View style={styles.unlockedBadge}>
              <Ionicons name="lock-open" size={12} color={ACCENT} />
            </View>
          ) : (
            <Text style={styles.freeText}>{t("tuningSelector.free")}</Text>
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
        <Ionicons name="musical-notes" size={13} color={ACCENT} />
        <Text style={styles.selectorText}>{currentTuning.name}</Text>
        <View style={styles.selectorDivider} />
        <Text style={styles.selectorNotes}>{currentTuning.shortName}</Text>
        <Ionicons name="chevron-down" size={12} color={TEXT_DIM} />
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
              <View style={styles.modalTitleRow}>
                <Ionicons name="musical-notes" size={18} color={ACCENT} />
                <Text style={styles.modalTitle}>{t("tuningSelector.title")}</Text>
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.sectionTitle}>{t("tuningSelector.free")}</Text>
              {freeTunings.map(renderTuningItem)}

              <View style={styles.sectionDivider} />

              <View style={styles.premiumHeaderRow}>
                <Text style={styles.sectionTitle}>{t("tuningSelector.premium")}</Text>
                <View style={styles.premiumBadgeSmall}>
                  <Ionicons name="diamond" size={11} color={PREMIUM_COLOR} />
                  <Text style={styles.premiumBadgeText}>PRO</Text>
                </View>
              </View>
              {!isPremiumUser && (
                <Text style={styles.premiumHint}>
                  {t("tuningSelector.premiumHint")}
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: SURFACE_LIGHT,
    borderRadius: 16,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  selectorText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: TEXT_PRIMARY,
    letterSpacing: 0.3,
  },
  selectorDivider: {
    width: 1,
    height: 12,
    backgroundColor: BORDER,
  },
  selectorNotes: {
    fontSize: 10,
    color: TEXT_DIM,
    fontWeight: "500" as const,
    letterSpacing: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: SURFACE_ELEVATED,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "80%",
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
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
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: TEXT_PRIMARY,
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: BORDER,
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
    backgroundColor: PREMIUM_DIM,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: PREMIUM_COLOR,
    letterSpacing: 0.5,
  },
  premiumHint: {
    fontSize: 12,
    color: TEXT_DIM,
    marginBottom: 12,
    fontStyle: "italic" as const,
  },
  tuningItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tuningItemSelected: {
    borderColor: ACCENT_MED,
    backgroundColor: ACCENT_DIM,
  },
  tuningItemLocked: {
    opacity: 0.55,
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
    fontSize: 15,
    fontWeight: "600" as const,
    color: TEXT_PRIMARY,
  },
  tuningNameSelected: {
    color: ACCENT,
  },
  tuningNotes: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: "500" as const,
    letterSpacing: 1.2,
  },
  tuningGenre: {
    fontSize: 11,
    color: TEXT_DIM,
    fontStyle: "italic" as const,
  },
  tuningItemRight: {
    paddingLeft: 12,
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PREMIUM_DIM,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  lockText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: PREMIUM_COLOR,
    letterSpacing: 0.5,
  },
  unlockedBadge: {
    padding: 6,
  },
  freeText: {
    fontSize: 11,
    color: ACCENT,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
});
