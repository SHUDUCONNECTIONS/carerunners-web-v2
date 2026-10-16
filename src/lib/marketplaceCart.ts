// The shopping cart. It lives in the buyer's browser (localStorage) until the
// order is PAID; prices and stock are always re-read from the server when the
// order is placed. One cart holds items from one store only, because a delivery
// collects from a single pickup address.
export interface CartLine {
  listingId: string
  title: string
  image: string | null
  unitPrice: number
  stock: number | null
  quantity: number
}

export interface Cart {
  sellerId: string
  sellerName: string
  items: CartLine[]
  /** The delivery trip of an order placed from this cart and not paid yet (see marketplaceCartSync). */
  pendingRequestId?: string
}

export const EMPTY_CART: Cart = { sellerId: "", sellerName: "", items: [] }
export const MAX_CART_LINES = 20

const KEY = "carerunners-market-cart"
const EVENT = "carerunners-market-cart-changed"

// Units a buyer can still add: stock for tracked items, one for one-off items.
export function maxQuantity(stock: number | null): number {
  return stock === null ? 1 : Math.max(0, stock)
}

export function clampQuantity(quantity: number, stock: number | null): number {
  const q = Math.floor(Number(quantity)) || 1
  return Math.min(Math.max(1, q), Math.max(1, maxQuantity(stock)))
}

export type AddResult = { cart: Cart; error?: string }

export function addToCart(
  cart: Cart,
  seller: { id: string; name: string },
  line: Omit<CartLine, "quantity">,
  quantity: number
): AddResult {
  if (cart.items.length > 0 && cart.sellerId !== seller.id) {
    return { cart, error: `Your cart has items from ${cart.sellerName || "another store"}. Check out or empty it first.` }
  }
  if (maxQuantity(line.stock) < 1) return { cart, error: "This item is out of stock." }
  const existing = cart.items.find((i) => i.listingId === line.listingId)
  if (!existing && cart.items.length >= MAX_CART_LINES) {
    return { cart, error: `A cart holds up to ${MAX_CART_LINES} different items.` }
  }
  const items = existing
    ? cart.items.map((i) =>
        i.listingId === line.listingId
          ? { ...i, unitPrice: line.unitPrice, stock: line.stock, quantity: clampQuantity(i.quantity + quantity, line.stock) }
          : i
      )
    : [...cart.items, { ...line, quantity: clampQuantity(quantity, line.stock) }]
  return { cart: { ...cart, sellerId: seller.id, sellerName: seller.name, items } }
}

export function setLineQuantity(cart: Cart, listingId: string, quantity: number): Cart {
  return { ...cart, items: cart.items.map((i) => (i.listingId === listingId ? { ...i, quantity: clampQuantity(quantity, i.stock) } : i)) }
}

export function removeLine(cart: Cart, listingId: string): Cart {
  const items = cart.items.filter((i) => i.listingId !== listingId)
  return items.length === 0 ? EMPTY_CART : { ...cart, items }
}

export const cartCount = (cart: Cart) => cart.items.reduce((n, i) => n + i.quantity, 0)
export const cartSubtotal = (cart: Cart) => cart.items.reduce((n, i) => n + i.unitPrice * i.quantity, 0)

// ── browser storage ─────────────────────────────────────────────────────────
export function loadCart(): Cart {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && Array.isArray(parsed.items)) return parsed as Cart
  } catch {
    // storage unavailable or corrupt: start with an empty cart
  }
  return EMPTY_CART
}

export function saveCart(cart: Cart) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cart))
  } catch {
    // storage full or blocked: the cart just won't persist
  }
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeCart(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}
