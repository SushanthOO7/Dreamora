"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Route } from "next";
import { PageTransition } from "./motion-wrapper";

const navigation = [
  {
    href: "/studio",
    label: "Studio",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 12h6M12 9v6" />
      </svg>
    )
  },
  {
    href: "/reports",
    label: "Reports",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10M6 20V4M18 20v-6" />
      </svg>
    )
  }
] as const satisfies ReadonlyArray<{ href: Route; label: string; icon: React.ReactNode }>;

export function WorkspaceShell({
  title,
  description,
  actions,
  children
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen">
      <div className="grid-fade fixed inset-0 opacity-40" />

      <div className="relative mx-auto grid min-h-screen max-w-[1500px] gap-5 px-4 py-4 lg:grid-cols-[240px_1fr] lg:px-6">
        {/* ── Sidebar ──────────────────────────────── */}
        <aside className="panel-strong sticky top-4 h-fit rounded-[28px] p-4 lg:p-5">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-[20px] border border-[var(--line)] bg-white/60 px-4 py-3.5 transition-colors hover:bg-white/80"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-bold text-white">
              D
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Dreamora</p>
              <p className="text-[11px] text-[var(--foreground)]/40">
                AI Generation
              </p>
            </div>
          </Link>

          <nav className="mt-5 space-y-1">
            {navigation.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative block"
                >
                  <div
                    className={[
                      "flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm transition-all duration-200",
                      active
                        ? "bg-[var(--accent)] text-white font-medium shadow-md shadow-black/10"
                        : "text-[var(--foreground)]/55 hover:bg-white/60 hover:text-[var(--foreground)]"
                    ].join(" ")}
                  >
                    <span className={active ? "opacity-100" : "opacity-50"}>
                      {item.icon}
                    </span>
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Mini status */}
          <div className="mt-6 rounded-[18px] border border-[var(--line)] bg-white/50 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--success)] animate-pulse" />
              <span className="text-xs font-medium text-[var(--foreground)]/50">
                System online
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-[var(--foreground)]/35">
              Local ComfyUI connected
            </p>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────── */}
        <PageTransition className="space-y-5">
          <header className="panel-strong rounded-[28px] px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <motion.h1
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)] md:text-4xl"
                >
                  {title}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="mt-2 max-w-xl text-sm leading-6 text-[var(--foreground)]/45"
                >
                  {description}
                </motion.p>
              </div>
              {actions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="flex flex-wrap gap-3"
                >
                  {actions}
                </motion.div>
              )}
            </div>
          </header>

          {children}
        </PageTransition>
      </div>
    </main>
  );
}
