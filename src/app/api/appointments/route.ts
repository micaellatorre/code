// app/api/appointments/route.ts
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/auth";
import { resolveSessionTenantId } from "@/lib/tenant";
import { productCatalogDisplayInclude } from "@/lib/products/selects";

// GET: lista de todas las citas
export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [
        { buyer: { is: { tenantId } } },
        { user: { is: { tenantId } } },
        { interests: { some: { product: { tenantId } } } },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      buyer: true,
      interests: { include: { product: { include: productCatalogDisplayInclude } } },
    },
    orderBy: { scheduledAt: "desc" },
  });
  return NextResponse.json(appointments);
}

// POST: crea una nueva cita
export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  let body: {
    buyerId?: string;
    scheduledAt?: string;
    durationMinutes?: number | string;
    notes?: string;
    outcome?: "PENDIENTE" | "VENTA_CONCRETADA" | "NO_SE_CONCRETO" | "SENADO" | "SENADO_EN_CAMINO" | "SENADO_EN_STOCK";
    interests?: { productId: string; notes?: string; priority?: number }[];
    deposits?: { amount?: number | string }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { buyerId, scheduledAt, durationMinutes, notes, outcome, interests, deposits } = body;

  if (!buyerId) {
    return NextResponse.json(
      { error: "La cita debe estar asociada a un cliente." },
      { status: 400 }
    );
  }

  if (!scheduledAt) {
    return NextResponse.json(
      { error: "La fecha y hora de la cita son obligatorias." },
      { status: 400 }
    );
  }

  try {
    const txResult = await prisma.$transaction(
      async (tx) => {
        const userId = auth.session?.user?.id || null;
        const tenantId = await resolveSessionTenantId(auth.session.user.tenantId);

        if (!userId || !tenantId) {
          throw new Error("Usuario no autenticado");
        }

        const hasDeposit = Array.isArray(deposits) && deposits.some((deposit) => Number(deposit.amount || 0) > 0);
        const productIds = interests?.map((interest) => interest.productId).filter(Boolean) ?? [];
        let derivedOutcome = outcome || "PENDIENTE";

        const buyer = await tx.buyer.findFirst({ where: { id: buyerId, tenantId }, select: { id: true } });
        if (!buyer) throw new Error("Cliente no disponible para el tenant actual");

        if (productIds.length > 0) {
          const productsInTenant = await tx.product.findMany({
            where: { id: { in: productIds }, tenantId },
            select: { id: true, state: true },
          });
          if (productsInTenant.length !== new Set(productIds).size) {
            throw new Error("Todos los productos de interes deben pertenecer al tenant actual");
          }

          if (!outcome && hasDeposit) {
            if (productsInTenant.some((product) => product.state === "EN_STOCK")) derivedOutcome = "SENADO_EN_STOCK";
            else if (productsInTenant.some((product) => product.state === "EN_CAMINO")) derivedOutcome = "SENADO_EN_CAMINO";
            else derivedOutcome = "SENADO";
          }
        }

        const appointment = await tx.appointment.create({
          data: {
            userId: userId,
            buyerId,
            scheduledAt: new Date(scheduledAt),
            durationMinutes: durationMinutes
              ? parseInt(String(durationMinutes), 10)
              : null,
            resultNotes: notes || null,
            status: "PROGRAMADA",
            outcome: derivedOutcome,
            interests: {
              create:
                interests?.map((interest) => ({
                  productId: interest.productId,
                  notes: interest.notes,
                  priority: interest.priority,
                })) || [],
            },
          },
        });

        if (hasDeposit && productIds.length > 0) {
          await tx.product.updateMany({
            where: { id: { in: productIds }, tenantId },
            data: { senado: true, senadoAt: new Date() },
          });
        }

        return appointment;
      }
    );

    // Lectura FUERA de la transacción para devolver el objeto completo
    const createdAppointment = await prisma.appointment.findUnique({
      where: { id: txResult.id },
      include: {
        buyer: true,
        interests: {
          include: {
            product: { include: productCatalogDisplayInclude },
          },
        },
      },
    });

    return NextResponse.json(createdAppointment, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al crear la cita";
    console.error("Error creating appointment:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
