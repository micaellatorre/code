import assert from "node:assert/strict"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { postSalePaymentToCash } from "@/lib/domain/cash"
import { addCustomerOrderPayment, assignOrderItemProduct, convertCustomerOrderToSale, createCustomerOrder, getCustomerOrder, transitionCustomerOrder } from "@/lib/domain/customer-orders"

const d = (v: string | number) => new Prisma.Decimal(v)

async function cleanupTestTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  if (!tenant?.name.startsWith("Order Verify ")) {
    throw new Error(`Refusing to clean up non-test tenant ${tenantId}`)
  }

  await prisma.$transaction([
    prisma.cashMovement.deleteMany({ where: { tenantId } }),
    prisma.auditLog.deleteMany({ where: { tenantId } }),
    prisma.payment.deleteMany({ where: { sale: { tenantId } } }),
    prisma.saleItem.deleteMany({ where: { sale: { tenantId } } }),
    prisma.sale.deleteMany({ where: { tenantId } }),
    prisma.customerOrderInventoryAllocation.deleteMany({ where: { order: { tenantId } } }),
    prisma.customerOrderPayment.deleteMany({ where: { order: { tenantId } } }),
    prisma.customerOrderItem.deleteMany({ where: { order: { tenantId } } }),
    prisma.customerOrder.deleteMany({ where: { tenantId } }),
    prisma.product.deleteMany({ where: { tenantId } }),
    prisma.cashAccount.deleteMany({ where: { tenantId } }),
    prisma.buyer.deleteMany({ where: { tenantId } }),
    prisma.user.deleteMany({ where: { tenantId } }),
    prisma.branch.deleteMany({ where: { tenantId } }),
    prisma.tenant.delete({ where: { id: tenantId } }),
  ])
}

