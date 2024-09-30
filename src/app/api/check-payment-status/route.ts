// app/api/check-payment-status/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Missing or invalid payment ID' }, { status: 400 });
  }

  const entityId = process.env.ENTITY_ID;
  const authBearerToken = process.env.BEARER_TOKEN;

  try {
    const response = await fetch(`https://card.peachpayments.com/v1/checkouts/${id}/payment?entityId=${entityId}`, {
      method: 'GET',
      headers: {
        'Authorization': authBearerToken,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Errorss checking payment status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
