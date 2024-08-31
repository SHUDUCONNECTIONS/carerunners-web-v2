import { NextRequest, NextResponse } from "next/server";
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, amount, date, brand, customMessage } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const result = await sendSingleEmail(email, amount, date, brand, customMessage);

    if (result.status === 'success') {
      console.log(`Successfully sent email to ${email}`);
      return NextResponse.json({ success: true });
    } else {
      console.error(`Failed to send email to ${email}:`, result.error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in email sending process:", error);
    return NextResponse.json(
      { error: "Failed to process email sending" },
      { status: 500 }
    );
  }
}

async function sendSingleEmail(email: string, amount: number, date: string, brand: string, customMessage?: string) {
  try {
    await resend.emails.send({
      from: 'Carerunners <no-reply@carerunners.app>',
      to: [email],
      subject: 'Payment Succesful',
      html: `
        <p>Dear Customer,</p>
        <p>Thank you for your payment. Here is the proof of your recent transaction.</p>
        <p><strong>Amount:</strong> R${amount}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Brand:</strong> ${brand}</p>
        ${customMessage ? `<p>${customMessage}</p>` : ''}
        <p>If you have any questions, feel free to contact us.</p>
        <p>Best regards,<br/>The Carerunners Team</p>
      `,
    });
    return { status: 'success' };
  } catch (error) {
    return { status: 'failure', error };
  }
}