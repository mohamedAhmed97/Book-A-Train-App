import * as React from "react";
import { Text, View, ActivityIndicator, type PressableProps, type GestureResponderEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { gradients, type GradientName } from "@/lib/gradients";
import { PressableScale } from "./pressable-scale";

const buttonVariants = cva(
  "flex-row items-center justify-center gap-2 rounded-2xl overflow-hidden",
  {
    variants: {
      variant: {
        gradient: "",
        solid: "bg-primary",
        secondary: "bg-bg3 border border-bg5",
        outline: "border border-bg5 bg-transparent",
        ghost: "bg-transparent",
        destructive: "bg-coral",
      },
      size: {
        sm: "h-10 px-4",
        md: "h-12 px-5",
        lg: "h-14 px-6",
      },
    },
    defaultVariants: { variant: "gradient", size: "md" },
  },
);

const buttonTextVariants = cva("font-bold tracking-wide", {
  variants: {
    variant: {
      gradient: "text-white",
      solid: "text-white",
      secondary: "text-txt",
      outline: "text-txt",
      ghost: "text-txt",
      destructive: "text-white",
    },
    size: {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
    },
  },
  defaultVariants: { variant: "gradient", size: "md" },
});

type Props = Omit<PressableProps, "children"> &
  VariantProps<typeof buttonVariants> & {
    children: React.ReactNode;
    loading?: boolean;
    gradient?: GradientName;
    textClassName?: string;
    onPress?: (e: GestureResponderEvent) => void;
  };

export function Button({
  className,
  variant = "gradient",
  size,
  loading,
  disabled,
  children,
  textClassName,
  gradient = "hero",
  ...props
}: Props) {
  const isDisabled = disabled || loading;
  const content = (
    <>
      {loading && <ActivityIndicator size="small" color="#fff" />}
      {typeof children === "string" ? (
        <Text className={cn(buttonTextVariants({ variant, size }), textClassName)}>
          {children}
        </Text>
      ) : (
        children
      )}
    </>
  );

  if (variant === "gradient") {
    return (
      <PressableScale
        hapticType="medium"
        scaleTo={0.97}
        className={cn(buttonVariants({ variant, size }), isDisabled && "opacity-50", className)}
        disabled={isDisabled}
        {...props}
      >
        <LinearGradient
          colors={gradients[gradient] as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View className="flex-row items-center justify-center gap-2">{content}</View>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      hapticType="light"
      scaleTo={0.97}
      className={cn(buttonVariants({ variant, size }), isDisabled && "opacity-50", className)}
      disabled={isDisabled}
      {...props}
    >
      {content}
    </PressableScale>
  );
}

export { buttonVariants, buttonTextVariants };
