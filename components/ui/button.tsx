import * as React from "react";
import { Pressable, Text, ActivityIndicator, type PressableProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "flex-row items-center justify-center gap-2 rounded-lg",
  {
    variants: {
      variant: {
        default: "bg-primary active:bg-primary/90",
        destructive: "bg-destructive active:bg-destructive/90",
        outline: "border border-border bg-background active:bg-secondary",
        secondary: "bg-secondary active:bg-secondary/80",
        ghost: "bg-transparent active:bg-secondary",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

const buttonTextVariants = cva("text-sm font-semibold", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface ButtonProps
  extends Omit<PressableProps, "children">,
    VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
  loading?: boolean;
  textClassName?: string;
}

export function Button({ className, variant, size, loading, disabled, children, textClassName, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      className={cn(buttonVariants({ variant, size }), isDisabled && "opacity-60", className)}
      disabled={isDisabled}
      {...props}
    >
      {loading && <ActivityIndicator size="small" color="#fff" />}
      {typeof children === "string" ? (
        <Text className={cn(buttonTextVariants({ variant }), textClassName)}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export { buttonVariants, buttonTextVariants };
