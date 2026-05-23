import * as React from "react";
import { TextInput, type TextInputProps, useColorScheme } from "react-native";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<TextInput, TextInputProps>(
  ({ className, placeholderTextColor, ...props }, ref) => {
    const scheme = useColorScheme();
    const phColor = placeholderTextColor ?? (scheme === "dark" ? "#475569" : "#94A3B8");
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={phColor}
        className={cn(
          "h-12 rounded-2xl border border-bg5 bg-bg2 px-4 text-txt text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
