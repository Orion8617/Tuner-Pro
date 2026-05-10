import {
  View, Text, Pressable, StyleSheet, ScrollView, Platform,
  Alert, ActivityIndicator, Linking, Modal,
} from "react-native";
import { useState, useCallback, useRef } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/lib/revenuecat";
import { t } from "@/lib/i18n";
import { apiRequest } from "@/lib/query-client";

type Plan = "monthly" | "quarterly" | "annual" | "lifetime";
type CryptoToken = "usdc" | "sol";

const ACCENT = "#4AEDC4";
const ACCENT_DIM = "rgba(74, 237, 196, 0.12)";
const ACCENT_MED = "rgba(74, 237, 196, 0.25)";
const BG = "#080808";
const SURFACE = "#111111";
const SURFACE_ELEVATED = "#161616";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "rgba(255,255,255,0.55)";
const TEXT_DIM = "rgba(255,255,255,0.25)";
const GOLD = "#E8C547";
const GOLD_DIM = "rgba(232, 197, 71, 0.14)";
const PHANTOM_PURPLE = "#7B3FE4";
const SOL_ORANGE = "#F7931A";

const FEATURE_CHECKLIST = [
  { icon: "pulse" as const, label: "KlonEngine SNN Signal Processing", sub: "Neuromorphic pitch engine — Zero-GC · GDOP confidence · NEAT-Audio", pro: true },
  { icon: "musical-notes" as const, label: "6 Premium Guitar Tunings", sub: "Drop D, Open G, DADGAD, Open D, Open E, Drop C", pro: true },
  { icon: "musical-note" as const, label: "Bass & Ukulele", sub: "4/5-string bass, ukulele, 7-string guitar", pro: true },
  { icon: "options" as const, label: "Reference Pitch A4", sub: "432 · 440 · 442 · 444 Hz — studio calibration", pro: true },
  { icon: "speedometer" as const, label: "NEAT-Audio Environment Index", sub: "Detects ambient noise, reverb & distortion in real time", pro: true },
  { icon: "analytics" as const, label: "Tuning History", sub: "Track your sessions over time", pro: true },
  { icon: "radio" as const, label: "Standard Tuner (EADGBE)", sub: "Always free, always fast", pro: false },
  { icon: "git-branch" as const, label: "3 Free Alternate Tunings", sub: "Double Drop D, Open C, All Fourths", pro: false },
];

function PressableScale({
  onPress,
  style,
  children,
  disabled,
}: {
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(0.96, { damping: 10, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
      }}
      onPress={onPress}
      disabled={disabled}
      style={style}
    >
      <Animated.View style={animStyle}>{children}</Animated.View>
    </Pressable>
  );
}

function showAlert(title: string, msg: string) {
  if (Platform.OS === "web") alert(msg);
  else Alert.alert(title, msg);
}

