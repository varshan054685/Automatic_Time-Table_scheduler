import { ReactNode } from "react";
import { View, Text } from "react-native";
import { colors, typography } from "@/constants/theme";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <View className="items-center justify-center px-8 py-12">
      {icon ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          {icon}
        </View>
      ) : null}
      <Text style={[typography.h3, { color: colors.ink, textAlign: "center" }]}>{title}</Text>
      {message ? (
        <Text
          style={[
            typography.caption,
            { color: colors.inkSecondary, textAlign: "center", marginTop: 6, maxWidth: 280 },
          ]}
        >
          {message}
        </Text>
      ) : null}
      {action ? <View className="mt-6">{action}</View> : null}
    </View>
  );
}
