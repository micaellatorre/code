// src/app/api/buyers/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getDefaultTenantId() {
    const tenant = await prisma.tenant.findFirst({
        where: { id: process.env.DEFAULT_TENANT_ID as string | undefined },
    });
    if (!tenant) {
        return process.env.DEFAULT_TENANT_ID as string | undefined;
    }
    return tenant.id;
}

export async function GET() {
  try {
    const buyers = await prisma.buyer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return NextResponse.json(buyers)
  } catch (error) {
    console.error('Failed to fetch buyers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const data = await req.json()
  const tenantId = await getDefaultTenantId()

  try {
    const newBuyer = await prisma.buyer.create({
      data: {
        ...data,
        tenantId,
      },
    })
    return NextResponse.json({ buyer: newBuyer }, { status: 201 })
  } catch (error) {
    console.error('Failed to create buyer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}