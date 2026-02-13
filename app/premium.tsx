import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Alert, ActivityIndicator } from "react-native";
import { useState, useCallback } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { apiRequest } from "@/lib/query-client";

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
  const { user, upgradeToPremium, checkSubscriptionStatus } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual");
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!user) {
      if (Platform.OS === "web") {
        alert(t("premium.loginRequired"));
      } else {
        Alert.alert("", t("premium.loginRequired"));
      }
      router.push("/(auth)/login");
      return;
    }

    setIsProcessing(true);

    try {
      const res = await apiRequest("GET", `/api/checkout/url?plan=${selectedPlan}&userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();

      if (!data.checkoutUrl) {
        throw new Error("No checkout URL");
      }

      await WebBrowser.openBrowserAsync(data.checkoutUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      });

      setIsProcessing(true);
      let attempts = 0;
      const maxAttempts = 6;

      const checkPayment = async () => {
        const isPremium = await checkSubscriptionStatus();
        if (isPremium) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsProcessing(false);
          router.back();
          return;
        }
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkPayment, 3000);
        } else {
          setIsProcessing(false);
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
        }
      };

      setTimeout(checkPayment, 2000);
    } catch (e) {
      console.error("Purchase error:", e);
      setIsProcessing(false);
      if (Platform.OS === "web") {
        alert(t("premium.error"));
      } else {
        Alert.alert("", t("premium.error"));
      }
    }
  }, [user, selectedPlan, checkSubscriptionStatus, upgradeToPremium]);

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

        <View style={styles.planSelector}>
          <Pressable
            style={[styles.planCard, selectedPlan === "monthly" && styles.planCardActive]}
            onPress={() => { setSelectedPlan("monthly"); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.planLabel, selectedPlan === "monthly" && styles.planLabelActive]}>
              {t("premium.monthly")}
            </Text>
            <Text style={[styles.planPrice, selectedPlan === "monthly" && styles.planPriceActive]}>
              $1.99
            </Text>
            <Text style={[styles.planPeriod, selectedPlan === "monthly" && styles.planPeriodActive]}>
              {t("premium.perMonth")}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.planCard, selectedPlan === "annual" && styles.planCardActive]}
            onPress={() => { setSelectedPlan("annual"); Haptics.selectionAsync(); }}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>{t("premium.bestValue")}</Text>
            </View>
            <Text style={[styles.planLabel, selectedPlan === "annual" && styles.planLabelActive]}>
              {t("premium.annual")}
            </Text>
            <Text style={[styles.planPrice, selectedPlan === "annual" && styles.planPriceActive]}>
              $9.99
            </Text>
            <Text style={[styles.planPeriod, selectedPlan === "annual" && styles.planPeriodActive]}>
              {t("premium.perYear")}
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>{t("premium.save")}</Text>
            </View>
          </Pressable>
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
                <Ionicons name="checkmark-circle" size={16} color={Colors.dark.inTune} />
                <Text style={styles.compareTextGood}>{t("premium.compareNoAds")}</Text>
              </View>
            </View>
            <View style={styles.compareRow}>
              <View style={styles.compareColLeft}>
                <Ionicons name="close-circle" size={16} color={Colors.dark.warning} />
                <Text style={styles.compareTextBad}>{t("premium.comparePrice")}</Text>
              </View>
              <View style={styles.compareColRight}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.dark.inTune} />
                <Text style={styles.compareTextGood}>{t("premium.compareOurPrice")}</Text>
              </View>
            </View>
            <View style={styles.compareRow}>
              <View style={styles.compareColLeft}>
                <Ionicons name="close-circle" size={16} color={Colors.dark.warning} />
                <Text style={styles.compareTextBad}>{t("premium.compareBloat")}</Text>
              </View>
              <View style={styles.compareColRight}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.dark.inTune} />
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
                color={feature.free ? Colors.dark.inTune : Colors.dark.textTertiary}
              />
            </View>
          ))}
        </View>

        {user?.isPremium ? (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.dark.inTune} />
            <Text style={styles.activeText}>{t("premium.activePlan")}</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.purchaseButton,
              pressed && styles.purchaseButtonPressed,
            ]}
            onPress={handlePurchase}
            disabled={isProcessing}
          >
            <LinearGradient
              colors={[Colors.dark.premiumGradientStart, Colors.dark.premiumGradientEnd]}
              style={styles.purchaseGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isProcessing ? (
                <>
                  <ActivityIndicator size="small" color="#000" />
                  <Text style={styles.purchaseText}>{t("premium.processing")}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="diamond" size={20} color="#000" />
                  <Text style={styles.purchaseText}>
                    {t("premium.subscribe")} — {selectedPlan === "monthly" ? "$1.99/mo" : "$9.99/yr"}
                  </Text>
                </>
              )}
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
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  planSelector: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  planCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: "center",
    gap: 4,
  },
  planCardActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryMuted,
  },
  planLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.dark.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  planLabelActive: {
    color: Colors.dark.primary,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  planPriceActive: {
    color: Colors.dark.premium,
  },
  planPeriod: {
    fontSize: 13,
    color: Colors.dark.textTertiary,
  },
  planPeriodActive: {
    color: Colors.dark.textSecondary,
  },
  bestValueBadge: {
    position: "absolute",
    top: -10,
    backgroundColor: Colors.dark.inTune,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#000",
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  saveBadge: {
    backgroundColor: Colors.dark.inTuneMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  saveText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.dark.inTune,
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
    backgroundColor: Colors.dark.inTuneMuted,
    marginTop: 24,
  },
  activeText: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.dark.inTune,
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
    backgroundColor: Colors.dark.inTuneMuted,
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
    color: Colors.dark.inTune,
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
    color: Colors.dark.inTune,
    fontWeight: "600" as const,
    flex: 1,
  },
});
