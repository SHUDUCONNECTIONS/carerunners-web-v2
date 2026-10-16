"use client"

import React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_VERSION, TermsBlock } from "@/lib/marketplaceTerms"

function Blocks({ blocks }: { blocks: TermsBlock[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.t === "p" ? (
          <p key={i} className="text-sm text-gray-700 leading-relaxed">
            {b.text}
          </p>
        ) : (
          <ul key={i} className="list-disc pl-6 space-y-1 text-sm text-gray-700">
            {b.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )
      )}
    </>
  )
}

export default function MarketplaceTermsPage() {
  let lastPart: string | null = null
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href="/marketplace" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
        <ArrowLeft className="h-4 w-4 mr-1" /> MarketPortal
      </Link>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Care Runners MarketPortal</h1>
            <h2 className="text-lg font-semibold text-gray-700">Seller &amp; Buyer Terms and Conditions</h2>
            <p className="text-xs text-gray-500">Version {TERMS_VERSION}</p>
          </div>

          <section className="space-y-2">
            <h3 className="font-bold">1. Introduction</h3>
            <Blocks blocks={TERMS_INTRO} />
          </section>

          {TERMS_SECTIONS.map((s) => {
            const showPart = s.part && s.part !== lastPart
            lastPart = s.part
            return (
              <React.Fragment key={s.n}>
                {showPart && (
                  <h2 className="pt-4 text-base font-bold uppercase tracking-wide text-[var(--brand-700)] border-t">
                    {s.part}
                  </h2>
                )}
                <section className="space-y-2">
                  <h3 className="font-bold">
                    {s.n}. {s.title}
                  </h3>
                  <Blocks blocks={s.blocks} />
                </section>
              </React.Fragment>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
