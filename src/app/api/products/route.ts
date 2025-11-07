import { prisma } from '@/lib/prisma';
import { ProductSate, ProductType } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * API para listar y crear productos.
 * GET /api/products?state=EN_STOCK&type=PHONE&q=iPhone
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state') as ProductSate | null;
    const type = searchParams.get('type') as ProductType | null;
    const q = searchParams.get('q');

    const tenantId = process.env.DEFAULT_TENANT_ID as string;

    const where: any = {
      tenantId,
    };

    if (state) {
      where.state = state;
    }

    if (type) {
      where.type = type;
    }

    if (q) {
      where.modelName = {
        contains: q,
        mode: 'insensitive',
      };
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  try {
    // If tenant isn't provided (no auth yet), fall back to the default tenant id
    const data = { ...body, tenantId: (body.tenantId ?? process.env.DEFAULT_TENANT_ID as string) };
    const product = await prisma.product.create({ data });
    return NextResponse.json(product, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Error creando producto' }, { status: 500 });
  }
}