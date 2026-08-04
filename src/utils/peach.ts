// src/utils/peach.ts
// Server-only wrapper around Peach Payments' Checkout API, shared by
// prepare-checkout and check-payment-status so both routes read the same
// env vars and result-code logic instead of re-implementing it.
const PEACH_HOST = process.env.PEACH_HOST || "card.peachpayments.com";
const ENTITY_ID = process.env.ENTITY_ID;
const rawBearerToken = process.env.BEARER_TOKEN;
const BEARER_TOKEN =
  rawBearerToken && !rawBearerToken.startsWith("Bearer ")
    ? `Bearer ${rawBearerToken}`
    : rawBearerToken;

export async function createCheckout({
  amount,
  currency = "ZAR",
}: {
  amount: string;
  currency?: string;
}) {
  const body = new URLSearchParams({
    entityId: ENTITY_ID || "",
    amount,
    currency,
    paymentType: "DB",
  });

  const res = await fetch(`https://${PEACH_HOST}/v1/checkouts`, {
    method: "POST",
    headers: {
      Authorization: BEARER_TOKEN || "",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return res.json();
}

export async function getPaymentStatus(checkoutId: string) {
  const res = await fetch(
    `https://${PEACH_HOST}/v1/checkouts/${checkoutId}/payment?entityId=${ENTITY_ID}`,
    { headers: { Authorization: BEARER_TOKEN || "" } }
  );
  return res.json();
}

// Peach/OPPWA result codes: 000.000.*, 000.100.1xx and 000.[36]xx mean success.
export function isSuccessCode(code: unknown) {
  return typeof code === "string" && /^(000\.000\.|000\.100\.1|000\.[36])/.test(code);
}

export function isPendingCode(code: unknown) {
  return typeof code === "string" && /^(000\.200\.|000\.400\.[01]|100\.|200\.)/.test(code);
}
