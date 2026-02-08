import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

function getFeatures() {
  return [
    {
      icon: "musical-notes" as const,
      title: t("premium.premiumTunings"),
      desc: "Drop D, Open G, DADGAD, Open D, Open E, Drop C",
      free: false,
    },
    {
      icon: "speedometer" as const,
      title: t("premium.advancedDetection"),
      desc: t("premium.advancedDetectionDesc"),
      free: false,
    },
    {
      icon: "analytics" as const,
      title: t("premium.tuningHistory"),
      desc: t("premium.tuningHistoryDesc"),
      free: false,
    },
    {
      icon: "color-palette" as const,
      title: t("premium.customThemes"),
      desc: t("premium.customThemesDesc"),
      free: false,
    },
    {
      icon: "radio" as const,
      title: t("premium.standardTuner"),
      desc: t("premium.standardTunerDesc"),
      free: true,
    },
    {
      icon: "git-branch" as const,
      title: t("premium.freeTunings"),
      desc: "Double Drop D, Open C, All Fourths",
      free: true,
    },
  ];
}

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const { user, upgradeToPremium } = useAuth();

  async function handlePurchase() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await WebBrowser.openBrowserAsync("https://lemonsqueezy.com", {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      });

      if (Platform.OS === "web") {
        const confirmed = confirm(t("premium.confirmWeb"));
        if (confirmed) {
          await upgradeToPremium();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        }
      } else {
        Alert.alert(
          t("premium.alertTitle"),
          t("premium.alertMessage"),
          [
            { text: t("premium.no"), style: "cancel" },
            {
              text: t("premium.yes"),
              onPress: async () => {
                await upgradeToPremium();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back();
              },
            },
          ]
        );
      }
    } catch (e) {
      console.error("Browser error:", e);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.dark.text} />
        </Pressable>

        <View style={styles.header}>
          <LinearGradient
            colors={[Colors.dark.premiumGradientStart, Colors.dark.premiumGradientEnd]}
            style={styles.premiumBadge}
          >
            <Ionicons name="diamond" size={32} color="#000" />
          </LinearGradient>
          <Text style={styles.title}>GuitarTune Pro</Text>
          <Text style={styles.subtitle}>
            {t("premium.subtitle")}
          </Text>
        </View>

        <View style={styles.priceContainer}>
          <View style={styles.priceOption}>
            <Text style={styles.priceAmount}>$1.99</Text>
            <Text style={styles.pricePeriod}>{t("premium.perMonth")}</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceOption}>
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>{t("premium.save")}</Text>
            </View>
            <Text style={styles.priceAmount}>$9.99</Text>
            <Text style={styles.pricePeriod}>{t("premium.perYear")}</Text>
          </View>
        </View>

        <View style={styles.compareSection}>
          <Text style={styles.compareTitle}>{t("premium.compareTitle")}</Text>
          <View style={styles.compareTable}>
            <View style={styles.compareHeader}>
              <View style={styles.compareColLeft}>
                <Text style={styles.compareHeaderText}>{t("premium.compareOthers")}</Text>
              </View>
              <View style={styles.compareColRight}>
                <Text style={styles.compareHeaderTextHighlight}>{t("premium.compareUs")}</Text>
              </View>
            </View>
            <View style={styles.compareRow}>
              <View style={styles.compareColLeft}>
                <Ionicons name="close-circle" size={16} color={Colors.dark.warning} />
                <Text style={styles.compareTextBad}>{t("premium.compareAds")}</Text>
              </View>
              <View style={styles.compareColRight}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.dark.accent} />
                <Text style={styles.compareTextGood}>{t("premium.compareNoAds")}</Text>
              </View>
            </View>
            <View style={styles.compareRow}>
              <View style={styles.compareColLeft}>
                <Ionicons name="close-circle" size={16} color={Colors.dark.warning} />
                <Text style={styles.compareTextBad}>{t("premium.comparePrice")}</Text>
              </View>
              <View style={styles.compareColRight}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.dark.accent} />
                <Text style={styles.compareTextGood}>{t("premium.compareOurPrice")}</Text>
              </View>
            </View>
            <View style={styles.compareRow}>
              <View style={styles.compareColLeft}>
                <Ionicons name="close-circle" size={16} color={Colors.dark.warning} />
                <Text style={styles.compareTextBad}>{t("premium.compareBloat")}</Text>
              </View>
              <View style={styles.compareColRight}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.dark.accent} />
                <Text style={styles.compareTextGood}>{t("premium.compareFast")}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.featuresContainer}>
          {getFeatures().map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: feature.free ? Colors.dark.surfaceHighlight : Colors.dark.primaryMuted },
                ]}
              >
                <Ionicons
                  name={feature.icon}
                  size={20}
                  color={feature.free ? Colors.dark.textSecondary : Colors.dark.primary}
                />
              </View>
              <View style={styles.featureTextContainer}>
                <View style={styles.featureTitleRow}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  {!feature.free && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
              <Ionicons
                name={feature.free ? "checkmark-circle" : "lock-closed"}
                size={20}
                color={feature.free ? Colors.dark.accent : Colors.dark.textTertiary}
              />
            </View>
          ))}
        </View>

        {user?.isPremium ? (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.dark.accent} />
            <Text style={styles.activeText}>{t("premium.activePlan")}</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.purchaseButton,
              pressed && styles.purchaseButtonPressed,
            ]}
            onPress={handlePurchase}
          >
            <LinearGradient
              colors={[Colors.dark.premiumGradientStart, Colors.dark.premiumGradientEnd]}
              style={styles.purchaseGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="diamond" size={20} color="#000" />
              <Text style={styles.purchaseText}>{t("premium.subscribe")}</Text>
            </LinearGradient>
          </Pressable>
        )}

        <Text style={styles.disclaimer}>
          {t("premium.disclaimer")}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    padding: 24,
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  premiumBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.dark.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 20,
  },
  priceOption: {
    alignItems: "center",
    gap: 2,
  },
  priceDivider: {
    width: 1,
    height: 50,
    backgroundColor: Colors.dark.border,
  },
  saveBadge: {
    backgroundColor: Colors.dark.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  saveText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.dark.accent,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: Colors.dark.premium,
  },
  pricePeriod: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  featuresContainer: {
    marginTop: 28,
    gap: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    gap: 12,
    marginBottom: 8,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
  proBadge: {
    backgroundColor: Colors.dark.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: Colors.dark.primary,
    letterSpacing: 0.5,
  },
  featureDesc: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: Colors.dark.accentMuted,
    marginTop: 24,
  },
  activeText: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.dark.accent,
  },
  purchaseButton: {
    marginTop: 24,
    borderRadius: 16,
    overflow: "hidden",
  },
  purchaseButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  purchaseGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 18,
  },
  purchaseText: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: "#000",
  },
  disclaimer: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    textAlign: "center",
    marginTop: 16,
  },
  compareSection: {
    marginTop: 24,
    gap: 12,
  },
  compareTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    textAlign: "center",
  },
  compareTable: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  compareHeader: {
    flexDirection: "row",
    backgroundColor: Colors.dark.surfaceHighlight,
  },
  compareColLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 12,
  },
  compareColRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 12,
    backgroundColor: "rgba(0, 230, 118, 0.06)",
  },
  compareHeaderText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.dark.textTertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  compareHeaderTextHighlight: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.dark.accent,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  compareRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  compareTextBad: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  compareTextGood: {
    fontSize: 13,
    color: Colors.dark.accent,
    fontWeight: "600" as const,
    flex: 1,
  },
});
