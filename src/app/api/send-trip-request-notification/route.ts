import { NextRequest, NextResponse } from "next/server";
import { Resend } from 'resend';
import { ADMIN_EMAILS } from "@/utils/adminEmails";

// Constructing this at module scope with a missing key throws immediately,
// which fails `next build`'s page-data collection for this route (and takes
// the whole build down with it) rather than just this one email failing at
// request time. Defer construction until a request actually needs it.
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function POST(request: NextRequest) {
  try {
    const {
      pickupLocation,
      dropoffLocation,
      pickupDate,
      pickupTime,
      price,
      customerEmail,
      origin,
    } = await request.json();

    const result = await sendAdminNotification({
      pickupLocation,
      dropoffLocation,
      pickupDate,
      pickupTime,
      price,
      customerEmail,
      origin,
    });

    if (result.status === 'success') {
      return NextResponse.json({ success: true });
    } else {
      console.error("Failed to send admin trip notification:", result.error);
      return NextResponse.json(
        { error: "Failed to send admin trip notification" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in admin trip notification sending process:", error);
    return NextResponse.json(
      { error: "Failed to process admin trip notification" },
      { status: 500 }
    );
  }
}

async function sendAdminNotification(trip: {
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupDate?: string;
  pickupTime?: string;
  price?: number | string;
  customerEmail?: string;
  origin?: string;
}) {
  try {
    const link = trip.origin ? `${trip.origin}/admin/requests` : "/admin/requests";
    await getResend().emails.send({
      from: 'Carerunners <no-reply@carerunners.app>',
      to: ADMIN_EMAILS,
      subject: 'New Pickup Request Awaiting a Driver',
      html: `
        <p>A new trip has been booked and paid for, and is now waiting for a driver.</p>
        <p><strong>Customer:</strong> ${trip.customerEmail || "Unknown"}</p>
        <p><strong>Pickup:</strong> ${trip.pickupLocation || "—"}</p>
        <p><strong>Dropoff:</strong> ${trip.dropoffLocation || "—"}</p>
        <p><strong>Scheduled:</strong> ${trip.pickupDate || "—"} ${trip.pickupTime || ""}</p>
        <p><strong>Price:</strong> R${trip.price ?? "—"}</p>
        <p><a href="${link}">View requested trips</a></p>
      `,
    });
    return { status: 'success' };
  } catch (error) {
    return { status: 'failure', error };
  }
}
