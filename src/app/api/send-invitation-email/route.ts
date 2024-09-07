import { NextRequest, NextResponse } from "next/server";
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, firmName, invitationLink } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const result = await sendInvitationEmail(email, firmName, invitationLink);

    if (result.status === 'success') {
      console.log(`Successfully sent invitation email to ${email}`);
      return NextResponse.json({ success: true });
    } else {
      console.error(`Failed to send invitation email to ${email}:`, result.error);
      return NextResponse.json(
        { error: "Failed to send invitation email" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in invitation email sending process:", error);
    return NextResponse.json(
      { error: "Failed to process invitation email sending" },
      { status: 500 }
    );
  }
}

async function sendInvitationEmail(email: string, firmName: string, invitationLink: string) {
  try {
    await resend.emails.send({
      from: 'Carerunners <no-reply@carerunners.app>',
      to: [email],
      subject: 'Invitation to Join Carerunners',
      html: `
        <p>Dear User,</p>
        <p>You have been invited to join ${firmName} on Carerunners.</p>
        <p>To accept this invitation and create your account, please click on the following link:</p>
        <p><a href="${invitationLink}">${invitationLink}</a></p>
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        <p>Welcome to Carerunners!</p>
        <p>Best regards,<br/>The Carerunners Team</p>
      `,
    });
    return { status: 'success' };
  } catch (error) {
    return { status: 'failure', error };
  }
}