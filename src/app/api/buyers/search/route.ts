
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/buyers/search?q=...
// Searches for buyers by name, surname, dni, or instagram
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const tenantId = process.env.DEFAULT_TENANT_ID as string;

    const buyers = await prisma.buyer.findMany({
      where: {
        tenantId,
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            surname: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            dni: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            instagram: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      take: 8,
      select: {
        id: true,
        name: true,
        surname: true,
        dni: true,
        instagram: true,
      },
    });

    return NextResponse.json(buyers);
  } catch (error) {
    console.error('Error searching buyers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
