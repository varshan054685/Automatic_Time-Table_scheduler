import { View, Text } from "react-native";
import { colors } from "@/constants/theme";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  dot?: boolean;
}

const TONES: Record<Tone, { bg: string; fg: string; dot: string }> = {
  success: { bg: colors.successSoft, fg: colors.success, dot: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning, dot: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger, dot: colors.danger },
  info: { bg: colors.primarySoft, fg: colors.primary, dot: colors.primary },
  neutral: { bg: "#F1F5F9", fg: colors.inkSecondary, dot: colors.inkMuted },
};

export function StatusBadge({ label, tone = "neutral", dot = true }: StatusBadgeProps) {
  const t = TONES[tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: t.bg,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: "flex-start",
      }}
    >
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.dot }} /> : null}
      <Text style={{ fontSize: 12, fontWeight: "700", color: t.fg, letterSpacing: 0.2 }}>
        {label}
      </Text>
    </View>
  );
}
