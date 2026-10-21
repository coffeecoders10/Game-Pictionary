"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export function Sketchpad() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#e8eff5";
    ctx.fillStyle = "#e8eff5";

    let drawing = false;
    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const [x, y] = point(e);
      ctx.beginPath(); // new path per stroke so strokes don't join
      ctx.moveTo(x, y);
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: PointerEvent) => {
      if (!drawing) return;
      const [x, y] = point(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const up = () => (drawing = false);

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
  };

  return (
    <main className="sketch">
      <canvas ref={ref} className="sketch-canvas" aria-label="Drawing area" />
      <Link href="/" className="btn sketch-back">
        Back
      </Link>
      <button className="btn sketch-clear" type="button" onClick={clear}>
        Clear
      </button>
    </main>
  );
}
