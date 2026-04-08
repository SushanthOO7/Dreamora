"use client";

import { motion } from "framer-motion";

const wavePaths = [
  {
    d: "M0,320 C160,280 320,360 480,320 C640,280 800,240 960,280 C1120,320 1280,360 1440,320 C1600,280 1760,320 1920,300 L1920,600 L0,600 Z",
    fill: "rgba(248, 220, 180, 0.35)",
    className: "wave-1",
    style: { bottom: 0 }
  },
  {
    d: "M0,360 C200,310 360,390 520,350 C680,310 840,280 1000,320 C1160,360 1320,400 1480,350 C1640,300 1800,340 1920,330 L1920,600 L0,600 Z",
    fill: "rgba(240, 190, 140, 0.4)",
    className: "wave-2",
    style: { bottom: 0 }
  },
  {
    d: "M0,380 C180,340 340,410 500,370 C660,330 820,300 980,350 C1140,400 1300,380 1460,360 C1620,340 1780,370 1920,355 L1920,600 L0,600 Z",
    fill: "rgba(228, 160, 105, 0.45)",
    className: "wave-3",
    style: { bottom: 0 }
  },
  {
    d: "M0,420 C150,380 310,440 470,410 C630,380 790,350 950,390 C1110,430 1270,410 1430,400 C1590,390 1750,415 1920,400 L1920,600 L0,600 Z",
    fill: "rgba(215, 130, 78, 0.5)",
    className: "wave-4",
    style: { bottom: 0 }
  },
  {
    d: "M0,460 C200,430 360,480 520,450 C680,420 840,400 1000,440 C1160,480 1320,460 1480,445 C1640,430 1800,455 1920,445 L1920,600 L0,600 Z",
    fill: "rgba(200, 100, 55, 0.55)",
    className: "wave-5",
    style: { bottom: 0 }
  }
];

export function AnimatedWaves() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Warm radial glow behind waves */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 60% at 50% 100%, rgba(232, 160, 90, 0.18) 0%, transparent 70%)"
        }}
      />

      {wavePaths.map((wave, i) => (
        <motion.div
          key={i}
          className={`wave-layer ${wave.className}`}
          style={wave.style}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 + i * 0.15, duration: 1.2, ease: "easeOut" }}
        >
          <svg
            viewBox="0 0 1920 600"
            preserveAspectRatio="none"
            className="w-full"
            style={{ height: "clamp(260px, 45vh, 440px)" }}
          >
            <path d={wave.d} fill={wave.fill} />
          </svg>
        </motion.div>
      ))}

      {/* Top-edge gradient mask for smooth blend into background */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "clamp(260px, 45vh, 440px)",
          background:
            "linear-gradient(to bottom, var(--background) 0%, transparent 30%)"
        }}
      />
    </div>
  );
}

/* Smaller inline wave for section dividers */
export function WaveDivider() {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 80 }}>
      <svg
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <path
          d="M0,40 C240,10 480,70 720,40 C960,10 1200,70 1440,40 L1440,80 L0,80 Z"
          fill="rgba(228, 160, 105, 0.12)"
        />
      </svg>
    </div>
  );
}
