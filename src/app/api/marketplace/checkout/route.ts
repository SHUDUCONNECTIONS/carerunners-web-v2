// app/api/marketplace/checkout/route.ts
// Server-authoritative MarketPortal purchase. The order can hold several
// products from one store (a cart): prices come from the listings (never the
// client), stock is taken so two buyers can't both get the last unit, and ONE
// Care Runners delivery trip is created in pickupRequests so it goes through the
// normal payment -> driver assignment -> tracking flow with a single delivery fee.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/utils/requireAuth";
import { adminDb } from "@/utils/firebaseAdmin";
import {
  MARKET_LISTINGS,
  MARKET_ORDERS,
  MARKET_PICKUP,
  RESERVATION_MINUTES,
  orderSummaryText,
  type MarketOrderLine,
} from "@/lib/marketplace";
import { googleDrivingRoute } from "@/utils/drivingDistance";
import { TERMS_VERSION } from "@/lib/marketplaceTerms";
import { releaseExpiredOrders } from "@/utils/marketplaceStock";
import { isRateLimited } from "@/utils/rateLimit";
import {
  COURIER_ETA,
  isAllowedDeliveryDate,
  defaultDeliveryDate,
  deliveryDayOptions,
  deliveryFeeFor,
  deliveryTimeText,
  deliveryZone,
  driveMinutes,
  driveSurcharge,
  isCourier,
  needsProvinceCheck,
} from "@/lib/marketplaceDeliveryDay";
import { inSameProvince } from "@/utils/province";
import { getMarketSettings } from "@/utils/marketplaceSettings";
import { sendLowStockAlert } from "@/utils/email";

// An email goes to the admins when an item drops to this many units or fewer.
const LOW_STOCK = 10;
import { belowMinimum, deliveryCharge } from "@/lib/marketplaceSettings";

const MAX_QTY_PER_LINE = 1000;
const MAX_LINES = 20;

