"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const variantClassMap = {
  default: "dragon-btn-default",
  secondary: "dragon-btn-secondary",
  destructive: "dragon-btn-destructive",
  outline: "dragon-btn-outline",
  ghost: "dragon-btn-ghost",
  link: "dragon-btn-link",
} as const;

export type DragonVariant = keyof typeof variantClassMap;

export interface DragonButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DragonVariant;
}

const DragonButton = React.forwardRef<HTMLButtonElement, DragonButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn("dragon-btn", variantClassMap[variant], className)}
        {...props}
      />
    );
  }
);
DragonButton.displayName = "DragonButton";

export { DragonButton };
