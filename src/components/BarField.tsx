"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useInk } from "@/hooks/useInk";
import { fmtPct, fmtTemp } from "@/lib/format";
import type { HourlyPoint, Language } from "@/lib/types";
import { t } from "@/lib/uiText";

/**
 * The hourly series, drawn as a bar field into its own ruler.
 *
 * This is the product's centre of gravity below the prose, and every mark in it
 * is a fetched number: the upper band is temperature, the lower band is the
 * chance of rain as dither, and the line through the bar tops is the actual
 * diurnal curve, not an ornament. The ruler behind them carries no values and
 * encodes nothing, which is the only reason it is allowed to exist.
 *
 * Selecting a column inverts it — the bar is knocked back out of the solid block
 * rather than drawn over it — while the rest of the field keeps its bars, so one
 * hour can be read without losing the shape it sits in. The control is a real
 * slider: arrow keys move the sample, the readout is a live region, and the whole
 * series is also present as text for a screen reader, because a canvas is not an
 * answer.
 */

const PLOT_H = 116;
const TEMP_SHARE = 0.64;
const DRAW_MS = 620;

function indexFromEvent(element: HTMLElement, clientX: number, count: number): number {
  const rect = element.getBoundingClientRect();
  const ratio = (clientX - rect.left) / Math.max(1, rect.width);
  return Math.min(count - 1, Math.max(0, Math.floor(ratio * count)));
}

