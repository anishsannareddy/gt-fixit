"use client";

import Link from "next/link";
import { useActionState, useRef, useState, type FormEvent } from "react";
import { signIn, signUp, type AuthState } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Form";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/components/ui/cn";

const GT_EMAIL = /^[a-z0-9][a-z0-9._+-]{0,63}@gatech\.edu$/i;

type Demo = { password: string; accounts: { email: string; name: string; role: string }[] } | null;

export function LoginForm({ initialTab, demo }: { initialTab: "signin" | "signup"; demo: Demo }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="bg-campus flex min-h-dvh flex-col items-center px-4 py-6">
      <div className="flex w-full max-w-md items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
          <ArrowLeftIcon className="size-4" /> Home
        </Link>
        <Logo />
      </div>

      <main className="mt-8 w-full max-w-md">
        <h1 className="font-display text-4xl font-bold tracking-tight">{tab === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-ink-muted">
          {tab === "signin" ? "Sign in with your Georgia Tech email." : "Open to anyone with a @gatech.edu email. New accounts are student accounts."}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-1" role="tablist" aria-label="Sign in or create an account">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("min-h-11 rounded-xl text-sm font-semibold transition", tab === t ? "bg-gt-navy text-white" : "text-ink-muted hover:text-ink")}
            >
              {t === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-3xl border border-line bg-white p-5 shadow-panel">
          {tab === "signin" ? <SignInForm demo={demo} /> : <SignUpForm />}
        </div>
      </main>
    </div>
  );
}

function SignInForm({ demo }: { demo: Demo }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, undefined);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);

  function fill(address: string) {
    if (email.current) email.current.value = address;
    if (password.current && demo) password.current.value = demo.password;
    password.current?.focus();
  }

  return (
    <>
      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="email">GT email</Label>
          <Input ref={email} id="email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} required defaultValue={state?.email} placeholder="gburdell3@gatech.edu" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input ref={password} id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <FieldError>{state?.error}</FieldError>
        <Button variant="gold" size="lg" type="submit" full disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {demo && (
        <details className="group mt-5 rounded-2xl border border-line bg-navy-50 open:bg-white">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-ink">
            Demo accounts
            <span className="text-ink-muted transition group-open:rotate-180" aria-hidden="true">
              ▾
            </span>
          </summary>
          <div className="px-4 pb-4">
            <p className="text-xs text-ink-muted">
              All demo accounts use the password <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-ink">{demo.password}</code>. Tap one to fill the form.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {demo.accounts.map((a) => (
                <li key={a.email}>
                  <button type="button" onClick={() => fill(a.email)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-navy-50">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{a.name}</span>
                      <span className="block truncate font-mono text-xs text-ink-muted">{a.email}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-semibold text-gold-ink ring-1 ring-gt-gold/50">{a.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </>
  );
}

function SignUpForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, undefined);
  const [clientError, setClientError] = useState<string | null>(null);
  const error = clientError ?? state?.error;

  function validate(e: FormEvent<HTMLFormElement>) {
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    let message: string | null = null;
    if (!GT_EMAIL.test(email)) message = "Sign-up is only open to Georgia Tech emails ending in @gatech.edu.";
    else if (String(data.get("password") ?? "").length < 8) message = "Use a password of at least 8 characters.";
    setClientError(message);
    if (message) e.preventDefault();
  }

  return (
    <form action={action} onSubmit={validate} noValidate className="space-y-4">
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" required placeholder="George Burdell" />
      </div>
      <div>
        <Label htmlFor="su-email">GT email</Label>
        <Input id="su-email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required defaultValue={state?.email} placeholder="gburdell3@gatech.edu" aria-invalid={Boolean(error)} />
      </div>
      <div>
        <Label htmlFor="su-password">Password</Label>
        <Input id="su-password" name="password" type="password" autoComplete="new-password" minLength={8} required aria-describedby="pw-hint" />
        <p id="pw-hint" className="mt-1.5 text-xs text-ink-muted">At least 8 characters.</p>
      </div>
      <FieldError>{error}</FieldError>
      <Button variant="gold" size="lg" type="submit" full disabled={pending}>
        {pending ? "Creating account…" : "Create student account"}
      </Button>
    </form>
  );
}
