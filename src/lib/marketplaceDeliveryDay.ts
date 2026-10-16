// src/lib/marketplaceDeliveryDay.ts
// The buyer picks the day they want a MarketPortal order delivered: today, tomorrow, or the day after
// (shown by its weekday name, e.g. "Thursday"). Days are worked out in South African time so
// "today" doesn't flip at 2am. The server checks the chosen date against the same list.
import { SA_TIME_ZONE as TZ, saDay } from "./saDate";

// Fixed delivery prices (rand) for our drivers: the sooner it arrives, the more it costs. The same price
// applies wherever a driver can reach in a day. Index 0 = today, 1 = tomorrow, 2 = the day after.
export const DELIVERY_FEES = [149, 99, 69] as const;
// Same-day delivery can only be chosen before this hour (South African time, 24h clock).
export const SAME_DAY_CUTOFF_HOUR = 10;

// Who delivers (decided by driving time and province, never by distance):
//  - "driver":  our drivers, anywhere in the seller's province, and in other provinces up to
//               MAX_OUT_OF_PROVINCE_HOURS' drive. Priced by delivery day plus a drive-time surcharge.
//  - "courier": another province, further than that: another courier company, booked by an admin,
//               at a flat COURIER_FEE.
export type DeliveryZone = "driver" | "courier";
export const MAX_OUT_OF_PROVINCE_HOURS = 4;
// Never less than our dearest driver trip (same day + the biggest surcharge = R349), so a further
// address never costs less than a nearer one.
export const COURIER_FEE = 350;
export const COURIER_ETA = "3–5 working days";
// Long driver trips cost more: the largest surcharge whose drive time (one way, minutes) is passed.
export const DRIVE_SURCHARGES = [
  { overMinutes: 90, amount: 100 },
  { overMinutes: 180, amount: 200 },
] as const;
// Used only when Google can't give a driving time: an average speed for the estimate (km/h).
export const FALLBACK_SPEED_KMH = 80;

// One-way driving time in minutes; estimated from the distance when Google couldn't say.
export function driveMinutes(km: number, minutes: number | null): number {
  return minutes ?? (km / FALLBACK_SPEED_KMH) * 60;
}

// Only needs the province when the drive is longer than the out-of-province limit.
export const needsProvinceCheck = (drive: number) => drive > MAX_OUT_OF_PROVINCE_HOURS * 60;

// `sameProvince`: whether the address is in the seller's province (null = unknown, treated as another province).
export function deliveryZone(drive: number, sameProvince: boolean | null): DeliveryZone {
  return !needsProvinceCheck(drive) || sameProvince === true ? "driver" : "courier";
}

export const isCourier = (zone: DeliveryZone) => zone === "courier";

export function driveSurcharge(drive: number): number {
  return DRIVE_SURCHARGES.reduce((n, s) => (drive > s.overMinutes ? s.amount : n), 0);
}

// The delivery fee: the courier's flat price, or the chosen day's price plus the drive-time surcharge.
export function deliveryFeeFor(zone: DeliveryZone, date: string, surcharge: number, now: Date = new Date()): number | null {
  if (zone === "courier") return COURIER_FEE;
  const fee = deliveryFeeForDate(date, now);
  return fee === null ? null : fee + surcharge;
}

export function zoneLabel(zone: DeliveryZone | undefined): string {
  return zone === "courier" ? "Outside courier" : "Care Runners driver";
}

export type DeliveryDayOption = {
  date: string; // YYYY-MM-DD
  label: string; // "Today", "Tomorrow", "Thursday"
  detail: string; // "Tue 13 Oct"
  fee: number; // fixed delivery price for this day, in rand
  available: boolean; // false once today's cut-off has passed
};

// YYYY-MM-DD for the calendar day `offset` days after `now`, in South African time.
const dayString = (now: Date, offset: number) => saDay(now, offset);

function format(date: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d)));
}

function hourInSA(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
}

export function deliveryDayOptions(now: Date = new Date()): DeliveryDayOption[] {
  return [0, 1, 2].map((offset) => {
    const date = dayString(now, offset);
    return {
      date,
      label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : format(date, { weekday: "long" }),
      detail: format(date, { weekday: "short", day: "numeric", month: "short" }),
      fee: DELIVERY_FEES[offset],
      available: offset > 0 || hourInSA(now) < SAME_DAY_CUTOFF_HOUR,
    };
  });
}

export function isAllowedDeliveryDate(date: unknown, now: Date = new Date()): date is string {
  return typeof date === "string" && deliveryDayOptions(now).some((o) => o.date === date && o.available);
}

// The day shown selected when the buyer opens the page: the soonest one they can still choose.
export function defaultDeliveryDate(now: Date = new Date()): string {
  return (deliveryDayOptions(now).find((o) => o.available) ?? deliveryDayOptions(now)[1]).date;
}

export function deliveryFeeForDate(date: string, now: Date = new Date()): number | null {
  const o = deliveryDayOptions(now).find((x) => x.date === date && x.available);
  return o ? o.fee : null;
}

export function deliveryTimeText(date: string, now: Date = new Date()): string {
  const option = deliveryDayOptions(now).find((o) => o.date === date);
  if (!option) return "Any time";
  return option.label === "Today" ? "Any time today" : option.label === "Tomorrow" ? "Any time tomorrow" : `Any time on ${option.label}`;
}
