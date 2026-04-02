import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  Inbox,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark";
type StatusTone = "success" | "warning" | "error" | "info";
type SpecimenKey = "cta" | "search" | "status" | "empty" | "toast" | "stat";

const specimens: Array<{
  key: SpecimenKey;
  title: string;
  note: string;
}> = [
  {
    key: "cta",
    title: "Primary CTA button group",
    note: "Primary, secondary, and tertiary action hierarchy using shared button color, pill geometry, and focus behavior.",
  },
  {
    key: "search",
    title: "Search input with filter chip row",
    note: "Search field, filter affordance, and compact chips using the shared surface, placeholder, and border tokens.",
  },
  {
    key: "status",
    title: "Status badge cluster",
    note: "Semantic status badges with icon-plus-color communication across success, warning, error, and info states.",
  },
  {
    key: "empty",
    title: "Empty state card",
    note: "Supportive empty-state pattern using shared glass and skeleton utilities with the system’s warm rounded geometry.",
  },
  {
    key: "toast",
    title: "Notification toast",
    note: "Compact confirmation feedback using the shared toast motion, semantic color, and shadow stack.",
  },
  {
    key: "stat",
    title: "Mini analytics stat tile",
    note: "Small KPI surface using mono numerals, chart tokens, and muted layering for quick scanning.",
  },
];

const filterOptions = ["All", "Open", "Recent", "Flagged"];

const statusItems: Array<{
  label: string;
  tone: StatusTone;
  icon: ComponentType<{ className?: string }>;
}> = [
  { label: "Healthy", tone: "success", icon: CheckCircle2 },
  { label: "Pending", tone: "warning", icon: Clock3 },
  { label: "Action needed", tone: "error", icon: TriangleAlert },
  { label: "Updated", tone: "info", icon: Sparkles },
];

const toneClasses: Record<StatusTone, string> = {
  success:
    "border-[color:var(--color-success)]/18 bg-[color:var(--color-success-fill)] text-[color:var(--color-success-text)]",
  warning:
    "border-[color:var(--color-warning)]/18 bg-[color:var(--color-warning-fill)] text-[color:var(--color-warning-text)]",
  error:
    "border-[color:var(--color-error)]/18 bg-[color:var(--color-error-fill)] text-[color:var(--color-error-text)]",
  info:
    "border-[color:var(--color-info)]/18 bg-[color:var(--color-info-fill)] text-[color:var(--color-info-text)]",
};

export function DesignSystemShowcase() {
  return (
    <main className="min-h-screen bg-[color:var(--color-surface)] text-foreground">
      <div className="mx-auto flex w-full max-w-[var(--max-w-app)] flex-col px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="reveal visible border-b border-border/80 pb-6">
          <div className="max-w-3xl space-y-3">
            <span className="inline-flex h-7 items-center rounded-full bg-[color:var(--color-surface-muted)] px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-neutral-500)]">
              Shared Prewedd system
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
                UI element review
              </h1>
              <p className="text-sm leading-6 text-[color:var(--color-neutral-500)] sm:text-base">
                Six reusable components shown in light and dark using the shared Prewedd tokens, utilities, and shadcn bridge.
              </p>
            </div>
          </div>
        </header>

        <div className="divide-y divide-border/80">
          {specimens.map((specimen, index) => (
            <SpecimenSection
              key={specimen.key}
              className={cn(
                "reveal visible",
                index === 0 && "reveal-delay-1",
                index === 1 && "reveal-delay-2",
                index > 1 && "reveal-delay-3"
              )}
              note={specimen.note}
              title={specimen.title}
            >
              <ThemePreview theme="light">{renderSpecimen(specimen.key, "light")}</ThemePreview>
              <ThemePreview theme="dark">{renderSpecimen(specimen.key, "dark")}</ThemePreview>
            </SpecimenSection>
          ))}
        </div>
      </div>
    </main>
  );
}

function SpecimenSection({
  title,
  note,
  className,
  children,
}: {
  title: string;
  note: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("py-6 sm:py-8", className)}>
      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-8">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-neutral-400)]">
            {title}
          </p>
          <p className="text-sm leading-6 text-[color:var(--color-neutral-500)]">{note}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">{children}</div>
      </div>
    </section>
  );
}

function ThemePreview({
  theme,
  children,
}: {
  theme: ThemeMode;
  children: ReactNode;
}) {
  return (
    <div
      data-theme={theme}
      className="rounded-[var(--radius-xl)] bg-[color:var(--color-surface-alt)] p-4 ring-1 ring-border/80 sm:p-5"
    >
      <div className="mb-4 inline-flex h-7 items-center rounded-full bg-background px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-neutral-500)] ring-1 ring-border/80">
        {theme === "light" ? "Light" : "Dark"}
      </div>
      {children}
    </div>
  );
}

function renderSpecimen(key: SpecimenKey, theme: ThemeMode) {
  switch (key) {
    case "cta":
      return <PrimaryCtaGroup theme={theme} />;
    case "search":
      return <SearchFilterControl theme={theme} />;
    case "status":
      return <StatusBadgeCluster />;
    case "empty":
      return <EmptyStateCard theme={theme} />;
    case "toast":
      return <NotificationToast />;
    case "stat":
      return <MiniAnalyticsTile />;
  }
}

