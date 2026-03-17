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
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { TuningConfig, getFreeTunings, getPremiumTunings } from "@/lib/tuner-engine";
import { t } from "@/lib/i18n";

const ACCENT = "#4AEDC4";
const ACCENT_DIM = "rgba(74, 237, 196, 0.12)";
const ACCENT_MED = "rgba(74, 237, 196, 0.28)";
const BG = "#080808";
const SURFACE = "#111111";
const SURFACE_ELEVATED = "#181818";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "rgba(255, 255, 255, 0.55)";
const TEXT_DIM = "rgba(255, 255, 255, 0.22)";
const BORDER = "rgba(255, 255, 255, 0.07)";
const PREMIUM_COLOR = "#E8C547";
const PREMIUM_DIM = "rgba(232, 197, 71, 0.12)";

interface TuningSelectorProps {
  currentTuning: TuningConfig;
  onSelect: (tuning: TuningConfig) => void;
  isPremiumUser: boolean;
  onPremiumRequired: () => void;
}

const GENRE_ORDER = [
  "All Genres",
  "Folk / Acoustic",
  "Alternative / Folk",
  "Jazz / Fusion",
  "Rock / Metal / Grunge",
  "Blues / Rock / Country",
  "Celtic / Folk / Rock",
  "Blues / Folk / Slide",
  "Blues / Rock / Slide",
  "Metal / Hard Rock",
];

const GENRE_ICONS: Record<string, string> = {
  "All Genres": "globe-outline",
  "Folk / Acoustic": "leaf-outline",
  "Alternative / Folk": "radio-outline",
  "Jazz / Fusion": "cafe-outline",
  "Rock / Metal / Grunge": "flash-outline",
  "Blues / Rock / Country": "sunny-outline",
  "Celtic / Folk / Rock": "earth-outline",
  "Blues / Folk / Slide": "water-outline",
  "Blues / Rock / Slide": "flame-outline",
  "Metal / Hard Rock": "skull-outline",
};

function groupByGenre(tunings: TuningConfig[]) {
  const map: Record<string, TuningConfig[]> = {};
  for (const t of tunings) {
    if (!map[t.genre]) map[t.genre] = [];
    map[t.genre].push(t);
  }
  return map;
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
  const premiumByGenre = groupByGenre(premiumTunings);

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
        style={({ pressed }) => [
          styles.tuningItem,
          isSelected && styles.tuningItemSelected,
          isLocked && styles.tuningItemLocked,
          pressed && styles.tuningItemPressed,
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
              <Ionicons name="checkmark-circle" size={14} color={ACCENT} />
            )}
          </View>
          <Text style={styles.tuningNotes}>{tuning.shortName}</Text>
        </View>
        <View style={styles.tuningItemRight}>
          {isLocked ? (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={11} color={PREMIUM_COLOR} />
              <Text style={styles.lockText}>PRO</Text>
            </View>
          ) : tuning.isPremium ? (
            <View style={styles.unlockedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={ACCENT} />
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
        style={({ pressed }) => [styles.selectorButton, pressed && styles.selectorButtonPressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setModalVisible(true);
        }}
      >
        <Ionicons name="musical-notes" size={12} color={ACCENT} />
        <Text style={styles.selectorText}>{currentTuning.name}</Text>
        <View style={styles.selectorDivider} />
        <Text style={styles.selectorNotes}>{currentTuning.shortName}</Text>
        <Ionicons name="chevron-down" size={11} color={TEXT_DIM} />
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
              { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20 },
            ]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="musical-notes" size={17} color={ACCENT} />
                <Text style={styles.modalTitle}>{t("tuningSelector.title")}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={TEXT_SECONDARY} />
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
                  <Ionicons name="diamond" size={10} color={PREMIUM_COLOR} />
                  <Text style={styles.premiumBadgeText}>PRO</Text>
                </View>
              </View>

              {!isPremiumUser && (
                <Text style={styles.premiumHint}>
                  {t("tuningSelector.premiumHint")}
                </Text>
              )}

              {Object.entries(premiumByGenre)
                .sort(([a], [b]) => {
                  const ia = GENRE_ORDER.indexOf(a);
                  const ib = GENRE_ORDER.indexOf(b);
                  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                })
                .map(([genre, tunings]) => (
                  <View key={genre} style={styles.genreGroup}>
                    <View style={styles.genreHeader}>
                      <Ionicons
                        name={(GENRE_ICONS[genre] || "musical-note-outline") as any}
                        size={12}
                        color={TEXT_DIM}
                      />
                      <Text style={styles.genreLabel}>{genre}</Text>
                    </View>
                    {tunings.map(renderTuningItem)}
                  </View>
                ))}
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
    backgroundColor: "#181818",
    borderRadius: 16,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  selectorButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  selectorText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  selectorDivider: {
    width: 1,
    height: 11,
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
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "flex-end",
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: "#141414",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  modalHandle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 6,
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
    fontSize: 17,
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
    fontSize: 10,
    fontWeight: "700" as const,
    color: ACCENT,
    textTransform: "uppercase" as const,
    letterSpacing: 1.4,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
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
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
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
    marginBottom: 14,
    fontStyle: "italic" as const,
    lineHeight: 17,
  },
  genreGroup: {
    marginBottom: 6,
  },
  genreHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
    marginTop: 10,
  },
  genreLabel: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: TEXT_DIM,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
  tuningItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tuningItemSelected: {
    borderColor: ACCENT_MED,
    backgroundColor: ACCENT_DIM,
  },
  tuningItemLocked: {
    opacity: 0.5,
  },
  tuningItemPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  tuningItemLeft: {
    flex: 1,
    gap: 3,
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
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontWeight: "500" as const,
    letterSpacing: 1.2,
  },
  tuningItemRight: {
    paddingLeft: 12,
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PREMIUM_DIM,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.2)",
  },
  lockText: {
    fontSize: 9,
    fontWeight: "800" as const,
    color: PREMIUM_COLOR,
    letterSpacing: 0.5,
  },
  unlockedBadge: {
    padding: 5,
  },
  freeText: {
    fontSize: 10,
    color: ACCENT,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
});
