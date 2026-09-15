import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarClock } from "lucide-react-native";
import { colors, typography } from "@/constants/theme";
import { layout } from "@/constants/layout";

interface AuthShellProps {
  title: string;
  subtitle: string;
}

export function AuthShell({ title, subtitle, children }: PropsWithChildren<AuthShellProps>) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: layout.screenPadding,
          justifyContent: "center",
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <CalendarClock size={28} color={colors.white} />
          </View>
          <Text
            style={[
              typography.h1,
              { color: colors.ink, letterSpacing: -0.5, textAlign: "center" },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.inkSecondary, marginTop: 6, textAlign: "center", maxWidth: 300 },
            ]}
          >
            {subtitle}
          </Text>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
