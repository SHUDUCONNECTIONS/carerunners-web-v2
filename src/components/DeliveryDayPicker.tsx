"use client"

import { useMemo } from "react"
import { deliveryDayOptions, SAME_DAY_CUTOFF_HOUR } from "@/lib/marketplaceDeliveryDay"
import { formatRand } from "@/lib/marketplace"

// "When should we deliver?" Three choices: today, tomorrow, or the day after (named by weekday).
// `surcharge` is the drive-time add-on for long trips, included in every day's price.
export function DeliveryDayPicker({
  value,
  onChange,
  surcharge = 0,
}: {
  value: string
  onChange: (date: string) => void
  surcharge?: number
}) {
  const options = useMemo(() => deliveryDayOptions(), [])
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium leading-none">Delivery day</legend>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Delivery day">
        {options.map((o) => {
          const selected = value === o.date
          return (
            <button
              key={o.date}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!o.available}
              onClick={() => onChange(o.date)}
              className={`rounded-xl border px-2 py-2.5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "border-[var(--brand-600)] bg-blue-50 text-[var(--brand-700)] ring-1 ring-[var(--brand-600)]"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-xs text-gray-500">{o.detail}</span>
              <span className="mt-0.5 block text-sm font-bold">{o.available ? formatRand(o.fee + surcharge) : `Order before ${SAME_DAY_CUTOFF_HOUR}:00`}</span>
            </button>
          )
        })}
      </div>
      {surcharge > 0 && (
        <p className="text-xs text-gray-600">Includes {formatRand(surcharge)} for the long drive to your address.</p>
      )}
    </fieldset>
  )
}
