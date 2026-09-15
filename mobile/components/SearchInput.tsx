import { TextInput, View, Pressable, type TextInputProps, type ViewStyle } from "react-native";
import { Search, X } from "lucide-react-native";
import { colors, radii, typography } from "@/constants/theme";

interface SearchInputProps extends Omit<TextInputProps, "style"> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Applied to the outer container (e.g. margins). */
  containerStyle?: ViewStyle;
}

/**
 * Search field with leading icon and a clear button. Used by the Data and
 * Timetable screens in later phases; included now for the design system.
 */
export function SearchInput({
  value,
  onChangeText,
  placeholder = "Search…",
  containerStyle,
  ...rest
}: SearchInputProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: 46,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
        gap: 10,
        ...containerStyle,
      }}
    >
      <Search size={18} color={colors.inkMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        style={[
          typography.body,
          { flex: 1, color: colors.ink, paddingVertical: 0, paddingHorizontal: 0 },
        ]}
        autoCorrect={false}
        autoCapitalize="none"
        {...rest}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={13} color={colors.inkSecondary} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
