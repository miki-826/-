"use client";

import { sound } from "@/lib/sound";

type Variant = "cyan" | "purple" | "cyan2" | "purple2";

const BG: Record<Variant, string> = {
  cyan: "/images/buttons/btn-cyan.png",
  purple: "/images/buttons/btn-purple.png",
  cyan2: "/images/buttons/btn-cyan2.png",
  purple2: "/images/buttons/btn-purple2.png",
};

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
      className={`neon-btn${small ? " small" : ""}${fluid ? " fluid" : ""}`}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (sfx) sound.playSfx(sfx);
        onClick?.();
      }}
    >
      <img className="btn-bg" src={BG[variant]} alt="" aria-hidden />
      <span className="btn-label">{children}</span>
    </button>
  );
}
