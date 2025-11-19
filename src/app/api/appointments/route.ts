
// app/api/appointments/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET: lista de todas las citas
export async function GET() {
  const appointments = await prisma.appointment.findMany({
    include: {
      buyer: true,
      interests: { include: { product: true } },
    },
    orderBy: { scheduledAt: "desc" },
  });
  return NextResponse.json(appointments);
}

// POST: crea una nueva cita
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { buyerId, scheduledAt, durationMinutes, notes, interests } = body;

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
    const txResult = await prisma.$transaction(async (tx) => {
      const tenantId = process.env.DEFAULT_TENANT_ID;
      if (!tenantId) {
        throw new Error("DEFAULT_TENANT_ID no configurado");
      }

      const appointment = await tx.appointment.create({
        data: {
          tenantId,
          buyerId,
          scheduledAt: new Date(scheduledAt),
          durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
          resultNotes: notes || null,
          status: 'SCHEDULED',
          outcome: 'PENDING',
          interests: {
            create: interests?.map((interest: any) => ({
              productId: interest.productId,
              notes: interest.notes,
              priority: interest.priority,
            })) || [],
          },
        },
      });

      return appointment;
    });

    // Lectura FUERA de la transacción para devolver el objeto completo
    const createdAppointment = await prisma.appointment.findUnique({
        where: { id: txResult.id },
        include: {
            buyer: true,
            interests: {
                include: {
                    product: true,
                }
            }
        }
    });

    return NextResponse.json(createdAppointment, { status: 201 });

  } catch (err: any) {
    console.error("Error creating appointment:", err);
    return NextResponse.json({ error: err.message || "Error al crear la cita" }, { status: 500 });
  }
}
