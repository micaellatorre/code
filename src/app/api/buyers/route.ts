// src/app/api/buyers/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getDefaultTenantId() {
    const tenant = await prisma.tenant.findFirst({
        where: { name: 'Default' },
    });
    if (!tenant) {
        // if there is no default tenant, create one
        const newTenant = await prisma.tenant.create({
            data: {
                name: 'Default',
            },
        });
        return newTenant.id;
    }
    return tenant.id;
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