function PrimaryCtaGroup({ theme }: { theme: ThemeMode }) {
  return (
    <div
      data-slot="button-group"
      className="flex flex-wrap items-center gap-2.5"
      role="group"
      aria-label={`${theme} action group`}
    >
      <Button
        className="btn-shimmer h-11 rounded-full px-5 text-sm font-semibold shadow-[var(--shadow-btn-primary)] hover:shadow-[var(--shadow-btn-primary-hover)]"
        size="lg"
      >
        <Plus className="size-4" />
        Create item
      </Button>
      <Button
        className="h-11 rounded-full border-border/80 bg-background px-4 text-sm shadow-none"
        size="lg"
        variant="outline"
      >
        Review
      </Button>
      <Button
        className="h-11 rounded-full px-4 text-sm text-[color:var(--color-neutral-600)] shadow-none"
        size="lg"
        variant="ghost"
      >
        More
        <ChevronDown className="size-4" />
      </Button>
    </div>
  );
}

function SearchFilterControl({ theme }: { theme: ThemeMode }) {
  const inputId = `${theme}-search-input`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-background px-4 py-3 ring-1 ring-border/80">
        <Search className="size-4 text-[color:var(--color-neutral-400)]" />
        <label className="sr-only" htmlFor={inputId}>
          Search
        </label>
        <input
          id={inputId}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-[color:var(--color-placeholder)] focus:outline-none"
          placeholder="Search"
          type="search"
        />
        <button
          className="inline-flex h-9 items-center gap-2 rounded-full bg-[color:var(--color-surface-alt)] px-3 text-xs font-medium text-[color:var(--color-neutral-600)] ring-1 ring-border/80"
          type="button"
        >
          <SlidersHorizontal className="size-3.5" />
          Filter
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option, index) => (
          <button
            key={`${theme}-${option}`}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium ring-1",
              index === 0
                ? "bg-primary text-white ring-primary/20"
                : "bg-background text-[color:var(--color-neutral-600)] ring-border/80"
            )}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadgeCluster() {
  return (
    <div className="flex flex-wrap gap-2">
      {statusItems.map((item) => {
        const Icon = item.icon;

        return (
          <span
            key={item.label}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium",
              toneClasses[item.tone]
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

function EmptyStateCard({ theme }: { theme: ThemeMode }) {
  return (
    <div className="glass-light rounded-[var(--radius-xl)] p-5 ring-1 ring-border/80">
      <div className="flex flex-col gap-4">
        <div className="flex size-12 items-center justify-center rounded-[var(--radius-lg)] bg-background text-primary ring-1 ring-border/70">
          <Inbox className="size-5" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
            No items yet
          </h3>
          <p className="max-w-sm text-sm leading-6 text-[color:var(--color-neutral-500)]">
            Add a new item or import sample data to populate this area.
          </p>
        </div>
        <div className="space-y-2 rounded-[var(--radius-lg)] bg-background/80 p-3 ring-1 ring-border/70">
          <div className="skeleton h-3.5 w-28" />
          <div className="skeleton h-3.5 w-full" />
          <div className="skeleton h-3.5 w-4/5" />
        </div>
        <div
          data-slot="button-group"
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={`${theme} empty actions`}
        >
          <Button className="btn-shimmer rounded-full px-4 shadow-[var(--shadow-btn-primary)]">
            <Plus className="size-4" />
            Add item
          </Button>
          <Button
            className="rounded-full border-border/80 bg-background px-4 shadow-none"
            variant="outline"
          >
            Import sample
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotificationToast() {
  return (
    <div className="animate-[var(--animate-toast-enter)] rounded-[var(--radius-xl)] bg-background px-4 py-3.5 shadow-[var(--shadow-lg)] ring-1 ring-border/80">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-10 items-center justify-center rounded-full bg-[color:var(--color-success-fill)] text-[color:var(--color-success-text)]">
          <Bell className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Saved</p>
            <span className="text-xs text-[color:var(--color-neutral-400)]">Now</span>
          </div>
          <p className="text-sm leading-6 text-[color:var(--color-neutral-500)]">
            The latest update is available in the workspace.
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniAnalyticsTile() {
  const bars = ["h-5", "h-8", "h-10", "h-7", "h-12", "h-6", "h-9"];

  return (
    <div className="rounded-[var(--radius-xl)] bg-background p-4 ring-1 ring-border/80">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-neutral-400)]">
            Throughput
          </p>
          <div className="flex items-end gap-3">
            <span className="font-mono text-3xl font-semibold text-foreground">248</span>
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-[color:var(--color-success-fill)] px-2.5 text-xs font-medium text-[color:var(--color-success-text)]">
              <ArrowUpRight className="size-3.5" />
              8.2%
            </span>
          </div>
        </div>
        <span className="inline-flex h-7 items-center rounded-full bg-[color:var(--color-surface-alt)] px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-neutral-500)]">
          7D
        </span>
      </div>
      <div className="rounded-[var(--radius-lg)] bg-[color:var(--color-surface-alt)] px-3 py-4">
        <div className="flex h-16 items-end gap-1">
          {bars.map((height, index) => (
            <div key={index} className="flex flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-full bg-primary/90",
                  index % 3 === 1 && "bg-[color:var(--chart-2)]/80",
                  index % 3 === 2 && "bg-[color:var(--chart-3)]/80",
                  height
                )}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--color-neutral-400)]">
        <span className="inline-flex items-center gap-1.5">
          <Filter className="size-3.5" />
          Updated 5 min ago
        </span>
        <span>System metric</span>
      </div>
    </div>
  );
}
