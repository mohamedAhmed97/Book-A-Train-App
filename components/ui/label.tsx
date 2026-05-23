import * as React from "react";
import { Text, type TextProps } from "react-native";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn("text-xs font-semibold tracking-widest text-txt2 uppercase", className)}
      {...props}
    />
  );
}
