// app/api/prepare-checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import querystring from 'querystring';

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ message: 'Method Not Allowed' }, {
status: 405 });
  }

  const ENTITY_ID = process.env.ENTITY_ID;
  const BEARER_TOKEN = process.env.BEARER_TOKEN;

  let price: unknown;
  try {
    const body = await req.json();
    price = body?.price;
  } catch (error) {
    console.error('Error parsing checkout request body:', error);
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  if (!price) {
    return NextResponse.json({ message: 'Price is required' }, { status: 400 });
  }

  const path = '/v1/checkouts';
  const data = querystring.stringify({
    entityId: ENTITY_ID,
    amount: price,
    currency: 'ZAR',
    paymentType: 'DB',
  });

  const options = {
    host: 'card.peachpayments.com',
    port: 443,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': data.length,
      'Authorization': BEARER_TOKEN,
    },
  };

  try {
    const result = await new Promise((resolve, reject) => {
      const postRequest = https.request(options, (response) => {
        const buf: any[] = [];
        response.on('data', (chunk) => {
          buf.push(Buffer.from(chunk));
        });
        response.on('end', () => {
          const jsonString = Buffer.concat(buf).toString('utf8');
          try {
            resolve(JSON.parse(jsonString));
          } catch (parseError) {
            reject(parseError);
          }
        });
      });

      postRequest.on('error', (error) => {
        reject(error);
      });

      postRequest.write(data);
      postRequest.end();
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error processing payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, {
status: 500 });
  }
}