export function BarField({
  points,
  language,
}: {
  points: HourlyPoint[];
  language: Language;
}) {
  const copy = t(language);
  const ink = useInk();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const selectedRef = useRef<number | null>(null);
  const progressRef = useRef(1);
  const renderRef = useRef<(() => void) | null>(null);

  const scale = useMemo(() => {
    const values = points
      .map((point) => point.tempC)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    if (values.length === 0) return null;
    const low = Math.min(...values);
    const high = Math.max(...values);
    return { low, high, span: high - low || 1 };
  }, [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !scale || points.length < 2) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 1;
    let frame = 0;

    const paint = () => {
      const count = points.length;
      const cell = width / count;
      const tempH = Math.round(PLOT_H * TEMP_SHARE);
      const rainTop = tempH + 9;
      // Both bands stand on a rule. The rain dither used to grow *down* from
      // rainTop, which put two opposite directions in one plot and left a 4%
      // hour as a stray hairline floating halfway down the canvas.
      const rainFloor = PLOT_H - 2;
      const rainH = rainFloor - rainTop;
      const shown = Math.max(1, Math.ceil(count * progressRef.current));
      const active = selectedRef.current;

      ctx.clearRect(0, 0, width, PLOT_H);

      // The ruler: uniform pitch, no values. Furniture, not a signal.
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = ink;
      for (let i = 0; i <= count; i += 3) {
        ctx.fillRect(Math.round(i * cell), 0, 1, PLOT_H);
      }
      ctx.globalAlpha = 0.42;
      ctx.fillRect(0, tempH, width, 1);
      // The rain band gets its own floor, so a 0% hour reads as a measured zero
      // against a rule rather than as an empty patch of canvas.
      ctx.fillRect(0, PLOT_H - 1, width, 1);
      ctx.globalAlpha = 1;

      for (let i = 0; i < shown; i += 1) {
        const point = points[i];
        const x = i * cell;
        const barW = Math.max(2, Math.floor(cell) - 3);
        const barX = Math.round(x + (cell - barW) / 2);

        // The cursor is a full-height inversion of one column. The rest of the
        // field keeps its bars: dimming them would delete the series to read one
        // hour out of it, which is the opposite of what a sample is for.
        if (active === i) {
          ctx.fillStyle = ink;
          ctx.fillRect(Math.round(x), 0, Math.max(2, Math.ceil(cell)), PLOT_H);
        }

        // Inside the inverted column the ink runs the other way, so the bar is
        // knocked back out of the solid block rather than drawn over it.
        const knockout = active === i;
        ctx.fillStyle = ink;
        const temp = point.tempC;
        if (temp !== null && Number.isFinite(temp)) {
          const h = Math.max(2, Math.round(((temp - scale.low) / scale.span) * (tempH - 12)) + 4);
          if (knockout) ctx.globalCompositeOperation = "destination-out";
          ctx.fillRect(barX, tempH - h, barW, h);
          ctx.globalCompositeOperation = "source-over";
        }

        // Rain as dither, standing on the plot floor: 1px rows every 3px, so it
        // can never be mistaken for the solid ink of a measured temperature and
        // it climbs the way the temperature bars do.
        const prob = point.precipProbability;
        if (prob !== null && Number.isFinite(prob) && prob > 0) {
          const h = Math.max(1, Math.round((prob / 100) * rainH));
          if (knockout) ctx.globalCompositeOperation = "destination-out";
          for (let y = 0; y < h; y += 3) {
            ctx.fillRect(barX, rainFloor - y, Math.max(2, barW), 1);
          }
          ctx.globalCompositeOperation = "source-over";
        }
      }

      // The curve through the bar tops, drawn last so a dimmed field cannot
      // swallow it. This is the series, not a decoration.
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < shown; i += 1) {
        const temp = points[i].tempC;
        if (temp === null || !Number.isFinite(temp)) continue;
        const h = Math.max(2, Math.round(((temp - scale.low) / scale.span) * (tempH - 12)) + 4);
        const x = i * cell + cell / 2;
        const y = tempH - h;
        if (started) ctx.lineTo(x, y);
        else {
          ctx.moveTo(x, y);
          started = true;
        }
      }
      if (started) ctx.stroke();
    };

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(canvas.getBoundingClientRect().width));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(PLOT_H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    renderRef.current = paint;
    measure();

    // The authored moment: the series lays itself down left to right at a
    // constant rate, the way a plotter would. Never eased — a machine drawing a
    // measurement does not accelerate.
    if (reduced) {
      progressRef.current = 1;
      paint();
    } else {
      progressRef.current = 0;
      const start = performance.now();
      const step = (now: number) => {
        progressRef.current = Math.min(1, (now - start) / DRAW_MS);
        paint();
        if (progressRef.current < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }

    const observer = new ResizeObserver(() => {
      measure();
      paint();
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderRef.current = null;
    };
  }, [ink, points, scale]);

  useEffect(() => {
    selectedRef.current = selected;
    renderRef.current?.();
  }, [selected]);

  const count = points.length;

  // Tap selects; a horizontal drag scrubs. `touch-pan-y` on the canvas keeps the
  // page scrollable through the plot, so the control can be full-bleed on a
  // phone without trapping the gesture.
  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(indexFromEvent(event.currentTarget, event.clientX, count));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setSelected(indexFromEvent(event.currentTarget, event.clientX, count));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = (delta: number) => {
      event.preventDefault();
      setSelected((current) =>
        current === null ? 0 : Math.min(count - 1, Math.max(0, current + delta)),
      );
    };
    if (event.key === "ArrowRight" || event.key === "ArrowUp") step(1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") step(-1);
    else if (event.key === "Home") {
      event.preventDefault();
      setSelected(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setSelected(count - 1);
    } else if (event.key === "Escape") setSelected(null);
  };

  if (!scale || count < 2) {
    return <p className="mono-label border-hair mt-4 border-t pt-2">{copy.fieldEmpty}</p>;
  }

  const sampled = selected === null ? null : points[selected];
  const readout = sampled
    ? `${sampled.label} · ${fmtTemp(sampled.tempC)} · ${copy.rainAxis} ${fmtPct(sampled.precipProbability)}`
    : copy.sampleHint;

  const stride = Math.max(1, Math.ceil(count / 5));
  const ticks = points.filter((_, index) => index % stride === 0);

  return (
    <div className="mt-4">
      <div className="mono-label flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span>{copy.hourly}</span>
        <span className="flex items-baseline gap-2">
          <span className="numeric">
            {copy.tempAxis} {Math.round(scale.low)}–{Math.round(scale.high)}
          </span>
          <span aria-hidden="true" className="field-dither h-2 w-4 self-center" />
          <span>{copy.rainAxis}</span>
        </span>
      </div>

      <canvas
        ref={canvasRef}
        role="slider"
        tabIndex={0}
        aria-label={`${copy.hourly} — ${copy.sample}`}
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={selected ?? 0}
        aria-valuetext={readout}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        className="mt-1.5 block w-full cursor-crosshair touch-pan-y"
        style={{ height: PLOT_H }}
      />

      <div className="mono-label border-hair mt-1 flex justify-between border-t pt-1">
        {ticks.map((point) => (
          <span key={point.time}>{point.label}</span>
        ))}
      </div>

      <p
        role="status"
        aria-live="polite"
        className="numeric text-caption mt-2 flex flex-wrap items-center gap-2"
      >
        {sampled ? (
          <>
            <span className="field-solid mono-label px-1.5 py-0.5">{sampled.label}</span>
            <span>{fmtTemp(sampled.tempC)}</span>
            <span aria-hidden="true" className="bg-hair-2 h-3 w-px" />
            <span>
              {copy.rainAxis} {fmtPct(sampled.precipProbability)}
            </span>
          </>
        ) : (
          <span>{copy.sampleHint}</span>
        )}
      </p>

      {/* The series as text. A canvas is not an answer. */}
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.time}>
            {point.label}: {fmtTemp(point.tempC)}, {copy.rainAxis}{" "}
            {fmtPct(point.precipProbability)}
          </li>
        ))}
      </ul>
    </div>
  );
}

