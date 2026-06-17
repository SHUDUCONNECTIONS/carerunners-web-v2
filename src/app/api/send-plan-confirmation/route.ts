import { NextRequest, NextResponse } from "next/server";
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, amount, date, brand, planName } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const result = await sendPlanConfirmationEmail(email, amount, date, brand, planName);

    if (result.status === 'success') {
      return NextResponse.json({ success: true });
    } else {
      console.error(`Failed to send plan confirmation email to ${email}:`, result.error);
      return NextResponse.json(
        { error: "Failed to send plan confirmation email" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in plan confirmation email sending process:", error);
    return NextResponse.json(
      { error: "Failed to process plan confirmation email sending" },
      { status: 500 }
    );
  }
}

async function sendPlanConfirmationEmail(email: string, amount: number, date: string, brand: string, planName: string) {
  try {
    await resend.emails.send({
      from: 'Carerunners <no-reply@carerunners.app>',
      to: [email],
      subject: 'Plan Subscription Confirmed',
      html: `
        <p>Dear Customer,</p>
        <p>Thank you for subscribing to our ${planName} plan. Your payment has been successfully processed.</p>
        <p>Here are the details of your subscription:</p>
        <ul>
          <li><strong>Plan:</strong> ${planName}</li>
          <li><strong>Amount:</strong> R${amount}</li>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Payment Method:</strong> ${brand}</li>
        </ul>
        <p>Your subscription is now active, and you can start enjoying all the benefits of the ${planName} plan.</p>
        <p>If you have any questions about your subscription or need assistance, please don't hesitate to contact our support team.</p>
        <p>Thank you for choosing Carerunners!</p>
        <p>Best regards,<br/>The Carerunners Team</p>
      `,
    });
    return { status: 'success' };
  } catch (error) {
    return { status: 'failure', error };
  }
}