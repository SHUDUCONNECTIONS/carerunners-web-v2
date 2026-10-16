// src/lib/saDate.ts
// Calendar days in South African time. Trip dates (pickupDate) are SA dates, so "today" has to be
// worked out in SA time too: new Date().toISOString() is UTC, which is still yesterday until 02:00.
export const SA_TIME_ZONE = "Africa/Johannesburg";

// YYYY-MM-DD for the day `offset` days after `now`, in South African time.
export function saDay(now: Date = new Date(), offset = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = parts.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().split("T")[0];
}
