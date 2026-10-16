// Keeps the cart until its order is actually paid. Placing an order only remembers the order's
// delivery trip on the cart (pendingRequestId); this checks that trip and:
//  - paid: empties the cart
//  - cancelled, expired or gone: forgets the order and keeps the items, so the buyer can try again
//  - still waiting for payment: leaves everything as it is
// Works however the payment finished (status page, webhook, or the buyer closing the tab).
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/utils/firebase"
import { authedFetch } from "@/utils/authedFetch"
import { EMPTY_CART, loadCart, saveCart, type Cart } from "@/lib/marketplaceCart"

export type PendingState = "none" | "unpaid"

export async function settlePendingCart(): Promise<PendingState> {
  const cart = loadCart()
  if (!cart.pendingRequestId) return "none"
  try {
    const trip = (await getDoc(doc(db, "pickupRequests", cart.pendingRequestId))).data()
    if (trip?.payment_status === "paid") {
      saveCart(EMPTY_CART)
      return "none"
    }
    if (!trip || trip.status === "cancelled") {
      saveCart(withoutPending(cart))
      return "none"
    }
    return "unpaid"
  } catch {
    // can't check right now: keep the cart as it is
    return "unpaid"
  }
}

// Cancels the cart's earlier order when the buyer places a new one instead, so its stock isn't held
// twice. Only an order still waiting for payment is cancelled; a paid one is never touched here.
export async function cancelUnpaidOrder(requestId: string): Promise<void> {
  try {
    const trip = (await getDoc(doc(db, "pickupRequests", requestId))).data()
    if (trip?.status === "awaiting-payment") {
      await authedFetch("/api/cancel-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      })
    }
  } catch {
    // if it can't be cancelled now, it still expires on its own after the payment window
  }
  saveCart(withoutPending(loadCart()))
}

export function withoutPending(cart: Cart): Cart {
  const { pendingRequestId: _drop, ...rest } = cart
  return rest
}