async function main() {
  const key = Date.now().toString(36)
  let testTenantId: string | null = null
  try {
    const tenant = await prisma.tenant.create({ data: { name: `Order Verify ${key}` } })
    testTenantId = tenant.id
    const branch = await prisma.branch.create({ data: { tenantId: tenant.id, code: `V${key.slice(-5)}`, name: "Validation", isActive: true } })
    const user = await prisma.user.create({ data: { email: `orders-${key}@test.local`, name: "Seller", role: "ADMIN", tenantId: tenant.id, currentBranchId: branch.id } })
    const buyer = await prisma.buyer.create({ data: { tenantId: tenant.id, name: "Ada", surname: "Lovelace", dni: key, phone: "+5491112345678", email: `buyer-${key}@test.local` } })
    const cash = await prisma.cashAccount.create({ data: { tenantId: tenant.id, code: `USD-${key}`, name: "USD", type: "CASH", currency: "USD", scope: "TENANT" } })
    const accessory = await prisma.product.create({ data: { tenantId: tenant.id, branchId: branch.id, type: "ACCESSORY", modelName: "Charger", costPrice: d(20), salePrice: d(40), state: "EN_STOCK", stock: 5, stockInitial: 5, stockAvailable: 5 } })
    const phone = await prisma.product.create({ data: { tenantId: tenant.id, branchId: branch.id, type: "PHONE", modelName: "Future Phone", costPrice: d(800), salePrice: d(1000), state: "EN_STOCK", stock: 1, stockInitial: 1, stockAvailable: 1 } })
    const actor = { tenantId: tenant.id, actorUserId: user.id, actorRole: "ADMIN" as const }
    const pay = (amount: string) => ({ method: "EFECTIVO_USD" as const, currency: "USD" as const, amount: d(amount), exchangeRate: null, amountUsd: d(amount), coveredBaseUsd: d(amount), surchargePct: d(0), surchargeAmount: d(0), installments: null, installmentAmount: null, pricingSnapshot: null, cashAccountId: cash.id, paidAt: new Date(), note: "verify" })

    const order = await createCustomerOrder({ ...actor, input: { buyerId: buyer.id, branchId: branch.id, items: [
      { kind: "ON_DEMAND", description: "Future Phone", quantity: 1, unitPriceUsd: d(1000) },
      { kind: "STOCK", stockProductId: accessory.id, description: "Charger", quantity: 1, unitPriceUsd: d(40) },
    ], payments: [pay("100")] } })
    assert.ok(order)
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: accessory.id } })).stockAvailable, 4)
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: accessory.id } })).stock, 5)

    const pending = order!.items.find((item) => item.kind === "ON_DEMAND")
    assert.ok(pending)
    await assignOrderItemProduct({ ...actor, orderId: order!.id, itemId: pending.id, productId: phone.id })
    await addCustomerOrderPayment({ ...actor, orderId: order!.id, payment: pay("940") })
    assert.equal(Number((await getCustomerOrder(tenant.id, order!.id))?.balanceDueUsd), 0)

    for (const status of ["PROCUREMENT_PENDING", "ORDERED_TO_SUPPLIER", "IN_TRANSIT", "RECEIVED", "READY_FOR_DELIVERY"] as const) {
      await transitionCustomerOrder({ ...actor, orderId: order!.id, status })
    }
    const first = await convertCustomerOrderToSale({ ...actor, orderId: order!.id })
    const second = await convertCustomerOrderToSale({ ...actor, orderId: order!.id })
    assert.equal(second.alreadyConverted, true)
    assert.equal(second.saleId, first.saleId)
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: first.saleId }, include: { payments: true, items: true } })
    assert.equal(sale.items.length, 2)
    assert.equal(sale.payments.length, 2)
    assert.ok(sale.payments.every((payment) => payment.originCustomerOrderPaymentId))
    const phoneAfterSale = await prisma.product.findUniqueOrThrow({ where: { id: phone.id } })
    assert.equal(phoneAfterSale.stock, 0)
    assert.equal(phoneAfterSale.state, "VENDIDO")
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: accessory.id } })).stock, 4)
    assert.equal(await prisma.cashMovement.count({ where: { tenantId: tenant.id, sourceType: "CUSTOMER_ORDER_PAYMENT" } }), 2)
    assert.equal(await prisma.cashMovement.count({ where: { tenantId: tenant.id, sourceType: "SALE_PAYMENT" } }), 0)

    await prisma.$transaction(async (tx) => {
      for (const payment of sale.payments) {
        const posted = await postSalePaymentToCash({
          ...actor,
          tx,
          sale: { id: sale.id, branchId: sale.branchId },
          payment,
        })
        assert.equal(posted, null)
      }
    })
    assert.equal(await prisma.cashMovement.count({ where: { tenantId: tenant.id, sourceType: "SALE_PAYMENT" } }), 0)

    const reversalsBeforeCancelOrder = await prisma.cashMovement.count({ where: { tenantId: tenant.id, category: "REVERSAL" } })
    const cancelOrder = await createCustomerOrder({ ...actor, input: { buyerId: buyer.id, branchId: branch.id, items: [
      { kind: "ON_DEMAND", description: "Future 2", quantity: 1, unitPriceUsd: d(1000) },
      { kind: "STOCK", stockProductId: accessory.id, description: "Charger", quantity: 1, unitPriceUsd: d(40) },
    ], payments: [pay("100")] } })
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: accessory.id } })).stockAvailable, 3)
    await transitionCustomerOrder({ ...actor, orderId: cancelOrder!.id, status: "CANCELLED" })
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: accessory.id } })).stockAvailable, 4)
    assert.equal(await prisma.cashMovement.count({ where: { tenantId: tenant.id, category: "REVERSAL" } }), reversalsBeforeCancelOrder + 1)

    console.log("customer-orders verification passed")
  } finally {
    if (testTenantId) {
      await cleanupTestTenant(testTenantId)
      console.log(`cleaned up customer-orders verification tenant ${testTenantId}`)
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
