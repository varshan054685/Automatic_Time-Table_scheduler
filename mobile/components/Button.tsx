import { ActivityIndicator, Pressable, Text, type ViewStyle } from "react-native";
import { colors, radii, typography } from "@/constants/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const HEIGHTS: Record<Size, number> = { sm: 36, md: 46, lg: 54 };
const PADDING: Record<Size, number> = { sm: 14, md: 20, lg: 24 };
const FONT: Record<Size, number> = { sm: 13, md: 15, lg: 16 };

function bgFor(variant: Variant, pressed: boolean, disabled: boolean): string {
  if (disabled) return "#E2E8F0";
  switch (variant) {
    case "primary":
      return pressed ? colors.primaryHover : colors.primary;
    case "secondary":
      return pressed ? "#E0E7FF" : colors.primarySoft;
    case "outline":
      return colors.surface;
    case "ghost":
      return "transparent";
    case "destructive":
      return pressed ? "#BE123C" : colors.danger;
  }
}

function fgFor(variant: Variant, disabled: boolean): string {
  if (disabled) return "#94A3B8";
  switch (variant) {
    case "primary":
    case "destructive":
      return colors.white;
    case "secondary":
      return colors.primary;
    case "outline":
    case "ghost":
      return colors.ink;
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        {
          height: HEIGHTS[size],
          paddingHorizontal: PADDING[size],
          borderRadius: radii.md,
          backgroundColor: bgFor(variant, pressed, isDisabled),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: variant === "outline" ? colors.line : undefined,
          opacity: pressed && !isDisabled ? 0.92 : 1,
        },
        fullWidth && { width: "100%" },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fgFor(variant, isDisabled)} />
      ) : null}
      <Text
        style={[
          typography.bodyMedium,
          {
            fontSize: FONT[size],
            color: fgFor(variant, isDisabled),
            letterSpacing: -0.1,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
