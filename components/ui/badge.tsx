import * as React from "react";
import { View, Text, type ViewProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("self-start rounded-full px-2.5 py-1", {
  variants: {
    variant: {
      default:    "bg-primary",
      secondary:  "bg-bg4 border border-bg5",
      destructive: "bg-coral",
      outline:    "border border-bg5 bg-transparent",
      success:    "bg-accent",
      warning:    "bg-amber",
      info:       "bg-primary/15 border border-primary/30",
    },
  },
  defaultVariants: { variant: "default" },
});

const badgeTextVariants = cva("text-[10px] font-bold tracking-wider", {
  variants: {
    variant: {
      default:     "text-white",
      secondary:   "text-txt",
      destructive: "text-white",
      outline:     "text-txt",
      success:     "text-white",
      warning:     "text-white",
      info:        "text-primary",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends ViewProps, VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)} {...props}>
      {typeof children === "string" ? (
        <Text className={badgeTextVariants({ variant })}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}
