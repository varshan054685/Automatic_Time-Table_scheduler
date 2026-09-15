import { PropsWithChildren } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  type ScrollViewProps,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout } from "@/constants/layout";

interface ScreenProps extends ViewProps {
  /** Wrap content in a ScrollView. */
  scroll?: boolean;
  /** Keyboard-aware behavior is not needed for Phase 2 shells. */
  padded?: boolean;
  scrollProps?: ScrollViewProps;
}

/**
 * Base screen container: canvas background, safe-area padding, optional scroll.
 */
export function Screen({
  scroll = false,
  padded = true,
  children,
  style,
  scrollProps,
  ...rest
}: PropsWithChildren<ScreenProps>) {
  const insets = useSafeAreaInsets();

  const content = (
    <View
      {...rest}
      style={[
        styles.content,
        padded && { paddingHorizontal: layout.screenPadding },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (scroll) {
    return (
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <ScrollView
          {...scrollProps}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { paddingBottom: layout.screenPadding * 2 },
            scrollProps?.contentContainerStyle,
          ]}
        >
          {content}
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    flexGrow: 1,
  },
});
