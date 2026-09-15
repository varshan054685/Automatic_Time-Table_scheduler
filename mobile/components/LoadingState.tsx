import { ActivityIndicator, View, Text } from "react-native";
import { colors, typography } from "@/constants/theme";

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  return (
    <View className="items-center justify-center py-16" accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text
        style={[
          typography.caption,
          { color: colors.inkSecondary, marginTop: 12 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
