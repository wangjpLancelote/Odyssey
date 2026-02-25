import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "accent";
};

export function Button({ className = "", variant = "default", ...props }: Props) {
  const variantClass = variant === "accent" ? "btn-accent" : "";
  return <button className={`btn ${variantClass} ${className}`.trim()} {...props} />;
}
