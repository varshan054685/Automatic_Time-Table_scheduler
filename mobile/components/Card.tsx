import { PropsWithChildren } from "react";
import {
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "@/constants/theme";

interface CardProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Removes the default padding for full-bleed content. */
  padded?: boolean;
}

/**
 * Standard content card: white surface, hairline border, soft shadow.
 * Pressable when `onPress` is provided.
 */
export function Card({ children, className, style, onPress, padded = true }: PropsWithChildren<CardProps>) {
  const base = {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: "hidden" as const,
  };

  const paddingStyle = padded ? { padding: 16 } : undefined;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          base,
          paddingStyle,
          pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] },
          style,
        ]}
        android_ripple={{ color: "rgba(15,23,42,0.06)" }}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[base, paddingStyle, style]} className={className}>
      {children}
    </View>
  );
}
