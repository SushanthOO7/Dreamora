"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { UsageMetric, UsageSeries } from "@dreamora/shared";
import { ScrollReveal, StaggerContainer, StaggerItem, HoverScale } from "./motion-wrapper";

type ReportsContentProps = {
  usageMetrics: UsageMetric[];
  modelUsageBreakdown: UsageSeries[];
  weeklyUsageSeries: UsageSeries[];
};

/* Warm color palette for charts matching the theme */
const warmBarColors = [
  "#f5d6a0", "#edc08a", "#e4a870", "#db9058",
  "#d27840", "#c86030", "#e4a870"
];

const warmDonutColors = [
  "#1a1714", "#d4845a", "#e8a06a", "#f5d6a0",
  "#3daa7e", "#6ccf96", "#4d7cfe"
];

export function ReportsContent({
  usageMetrics,
  modelUsageBreakdown,
  weeklyUsageSeries
}: ReportsContentProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const total = modelUsageBreakdown.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-5">
      {/* ─── Metric cards ──────────────────────────── */}
      <StaggerContainer className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" staggerDelay={0.08}>
        {usageMetrics.map((metric) => (
          <StaggerItem key={metric.label}>
            <HoverScale>
              <div className="panel rounded-[24px] p-5">
                <p className="text-xs text-[var(--foreground)]/35">{metric.label}</p>
                <motion.p
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]"
                >
                  {metric.value}
                </motion.p>
                <p className="mt-2 text-[11px] leading-4 text-[var(--foreground)]/35">
                  {metric.detail}
                </p>
              </div>
            </HoverScale>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* ─── Charts row ────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        {/* Bar chart: Weekly activity */}
        <ScrollReveal animation="slide-right">
          <div className="panel-strong rounded-[28px] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold tracking-tight">
                    Generation volume
                  </p>
                  <span className="rounded-full border border-[var(--line)] bg-white/60 px-2 py-0.5 text-[10px] text-[var(--foreground)]/35">
                    Workspaces
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--foreground)]/35">
                  Weekly generation activity overview
                </p>
              </div>
              <div className="flex items-center gap-2">
                {["Last 7 days", "This month"].map((label, i) => (
                  <span
                    key={label}
                    className={`rounded-full px-3 py-1 text-[11px] ${
                      i === 0
                        ? "bg-[var(--accent)] text-white"
                        : "border border-[var(--line)] text-[var(--foreground)]/35"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Y-axis labels + bars */}
            <div className="relative flex h-[300px] items-end gap-0 rounded-[20px] border border-[var(--line)] bg-white/50 px-4 pb-10 pt-6">
              {/* Y-axis grid lines */}
              {[100, 75, 50, 25].map((val) => (
                <div
                  key={val}
                  className="absolute left-0 right-0 border-t border-[var(--foreground)]/5"
                  style={{ bottom: `${val * 2.4 + 40}px` }}
                >
                  <span className="absolute -left-1 -top-2.5 text-[9px] text-[var(--foreground)]/20 hidden sm:block">
                    {val}%
                  </span>
                </div>
              ))}

              {weeklyUsageSeries.map((item, i) => {
                const barColor = warmBarColors[i % warmBarColors.length];
                return (
                  <div
                    key={item.label}
                    className="flex flex-1 flex-col items-center gap-2 relative"
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip */}
                    {hoveredBar === i && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-16 z-10 panel-strong rounded-[14px] px-3 py-2 text-center whitespace-nowrap"
                      >
                        <p className="text-[10px] text-[var(--foreground)]/35">{item.label}</p>
                        <p className="text-sm font-semibold">{item.value}%</p>
                      </motion.div>
                    )}

                    <div className="flex h-full w-full items-end justify-center px-1">
                      <motion.div
                        className="w-full max-w-[48px] chart-bar"
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(item.value * 2.4, 4)}px` }}
                        transition={{
                          delay: 0.1 + i * 0.06,
                          duration: 0.6,
                          ease: [0.25, 0.1, 0.25, 1]
                        }}
                        style={{ background: barColor }}
                      />
                    </div>
                    <span className="absolute bottom-[-28px] text-[11px] text-[var(--foreground)]/40">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollReveal>

        {/* Donut chart: Model usage */}
        <ScrollReveal animation="slide-left">
          <div className="panel-strong rounded-[28px] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold tracking-tight">
                    Engine mix
                  </p>
                  <span className="rounded-full border border-[var(--line)] bg-white/60 px-2 py-0.5 text-[10px] text-[var(--foreground)]/35">
                    By completions
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--foreground)]/35">
                  Model usage breakdown
                </p>
              </div>
            </div>

            {/* Donut */}
            <div className="flex items-center justify-center py-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                className="relative h-[220px] w-[220px] rounded-full"
                style={{
                  background: `conic-gradient(${modelUsageBreakdown
                    .map((item, index, arr) => {
                      const color = warmDonutColors[index % warmDonutColors.length];
                      const start =
                        (arr.slice(0, index).reduce((sum, part) => sum + part.value, 0) /
                          Math.max(1, total)) * 360;
                      const end =
                        (arr.slice(0, index + 1).reduce((sum, part) => sum + part.value, 0) /
                          Math.max(1, total)) * 360;
                      return `${color} ${start}deg ${end}deg`;
                    })
                    .join(", ")})`
                }}
              >
                <div className="absolute inset-[50px] rounded-full bg-[var(--background)] flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold tracking-tight">{total}%</p>
                    <p className="text-[10px] text-[var(--foreground)]/30">Total</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              {modelUsageBreakdown.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="flex items-center gap-2"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: warmDonutColors[i % warmDonutColors.length] }}
                  />
                  <span className="text-xs text-[var(--foreground)]/50">{item.label}</span>
                </motion.div>
              ))}
            </div>

            {/* Breakdown list */}
            <div className="mt-6 space-y-2">
              {modelUsageBreakdown.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="flex items-center justify-between rounded-[16px] border border-[var(--line)] bg-white/50 px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: warmDonutColors[i % warmDonutColors.length] }}
                    />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:block h-1.5 w-16 rounded-full bg-[var(--foreground)]/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.value / Math.max(1, total)) * 100}%` }}
                        transition={{ delay: 0.6 + i * 0.08, duration: 0.5 }}
                        style={{ background: warmDonutColors[i % warmDonutColors.length] }}
                      />
                    </div>
                    <span className="text-sm font-medium text-[var(--foreground)]/50 w-10 text-right">
                      {item.value}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* ─── ARR-style highlight card ──────────────── */}
      <ScrollReveal animation="scale-in">
        <div className="panel-strong rounded-[28px] p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--foreground)]/30 uppercase tracking-wider">
                Generation summary
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                Pipeline Performance
              </h3>
              <p className="mt-1 text-sm text-[var(--foreground)]/40">
                Aggregated metrics from all generation runs across models and providers.
              </p>
            </div>
            <div className="flex gap-3">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-[20px] border border-[var(--success)]/20 bg-[var(--success-soft)] px-5 py-3 text-center"
              >
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M7 7h10v10" />
                  </svg>
                  <span className="text-sm font-semibold text-[var(--success)]">+63%</span>
                </div>
                <p className="mt-0.5 text-[10px] text-[var(--success)]/60">vs. last month</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-[20px] border border-[var(--line)] bg-white/50 px-5 py-3 text-center"
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">776</p>
                <p className="mt-0.5 text-[10px] text-[var(--foreground)]/30">Total outputs</p>
              </motion.div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
