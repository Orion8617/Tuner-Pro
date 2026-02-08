import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

const FEATURES = [
  {
    icon: "musical-notes" as const,
    title: "6 Afinaciones Premium",
    desc: "Drop D, Open G, DADGAD, Open D, Open E, Drop C",
    free: false,
  },
  {
    icon: "speedometer" as const,
    title: "Detección Avanzada",
    desc: "Algoritmo de alta precisión para graves y agudos",
    free: false,
  },
  {
    icon: "analytics" as const,
    title: "Historial de Afinación",
    desc: "Seguimiento de tu progreso de afinación",
    free: false,
  },
  {
    icon: "color-palette" as const,
    title: "Temas Personalizados",
    desc: "Personaliza la apariencia de la app",
    free: false,
  },
  {
    icon: "radio" as const,
    title: "Afinador Estándar",
    desc: "Detección de afinación estándar con vibración",
    free: true,
  },
  {
    icon: "git-branch" as const,
    title: "3 Afinaciones Gratis",
    desc: "Double Drop D, Open C, All Fourths",
    free: true,
  },
];

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
        const confirmed = confirm("¿Se completó tu compra exitosamente?");
        if (confirmed) {
          await upgradeToPremium();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        }
      } else {
        Alert.alert(
          "¿Compra completada?",
          "¿Se realizó tu pago exitosamente?",
          [
            { text: "No", style: "cancel" },
            {
              text: "Sí",
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
            Desbloquea todas las funciones premium
          </Text>
        </View>

        <View style={styles.priceContainer}>
          <View style={styles.priceOption}>
            <Text style={styles.priceAmount}>$1.99</Text>
            <Text style={styles.pricePeriod}>/ mes</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceOption}>
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>Ahorra 58%</Text>
            </View>
            <Text style={styles.priceAmount}>$9.99</Text>
            <Text style={styles.pricePeriod}>/ año</Text>
          </View>
        </View>

        <View style={styles.featuresContainer}>
          {FEATURES.map((feature, index) => (
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
            <Text style={styles.activeText}>Plan Pro Activo</Text>
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
              <Text style={styles.purchaseText}>Suscribirse a Pro</Text>
            </LinearGradient>
          </Pressable>
        )}

        <Text style={styles.disclaimer}>
          Powered by Lemon Squeezy. Cancela cuando quieras.
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
});
