import { cn } from "@/lib/cn";

/** Button classes, usable from server components (no "use client"). */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

/*
 * v2 buttons are pills. Raised variants carry the cell material (tone + soft shadow + a 1px
 * top highlight) and the response motion: press to 0.97, hover lift of -1px with the shadow
 * deepening. Ghost and link have no surface and no lift.
 */
const base =
  "focus-ring touch-target inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap " +
  "rounded-full font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-160 ease-standard " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:stroke-[1.75]";

const raised = "press shadow-cell hover:shadow-cell-hover";

const variants: Record<ButtonVariant, string> = {
  primary: `${raised} bg-accent text-accent-fg hover:bg-accent-hover [box-shadow:var(--lb-shadow-cell),inset_0_1px_0_rgb(255_255_255/0.25)]`,
  secondary: `${raised} bg-raised text-fg hover:bg-raised dark:bg-raised dark:hover:bg-selected`,
  ghost: "text-fg hover:bg-hover active:scale-[0.97] data-[state=open]:bg-hover",
  danger: `${raised} bg-danger text-danger-fg hover:brightness-[0.95] dark:hover:brightness-110`,
  link: "h-auto px-0 text-accent-text underline-offset-4 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-small md:h-8 md:px-3 [&_svg]:size-3.5",
  md: "h-10 px-4 text-body md:h-9 md:px-4 [&_svg]:size-4",
  lg: "h-11 px-5 text-body-lg md:h-10 md:px-5 [&_svg]:size-[18px]",
  icon: "size-10 md:size-9 [&_svg]:size-4",
  "icon-sm": "size-9 md:size-8 [&_svg]:size-4",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], variant === "link" ? "h-auto px-0" : sizes[size], className);
}
