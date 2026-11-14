"use client";

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";
import { XIcon } from "./Icons";
import { useIsDesktop } from "./useMediaQuery";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  /** Pinned below the scrolling content (e.g. the submit button). */
  footer?: ReactNode;
  /**
   * "sheet":  bottom sheet on phones, floating side panel on laptops. The page behind stays usable.
   * "drawer": full-screen on phones, full-height right drawer on laptops, with a dimmed backdrop.
   */
  variant?: "sheet" | "drawer";
};

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"])';

export function Sheet({ open, onClose, title, eyebrow, children, footer, variant = "sheet" }: Props) {
  const desktop = useIsDesktop();
  const drag = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const modal = variant === "drawer";

  // Esc closes; in modal mode, Tab stays inside the panel and the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    if (modal) panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (!modal || e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    if (modal) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (modal) previous?.focus?.();
    };
  }, [open, modal, onClose]);

  const fromBottom = !desktop && variant === "sheet";
  const hidden = fromBottom ? { y: "100%" } : { x: desktop ? 56 : 0, opacity: 0 };

  return (
    <AnimatePresence>
      {open && (
        <>
          {modal && (
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              aria-hidden="true"
            />
          )}
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal={modal || undefined}
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={hidden}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={hidden}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            drag={fromBottom ? "y" : false}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              "glass-strong fixed z-50 flex flex-col shadow-panel outline-none",
              variant === "sheet"
                ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[2rem] md:inset-x-auto md:top-22 md:right-4 md:bottom-4 md:max-h-none md:w-[27rem] md:rounded-3xl"
                : "inset-0 md:left-auto md:w-[34rem] md:rounded-l-3xl md:border-y-0 md:border-r-0",
            )}
          >
            <div
              className={cn("shrink-0 px-5 pt-3 pb-3 md:pt-5", fromBottom && "cursor-grab touch-none active:cursor-grabbing")}
              onPointerDown={fromBottom ? (e) => drag.start(e) : undefined}
            >
              {fromBottom && <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-white/25" aria-hidden="true" />}
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {eyebrow && <div className="mb-0.5 text-xs font-semibold tracking-[0.18em] text-gt-gold uppercase">{eyebrow}</div>}
                  <h2 id={titleId} className="font-display text-2xl leading-tight font-bold tracking-tight">
                    {title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Close"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
            {footer && <div className="pb-safe shrink-0 border-t border-white/10 px-5 pt-3">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