function PlanCard({
  plan,
  isSelected,
  onSelect,
}: {
  plan: { key: Plan; label: string; price: string; period: string; badge?: string; badgeColor?: string; saveBadge?: string };
  isSelected: boolean;
  onSelect: (key: Plan) => void;
}) {
  const badgeIsAccent = plan.badgeColor === ACCENT;
  const badgeIsGold   = plan.badgeColor === GOLD;
  const badgeBg       = badgeIsAccent ? ACCENT_MED : badgeIsGold ? GOLD_DIM : "rgba(123,63,228,0.2)";
  const badgeBorder   = badgeIsAccent ? "rgba(74,237,196,0.3)" : badgeIsGold ? "rgba(232,197,71,0.3)" : "rgba(123,63,228,0.35)";
  const saveBg        = badgeIsAccent ? ACCENT_DIM : badgeIsGold ? GOLD_DIM : "rgba(123,63,228,0.15)";

  return (
    <Pressable
      key={plan.key}
      style={[styles.planCard, isSelected && styles.planCardSelected]}
      onPress={() => { onSelect(plan.key); Haptics.selectionAsync(); }}
    >
      {plan.badge && (
        <View style={[styles.planBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
          <Text style={[styles.planBadgeText, { color: plan.badgeColor }]}>{plan.badge}</Text>
        </View>
      )}
      {isSelected && (
        <View style={styles.selectedDot}>
          <Ionicons name="checkmark-circle" size={14} color={ACCENT} />
        </View>
      )}
      <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>{plan.label}</Text>
      <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>{plan.price}</Text>
      <Text style={[styles.planPeriod, isSelected && styles.planPeriodSelected]}>{plan.period}</Text>
      {plan.saveBadge && (
        <View style={[styles.savePill, { backgroundColor: saveBg }]}>
          <Text style={[styles.savePillText, { color: plan.badgeColor }]}>{plan.saveBadge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const { user, upgradeToPremium } = useAuth();
  const { packages, purchase, restore, isPurchasing, isRestoring, isSubscribed } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<Plan>("annual");
  const [cryptoToken, setCryptoToken] = useState<CryptoToken>("usdc");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSolanaProcessing, setIsSolanaProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPkg, setPendingPkg] = useState<any>(null);
  const solanaPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canPayWithPhantom = selectedPlan === "lifetime" || selectedPlan === "quarterly";

  const getPackageForPlan = useCallback((plan: Plan) => {
    if (plan === "monthly") return packages.monthly;
    if (plan === "quarterly") return packages.quarterly;
    if (plan === "annual") return packages.annual;
    if (plan === "lifetime") return packages.lifetime;
    return null;
  }, [packages]);

  const handlePurchase = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user) {
      showAlert("", t("premium.loginRequired"));
      router.push("/(auth)/login");
      return;
    }
    const pkg = getPackageForPlan(selectedPlan);
    if (!pkg) {
      showAlert("", "Plan no disponible. Intenta de nuevo.");
      return;
    }
    // En modo dev mostramos confirmación antes de cobrar
    if (__DEV__) {
      setPendingPkg(pkg);
      setShowConfirm(true);
      return;
    }
    setIsProcessing(true);
    try {
      await purchase(pkg);
      await upgradeToPremium();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      if (!e?.userCancelled) {
        console.error("Purchase error:", e);
        showAlert("", t("premium.error"));
      }
    } finally {
      setIsProcessing(false);
    }
  }, [user, selectedPlan, getPackageForPlan, purchase, upgradeToPremium]);

  const confirmDevPurchase = useCallback(async () => {
    setShowConfirm(false);
    if (!pendingPkg) return;
    setIsProcessing(true);
    try {
      await purchase(pendingPkg);
      await upgradeToPremium();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      if (!e?.userCancelled) showAlert("", t("premium.error"));
    } finally {
      setIsProcessing(false);
      setPendingPkg(null);
    }
  }, [pendingPkg, purchase, upgradeToPremium]);

  const handleRestore = useCallback(async () => {
    try {
      await restore();
      if (isSubscribed) {
        await upgradeToPremium();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } else {
        showAlert("", "No se encontraron compras anteriores.");
      }
    } catch (e) {
      showAlert("", t("premium.error"));
    }
  }, [restore, isSubscribed, upgradeToPremium]);

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

  const getPhantomDesc = () => {
    const isLifetime = selectedPlan === "lifetime";
    if (cryptoToken === "sol") {
      return isLifetime ? t("premium.solAmountLifetime") : t("premium.solAmount3mo");
    }
    return isLifetime ? t("premium.phantomPayDescLifetime") : t("premium.phantomPayDesc3mo");
  };

  const getMainButtonLabel = () => {
    const pkg = getPackageForPlan(selectedPlan);
    const price = pkg?.product?.priceString;
    if (selectedPlan === "lifetime") return `${t("premium.buyLifetime")}  ${price ?? "$14.99"}`;
    if (selectedPlan === "quarterly") return `${t("premium.buy3Months")}  ${price ?? "$4.99"}`;
    if (selectedPlan === "annual") return `${t("premium.subscribe")}  ${price ?? "$9.99"}/yr`;
    return `${t("premium.subscribe")}  ${price ?? "$1.99"}/mo`;
  };

  const ctaGradientColors = (): [string, string] => {
    if (selectedPlan === "lifetime") return ["#E8C547", "#C8A96E"];
    if (selectedPlan === "quarterly") return [PHANTOM_PURPLE, "#9945FF"];
    return ["#4AEDC4", "#2AC8A4"];
  };

  const plans: {
    key: Plan;
    label: string;
    price: string;
    period: string;
    badge?: string;
    badgeColor?: string;
    saveBadge?: string;
  }[] = [
    {
      key: "monthly",
      label: t("premium.monthly"),
      price: "$1.99",
      period: t("premium.perMonth"),
    },
    {
      key: "quarterly",
      label: t("premium.quarterly"),
      price: "$4.99",
      period: t("premium.per3Months"),
      badge: t("premium.popular"),
      badgeColor: PHANTOM_PURPLE,
      saveBadge: t("premium.save3mo"),
    },
    {
      key: "annual",
      label: t("premium.annual"),
      price: "$9.99",
      period: t("premium.perYear"),
      badge: t("premium.bestValue"),
      badgeColor: ACCENT,
      saveBadge: t("premium.save"),
    },
    {
      key: "lifetime",
      label: t("premium.lifetime"),
      price: "$14.99",
      period: t("premium.forever"),
      badge: t("premium.oneTime"),
      badgeColor: GOLD,
      saveBadge: t("premium.payOnce"),
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== CLOSE BUTTON ===== */}
        <PressableScale onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={TEXT_SECONDARY} />
        </PressableScale>

        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <LinearGradient
            colors={["rgba(74, 237, 196, 0.18)", "rgba(232, 197, 71, 0.14)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumBadge}
          >
            <Ionicons name="diamond" size={28} color={ACCENT} />
          </LinearGradient>
          <Text style={styles.title}>GuitarTune Pro</Text>
          <Text style={styles.subtitle}>{t("premium.subtitle")}</Text>
        </View>

        {/* ===== PLAN CARDS — 2×2 grid ===== */}
        <View style={styles.planGrid}>
          <View style={styles.planRow}>
            {plans.slice(0, 2).map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                isSelected={selectedPlan === plan.key}
                onSelect={setSelectedPlan}
              />
            ))}
          </View>
          <View style={styles.planRow}>
            {plans.slice(2, 4).map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                isSelected={selectedPlan === plan.key}
                onSelect={setSelectedPlan}
              />
            ))}
          </View>
        </View>

        {/* ===== FEATURE CHECKLIST ===== */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionLabel}>WHAT YOU GET</Text>
          <View style={styles.featuresList}>
            {FEATURE_CHECKLIST.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={[styles.featureIconWrap, f.pro ? styles.featureIconPro : styles.featureIconFree]}>
                  <Ionicons name={f.icon} size={16} color={f.pro ? ACCENT : TEXT_SECONDARY} />
                </View>
                <View style={styles.featureText}>
                  <View style={styles.featureTitleRow}>
                    <Text style={styles.featureLabel}>{f.label}</Text>
                    {f.pro && (
                      <View style={styles.proBadge}>
                        <Text style={styles.proBadgeText}>PRO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.featureSub}>{f.sub}</Text>
                </View>
                <Ionicons
                  name={f.pro ? "lock-closed" : "checkmark-circle"}
                  size={16}
                  color={f.pro ? TEXT_DIM : ACCENT}
                />
              </View>
            ))}
          </View>
        </View>

        {/* ===== MODAL CONFIRMACIÓN DEV ===== */}
        <Modal visible={showConfirm} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Confirmar compra (Test)</Text>
              <Text style={styles.modalBody}>
                {pendingPkg?.product?.title}{"\n"}
                <Text style={{ color: ACCENT, fontWeight: "700" }}>
                  {pendingPkg?.product?.priceString}
                </Text>
              </Text>
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalCancel} onPress={() => setShowConfirm(false)}>
                  <Text style={{ color: TEXT_SECONDARY, fontWeight: "600" }}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.modalConfirm} onPress={confirmDevPurchase}>
                  <Text style={{ color: "#000", fontWeight: "700" }}>Comprar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== CTA ===== */}
        {user?.isPremium ? (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={22} color={ACCENT} />
            <Text style={styles.activeText}>{t("premium.activePlan")}</Text>
          </View>
        ) : (
          <>
            <PressableScale
              onPress={handlePurchase}
              disabled={isProcessing || isSolanaProcessing || isPurchasing}
              style={styles.ctaWrap}
            >
              <LinearGradient
                colors={ctaGradientColors()}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {isProcessing ? (
                  <>
                    <ActivityIndicator size="small" color="#000" />
                    <Text style={styles.ctaText}>{t("premium.processing")}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="diamond" size={18} color="#000" />
                    <Text style={styles.ctaText}>{getMainButtonLabel()}</Text>
                  </>
                )}
              </LinearGradient>
            </PressableScale>

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
                    <Text style={[styles.tokenBtnText, cryptoToken === "usdc" && styles.tokenBtnTextActive]}>USDC</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tokenBtn, cryptoToken === "sol" && styles.tokenBtnActiveSol]}
                    onPress={() => { setCryptoToken("sol"); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.tokenBtnText, cryptoToken === "sol" && styles.tokenBtnTextActive]}>SOL</Text>
                  </Pressable>
                </View>

                <PressableScale
                  onPress={handlePhantomPay}
                  disabled={isSolanaProcessing || isProcessing}
                  style={[
                    styles.phantomButton,
                    cryptoToken === "sol" && styles.phantomButtonSol,
                    (isSolanaProcessing || isProcessing) && styles.phantomButtonDisabled,
                  ]}
                >
                  {isSolanaProcessing ? (
                    <View style={styles.phantomInner}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.phantomText}>{t("premium.phantomWaiting")}</Text>
                    </View>
                  ) : (
                    <View style={styles.phantomInner}>
                      <View style={[styles.phantomIconBox, cryptoToken === "sol" && styles.phantomIconBoxSol]}>
                        <Text style={styles.phantomIconText}>{cryptoToken === "sol" ? "◎" : "👻"}</Text>
                      </View>
                      <View>
                        <Text style={styles.phantomText}>{t("premium.phantomPay")}</Text>
                        <Text style={styles.phantomSub}>
                          {getPhantomDesc()}
                          {cryptoToken === "sol" && (
                            <Text style={styles.solNote}> · {t("premium.solNote")}</Text>
                          )}
                        </Text>
                      </View>
                    </View>
                  )}
                </PressableScale>
                <Text style={styles.phantomHint}>{t("premium.phantomInstallHint")}</Text>
              </>
            )}
          </>
        )}

        {/* ===== COMPARE — secondary ===== */}
        <View style={styles.compareSection}>
          <Text style={styles.sectionLabel}>WHY US</Text>
          {[
            { bad: t("premium.compareAds"), good: t("premium.compareNoAds") },
            { bad: t("premium.comparePrice"), good: t("premium.compareOurPrice") },
            { bad: t("premium.compareBloat"), good: t("premium.compareFast") },
          ].map((row, i) => (
            <View key={i} style={styles.compareRow}>
              <View style={styles.compareCell}>
                <Ionicons name="close-circle" size={14} color="rgba(255,68,68,0.6)" />
                <Text style={styles.compareBad}>{row.bad}</Text>
              </View>
              <View style={styles.compareDivider} />
              <View style={styles.compareCell}>
                <Ionicons name="checkmark-circle" size={14} color={ACCENT} />
                <Text style={styles.compareGood}>{row.good}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          {selectedPlan === "lifetime"
            ? t("premium.disclaimerLifetime")
            : selectedPlan === "quarterly"
            ? t("premium.disclaimerQuarterly")
            : t("premium.disclaimer")}
        </Text>

        {/* Restaurar compras */}
        {!user?.isPremium && (
          <Pressable onPress={handleRestore} disabled={isRestoring} style={styles.restoreBtn}>
            {isRestoring
              ? <ActivityIndicator size="small" color={TEXT_DIM} />
              : <Text style={styles.restoreText}>Restaurar compras anteriores</Text>
            }
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SURFACE_ELEVATED,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  header: {
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 28,
  },
  premiumBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(74, 237, 196, 0.2)",
  },
  title: {
    fontSize: 26,
    fontWeight: "800" as const,
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  planGrid: {
    gap: 8,
    marginBottom: 28,
  },
  planRow: {
    flexDirection: "row",
    gap: 8,
  },
  planCard: {
    flex: 1,
    padding: 12,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    gap: 3,
    minHeight: 110,
    justifyContent: "center",
    position: "relative" as const,
    overflow: "visible" as const,
  },
  planCardSelected: {
    borderColor: ACCENT,
    backgroundColor: "rgba(74, 237, 196, 0.07)",
  },
  planBadge: {
    position: "absolute" as const,
    top: -11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 9,
    fontWeight: "800" as const,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
  },
  selectedDot: {
    position: "absolute" as const,
    top: 8,
    right: 8,
  },
  planLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: TEXT_DIM,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
  },
  planLabelSelected: {
    color: ACCENT,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  planPriceSelected: {
    color: TEXT_PRIMARY,
  },
  planPeriod: {
    fontSize: 11,
    color: TEXT_DIM,
  },
  planPeriodSelected: {
    color: TEXT_SECONDARY,
  },
  savePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  savePillText: {
    fontSize: 9,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  featuresSection: {
    marginBottom: 24,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: ACCENT,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  featuresList: {
    gap: 6,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 13,
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureIconPro: {
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: "rgba(74, 237, 196, 0.15)",
  },
  featureIconFree: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: TEXT_PRIMARY,
  },
  proBadge: {
    backgroundColor: ACCENT_DIM,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(74, 237, 196, 0.18)",
  },
  proBadgeText: {
    fontSize: 8,
    fontWeight: "800" as const,
    color: ACCENT,
    letterSpacing: 0.5,
  },
  featureSub: {
    fontSize: 11,
    color: TEXT_DIM,
    lineHeight: 15,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 18,
    borderRadius: 18,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: "rgba(74, 237, 196, 0.2)",
    marginBottom: 8,
  },
  activeText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: ACCENT,
  },
  ctaWrap: {
    marginBottom: 8,
    borderRadius: 18,
    overflow: "hidden" as const,
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: "#000",
    letterSpacing: -0.2,
  },
  orSeparator: {
    fontSize: 11,
    color: TEXT_DIM,
    textAlign: "center",
    marginVertical: 14,
    letterSpacing: 0.3,
  },
  tokenToggle: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden" as const,
    marginBottom: 12,
  },
  tokenBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  tokenBtnActiveUsdc: {
    backgroundColor: PHANTOM_PURPLE,
  },
  tokenBtnActiveSol: {
    backgroundColor: SOL_ORANGE,
  },
  tokenBtnText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: TEXT_DIM,
  },
  tokenBtnTextActive: {
    color: "#fff",
  },
  phantomButton: {
    borderRadius: 16,
    backgroundColor: PHANTOM_PURPLE,
    borderWidth: 1,
    borderColor: "rgba(123,63,228,0.4)",
  },
  phantomButtonSol: {
    backgroundColor: SOL_ORANGE,
    borderColor: "rgba(247,147,26,0.4)",
  },
  phantomButtonDisabled: {
    opacity: 0.5,
  },
  phantomInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    justifyContent: "center",
  },
  phantomIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  phantomIconBoxSol: {
    backgroundColor: "rgba(247,147,26,0.25)",
  },
  phantomIconText: {
    fontSize: 20,
  },
  phantomText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#fff",
  },
  phantomSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 1,
  },
  solNote: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
  },
  phantomHint: {
    fontSize: 10,
    color: TEXT_DIM,
    textAlign: "center",
    marginTop: 6,
  },
  compareSection: {
    marginTop: 24,
    gap: 10,
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden" as const,
  },
  compareCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 11,
  },
  compareDivider: {
    width: 1,
    height: 30,
    backgroundColor: BORDER,
  },
  compareBad: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    flex: 1,
  },
  compareGood: {
    fontSize: 12,
    color: ACCENT,
    fontWeight: "600" as const,
    flex: 1,
  },
  disclaimer: {
    fontSize: 10,
    color: TEXT_DIM,
    textAlign: "center",
    marginTop: 18,
    lineHeight: 15,
  },
  restoreBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  restoreText: {
    fontSize: 12,
    color: TEXT_DIM,
    textDecorationLine: "underline" as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: BORDER,
    gap: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: TEXT_PRIMARY,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: "center",
  },
});
