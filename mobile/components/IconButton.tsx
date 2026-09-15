import { ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii } from "@/constants/theme";

type Variant = "ghost" | "soft" | "outline";

interface IconButtonProps {
  icon: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: number;
  accessibilityLabel: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

function bgFor(variant: Variant, pressed: boolean): string {
  switch (variant) {
    case "soft":
      return pressed ? "#E0E7FF" : colors.primarySoft;
    case "outline":
      return pressed ? "#F1F5F9" : colors.surface;
    default:
      return pressed ? "#F1F5F9" : "transparent";
  }
}

export function IconButton({
  icon,
  onPress,
  variant = "ghost",
  size = 20,
  accessibilityLabel,
  disabled = false,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          width: size + 24,
          height: size + 24,
          borderRadius: radii.sm,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bgFor(variant, pressed),
          opacity: disabled ? 0.4 : 1,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: colors.line,
        },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}
