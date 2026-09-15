import { AlertTriangle } from "lucide-react-native";
import { View, Text } from "react-native";
import { colors, typography } from "@/constants/theme";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again. If the problem persists, check your connection.",
  onRetry,
}: ErrorStateProps) {
  return (
    <View className="items-center justify-center px-8 py-12">
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: colors.dangerSoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <AlertTriangle size={28} color={colors.danger} />
      </View>
      <Text style={[typography.h3, { color: colors.ink, textAlign: "center" }]}>{title}</Text>
      <Text
        style={[
          typography.caption,
          { color: colors.inkSecondary, textAlign: "center", marginTop: 6, maxWidth: 280 },
        ]}
      >
        {message}
      </Text>
      {onRetry ? (
        <View className="mt-6">
          <Button label="Try again" variant="outline" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
