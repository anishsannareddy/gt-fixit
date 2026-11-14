"use client";

import { MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";

/** Wrap the app once. `reducedMotion="user"` turns off movement for people who ask their OS for less motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 260, damping: 30 }}>
      {children}
    </MotionConfig>
  );
}

/** Page-level enter transition (used by app/template.tsx). Opacity only, so fixed-position children stay put. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: "easeOut" }} className="flex flex-1 flex-col">
      {children}
    </motion.div>
  );
}

/** Fade + rise in. Use `delay` (seconds) or `index` to stagger a list. */
export function FadeIn({
  children,
  delay = 0,
  index,
  y = 16,
  className,
}: {
  children: ReactNode;
  delay?: number;
  index?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: delay + Math.min(index ?? 0, 12) * 0.045 }}
    >
      {children}
    </motion.div>
  );
}

/** Card that lifts slightly on hover and presses on tap. */
export function HoverLift({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} whileHover={{ y: -4, scale: 1.01 }} whileTap={{ scale: 0.985 }}>
      {children}
    </motion.div>
  );
}