type Body = {
  items?: { listingId?: string; quantity?: number }[];
  // a single product, as sent before carts existed
  listingId?: string;
  quantity?: number;
  deliveryAddress?: string;
  phone?: string;
  // YYYY-MM-DD: today (before the cut-off), tomorrow or the day after (see marketplaceDeliveryDay).
  deliveryDate?: string;
  termsAccepted?: boolean;
  deliveryLat?: number;
  deliveryLng?: number;
};

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [{ listingId: body.listingId, quantity: body.quantity }];
  if (rawItems.length < 1 || rawItems.length > MAX_LINES) {
    return NextResponse.json({ message: `An order holds 1 to ${MAX_LINES} different items.` }, { status: 400 });
  }
  const wanted = new Map<string, number>();
  for (const it of rawItems) {
    const quantity = it.quantity === undefined ? 1 : Number(it.quantity);
    if (!it.listingId || typeof it.listingId !== "string" || wanted.has(it.listingId)) {
      return NextResponse.json({ message: "Each item can only be on the order once." }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_LINE) {
      return NextResponse.json({ message: "Enter a valid quantity." }, { status: 400 });
    }
    wanted.set(it.listingId, quantity);
  }

  const deliveryAddress = body.deliveryAddress?.trim();
  const phone = body.phone?.trim();
  const dropoff = { lat: Number(body.deliveryLat), lng: Number(body.deliveryLng) };
  if (!deliveryAddress || !phone || deliveryAddress.length > 300 || phone.length > 30 || !Number.isFinite(dropoff.lat) || !Number.isFinite(dropoff.lng)) {
    return NextResponse.json(
      { message: "Delivery address (chosen from suggestions) and phone are required" },
      { status: 400 }
    );
  }
  // Checked once the zone is known: courier orders don't pick a day.
  let deliveryDate = body.deliveryDate === undefined ? defaultDeliveryDate() : body.deliveryDate;
  if (body.termsAccepted !== true) {
    return NextResponse.json({ message: "You must accept the Terms and Conditions to buy" }, { status: 400 });
  }

  const db = adminDb();
  const ids = [...wanted.keys()];
  const listingRefs = ids.map((id) => db.collection(MARKET_LISTINGS).doc(id));
  const orderRef = db.collection(MARKET_ORDERS).doc();
  const requestId = `${user.uid}_${Date.now()}`;
  const tripRef = db.collection("pickupRequests").doc(requestId);

  try {
    if (await isRateLimited(db, `checkout_${user.uid}`, 10, 60)) {
      return NextResponse.json({ message: "Too many order attempts. Please wait a minute and try again." }, { status: 429 });
    }
    // Unpaid orders past their payment window give their stock back before we check it.
    await releaseExpiredOrders(db);

    const buyerName = (await db.collection("users").doc(user.uid).get()).data()?.name ?? user.email ?? "";

    // Driving distance comes from Google (a network call), so it's worked out before
    // the transaction. All products on an order come from one store, so one pickup point.
    const pickupPre = await db.collection(MARKET_PICKUP).doc(ids[0]).get();
    if (!pickupPre.exists) return NextResponse.json({ message: "Item not found" }, { status: 404 });
    // Priced to the delivery address the driver will go to, not the coordinates the browser sent,
    // so a buyer can't send coordinates next to the store and pay the shortest-distance fee.
    const from = { lat: pickupPre.data()!.lat, lng: pickupPre.data()!.lng };
    const route = await googleDrivingRoute(from, deliveryAddress);
    if (route === null) {
      return NextResponse.json(
        { message: "We couldn't find a driving route to that delivery address. Please choose it from the suggestions." },
        { status: 422 }
      );
    }
    const { km } = route;
    const drive = driveMinutes(km, route.minutes);
    // Our drivers within the province and up to a few hours into other provinces; otherwise another
    // courier, booked by an admin.
    const sameProvince = needsProvinceCheck(drive) ? await inSameProvince(from, deliveryAddress) : null;
    const zone = deliveryZone(drive, sameProvince);
    const courier = isCourier(zone);
    const surcharge = courier ? 0 : driveSurcharge(drive);
    if (courier) {
      deliveryDate = deliveryDayOptions()[0].date; // the order date; the courier sets the delivery day
    } else if (!isAllowedDeliveryDate(deliveryDate)) {
      return NextResponse.json({ message: "That delivery day isn't available. Please choose one of the days shown." }, { status: 400 });
    }
    // Fixed price for the zone (or the chosen day), whatever the distance; never a price sent by the browser.
    const deliveryFee = deliveryFeeFor(zone, deliveryDate, surcharge)!;
    const settings = await getMarketSettings(db);

    const lowStock: { title: string; left: number }[] = [];
    const result = await db.runTransaction(async (tx) => {
      lowStock.length = 0; // the transaction can run more than once
      // All reads first, then all writes.
      const snaps = await Promise.all(listingRefs.map((r) => tx.get(r)));
      const pickupSnap = await tx.get(db.collection(MARKET_PICKUP).doc(ids[0]));
      if (!pickupSnap.exists || snaps.some((s) => !s.exists)) return { status: 404, message: "An item on your order was not found." };

      const sellerId = snaps[0].data()!.sellerId;
      const lines: MarketOrderLine[] = [];
      const stockWrites: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];

      for (const snap of snaps) {
        const l = snap.data()!;
        const quantity = wanted.get(snap.id)!;
        if (l.sellerId !== sellerId) {
          return { status: 400, message: "An order can only hold items from one store. Please order them separately." };
        }
        if (l.sellerId === user.uid) return { status: 403, message: "You can't buy your own item" };

        const reservedAt = l.reservedAt?.toMillis?.() ?? 0;
        const reservationExpired = Date.now() - reservedAt > RESERVATION_MINUTES * 60 * 1000;
        const available = l.status === "active" || (l.status === "reserved" && reservationExpired);
        if (!available || l.sellingPrice == null) {
          return { status: 409, message: `Sorry, "${l.title}" is no longer available.` };
        }

        const tracked = typeof l.stock === "number";
        if (!tracked && quantity !== 1) {
          return { status: 400, message: `"${l.title}" is a one-off item: quantity must be 1.` };
        }
        if (tracked && l.stock < quantity) {
          return {
            status: 409,
            message: l.stock > 0 ? `Only ${l.stock} of "${l.title}" left in stock.` : `Sorry, "${l.title}" is out of stock.`,
          };
        }

        if (tracked) {
          // Take the units now. The listing only shows as reserved when the last
          // unit goes; it returns to "active" if the order is cancelled.
          const left = l.stock - quantity;
          if (l.stock > LOW_STOCK && left <= LOW_STOCK) lowStock.push({ title: l.title, left });
          stockWrites.push({
            ref: snap.ref,
            data: {
              stock: left,
              updatedAt: FieldValue.serverTimestamp(),
              ...(left === 0
                ? { status: "reserved", reservedAt: FieldValue.serverTimestamp(), reservedBy: user.uid, reservedOrderId: orderRef.id }
                : {}),
            },
          });
        } else {
          stockWrites.push({
            ref: snap.ref,
            data: { status: "reserved", reservedAt: FieldValue.serverTimestamp(), reservedBy: user.uid, reservedOrderId: orderRef.id },
          });
        }

        lines.push({
          listingId: snap.id,
          title: l.title,
          image: l.images?.[0] ?? null,
          quantity,
          unitPrice: Number(l.sellingPrice),
          sellerUnitPrice: Number(l.askingPrice),
          markupUnit: Number(l.markupAmount ?? 0),
        });
      }

      const itemPrice = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
      const sellerPrice = lines.reduce((n, l) => n + l.sellerUnitPrice * l.quantity, 0);
      const markupAmount = lines.reduce((n, l) => n + l.markupUnit * l.quantity, 0);
      const units = lines.reduce((n, l) => n + l.quantity, 0);
      if (belowMinimum(settings, itemPrice)) {
        return { status: 400, message: `The minimum order is R${settings.minOrderAmount}. Add more items to continue.` };
      }
      // The driver is paid from the full fee; any discount is paid by Care Runners.
      const delivery = deliveryCharge(settings, itemPrice, deliveryFee);
      const pickup = pickupSnap.data()!;
      const title = lines.length === 1 ? lines[0].title : `${lines[0].title} + ${lines.length - 1} more`;
      const summary = orderSummaryText(lines);

      for (const w of stockWrites) tx.update(w.ref, w.data);

      tx.set(orderRef, {
        // top-level fields describe the first product so older screens keep working
        listingId: lines[0].listingId,
        listingTitle: title,
        listingImage: lines[0].image,
        items: lines,
        listingIds: lines.map((l) => l.listingId),
        buyerId: user.uid,
        buyerName,
        buyerPhone: phone,
        sellerId,
        deliveryOption: "delivery",
        deliveryMethod: courier ? "courier" : "driver",
        deliveryZone: zone,
        deliverySurcharge: surcharge,
        deliveryDriveMinutes: Math.round(drive),
        deliveryAddress,
        quantity: units,
        itemPrice,
        sellerPrice,
        markupAmount,
        deliveryFee,
        deliverySubsidy: delivery.subsidy,
        deliveryCharged: delivery.charged,
        deliveryDistanceKm: km,
        totalAmount: itemPrice + delivery.charged,
        status: "awaiting-payment",
        sellerPaidOut: false,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: FieldValue.serverTimestamp(),
        tripId: requestId,
        createdAt: FieldValue.serverTimestamp(),
      });

      // The trip's price is the delivery fee only, so driver payouts and
      // billing stay correct. The buyer is charged price + marketItemAmount
      // (see prepare-checkout) and Care Runners pays the seller afterwards.
      tx.set(tripRef, {
        userId: user.uid,
        attorneyName: buyerName,
        serviceType: "parcel_delivery",
        requestType: "marketplace",
        documentDescription: `MarketPortal order: ${summary}`,
        pickupLocation: pickup.address,
        dropoffLocation: deliveryAddress,
        pickupDate: deliveryDate,
        pickupTime: courier ? `Courier, ${COURIER_ETA}` : deliveryTimeText(deliveryDate),
        // Courier orders never go to drivers: once paid they wait for an admin to book the courier.
        deliveryMethod: courier ? "courier" : "driver",
        deliveryZone: zone,
        senderName: snaps[0].data()!.sellerName ?? "",
        senderNumber: pickup.phone ?? "",
        receiverName: buyerName,
        receiverNumber: phone,
        specialInstructions: "",
        distance: km.toFixed(2),
        price: deliveryFee,
        marketItemAmount: itemPrice,
        marketDeliveryDiscount: delivery.subsidy,
        marketOrderId: orderRef.id,
        marketListingId: lines[0].listingId,
        marketItems: lines.map((l) => ({ title: l.title, quantity: l.quantity, unitPrice: l.unitPrice })),
        itemPhotoUrl: lines[0].image,
        status: "awaiting-payment",
        payment_status: "unpaid",
        createdAt: new Date(),
      });
      return null;
    });

    if (result) return NextResponse.json({ message: result.message }, { status: result.status });
    if (lowStock.length > 0) {
      const base = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
      void sendLowStockAlert({ items: lowStock, link: `${base}/admin/marketplace` });
    }
    return NextResponse.json({ requestId, orderId: orderRef.id });
  } catch (err) {
    console.error("Error creating marketplace checkout:", err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
