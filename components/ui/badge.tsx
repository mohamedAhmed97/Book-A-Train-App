import * as React from "react";
import { View, Text, type ViewProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "self-start rounded-full px-2.5 py-1",
  {
    variants: {
      variant: {
        default: "bg-primary",
        secondary: "bg-secondary",
        destructive: "bg-destructive",
        outline: "border border-border bg-transparent",
        success: "bg-accent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const badgeTextVariants = cva("text-[10px] font-semibold", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      success: "text-accent-foreground",
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
      {typeof children === "string" ? <Text className={badgeTextVariants({ variant })}>{children}</Text> : children}
    </View>
  );
}
