"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  id: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function getStoredState(id: string, defaultOpen: boolean): boolean {
  if (typeof window === "undefined") return defaultOpen;
  const stored = localStorage.getItem(`section-${id}`);
  if (stored === null) return defaultOpen;
  return stored === "open";
}

export function CollapsibleSection({
  title,
  id,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setOpen(getStoredState(id, defaultOpen));
    setMounted(true);
  }, [id, defaultOpen]);

  function toggle() {
    const next = !open;
    setOpen(next);
    localStorage.setItem(`section-${id}`, next ? "open" : "closed");
  }

  // Avoid hydration mismatch — render open by default until mounted
  const isOpen = mounted ? open : defaultOpen;

  return (
    <section className="mb-1">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between py-3 text-sm font-semibold text-foreground hover:text-primary"
      >
        {title}
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && <div className="pb-4">{children}</div>}
    </section>
  );
}
