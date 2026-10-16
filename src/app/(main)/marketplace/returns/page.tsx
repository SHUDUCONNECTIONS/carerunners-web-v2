import React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { RETURNS_EFFECTIVE_DATE, RETURNS_SECTIONS, type ReturnsBlock } from "@/lib/marketplaceReturns"

function Blocks({ blocks }: { blocks: ReturnsBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.t === "p") {
          return (
            <p key={i} className="text-sm text-gray-700 leading-relaxed">
              {b.text}
            </p>
          )
        }
        if (b.t === "ul") {
          return (
            <ul key={i} className="list-disc pl-6 space-y-1 text-sm text-gray-700">
              {b.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )
        }
        if (b.t === "terms") {
          return (
            <ul key={i} className="list-disc pl-6 space-y-1 text-sm text-gray-700">
              {b.items.map(([term, text]) => (
                <li key={term}>
                  <span className="font-semibold text-gray-900">{term}:</span> {text}
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-gray-800 leading-relaxed">
            <span className="font-semibold">{b.label}:</span> {b.text}
          </p>
        )
      })}
    </>
  )
}

export default function MarketplaceReturnsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href="/marketplace" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
        <ArrowLeft className="h-4 w-4 mr-1" /> MarketPortal
      </Link>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Care Runners MarketPortal</h1>
            <h2 className="text-lg font-semibold text-gray-700">Return, Refund and Exchange Policy</h2>
            <p className="text-xs text-gray-500">Effective {RETURNS_EFFECTIVE_DATE} · www.carerunners.co.za</p>
          </div>

          {RETURNS_SECTIONS.map((s, i) => (
            <section key={s.title} className="space-y-2">
              <h3 className="font-bold">
                {i + 1}. {s.title}
              </h3>
              <Blocks blocks={s.blocks} />
            </section>
          ))}

          <p className="border-t pt-4 text-sm italic text-gray-500">
            Care Runners Market Portal: connecting buyers and sellers through convenient, reliable marketplace services.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
