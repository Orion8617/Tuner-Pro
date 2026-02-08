import { Stack } from "expo-router";
import Colors from "@/constants/colors";
import { t } from "@/lib/i18n";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerStyle: { backgroundColor: Colors.dark.surface },
        headerTintColor: Colors.dark.primary,
        headerTitleStyle: { color: Colors.dark.text, fontWeight: "600" as const },
        contentStyle: { backgroundColor: Colors.dark.background },
      }}
    >
      <Stack.Screen name="login" options={{ title: t("auth.signIn") }} />
      <Stack.Screen name="register" options={{ title: t("auth.createAccount") }} />
    </Stack>
  );
}
