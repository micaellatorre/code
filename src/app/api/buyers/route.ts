
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/buyers
// Creates a new buyer
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, surname, dob, phone, instagram, email, cuit, dni } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const tenantId = process.env.DEFAULT_TENANT_ID as string;

    const newBuyer = await prisma.buyer.create({
      data: {
        tenantId,
        name,
        surname,
        dob: dob ? new Date(dob) : null,
        phone,
        instagram,
        email,
        cuit,
        dni,
      },
    });

    return NextResponse.json(newBuyer, { status: 201 });
  } catch (error) {
    console.error('Error creating buyer:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
