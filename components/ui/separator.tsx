import * as React from "react";
import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export function Separator({ className, ...props }: ViewProps & { orientation?: "horizontal" | "vertical" }) {
  const { orientation = "horizontal", ...rest } = props as ViewProps & { orientation?: "horizontal" | "vertical" };
  return (
    <View
      className={cn(
        "bg-border",
        orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
        className,
      )}
      {...rest}
    />
  );
}
