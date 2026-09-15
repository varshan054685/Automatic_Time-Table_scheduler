import { ReactNode } from "react";
import { View, Text } from "react-native";
import { colors, typography } from "@/constants/theme";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned actions (e.g. icon buttons). */
  right?: ReactNode;
}

/**
 * App header used inside tab screens and pushed routes. Titles use the display
 * weight; subtitles stay muted. Kept minimal — no chrome, no gradient.
 */
export function AppHeader({ title, subtitle, right }: AppHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-1 pt-2 pb-3">
      <View className="flex-1 pr-3">
        <Text
          style={[typography.h1, { color: colors.ink, letterSpacing: -0.5 }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[typography.caption, { color: colors.inkSecondary, marginTop: 2 }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="flex-row items-center gap-2">{right}</View> : null}
    </View>
  );
}
