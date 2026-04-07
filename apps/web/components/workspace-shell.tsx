"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const navigation = [
  { href: "/studio", label: "Studio" },
  { href: "/providers", label: "Providers" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" }
] as const satisfies ReadonlyArray<{ href: Route; label: string }>;

export function WorkspaceShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen">
      <div className="grid-fade fixed inset-0 opacity-55" />
      <div className="relative mx-auto grid min-h-screen max-w-[1500px] gap-6 px-4 py-4 lg:grid-cols-[280px_1fr] lg:px-6">
        <aside className="panel rounded-[32px] p-4 lg:p-5">
          <div className="flex items-center gap-3 rounded-[24px] border border-black/8 bg-white/80 px-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-sm font-semibold text-white">
              D
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Dreamora</p>
              <p className="text-xs text-black/45">
                Personal generation workspace
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-black/8 bg-[#f7f6f2] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-black/35">
              Quick actions
            </p>
            <div className="mt-3 grid gap-2 text-sm">
              <button className="rounded-2xl bg-black px-4 py-3 text-left font-medium text-white">
                New generation run
              </button>
              <button className="rounded-2xl border border-black/8 bg-white px-4 py-3 text-left font-medium text-black/72">
                Configure providers
              </button>
            </div>
          </div>

          <nav className="mt-5 space-y-1">
            {navigation.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "block rounded-[22px] px-4 py-3 text-sm transition",
                    active
                      ? "bg-black text-white"
                      : "text-black/65 hover:bg-white/75"
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-[24px] border border-black/8 bg-white/70 px-4 py-4">
            <p className="text-sm font-medium">Single-server mode</p>
            <p className="mt-2 text-sm leading-6 text-black/55">
              UI, API, and Comfy orchestration can all live on the same machine
              while you validate the workflow through your VS Code tunnel.
            </p>
          </div>
        </aside>

        <section className="space-y-6">
          <header className="panel rounded-[32px] px-6 py-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-black/35">
                  Workspace
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-black md:text-5xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-black/58">
                  {description}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium">
                  Sync ComfyUI
                </button>
                <button className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
                  New run
                </button>
              </div>
            </div>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
