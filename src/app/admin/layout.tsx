"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  Calendar,
  Heart,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/roster", label: "Roster", icon: Users },
  { href: "/admin/calendar", label: "Calendar", icon: Calendar },
  { href: "/admin/weddings", label: "Weddings", icon: Heart },
];

export default function AdminLayout({
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
    <div className="flex min-h-screen w-screen overflow-x-hidden bg-background">
      {/* Sidebar — desktop */}
      <aside className="fixed flex h-screen w-56 flex-col overflow-y-auto border-r border-border bg-card z-20">
        <div className="flex h-14 items-center px-5">
          <span className="text-sm font-bold tracking-tight text-foreground">
            PreWedd Admin
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content — h-screen + overflow-y-auto makes this the scroll container,
           so sticky headers inside children work correctly */}
      <main className="ml-56 min-w-0 h-screen overflow-y-auto">{children}</main>
    </div>
  );
}
