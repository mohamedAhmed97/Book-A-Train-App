import * as React from "react";
import { ScrollView, View, RefreshControl, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { cn } from "@/lib/utils";

type Props = Omit<ScrollViewProps, "refreshControl"> & {
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollable?: boolean;
  /** extra padding at bottom — useful to clear the tab bar */
  bottomInset?: number;
  edges?: { top?: boolean; bottom?: boolean };
};

/**
 * Standard screen container. Handles safe areas, status-bar tint, optional
 * pull-to-refresh, and consistent padding. Use this on every route.
 */
export function Screen({
  children,
  refreshing = false,
  onRefresh,
  scrollable = true,
  bottomInset = 100,
  edges = { top: true, bottom: false },
  className,
  contentContainerStyle,
  ...rest
}: Props) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const tint = "#3B82F6";

  const paddingTop = edges.top ? insets.top : 0;
  const paddingBottom = (edges.bottom ? insets.bottom : 0) + bottomInset;

  const content = (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {children}
    </>
  );

  if (!scrollable) {
    return (
      <View
        className={cn("flex-1 bg-bg", className)}
        style={{ paddingTop, paddingBottom }}
      >
        {content}
      </View>
    );
  }

  return (
    <ScrollView
      className={cn("flex-1 bg-bg", className)}
      contentContainerStyle={[
        { paddingTop, paddingBottom },
        contentContainerStyle,
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tint}
            colors={[tint]}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
      {...rest}
    >
      {content}
    </ScrollView>
  );
}
