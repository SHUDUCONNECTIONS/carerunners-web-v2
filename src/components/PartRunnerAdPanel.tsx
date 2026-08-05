"use client";

import { MapPin, Zap, ShieldCheck, ArrowRight } from "lucide-react";

// The PartRunner promo card shown on every auth entry point (customer and
// driver login/sign-up) — extracted from the original customer login page
// so all four pages stay visually and content-consistent.
export function PartRunnerAdPanel({ ctaText = "Get started" }: { ctaText?: string }) {
  return (
    <div className="relative w-full max-w-sm rounded-3xl p-6 md:p-7 overflow-hidden
                    bg-gradient-to-br from-[#ef2530] via-[#e21b22] to-[#8f1116]
                    shadow-[0_20px_60px_-15px_rgba(226,27,34,0.7)] border border-white/10">
      {/* Decorative glow blobs */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-14 -left-10 w-44 h-44 rounded-full bg-black/20 blur-2xl pointer-events-none" />

      <div className="relative">
        {/* NEW badge */}
        <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-widest rounded-full px-3 py-1 mb-4">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
          </span>
          Just launched
        </span>

        {/* Logo + wordmark */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-14 w-14 rounded-2xl bg-white shadow-lg flex items-center justify-center shrink-0">
            <img src="/partrunnerlogo.png" alt="PartRunner" className="h-10 w-10 object-contain" />
          </div>
          <div>
            <p className="text-white font-extrabold text-xl leading-none">PartRunner</p>
            <p className="text-white/70 text-xs font-medium mt-1">by Carerunners</p>
          </div>
        </div>

        {/* Headline */}
        <h3 className="text-white text-2xl md:text-[28px] font-extrabold leading-tight mb-2">
          Need an auto part?<br />We&apos;ll bring it to you.
        </h3>
        <p className="text-white/85 text-sm leading-relaxed mb-5">
          Tell us what your car needs — we find it at a real store nearby and get it to your door, fast.
        </p>

        {/* Feature list */}
        <div className="space-y-2.5 mb-6">
          <div className="flex items-center gap-2.5 text-sm text-white/95">
            <span className="flex h-7 w-7 rounded-lg bg-white/15 items-center justify-center shrink-0">
              <MapPin className="h-3.5 w-3.5" />
            </span>
            Real stores near you, not guesswork
          </div>
          <div className="flex items-center gap-2.5 text-sm text-white/95">
            <span className="flex h-7 w-7 rounded-lg bg-white/15 items-center justify-center shrink-0">
              <Zap className="h-3.5 w-3.5" />
            </span>
            Same-day delivery to your door
          </div>
          <div className="flex items-center gap-2.5 text-sm text-white/95">
            <span className="flex h-7 w-7 rounded-lg bg-white/15 items-center justify-center shrink-0">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            Live tracking from store to your door
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between gap-2 bg-white rounded-xl px-4 py-3">
          <span className="text-[#b9151b] font-bold text-sm">{ctaText}</span>
          <ArrowRight className="h-4 w-4 text-[#b9151b] shrink-0" />
        </div>
      </div>
    </div>
  );
}
