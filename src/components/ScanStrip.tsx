"use client";

import { useEffect, useRef } from "react";

import { useInk } from "@/hooks/useInk";

/**
 * The scanning strip.
 *
 * This is the only thing in the product that moves continuously, and it runs
 * only while a lookup is actually in flight: a seeded bar field sweeping left
 * under a travelling sine. It encodes nothing and says so — the label beside it
 * reads "scanning" — because a field of bars that looked like a measurement
 * would be a fabricated number in this product, and the answer it precedes
 * would be worth less for it.
 *
 * Under `prefers-reduced-motion` the loop never starts and one high-contrast
 * still is drawn instead. Nothing here flashes: the bars translate.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPEED = 46; // px per second
const HEIGHT = 26;

export function ScanStrip({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ink = useInk();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 1;
    let span = 1;
    let bars: Array<{ x: number; w: number; h: number }> = [];
    let frame = 0;
    let start = 0;

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(canvas.getBoundingClientRect().width));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // The pattern repeats over twice the viewport so the sweep never seams.
      span = Math.max(width * 2, 480);
      const random = mulberry32(0xf682b2);
      bars = [];
      for (let x = 0; x < span; x += 4) {
        if (random() > 0.62) continue;
        bars.push({
          x,
          w: random() > 0.84 ? 2 : 1,
          h: Math.round(6 + random() * (HEIGHT - 8)),
        });
      }
    };

    const draw = (phase: number) => {
      ctx.clearRect(0, 0, width, HEIGHT);
      ctx.fillStyle = ink;
      for (const bar of bars) {
        const x = ((bar.x - phase) % span + span) % span;
        if (x > width) continue;
        ctx.fillRect(x, HEIGHT - bar.h, bar.w, bar.h);
      }

      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const y = HEIGHT / 2 + Math.sin((x + phase) / 21) * (HEIGHT / 2 - 3.5);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const step = (now: number) => {
      if (!start) start = now;
      draw(((now - start) / 1000) * SPEED);
      frame = requestAnimationFrame(step);
    };

    measure();
    if (reduced) draw(0);
    else frame = requestAnimationFrame(step);

    const observer = new ResizeObserver(() => {
      measure();
      if (reduced) draw(0);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ink]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`block w-full ${className ?? ""}`}
      style={{ height: HEIGHT }}
    />
  );
}
