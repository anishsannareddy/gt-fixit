import type { Metadata } from "next";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, KpiTile, Skeleton } from "@/components/ui/Feedback";
import { Input, Label, Select } from "@/components/ui/Form";
import { PlusIcon, WrenchIcon } from "@/components/ui/Icons";
import { BlockTower, GemCheck, WrenchGem } from "@/components/ui/Illustration";
import { Logo } from "@/components/ui/Logo";
import { FadeIn, HoverLift } from "@/components/ui/Motion";
import { Card, GlassPanel, PageContainer, PageHeader } from "@/components/ui/Surface";
import { PRIORITIES, STATUSES } from "@/lib/constants";
import { Interactive } from "./Interactive";

export const metadata: Metadata = { title: "Design system" };

const SWATCHES = [
  ["navy-950", "bg-navy-950"],
  ["navy-900", "bg-navy-900"],
  ["navy-800", "bg-navy-800"],
  ["gt-navy", "bg-gt-navy"],
  ["navy-600", "bg-navy-600"],
  ["navy-500", "bg-navy-500"],
  ["navy-300", "bg-navy-300"],
  ["gold-dark", "bg-gold-dark"],
  ["gt-gold", "bg-gt-gold"],
  ["gold-light", "bg-gold-light"],
  ["signal", "bg-signal"],
];

/** Living style guide: every shared component in one place. Open /ui while building new screens. */
export default function DesignSystemPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Design system" title="GT FixIt UI kit" subtitle="Everything in components/ui, on the campus background." />

      <div className="space-y-10">
        <Section title="Brand">
          <div className="flex flex-wrap items-center gap-8">
            <Logo />
            <div className="flex items-end gap-2">
              <GemCheck className="size-20" />
              <BlockTower className="size-20" />
              <WrenchGem className="size-20" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
            {SWATCHES.map(([name, cls]) => (
              <div key={name}>
                <div className={`h-12 rounded-xl border border-white/15 ${cls}`} />
                <div className="mt-1 font-mono text-[0.65rem] text-white/60">{name}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type">
          <p className="font-display text-6xl leading-none font-bold tracking-tight md:text-7xl">
            Fix it <span className="text-gt-gold">fast.</span>
          </p>
          <p className="mt-3 font-display text-2xl font-bold">Space Grotesk for headings</p>
          <p className="mt-1 max-w-xl text-white/70">Inter for body text. It stays readable at small sizes on a phone, in sunlight, halfway up a ladder.</p>
          <p className="mt-1 font-mono text-sm text-signal">JetBrains Mono for ticket numbers and Command Center data · #1042 · 6.5h</p>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="gold" size="xl">
              <PlusIcon /> Report an issue
            </Button>
            <Button variant="gold" size="lg">Gold · lg</Button>
            <Button variant="gold">Gold · md</Button>
            <Button>Glass</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
            <Button disabled>Disabled</Button>
          </div>
          <p className="mt-3 text-sm text-white/55">Rule: one gold button per screen. Everything else is glass or ghost.</p>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
            {PRIORITIES.map((p) => (
              <PriorityBadge key={p} priority={p} />
            ))}
            <Badge>Neutral</Badge>
            <Badge tone="gold">Gold</Badge>
          </div>
        </Section>

        <Section title="Sheet, drawer, toast and chips">
          <Interactive />
        </Section>

        <Section title="Surfaces and motion">
          <div className="grid gap-4 md:grid-cols-3">
            <FadeIn index={0}>
              <HoverLift>
                <GlassPanel className="p-5">
                  <h3 className="font-display text-lg font-bold">GlassPanel</h3>
                  <p className="mt-1 text-sm text-white/65">Floats over the 3D campus. Hover me: I lift.</p>
                </GlassPanel>
              </HoverLift>
            </FadeIn>
            <FadeIn index={1}>
              <Card>
                <h3 className="font-display text-lg font-bold">Card</h3>
                <p className="mt-1 text-sm text-white/65">Quiet container for lists and content.</p>
              </Card>
            </FadeIn>
            <FadeIn index={2}>
              <GlassPanel strong className="p-5">
                <h3 className="font-display text-lg font-bold">GlassPanel strong</h3>
                <p className="mt-1 text-sm text-white/65">Near-opaque, for forms that must stay readable.</p>
              </GlassPanel>
            </FadeIn>
          </div>
        </Section>

        <Section title="Form fields">
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ds-email">GT email</Label>
              <Input id="ds-email" type="email" placeholder="gburdell3@gatech.edu" />
            </div>
            <div>
              <Label htmlFor="ds-tech">Technician</Label>
              <Select id="ds-tech" defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                <option>Marcus Reed</option>
                <option>Tasha Coleman</option>
              </Select>
            </div>
          </div>
        </Section>

        <Section title="KPI tiles (Command Center)">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Open now" value="39" sub="10 unassigned" />
            <KpiTile label="Urgent open" value="3" sub="Needs attention" tone="alert" />
            <KpiTile label="Resolved" value="71" change={12} changeGood sub="vs prev 30d" />
            <KpiTile label="Avg. time to resolve" value="2.7d" change={7} changeGood={false} sub="vs prev 30d" tone="gold" />
          </div>
        </Section>

        <Section title="Empty and loading states">
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState
              title="Nothing assigned to you"
              art={<WrenchGem />}
              action={
                <Button>
                  <WrenchIcon /> See unassigned
                </Button>
              }
            >
              Pick up new work from the Unassigned tab.
            </EmptyState>
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 border-b border-white/10 pb-2 font-mono text-xs tracking-[0.25em] text-white/50 uppercase">{title}</h2>
      {children}
    </section>
  );
}
