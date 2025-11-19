
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Devuelve una cita por ID
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      buyer: true,
      interests: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }
  return NextResponse.json(appointment);
}

// DELETE: Elimina una cita
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    await prisma.appointment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error al eliminar la cita" }, { status: 500 });
  }
}

// PATCH: Actualiza una cita
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    scheduledAt,
    durationMinutes,
    status,
    outcome,
    noSaleReason,
    noSaleReasonOther,
    resultNotes,
    interests,
  } = body;

  try {
    const updatedAppointment = await prisma.$transaction(async (tx) => {
      // 1. Actualizar los datos principales de la cita
      const appointment = await tx.appointment.update({
        where: { id },
        data: {
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
          status,
          outcome,
          noSaleReason,
          noSaleReasonOther,
          resultNotes,
        },
      });

      // 2. Sincronizar los productos de interés (borrar y crear)
      if (interests && Array.isArray(interests)) {
        // Borrar los intereses existentes
        await tx.appointmentInterest.deleteMany({
          where: { appointmentId: id },
        });

        // Crear los nuevos intereses
        if (interests.length > 0) {
            await tx.appointmentInterest.createMany({
                data: interests.map((i: any) => ({
                    appointmentId: id,
                    productId: i.productId,
                    notes: i.notes,
                    priority: i.priority,
                })),
            });
        }
      }

      return appointment;
    });

    // Devolver la cita actualizada con todas sus relaciones
    const result = await prisma.appointment.findUnique({
        where: { id },
        include: {
            buyer: true,
            interests: { include: { product: true } },
        }
    });

    return NextResponse.json(result);

  } catch (e: any) {
    console.error("Error updating appointment:", e);
    return NextResponse.json({ error: e?.message ?? "Error al actualizar la cita" }, { status: 500 });
  }
}
