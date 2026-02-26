"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const DragonCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("dragon-card", className)} {...props} />
));
DragonCard.displayName = "DragonCard";

const DragonCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("dragon-card-header", className)} {...props} />
));
DragonCardHeader.displayName = "DragonCardHeader";

const DragonCardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("dragon-card-title", className)} {...props} />
));
DragonCardTitle.displayName = "DragonCardTitle";

const DragonCardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("dragon-card-description", className)} {...props} />
));
DragonCardDescription.displayName = "DragonCardDescription";

const DragonCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("dragon-card-content", className)} {...props} />
));
DragonCardContent.displayName = "DragonCardContent";

const DragonCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("dragon-card-footer", className)} {...props} />
));
DragonCardFooter.displayName = "DragonCardFooter";

export {
  DragonCard,
  DragonCardHeader,
  DragonCardTitle,
  DragonCardDescription,
  DragonCardContent,
  DragonCardFooter,
};
