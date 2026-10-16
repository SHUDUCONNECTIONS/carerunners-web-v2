import { MapPin, Truck } from "lucide-react"
import { formatRand } from "@/lib/marketplace"
import { COURIER_ETA, DELIVERY_FEES, MAX_OUT_OF_PROVINCE_HOURS } from "@/lib/marketplaceDeliveryDay"

// One line before the buyer enters an address: where it ships from and the lowest delivery price.
// The exact price for their address shows up once they pick it (day picker or courier box).
export function DeliveryAreaNotice({ from, compact = false }: { from?: string; compact?: boolean }) {
  return (
    <p
      className={`flex items-center gap-2 text-sm text-gray-600 ${
        compact ? "rounded-xl border border-gray-200 bg-white px-4 py-2.5" : ""
      }`}
    >
      <MapPin className="h-4 w-4 shrink-0 text-[var(--brand-600)]" />
      <span>
        {compact ? "We deliver nationwide" : from ? `Ships from ${from}` : "Delivered by Care Runners"} · from{" "}
        <b className="text-gray-900">{formatRand(DELIVERY_FEES[2])}</b>
      </span>
    </p>
  )
}

// Shown in place of the delivery-day picker when the address is too far for our drivers.
export function CourierDelivery({ fee }: { fee: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <Truck className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">
          Courier delivery · {COURIER_ETA} · {formatRand(fee)}
        </p>
        <p className="text-amber-900">Too far for our drivers ({MAX_OUT_OF_PROVINCE_HOURS}+ hours away), so it goes with a courier partner.</p>
      </div>
    </div>
  )
}
