import {
  View, Text, Pressable, StyleSheet, ScrollView, Platform,
  Alert, ActivityIndicator, Linking,
} from "react-native";
import { useState, useCallback, useRef } from "react";
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

type Plan = "monthly" | "quarterly" | "annual" | "lifetime";
type CryptoToken = "usdc" | "sol";

const PHANTOM_PURPLE = "#9945FF";
const SOL_ORANGE = "#F7931A";

function getFeatures() {
  return [
    { icon: "musical-notes" as const, title: t("premium.premiumTunings"), desc: "Drop D, Open G, DADGAD, Open D, Open E, Drop C", free: false },
    { icon: "speedometer" as const, title: t("premium.advancedDetection"), desc: t("premium.advancedDetectionDesc"), free: false },
    { icon: "analytics" as const, title: t("premium.tuningHistory"), desc: t("premium.tuningHistoryDesc"), free: false },
    { icon: "color-palette" as const, title: t("premium.customThemes"), desc: t("premium.customThemesDesc"), free: false },
    { icon: "radio" as const, title: t("premium.standardTuner"), desc: t("premium.standardTunerDesc"), free: true },
    { icon: "git-branch" as const, title: t("premium.freeTunings"), desc: "Double Drop D, Open C, All Fourths", free: true },
  ];
}

