"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Route } from "next";
import { AnimatedWaves } from "./animated-waves";
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
  HoverScale
} from "./motion-wrapper";

const navItems = [
  { label: "Studio", href: "/studio" as Route },
  { label: "Reports", href: "/reports" as Route }
];

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 12h6M12 9v6" />
      </svg>
    ),
    title: "Generation Studio",
    description:
      "Draft stills in FLUX, animate with Wan 2.2, accelerate with TeaCache, and upscale to delivery-ready masters."
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10M6 20V4M18 20v-6" />
      </svg>
    ),
    title: "Live Reports",
    description:
      "Track model usage, token consumption, and generation volume with real-time analytics dashboards."
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
      </svg>
    ),
    title: "Smart Workflows",
    description:
      "Automated pipelines from prompt to final delivery with quality scoring, regeneration policies, and review queues."
  }
];

const trustedLogos = [
  "FLUX",
  "Wan 2.2",
  "ComfyUI",
  "TeaCache",
  "SeedVR2",
  "RIFE"
];

const workflowSteps = [
  {
    step: "01",
    title: "Configure prompt & references",
    description:
      "Pull saved style cards, prior winning prompts, and reference images before generation."
  },
  {
    step: "02",
    title: "Generate keyframes",
    description:
      "Run FLUX GGUF image generation with optimized attention defaults for your hardware."
  },
  {
    step: "03",
    title: "Animate & extend",
    description:
      "Use Wan 2.2 with TeaCache acceleration for efficient motion generation."
  },
  {
    step: "04",
    title: "Upscale & deliver",
    description:
      "Apply RIFE interpolation then SeedVR2 upscale to produce delivery-ready masters."
  }
];

export function Shell() {
  return (
    <main className="min-h-screen overflow-hidden">
      {/* ── Navbar ─────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed top-0 inset-x-0 z-50"
      >
        <div className="mx-auto max-w-[1200px] px-6 pt-4">
          <nav className="panel-strong flex items-center justify-between rounded-full px-6 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-white">
                D
              </div>
              <span className="text-base font-semibold tracking-tight">
                Dreamora
              </span>
            </Link>

            <div className="hidden items-center gap-1 rounded-full border border-[var(--line)] bg-white/40 px-1 py-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-1.5 text-sm text-[var(--foreground)]/65 transition-colors hover:bg-white/70 hover:text-[var(--foreground)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <Link
              href="/studio"
              className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
              Open Studio
            </Link>
          </nav>
        </div>
      </motion.header>

      {/* ── Hero ───────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6">
        <div className="relative z-10 mx-auto max-w-3xl text-center pt-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h1 className="text-5xl font-semibold tracking-[-0.04em] leading-[1.1] md:text-7xl lg:text-8xl">
              <span className="font-[var(--font-serif)] italic" style={{ fontFamily: "var(--font-serif)" }}>
                Generation
              </span>{" "}
              That
              <br />
              Flows With You
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            className="mx-auto mt-7 max-w-xl text-base leading-7 text-[var(--foreground)]/55 md:text-lg md:leading-8"
          >
            Build, automate, and scale with AI designed to think naturally as
            smooth and adaptive as the world around you.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="mt-9 flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              href="/studio"
              className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-black/10 transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5l0 14M5 12l14 0" />
              </svg>
              Start Building with AI
            </Link>
            <Link
              href="/reports"
              className="rounded-full border border-[var(--line-strong)] bg-white/60 px-6 py-3 text-sm font-medium text-[var(--foreground)]/70 transition-all hover:bg-white/80 hover:text-[var(--foreground)]"
            >
              Explore Reports
            </Link>
          </motion.div>
        </div>

        {/* Waves */}
        <AnimatedWaves />
      </section>

      {/* ── Trusted engines strip ──────────────────── */}
      <section className="relative z-10 -mt-8 pb-20">
        <ScrollReveal animation="fade-in" delay={0.1}>
          <p className="text-center text-sm tracking-widest uppercase text-[var(--foreground)]/30">
            Powered by leading engines
          </p>
          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {trustedLogos.map((name) => (
              <span
                key={name}
                className="text-base font-medium tracking-tight text-[var(--foreground)]/25"
              >
                {name}
              </span>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* ── Features ───────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-[1100px] px-6 pb-28">
        <ScrollReveal>
          <p className="text-center text-sm tracking-widest uppercase text-[var(--foreground)]/30">
            Capabilities
          </p>
          <h2 className="mt-4 text-center text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
            Everything you need to create
          </h2>
        </ScrollReveal>

        <StaggerContainer className="mt-14 grid gap-5 md:grid-cols-3" staggerDelay={0.12}>
          {features.map((feature) => (
            <StaggerItem key={feature.title}>
              <HoverScale>
                <div className="panel rounded-[28px] p-7 h-full">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--line)] bg-white/80 text-[var(--foreground)]/60">
                    {feature.icon}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--foreground)]/50">
                    {feature.description}
                  </p>
                </div>
              </HoverScale>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* ── Workflow preview ────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-[1100px] px-6 pb-32">
        <ScrollReveal>
          <p className="text-center text-sm tracking-widest uppercase text-[var(--foreground)]/30">
            How it works
          </p>
          <h2 className="mt-4 text-center text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
            From prompt to delivery
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-base leading-7 text-[var(--foreground)]/50">
            A tuned pipeline that automates every step of your creative workflow.
          </p>
        </ScrollReveal>

        <div className="relative mt-16 mx-auto max-w-2xl">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-[var(--success)] via-[var(--accent-warm)] to-transparent" />

          <StaggerContainer staggerDelay={0.15}>
            {workflowSteps.map((step, i) => (
              <StaggerItem key={step.step}>
                <div className="relative flex items-start gap-5 pb-10 last:pb-0">
                  {/* Node dot */}
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--line-strong)] bg-white text-xs font-bold text-[var(--foreground)]/70 shadow-sm">
                    {step.step}
                  </div>
                  <HoverScale className="flex-1">
                    <div className="panel rounded-[24px] px-6 py-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold tracking-tight">
                          {step.title}
                        </h3>
                        {i < workflowSteps.length - 1 && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                            Auto
                          </span>
                        )}
                      </div>
                      <p className="mt-2.5 text-sm leading-6 text-[var(--foreground)]/50">
                        {step.description}
                      </p>
                    </div>
                  </HoverScale>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-[1100px] px-6 pb-20">
        <ScrollReveal animation="scale-in">
          <div className="panel-strong rounded-[36px] px-10 py-16 text-center md:px-16">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
              Ready to create?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--foreground)]/50">
              Open the studio and start your first generation workflow in under a minute.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/studio"
                className="rounded-full bg-[var(--accent)] px-7 py-3.5 text-sm font-medium text-white shadow-lg shadow-black/10 transition-transform hover:scale-[1.03] active:scale-[0.97]"
              >
                Launch Studio
              </Link>
              <Link
                href="/reports"
                className="rounded-full border border-[var(--line-strong)] bg-white/60 px-7 py-3.5 text-sm font-medium text-[var(--foreground)]/70 transition-all hover:bg-white/80"
              >
                View Reports
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="relative z-10 mx-auto max-w-[1100px] px-6 pb-10">
        <div className="flex items-center justify-between border-t border-[var(--line)] pt-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-[10px] font-bold text-white">
              D
            </div>
            <span className="text-sm font-medium text-[var(--foreground)]/50">
              Dreamora
            </span>
          </div>
          <p className="text-xs text-[var(--foreground)]/30">
            Personal AI generation workspace
          </p>
        </div>
      </footer>
    </main>
  );
}
