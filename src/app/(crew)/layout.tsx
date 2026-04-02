"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Heart,
  Calendar,
  User,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/weddings", label: "Weddings", icon: Heart },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/profile", label: "Profile", icon: User },
];

export default function CrewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top header — mobile */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-bold tracking-tight text-foreground">
          PreWedd Crew
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </header>

      {/* Page content */}
      <main className="flex flex-1 flex-col">{children}</main>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-16 items-center justify-around">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-[44px] flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "size-5",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for fixed bottom nav */}
      <div className="h-16" />
    </div>
  );
}