function showAlert(title: string, msg: string) {
  if (Platform.OS === "web") alert(msg);
  else Alert.alert(title, msg);
}

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const { user, upgradeToPremium, checkSubscriptionStatus } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<Plan>("quarterly");
  const [cryptoToken, setCryptoToken] = useState<CryptoToken>("usdc");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSolanaProcessing, setIsSolanaProcessing] = useState(false);
  const solanaPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canPayWithPhantom = selectedPlan === "lifetime" || selectedPlan === "quarterly";

  const handlePurchase = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user) {
      showAlert("", t("premium.loginRequired"));
      router.push("/(auth)/login");
      return;
    }
    setIsProcessing(true);
    try {
      const lsPlan = selectedPlan === "quarterly" ? "monthly" : selectedPlan;
      const res = await apiRequest("GET", `/api/checkout/url?plan=${lsPlan}&userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (!data.checkoutUrl) throw new Error("No checkout URL");

      await WebBrowser.openBrowserAsync(data.checkoutUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      });

      let attempts = 0;
      const checkPayment = async () => {
        const isPremium = await checkSubscriptionStatus();
        if (isPremium) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsProcessing(false);
          router.back();
          return;
        }
        attempts++;
        if (attempts < 6) {
          setTimeout(checkPayment, 3000);
        } else {
          setIsProcessing(false);
          if (Platform.OS === "web") {
            const confirmed = confirm(t("premium.confirmWeb"));
            if (confirmed) { await upgradeToPremium(); router.back(); }
          } else {
            Alert.alert(t("premium.alertTitle"), t("premium.alertMessage"), [
              { text: t("premium.no"), style: "cancel" },
              { text: t("premium.yes"), onPress: async () => { await upgradeToPremium(); router.back(); } },
            ]);
          }
        }
      };
      setTimeout(checkPayment, 2000);
    } catch (e) {
      console.error("Purchase error:", e);
      setIsProcessing(false);
      showAlert("", t("premium.error"));
    }
  }, [user, selectedPlan, checkSubscriptionStatus, upgradeToPremium]);

  const handlePhantomPay = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!user) {
      showAlert("", t("premium.loginRequired"));
      router.push("/(auth)/login");
      return;
    }
    if (solanaPollingRef.current) clearTimeout(solanaPollingRef.current);
    setIsSolanaProcessing(true);

    try {
      const planForSolana = selectedPlan === "quarterly" ? "quarterly" : "lifetime";
      const res = await apiRequest("POST", "/api/checkout/solana/create", {
        userId: user.id,
        plan: planForSolana,
        token: cryptoToken,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Solana payment not configured");

      const { url, phantomUrl, reference } = data as {
        url: string; phantomUrl: string; reference: string;
      };

      const canOpenPhantom = await Linking.canOpenURL("phantom://");
      await Linking.openURL(canOpenPhantom ? url : phantomUrl);

      let attempts = 0;
      const pollPayment = async () => {
        try {
          const verifyRes = await apiRequest(
            "GET",
            `/api/checkout/solana/verify?reference=${encodeURIComponent(reference)}&userId=${encodeURIComponent(user.id)}`
          );
          const verifyData = await verifyRes.json() as { status: string };

          if (verifyData.status === "confirmed") {
            await checkSubscriptionStatus();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsSolanaProcessing(false);
            router.back();
            return;
          }
          if (verifyData.status === "expired") {
            setIsSolanaProcessing(false);
            showAlert("", t("premium.phantomExpired"));
            return;
          }
        } catch (err) {
          console.warn("Solana verify poll error:", err);
        }
        attempts++;
        if (attempts < 40) {
          solanaPollingRef.current = setTimeout(pollPayment, 3000);
        } else {
          setIsSolanaProcessing(false);
        }
      };
      setTimeout(pollPayment, 4000);
    } catch (e: unknown) {
      console.error("Phantom pay error:", e);
      setIsSolanaProcessing(false);
      const msg = e instanceof Error ? e.message : t("premium.error");
      showAlert("", msg);
    }
  }, [user, selectedPlan, cryptoToken, checkSubscriptionStatus]);

  const getPlanPrice = (plan: Plan) => {
    if (plan === "monthly") return "$1.99";
    if (plan === "quarterly") return "$4.99";
    if (plan === "annual") return "$9.99";
    return "$14.99";
  };

  const getPhantomDesc = () => {
    const isLifetime = selectedPlan === "lifetime";
    if (cryptoToken === "sol") {
      return isLifetime ? t("premium.solAmountLifetime") : t("premium.solAmount3mo");
    }
    return isLifetime ? t("premium.phantomPayDescLifetime") : t("premium.phantomPayDesc3mo");
  };

  const getMainButtonLabel = () => {
    if (selectedPlan === "lifetime") return `${t("premium.buyLifetime")} — $14.99`;
    if (selectedPlan === "quarterly") return `${t("premium.buy3Months")} — $4.99`;
    if (selectedPlan === "annual") return `${t("premium.subscribe")} — $9.99/yr`;
    return `${t("premium.subscribe")} — $1.99/mo`;
  };

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
          <Text style={styles.subtitle}>{t("premium.subtitle")}</Text>
        </View>

        {/* Plan selector — 2×2 grid */}
        <View style={styles.planGrid}>
          {/* Row 1 */}
          <View style={styles.planRow}>
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
              style={[styles.planCard, selectedPlan === "quarterly" && styles.planCardActive]}
              onPress={() => { setSelectedPlan("quarterly"); Haptics.selectionAsync(); }}
            >
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>{t("premium.popular")}</Text>
              </View>
              <Text style={[styles.planLabel, selectedPlan === "quarterly" && styles.planLabelActive]}>
                {t("premium.quarterly")}
              </Text>
              <Text style={[styles.planPrice, selectedPlan === "quarterly" && styles.planPriceActive]}>
                $4.99
              </Text>
              <Text style={[styles.planPeriod, selectedPlan === "quarterly" && styles.planPeriodActive]}>
                {t("premium.per3Months")}
              </Text>
              <View style={styles.saveBadge}>
                <Text style={styles.saveText}>{t("premium.save3mo")}</Text>
              </View>
            </Pressable>
          </View>

          {/* Row 2 */}
          <View style={styles.planRow}>
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

            <Pressable
              style={[styles.planCard, selectedPlan === "lifetime" && styles.planCardActive]}
              onPress={() => { setSelectedPlan("lifetime"); Haptics.selectionAsync(); }}
            >
              <View style={styles.lifetimeBadge}>
                <Text style={styles.lifetimeBadgeText}>{t("premium.oneTime")}</Text>
              </View>
              <Text style={[styles.planLabel, selectedPlan === "lifetime" && styles.planLabelActive]}>
                {t("premium.lifetime")}
              </Text>
              <Text style={[styles.planPrice, selectedPlan === "lifetime" && styles.planPriceActive]}>
                $14.99
              </Text>
              <Text style={[styles.planPeriod, selectedPlan === "lifetime" && styles.planPeriodActive]}>
                {t("premium.forever")}
              </Text>
              <View style={styles.saveBadge}>
                <Text style={styles.saveText}>{t("premium.payOnce")}</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Compare table */}
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
            {[
              [t("premium.compareAds"), t("premium.compareNoAds")],
              [t("premium.comparePrice"), t("premium.compareOurPrice")],
              [t("premium.compareBloat"), t("premium.compareFast")],
            ].map(([bad, good], i) => (
              <View key={i} style={styles.compareRow}>
                <View style={styles.compareColLeft}>
                  <Ionicons name="close-circle" size={16} color={Colors.dark.warning} />
                  <Text style={styles.compareTextBad}>{bad}</Text>
                </View>
                <View style={styles.compareColRight}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.dark.inTune} />
                  <Text style={styles.compareTextGood}>{good}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {getFeatures().map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: feature.free ? Colors.dark.surfaceHighlight : Colors.dark.primaryMuted }]}>
                <Ionicons name={feature.icon} size={20} color={feature.free ? Colors.dark.textSecondary : Colors.dark.primary} />
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
          <>
            {/* Main CTA */}
            <Pressable
              style={({ pressed }) => [styles.purchaseButton, pressed && styles.purchaseButtonPressed]}
              onPress={handlePurchase}
              disabled={isProcessing || isSolanaProcessing}
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
                    <Text style={styles.purchaseText}>{getMainButtonLabel()}</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {/* Phantom Pay — quarterly or lifetime */}
            {canPayWithPhantom && (
              <>
                <Text style={styles.orSeparator}>{t("premium.orPayWith")}</Text>

                {/* Token toggle: USDC | SOL */}
                <View style={styles.tokenToggle}>
                  <Pressable
                    style={[styles.tokenBtn, cryptoToken === "usdc" && styles.tokenBtnActiveUsdc]}
                    onPress={() => { setCryptoToken("usdc"); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.tokenBtnText, cryptoToken === "usdc" && styles.tokenBtnTextActive]}>
                      {t("premium.payInUsdc")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tokenBtn, cryptoToken === "sol" && styles.tokenBtnActiveSol]}
                    onPress={() => { setCryptoToken("sol"); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.tokenBtnText, cryptoToken === "sol" && styles.tokenBtnTextActiveSol]}>
                      {t("premium.payInSol")}
                    </Text>
                  </Pressable>
                </View>

                {/* Phantom button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.phantomButton,
                    pressed && styles.phantomButtonPressed,
                    (isSolanaProcessing || isProcessing) && styles.phantomButtonDisabled,
                  ]}
                  onPress={handlePhantomPay}
                  disabled={isSolanaProcessing || isProcessing}
                >
                  {isSolanaProcessing ? (
                    <View style={styles.phantomButtonInner}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.phantomButtonText}>{t("premium.phantomWaiting")}</Text>
                    </View>
                  ) : (
                    <View style={styles.phantomButtonInner}>
                      <View style={[styles.phantomIconBox, cryptoToken === "sol" && styles.phantomIconBoxSol]}>
                        <Text style={styles.phantomIconText}>
                          {cryptoToken === "sol" ? "◎" : "👻"}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.phantomButtonText, cryptoToken === "sol" && styles.phantomButtonTextSol]}>
                          {t("premium.phantomPay")}
                        </Text>
                        <Text style={[styles.phantomButtonSubtext, cryptoToken === "sol" && styles.phantomButtonSubtextSol]}>
                          {getPhantomDesc()}
                          {cryptoToken === "sol" && (
                            <Text style={styles.solNote}> · {t("premium.solNote")}</Text>
                          )}
                        </Text>
                      </View>
                    </View>
                  )}
                </Pressable>
                <Text style={styles.phantomHint}>{t("premium.phantomInstallHint")}</Text>
              </>
            )}
          </>
        )}

        <Text style={styles.disclaimer}>
          {selectedPlan === "lifetime"
            ? t("premium.disclaimerLifetime")
            : selectedPlan === "quarterly"
            ? t("premium.disclaimerQuarterly")
            : t("premium.disclaimer")}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  scrollContent: { padding: 24 },
  closeButton: {
    alignSelf: "flex-end", width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.dark.surface, alignItems: "center", justifyContent: "center",
  },
  header: { alignItems: "center", gap: 12, marginTop: 8 },
  premiumBadge: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800" as const, color: Colors.dark.text },
  subtitle: { fontSize: 15, color: Colors.dark.textSecondary, textAlign: "center" },

  planGrid: { marginTop: 24, gap: 8 },
  planRow: { flexDirection: "row", gap: 8 },
  planCard: {
    flex: 1, padding: 12, borderRadius: 16, backgroundColor: Colors.dark.surface,
    borderWidth: 2, borderColor: Colors.dark.border, alignItems: "center", gap: 4,
    minHeight: 110,
  },
  planCardActive: { borderColor: Colors.dark.primary, backgroundColor: Colors.dark.primaryMuted },
  planLabel: { fontSize: 12, fontWeight: "600" as const, color: Colors.dark.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  planLabelActive: { color: Colors.dark.primary },
  planPrice: { fontSize: 22, fontWeight: "800" as const, color: Colors.dark.textSecondary, marginTop: 4 },
  planPriceActive: { color: Colors.dark.premium },
  planPeriod: { fontSize: 11, color: Colors.dark.textTertiary },
  planPeriodActive: { color: Colors.dark.textSecondary },

  bestValueBadge: {
    position: "absolute", top: -10,
    backgroundColor: Colors.dark.inTune, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  bestValueText: { fontSize: 9, fontWeight: "700" as const, color: "#000", textTransform: "uppercase" as const },
  popularBadge: {
    position: "absolute", top: -10,
    backgroundColor: PHANTOM_PURPLE, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  popularBadgeText: { fontSize: 9, fontWeight: "700" as const, color: "#fff", textTransform: "uppercase" as const },
  lifetimeBadge: {
    position: "absolute", top: -10,
    backgroundColor: Colors.dark.premium, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  lifetimeBadgeText: { fontSize: 9, fontWeight: "700" as const, color: "#000", textTransform: "uppercase" as const },
  saveBadge: {
    backgroundColor: Colors.dark.inTuneMuted, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, marginTop: 2,
  },
  saveText: { fontSize: 9, fontWeight: "700" as const, color: Colors.dark.inTune },

  compareSection: { marginTop: 24, gap: 12 },
  compareTitle: { fontSize: 17, fontWeight: "700" as const, color: Colors.dark.text, textAlign: "center" },
  compareTable: { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: Colors.dark.border },
  compareHeader: { flexDirection: "row", backgroundColor: Colors.dark.surfaceHighlight },
  compareColLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, padding: 12 },
  compareColRight: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderLeftWidth: 1, borderLeftColor: Colors.dark.border },
  compareHeaderText: { fontSize: 13, fontWeight: "700" as const, color: Colors.dark.textSecondary },
  compareHeaderTextHighlight: { fontSize: 13, fontWeight: "700" as const, color: Colors.dark.primary },
  compareRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: Colors.dark.border },
  compareTextBad: { fontSize: 12, color: Colors.dark.textSecondary, flex: 1 },
  compareTextGood: { fontSize: 12, color: Colors.dark.inTune, flex: 1 },

  featuresContainer: { marginTop: 24, gap: 4 },
  featureRow: {
    flexDirection: "row", alignItems: "center", padding: 14,
    borderRadius: 14, backgroundColor: Colors.dark.surface, gap: 12, marginBottom: 8,
  },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featureTextContainer: { flex: 1 },
  featureTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureTitle: { fontSize: 15, fontWeight: "600" as const, color: Colors.dark.text },
  proBadge: { backgroundColor: Colors.dark.primaryMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  proBadgeText: { fontSize: 9, fontWeight: "700" as const, color: Colors.dark.primary, letterSpacing: 0.5 },
  featureDesc: { fontSize: 12, color: Colors.dark.textTertiary, marginTop: 2 },

  activeBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 18, borderRadius: 16, backgroundColor: Colors.dark.inTuneMuted, marginTop: 24,
  },
  activeText: { fontSize: 17, fontWeight: "700" as const, color: Colors.dark.inTune },

  purchaseButton: { marginTop: 24, borderRadius: 16, overflow: "hidden" },
  purchaseButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  purchaseGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 18 },
  purchaseText: { fontSize: 17, fontWeight: "800" as const, color: "#000" },

  orSeparator: { textAlign: "center", color: Colors.dark.textTertiary, fontSize: 12, marginTop: 16, marginBottom: 10 },

  tokenToggle: {
    flexDirection: "row", alignSelf: "center", gap: 0,
    backgroundColor: Colors.dark.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.dark.border,
    overflow: "hidden", marginBottom: 12,
  },
  tokenBtn: { paddingHorizontal: 28, paddingVertical: 10 },
  tokenBtnActiveUsdc: { backgroundColor: PHANTOM_PURPLE },
  tokenBtnActiveSol: { backgroundColor: SOL_ORANGE },
  tokenBtnText: { fontSize: 14, fontWeight: "700" as const, color: Colors.dark.textSecondary },
  tokenBtnTextActive: { color: "#fff" },
  tokenBtnTextActiveSol: { color: "#fff" },

  phantomButton: {
    borderRadius: 16, overflow: "hidden",
    backgroundColor: PHANTOM_PURPLE,
    borderWidth: 1.5, borderColor: PHANTOM_PURPLE,
  },
  phantomButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  phantomButtonDisabled: { opacity: 0.5 },
  phantomButtonInner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  phantomIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  phantomIconBoxSol: { backgroundColor: "rgba(247,147,26,0.3)" },
  phantomIconText: { fontSize: 22 },
  phantomButtonText: { fontSize: 16, fontWeight: "700" as const, color: "#fff" },
  phantomButtonTextSol: { color: "#fff" },
  phantomButtonSubtext: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  phantomButtonSubtextSol: { color: "rgba(255,255,255,0.8)" },
  solNote: { fontSize: 10, color: "rgba(255,255,255,0.55)" },
  phantomHint: { fontSize: 11, color: Colors.dark.textTertiary, textAlign: "center", marginTop: 8 },

  disclaimer: { fontSize: 11, color: Colors.dark.textTertiary, textAlign: "center", marginTop: 16 },
});
