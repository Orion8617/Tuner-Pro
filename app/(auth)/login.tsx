import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password) {
      setError(t("login.fillFields"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    setError("");

    const result = await login(username.trim(), password);
    setLoading(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    } else {
      setError(result.error || t("login.failed"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="musical-notes" size={48} color={Colors.dark.primary} />
          </View>

          <Text style={styles.title}>{t("login.welcome")}</Text>
          <Text style={styles.subtitle}>{t("login.subtitle")}</Text>

          {!!error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={Colors.dark.warning} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={Colors.dark.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t("login.username")}
                placeholderTextColor={Colors.dark.textTertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.dark.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t("login.password")}
                placeholderTextColor={Colors.dark.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Colors.dark.textTertiary}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.loginButtonPressed,
              loading && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.dark.background} />
            ) : (
              <Text style={styles.loginButtonText}>{t("login.signIn")}</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("login.noAccount")}</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text style={styles.linkText}>{t("login.createAccount")}</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 16,
    justifyContent: "center",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.dark.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.dark.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dark.warningMuted,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    color: Colors.dark.warning,
    fontSize: 13,
    flex: 1,
  },
  inputGroup: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: Colors.dark.text,
  },
  eyeButton: {
    padding: 16,
  },
  loginButton: {
    backgroundColor: Colors.dark.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.dark.background,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 24,
    gap: 6,
  },
  footerText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  linkText: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: "600" as const,
  },
});
