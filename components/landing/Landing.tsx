"use client";

import { AnimatePresence, motion } from "motion/react";
import { useActionState, useState, type FormEvent, type ReactNode } from "react";
import { signInAs, signInWithEmail, type EmailSignInState } from "@/app/actions";
import { CampusCanvas, OsmCredit } from "@/components/campus/CampusCanvas";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Form";
import { ArrowLeftIcon, ChartIcon, MailIcon, UserIcon, WrenchIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { FadeIn } from "@/components/ui/Motion";
import type { Role, User } from "@/lib/types";

const GT_EMAIL = /^[a-z0-9][a-z0-9._-]{1,40}@gatech\.edu$/i;

const CHIPS: { role: Role; label: string; Icon: typeof UserIcon; prefer: string }[] = [
  { role: "reporter", label: "Student", Icon: UserIcon, prefer: "Alex" },
  { role: "technician", label: "Technician", Icon: WrenchIcon, prefer: "Marcus" },
  { role: "admin", label: "Admin", Icon: ChartIcon, prefer: "Jordan" },
];

/**
 * Landing + login. `personas` are the seeded demo users (empty when setup isn't finished,
 * in which case `notice` explains what to do).
 */
export function Landing({ personas, notice }: { personas: User[]; notice?: ReactNode }) {
  const [showForm, setShowForm] = useState(false);

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
              <AnimatePresence mode="wait" initial={false}>
                {showForm ? (
                  <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <EmailForm onBack={() => setShowForm(false)} />
                  </motion.div>
                ) : (
                  <motion.div key="cta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    <Button variant="gold" size="xl" onClick={() => setShowForm(true)} className="w-full sm:w-auto">
                      <MailIcon className="size-6" /> Sign in with GT account
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </FadeIn>

          {personas.length > 0 && (
            <FadeIn delay={0.32} className="mt-7">
              <p className="mb-2.5 text-xs font-medium tracking-wide text-ink-muted uppercase">Or explore the demo as</p>
              <div className="flex flex-wrap gap-2">
                {CHIPS.map(({ role, label, Icon, prefer }) => {
                  const options = personas.filter((p) => p.role === role);
                  const persona = options.find((p) => p.name.includes(prefer)) ?? options[0];
                  if (!persona) return null;
                  return (
                    <form key={role} action={signInAs}>
                      <input type="hidden" name="userId" value={persona.id} />
                      <button
                        title={`Continue as ${persona.name}`}
                        className="glass flex min-h-12 items-center gap-2.5 rounded-full py-1.5 pr-5 pl-1.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-gt-gold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gt-navy"
                      >
                        <span className="grid size-9 place-items-center rounded-full bg-gt-gold/20 text-gold-ink">
                          <Icon className="size-4.5" />
                        </span>
                        <span className="text-left leading-tight">
                          {label}
                          <span className="block text-[0.7rem] font-normal text-ink-muted">{persona.name}</span>
                        </span>
                      </button>
                    </form>
                  );
                })}
              </div>
            </FadeIn>
          )}
        </div>
      </main>
      {/* Map data credit, above the darkening overlay so it stays readable */}
      <OsmCredit className="absolute top-20 right-5 z-10 md:top-auto md:right-4 md:bottom-4" />
    </div>
  );
}

function EmailForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState<EmailSignInState, FormData>(signInWithEmail, undefined);
  const [clientError, setClientError] = useState<string | null>(null);
  const error = clientError ?? state?.error;

  function validate(e: FormEvent<HTMLFormElement>) {
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!GT_EMAIL.test(email)) {
      e.preventDefault();
      setClientError(email.includes("@") && !/@gatech\.edu$/i.test(email) ? "That isn't a Georgia Tech address. It must end in @gatech.edu." : "Enter your GT email, like gburdell3@gatech.edu.");
    } else setClientError(null);
  }

  return (
    <form action={action} onSubmit={validate} noValidate className="glass-strong max-w-md rounded-3xl p-5 shadow-panel">
      <Label htmlFor="email">GT email</Label>
      <Input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        placeholder="gburdell3@gatech.edu"
        aria-invalid={Boolean(error)}
        aria-describedby="email-help"
        onChange={() => clientError && setClientError(null)}
      />
      <FieldError>{error}</FieldError>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="lg" type="button" onClick={onBack} aria-label="Back" className="px-3">
          <ArrowLeftIcon />
        </Button>
        <Button variant="gold" size="lg" type="submit" disabled={pending} full>
          {pending ? "Signing in…" : "Continue"}
        </Button>
      </div>
      <p id="email-help" className="mt-3 text-xs text-ink-muted">
        Demo sign-in: any @gatech.edu address works and no password is needed. Real GT single sign-on would replace this.
      </p>
    </form>
  );
}
