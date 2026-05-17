import * as React from "react";
import { Text, type TextProps } from "react-native";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn("text-xs font-medium tracking-wide text-muted-foreground uppercase", className)}
      {...props}
    />
  );
}
