"use client";

import { cn } from "@/lib/cn";

// L'interrupteur iOS : 51 × 31, vert #34c759 quand il est ouvert.
export default function Interrupteur({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("interrupteur", on && "on")}
    >
      <span />
    </button>
  );
}
