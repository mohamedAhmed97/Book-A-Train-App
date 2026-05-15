import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";

/**
 * No explicit textAlign / writingDirection: when I18nManager.isRTL is true,
 * RN auto-aligns text input naturally to the writing direction.
 */
export const Input = React.forwardRef<TextInput, TextInputProps>(
  ({ className, placeholderTextColor = "#7B8DB8", ...props }, ref) => (
    <TextInput
      ref={ref}
      placeholderTextColor={placeholderTextColor}
      className={cn(
        "h-11 rounded-md border border-input bg-background px-3 text-foreground text-sm",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
