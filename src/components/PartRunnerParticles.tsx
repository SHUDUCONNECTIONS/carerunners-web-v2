"use client";

import * as React from "react";

// Lightweight canvas particle field — red dots that drift slowly and gently
// scatter away from the cursor. Purely decorative background for the
// PartRunner promo panel; self-contained (no extra dependency) and cleans
// up its animation frame / listeners on unmount.
const PARTICLE_COLOR = "226, 27, 34"; // PartRunner red, as an rgb() triplet
const PARTICLE_COUNT = 40;
const CURSOR_RADIUS = 90;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

export function PartRunnerParticles() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationFrame: number;
    const mouse = { x: -9999, y: -9999, active: false };

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0009,
      vy: (Math.random() - 0.5) * 0.0009,
      radius: 1.5 + Math.random() * 2.5,
      opacity: 0.25 + Math.random() * 0.45,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const handlePointerLeave = () => {
      mouse.active = false;
    };

    const step = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        // Slow ambient drift, normalized (0..1) so it's resolution independent.
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;

        let px = p.x * width;
        let py = p.y * height;

        // Gentle repulsion from the cursor — particles nudge away rather
        // than snapping, so it reads as "interactive" without being jarring.
        if (mouse.active) {
          const dx = px - mouse.x;
          const dy = py - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CURSOR_RADIUS && dist > 0.01) {
            const force = (1 - dist / CURSOR_RADIUS) * 18;
            px += (dx / dist) * force;
            py += (dy / dist) * force;
          }
        }

        ctx.beginPath();
        ctx.arc(px, py, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PARTICLE_COLOR}, ${p.opacity})`;
        ctx.fill();
      }

      animationFrame = requestAnimationFrame(step);
    };

    resize();
    step();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-auto"
    />
  );
}
