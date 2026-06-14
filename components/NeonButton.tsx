"use client";

import { sound } from "@/lib/sound";

type Variant = "cyan" | "purple" | "cyan2" | "purple2";

export default function NeonButton({
  children,
  onClick,
  variant = "cyan",
  small = false,
  fluid = false,
  disabled = false,
  sfx = "click",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: Variant;
  small?: boolean;
  fluid?: boolean;
  disabled?: boolean;
  sfx?: Parameters<typeof sound.playSfx>[0] | null;
}) {
  return (
    <button
      className={`neon-btn ${variant}${small ? " small" : ""}${
        fluid ? " fluid" : ""
      }`}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (sfx) sound.playSfx(sfx);
        onClick?.();
      }}
    >
      <span className="btn-label">{children}</span>
    </button>
  );
}
