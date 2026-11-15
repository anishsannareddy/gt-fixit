"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CampusCanvas, OsmCredit } from "@/components/campus/CampusCanvas";
import { Button } from "@/components/ui/Button";
import { MailIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { FadeIn } from "@/components/ui/Motion";

/** Landing page. `notice` explains what to do when setup isn't finished. */
export function Landing({ notice }: { notice?: ReactNode }) {

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      {/* 3D campus backdrop */}
      <div className="absolute inset-0">
        <CampusCanvas mode="hero" credit={false} />
      </div>
      {/* Fade the scene to white where the text sits so the headline never blends into the buildings */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(245_247_250/0.85)_0%,rgb(245_247_250/0)_28%,rgb(245_247_250/0.35)_55%,rgb(245_247_250/0.97)_78%)] md:bg-[linear-gradient(90deg,rgb(245_247_250/0.97)_0%,rgb(245_247_250/0.8)_38%,rgb(245_247_250/0)_70%)]"
        aria-hidden="true"
      />

      <header className="relative z-10 flex items-center justify-between px-5 pt-5 md:px-10 md:pt-8">
        <Logo />
        <span className="hidden rounded-full border border-line bg-slate-100 px-3 py-1 text-xs font-medium text-ink-muted backdrop-blur sm:block">
          Georgia Tech Campus Solutions Challenge
        </span>
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-end px-4 pb-6 md:justify-center md:px-10 md:pb-16">
        {/* Soft white panel behind the copy */}
        <div className="max-w-2xl rounded-[2rem] bg-white/80 p-5 shadow-panel ring-1 ring-line backdrop-blur-md md:bg-white/70 md:p-8">
          <FadeIn>
            <p className="text-xs font-semibold tracking-[0.25em] text-gold-ink uppercase md:text-sm">Campus maintenance, reimagined</p>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h1 className="mt-3 font-display text-[3.1rem] leading-[0.95] font-bold tracking-tight text-balance text-ink sm:text-7xl md:text-8xl">
              Fix it fast. <span className="text-gold-ink">Anywhere on campus.</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.16}>
            <p className="mt-5 max-w-lg text-base text-ink-muted md:text-lg">
              Tap a building, snap a photo, and watch your request move from reported to resolved.
            </p>
          </FadeIn>

          <FadeIn delay={0.24} className="mt-7">
            {notice ?? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button href="/login" variant="gold" size="xl" className="w-full sm:w-auto">
                  <MailIcon className="size-6" /> Sign in with GT account
                </Button>
                <Link href="/login?tab=signup" className="text-center text-sm font-semibold text-ink underline decoration-gt-gold decoration-2 underline-offset-4 hover:text-gold-ink sm:text-left">
                  New here? Create an account
                </Link>
              </div>
            )}
          </FadeIn>

        </div>
      </main>
      {/* Map data credit, above the darkening overlay so it stays readable */}
      <OsmCredit className="absolute top-20 right-5 z-10 md:top-auto md:right-4 md:bottom-4" />
    </div>
  );
}
