"use client"

import React, { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/utils/firebase"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import LoadingComponent from "@/components/loader"
import { MARKET_ORDERS, MarketOrder, formatRand, orderFromDoc, orderLines } from "@/lib/marketplace"

export default function ReceiptPage() {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <Receipt />
    </Suspense>
  )
}

// A printable summary of one MarketPortal order. It is a receipt, not a VAT tax invoice.
function Receipt() {
  const id = useSearchParams().get("id")
  const [order, setOrder] = useState<MarketOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        if (id) {
          const snap = await getDoc(doc(db, MARKET_ORDERS, id))
          if (snap.exists() && snap.data().buyerId === auth.currentUser?.uid) setOrder(orderFromDoc(snap.id, snap.data()))
        }
      } catch (err) {
        console.error("Error loading receipt:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <LoadingComponent />

  if (!order) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <p className="text-gray-600">We couldn&apos;t find that order.</p>
        <Button asChild>
          <Link href="/marketplace/my-listings">My purchases</Link>
        </Button>
      </div>
    )
  }

  const lines = orderLines(order)
  const delivery = order.deliveryCharged ?? order.deliveryFee
  const paid = order.status === "paid"

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/marketplace/my-listings" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="mr-1 h-4 w-4" /> My purchases
        </Link>
        <Button variant="outline" onClick={() => window.print()}>
          Print receipt
        </Button>
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order receipt</h1>
            <p className="text-sm text-gray-600">Care Runners MarketPortal</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Order {order.id}</p>
            <p>{order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-ZA") : ""}</p>
            <p className="font-semibold text-gray-900">{paid ? "Paid" : order.status === "cancelled" ? "Cancelled" : "Awaiting payment"}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.listingId} className="border-b border-gray-200">
                <td className="py-2 pr-2 text-gray-900">{l.title}</td>
                <td className="py-2 text-right">{l.quantity}</td>
                <td className="py-2 text-right">{formatRand(l.unitPrice)}</td>
                <td className="py-2 text-right">{formatRand(l.unitPrice * l.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Items</span>
            <span>{formatRand(order.itemPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Delivery</span>
            <span>{formatRand(order.deliveryFee)}</span>
          </div>
          {(order.deliverySubsidy ?? 0) > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Delivery discount</span>
              <span>{formatRand(order.deliverySubsidy)} off</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-300 pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatRand(order.itemPrice + delivery)}</span>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-900">Delivered to:</span> {order.deliveryAddress}
          </p>
          <p>
            <span className="font-medium text-gray-900">Contact:</span> {order.buyerPhone}
          </p>
        </div>
      </div>
    </div>
  )
}
