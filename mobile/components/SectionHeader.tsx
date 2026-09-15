import { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { colors } from "@/constants/theme";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional right node rendered in place of an action label. */
  right?: ReactNode;
}

export function SectionHeader({ title, subtitle, actionLabel, onAction, right }: SectionHeaderProps) {
  return (
    <View className="flex-row items-end justify-between px-1 mb-2 mt-4">
      <View className="flex-1 pr-3">
        <Text
          style={{
            fontSize: 15,
            fontWeight: "800",
            color: colors.ink,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, fontWeight: "500", color: colors.inkSecondary, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ??
        (actionLabel && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null)}
    </View>
  );
}
