"use client"

import type { Product } from "@prisma/client"
import Link from "next/link"
import { useState } from "react"
import ImeiDisplay from "@/components/common/ImeiDisplay"
import ProductColorSwatch from "@/components/products/ProductColorSwatch"
import { getConditionLabel, getProductDisplayCapacity, getProductDisplayColor, getProductDisplayColorHex, getProductDisplayModel, type ProductCatalogDisplayProduct } from "@/lib/products/display"
import ProductSelectionModal from "../sales/ProductSelectionModal"

export type AppointmentInterestDraft = {
  _id: string
  productId: string
  product: Product & ProductCatalogDisplayProduct
  notes?: string
  priority?: number
  agreedPrice?: number
  quantity?: number
  kind?: "NORMAL" | "PROMO" | "GIFT" | "DISCOUNT"
}

interface AppointmentInterestSectionProps {
  items: AppointmentInterestDraft[]
  setItems: (items: AppointmentInterestDraft[]) => void
}

export default function AppointmentInterestSection({ items, setItems }: AppointmentInterestSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [suggestionMessage, setSuggestionMessage] = useState("")

  const handleAddItems = (newItems: any[]) => {
    const updatedItems = [...items]
    newItems.forEach((newItem) => {
      const existingIndex = updatedItems.findIndex((item) => item.productId === newItem.productId)
      if (existingIndex === -1) {
        updatedItems.push({
          _id: newItem._id,
          productId: newItem.productId,
          product: newItem.product,
          notes: "",
          priority: 1,
          agreedPrice: Number(newItem.product?.salePrice ?? 0),
          quantity: 1,
          kind: "NORMAL",
        })
      }
    })

    setItems(updatedItems)
    setIsModalOpen(false)
  }

  function handleRemoveItem(itemId: string) {
    setItems(items.filter((item) => item._id !== itemId))
  }

  function handleUpdateItem(itemId: string, updatedFields: Partial<AppointmentInterestDraft>) {
    setItems(items.map((item) => (item._id === itemId ? { ...item, ...updatedFields } : item)))
  }

  function addCompatibleGift(tag: string) {
    const firstItem = items[0]
    if (!firstItem) return
    const note = firstItem.notes?.trim()
    const nextNote = [note, `Sugerencia compatible: ${tag}`].filter(Boolean).join(" | ")
    handleUpdateItem(firstItem._id, { notes: nextNote, kind: tag.includes("Promocion") ? "PROMO" : "GIFT" })
    setSuggestionMessage(`${tag} agregado como sugerencia en ${getProductDisplayModel(firstItem.product)}.`)
  }

  return (
    <div className="card bg-base-100 border border-base-content/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-lg">Items de interes</h2>
          <p className="text-sm text-base-content/60">Equipos, accesorios, regalos o promociones asociados a la reserva.</p>
        </div>
        <div className="join">
          <button type="button" className="btn btn-xs join-item btn-primary">
            Equipos
          </button>
          <button type="button" className="btn btn-xs join-item btn-outline">
            Accesorios
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center p-8 border border-dashed border-base-300 rounded-lg mt-4">
          <p className="text-base-content/70">Aun no hay productos de interes.</p>
          <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm mt-4">
            Agregar productos
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>IMEI</th>
                  <th>Modelo</th>
                  <th>Detalle</th>
                  <th>Precio pactado</th>
                  <th>Cant.</th>
                  <th>Tipo</th>
                  <th>Notas</th>
                  <th>Prioridad</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const color = getProductDisplayColor(item.product)
                  const capacity = item.product.type?.toUpperCase() === "PHONE" ? getProductDisplayCapacity(item.product) : null
                  return (
                  <tr key={item._id}>
                    <td><ImeiDisplay imei={item.product.imei} fallback="N/A" /></td>
                    <td>
                      <Link
                        href={`/dashboard/products/${item.productId}/edit`}
                        className="font-medium text-primary hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {getProductDisplayModel(item.product)}
                      </Link>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {capacity ? <span className="badge badge-outline badge-xs">{capacity}</span> : null}
                        {item.product.condition ? <span className="badge badge-outline badge-xs">{getConditionLabel(item.product.condition)}</span> : null}
                        {item.product.batteryPct ? <span className="badge badge-outline badge-xs">{item.product.batteryPct}% bat.</span> : null}
                        {color ? (
                          <span className="badge badge-outline badge-xs gap-1">
                            <ProductColorSwatch hexColor={getProductDisplayColorHex(item.product)} title={color} />
                            {color}
                          </span>
                        ) : null}
                        {item.product.state ? <span className="badge badge-outline badge-xs">{item.product.state}</span> : null}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.agreedPrice ?? Number(item.product.salePrice ?? 0)}
                        onChange={(event) => handleUpdateItem(item._id, { agreedPrice: parseFloat(event.target.value) || 0 })}
                        className="input input-bordered input-sm w-28"
                        min={0}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.quantity || 1}
                        onChange={(event) => handleUpdateItem(item._id, { quantity: parseInt(event.target.value) || 1 })}
                        className="input input-bordered input-sm w-20"
                        min={1}
                      />
                    </td>
                    <td>
                      <select
                        value={item.kind || "NORMAL"}
                        onChange={(event) => handleUpdateItem(item._id, { kind: event.target.value as AppointmentInterestDraft["kind"] })}
                        className="select select-bordered select-sm"
                      >
                        <option value="NORMAL">Normal</option>
                        <option value="PROMO">Promo</option>
                        <option value="GIFT">Regalo</option>
                        <option value="DISCOUNT">Descuento</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={item.notes || ""}
                        onChange={(event) => handleUpdateItem(item._id, { notes: event.target.value })}
                        className="input input-bordered input-sm w-full"
                        placeholder="Color, reserva, aclaracion..."
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.priority || 1}
                        onChange={(event) => handleUpdateItem(item._id, { priority: parseInt(event.target.value) || 1 })}
                        className="input input-bordered input-sm w-20"
                        min={1}
                      />
                    </td>
                    <td>
                      <button type="button" onClick={() => handleRemoveItem(item._id)} className="btn btn-ghost btn-xs">
                        Quitar
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-base-300 p-3">
            <p className="mb-2 text-sm font-medium">Regalos compatibles</p>
            <div className="flex flex-wrap gap-2">
              {["Funda", "Templado", "Cable", "Cargador", "Promocion combo"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="badge badge-outline cursor-pointer hover:badge-primary"
                  onClick={() => addCompatibleGift(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            {suggestionMessage ? <p className="mt-2 text-xs text-success">{suggestionMessage}</p> : null}
            <p className="mt-2 text-xs text-base-content/50">Las sugerencias se guardan en notas del item principal para retomarlas al convertir la reserva.</p>
          </div>

          <button type="button" onClick={() => setIsModalOpen(true)} className="btn btn-outline btn-sm mt-4 w-full">
            + Agregar mas productos
          </button>
        </div>
      )}

      {isModalOpen && (
        <ProductSelectionModal existingItems={[]} onClose={() => setIsModalOpen(false)} onAddItems={handleAddItems} />
      )}
    </div>
  )
}
