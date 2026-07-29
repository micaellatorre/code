// code/src/components/products/ProductTables.tsx

import React from "react"
import Link from "next/link"
import { CheckIcon, ChevronDownIcon, DocumentDuplicateIcon, EyeIcon, EyeSlashIcon, PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { formatInTimeZone } from "date-fns-tz"
import { AR_TIME_ZONE, toArgDateInputValue } from "@/lib/timezone"
import ImeiDisplay from "@/components/common/ImeiDisplay"
import BranchAutocomplete from "@/components/branches/BranchAutocomplete"
import { getStockRotation } from "@/lib/config/stockRotation"
import type { SerializedProduct } from "./types"
import type { ProductsInventory } from "./useProductsInventory"
import { formatDecimal, getProductCode, newestCreatedAt, rangeLabelFromItems } from "./utils"

type ProductTablesProps = { inventory: ProductsInventory }

export default function ProductTables({ inventory }: ProductTablesProps) {
  const { inventorySegment, isTableExpanded, isLoading, productsLocal, phoneSections, operationalProducts, viewMode, visibleOriginColumn, visibleLocationColumn, visibleImeiColumn, visibleCostColumn, visibleSalePriceColumn, hasProductActions, filteredProducts, grouped, groupedCounts, generalColumnCount, expandedGroups, showSensitiveColumns, setShowSensitiveColumns, canEditField, editableCellProps, startEditField, isEditing, getEditingValue, updateEditingValue, commitEditField, cancelEditField, savingField, conditionOptions, conditionLabelMap, canEditStock, changeStockBy, startEditStock, canEditState, stateOptions, stateColorMap, stateLabelMap, savingStateId, changeState, canEditProducts, canDuplicateProducts, canDeleteProducts, duplicatingId, deletingId, duplicateProduct, deleteProduct, selectedProductIds, toggleProductSelection, toggleGroup, branches, savingBranchProductId, changeProductBranch, stockSettings } = inventory
  const [copiedImeiProductId, setCopiedImeiProductId] = React.useState<string | null>(null)
  const copiedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  async function copyImeiToClipboard(imei?: string | null) {
    const normalized = imei?.trim()
    if (!normalized || typeof window === "undefined") return false

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(normalized)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = normalized
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        textarea.style.pointerEvents = "none"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }

      return true
    } catch {
      return false
    }
  }

  async function handleCopyImei(product: SerializedProduct) {
    const copied = await copyImeiToClipboard(product.imei)
    if (!copied) return

    setCopiedImeiProductId(product.id)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopiedImeiProductId(null), 1300)
  }

  function renderSensitiveColumnsToggle() {
    const label = showSensitiveColumns ? "Ocultar columnas sensibles" : "Mostrar columnas sensibles"

    return (
      <th className="text-right">
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowSensitiveColumns((prev) => !prev)} title={label} aria-label={label}>
          {showSensitiveColumns ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </th>
    )
  }

  function ImeiCellActions({ product }: { product: SerializedProduct }) {
    const copied = copiedImeiProductId === product.id
    const canEditImei = canEditField("imei")
    const hasImei = Boolean(product.imei?.trim())
    const actionWrapperClass = "inline-flex max-w-0 scale-90 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover:max-w-6 group-hover:scale-100 group-hover:opacity-100 group-focus-within:max-w-6 group-focus-within:scale-100 group-focus-within:opacity-100"

    return (
      <div className="group inline-flex items-center gap-0 whitespace-nowrap transition-[gap] duration-200 hover:gap-1 focus-within:gap-1">
        <ImeiDisplay imei={product.imei} copyOnClick={false} />

        {hasImei ? (
          <span className={actionWrapperClass}>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              title={copied ? "Copiado" : "Copiar IMEI"}
              aria-label={copied ? "IMEI copiado" : "Copiar IMEI"}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void handleCopyImei(product)
              }}
            >
              <DocumentDuplicateIcon className="size-3.5" />
            </button>
          </span>
        ) : null}

        {canEditImei ? (
          <span className={actionWrapperClass}>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              title="Editar IMEI"
              aria-label="Editar IMEI"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                startEditField(product.id, "imei", product.imei)
              }}
            >
              <PencilIcon className="size-3.5" />
            </button>
          </span>
        ) : null}

        {copied ? <span className="text-nowrap text-[0.7rem] text-success">Copiado</span> : null}
      </div>
    )
  }

  function SupplierCell({ product }: { product: SerializedProduct }) {
    if (!product.supplier) return <span className="text-base-content/40">-</span>

    return (
      <Link
        href={`/dashboard/suppliers/${product.supplier.id}/edit`}
        className="link link-primary whitespace-nowrap"
        onClick={(event) => event.stopPropagation()}
      >
        {product.supplier.name}
      </Link>
    )
  }

  function getRotationBadgeClass(label: string) {
    if (label === "Alta") return "badge-success"
    if (label === "Media") return "badge-warning"
    return "badge-error"
  }

  function RotationCell({ product }: { product: SerializedProduct }) {
    if (!product.createdAt || product.state === "VENDIDO") {
      return <span className="text-base-content/40">-</span>
    }

    const rotation = getStockRotation(
      product.createdAt,
      stockSettings.stockRotationHighMaxDays,
      stockSettings.stockRotationMediumMaxDays,
    )

    return (
      <span className={`badge badge-sm whitespace-nowrap ${getRotationBadgeClass(rotation.label)}`} title={`${rotation.daysInStock} dias en stock`}>
        {rotation.label}
      </span>
    )
  }

  function ProductRow({ p }: { p: SerializedProduct }) {
    return (
      <tr key={p.id}>
        <td className="text-xs text-base-content/60">
          {canEditField("createdAt") && isEditing(p.id, "createdAt") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="date"
                value={getEditingValue(p.id, "createdAt")}
                onChange={(e) => updateEditingValue(p.id, "createdAt", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "createdAt")
                  if (e.key === "Escape") cancelEditField(p.id, "createdAt")
                }}
                onBlur={() => commitEditField(p.id, "createdAt")}
                className="input input-xs w-full min-w-[120px]"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "createdAt"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "createdAt")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "createdAt")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "createdAt", p.createdAt ? toArgDateInputValue(new Date(p.createdAt)) : "")}>
              <div
                className="tooltip tooltip-right"
                data-tip={p.createdAt ? formatInTimeZone(new Date(p.createdAt), AR_TIME_ZONE, "dd/MM/yyyy HH:mm") : ""}
              >
                <span className="underline decoration-dotted cursor-help">
                  {p.createdAt ? formatInTimeZone(new Date(p.createdAt), AR_TIME_ZONE, "dd/MM") : "-"}
                </span>
              </div>
            </span>
          )}
        </td>

        <td>
          <RotationCell product={p} />
        </td>

        {visibleOriginColumn ? (
          <td>
            {canEditField("origin") && isEditing(p.id, "origin") ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={getEditingValue(p.id, "origin")}
                  onChange={(e) => updateEditingValue(p.id, "origin", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditField(p.id, "origin")
                    if (e.key === "Escape") cancelEditField(p.id, "origin")
                  }}
                  onBlur={() => commitEditField(p.id, "origin")}
                  className="input input-xs w-full min-w-[100px]"
                  disabled={savingField?.productId === p.id && savingField?.fieldName === "origin"}
                />
                <div className="flex flex-col join join-horizontal border border-base-content/10">
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "origin")}>
                    <CheckIcon className="h-[1em]" />
                  </button>
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "origin")}>
                    <XMarkIcon className="h-[1em]" />
                  </button>
                </div>
              </div>
            ) : (
              <span {...editableCellProps(p.id, "origin", p.origin)}>
                {p.origin || "-"}
              </span>
            )}
          </td>
        ) : null}

        <td>
          <SupplierCell product={p} />
        </td>

        {visibleLocationColumn ? (
          <td>
            {canEditField("branchId") ? (
              <BranchAutocomplete value={p.branchId} branches={branches} onChange={(branchId) => changeProductBranch(p.id, branchId)} compact loading={savingBranchProductId === p.id} />
            ) : (
              <span className="text-nowrap">{p.branch?.name ?? p.location ?? "Sin sucursal"}</span>
            )}
          </td>
        ) : null}

        {visibleImeiColumn ? (
          <td>
            {canEditField("imei") && isEditing(p.id, "imei") ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={getEditingValue(p.id, "imei")}
                  onChange={(e) => updateEditingValue(p.id, "imei", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditField(p.id, "imei")
                    if (e.key === "Escape") cancelEditField(p.id, "imei")
                  }}
                  onBlur={() => commitEditField(p.id, "imei")}
                  className="input input-xs w-full min-w-[100px]"
                  disabled={savingField?.productId === p.id && savingField?.fieldName === "imei"}
                />
                <div className="flex flex-col join join-horizontal border border-base-content/10">
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "imei")}>
                    <CheckIcon className="h-[1em]" />
                  </button>
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "imei")}>
                    <XMarkIcon className="h-[1em]" />
                  </button>
                </div>
              </div>
            ) : (
              <ImeiCellActions product={p} />
            )}
          </td>
        ) : null}

        <td>
          {canEditField("modelName") && isEditing(p.id, "modelName") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={getEditingValue(p.id, "modelName")}
                onChange={(e) => updateEditingValue(p.id, "modelName", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "modelName")
                  if (e.key === "Escape") cancelEditField(p.id, "modelName")
                }}
                onBlur={() => commitEditField(p.id, "modelName")}
                className="input input-xs w-full min-w-[120px]"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "modelName"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "modelName")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "modelName")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span  {...editableCellProps(p.id, "modelName", p.modelName)}>
              {p.notes ? (
                <div className="tooltip tooltip-bottom" data-tip={p.notes ?? ""}>
                  <span className="underline decoration-dotted cursor-help text-nowrap">{p.modelName}</span>
                </div>
              ) : (
                p.modelName
              )}
            </span>
          )}
        </td>

        <td>
          {canEditField("batteryPct") && isEditing(p.id, "batteryPct") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="number"
                min={0}
                max={100}
                value={getEditingValue(p.id, "batteryPct")}
                onChange={(e) => updateEditingValue(p.id, "batteryPct", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "batteryPct")
                  if (e.key === "Escape") cancelEditField(p.id, "batteryPct")
                }}
                onBlur={() => commitEditField(p.id, "batteryPct")}
                className="input input-xs w-20"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "batteryPct"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "batteryPct")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "batteryPct")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "batteryPct", p.batteryPct)}>
              {p.batteryPct != null ? (
                <>
                  {p.batteryPct}
                  <span className="text-xs text-base-content/50"> %</span>
                </>
              ) : (
                "-"
              )}
            </span>
          )}
        </td>

        <td>
          {canEditField("color") && isEditing(p.id, "color") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={getEditingValue(p.id, "color")}
                onChange={(e) => updateEditingValue(p.id, "color", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "color")
                  if (e.key === "Escape") cancelEditField(p.id, "color")
                }}
                onBlur={() => commitEditField(p.id, "color")}
                className="input input-xs w-full min-w-[80px]"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "color"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "color")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "color")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "color", p.color)}>
              <span className="text-nowrap">{p.color ?? "-"}</span>
            </span>
          )}
        </td>

        <td>
          {canEditField("capacityGB") && isEditing(p.id, 'capacityGB') ? (
            <div className="flex items-center gap-2">
              <select
                autoFocus
                name="capacityGB"
                value={getEditingValue(p.id, 'capacityGB')}
                onChange={(e) => updateEditingValue(p.id, 'capacityGB', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEditField(p.id, 'capacityGB')
                  if (e.key === 'Escape') cancelEditField(p.id, 'capacityGB')
                }}
                onBlur={() => commitEditField(p.id, 'capacityGB')}
                className="select select-xs w-24"
                disabled={savingField?.productId === p.id && savingField?.fieldName === 'capacityGB'}
              >
                <option value="">Seleccionar</option>
                <option value="64">64 GB</option>
                <option value="128">128 GB</option>
                <option value="256">256 GB</option>
                <option value="512">512 GB</option>
                <option value="1024">1024 GB (1 TB)</option>
                <option value="2048">2048 GB (2 TB)</option>
              </select>
              <div className='flex flex-col join join-horizontal border border-base-content/10'>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, 'capacityGB')}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, 'capacityGB')}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "capacityGB", p.capacityGB)}>
              {(p.capacityGB != null) ? (
                <>
                  {p.capacityGB}<span className="text-xs text-base-content/50"> GB</span>
                </>
              ) : (
                '-'
              )}
            </span>
          )}
        </td>

        <td>
          {canEditField("condition") && isEditing(p.id, "condition") ? (
            <div className="flex items-center gap-2">
              <select
                autoFocus
                value={getEditingValue(p.id, "condition")}
                onChange={(e) => updateEditingValue(p.id, "condition", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "condition")
                  if (e.key === "Escape") cancelEditField(p.id, "condition")
                }}
                onBlur={() => commitEditField(p.id, "condition")}
                className="select select-xs w-full min-w-[100px]"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "condition"}
              >
                <option value="">-</option>
                {conditionOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {conditionLabelMap[opt] ?? opt}
                  </option>
                ))}
              </select>
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "condition")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "condition")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "condition", p.condition)}>
              {p.condition == null ? "-" : conditionLabelMap[p.condition] ?? p.condition}
            </span>
          )}
        </td>

        {visibleCostColumn ? (
          <td>
            {canEditField("costPrice") && isEditing(p.id, "costPrice") ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/50">$ </span>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  min={0}
                  value={getEditingValue(p.id, "costPrice")}
                  onChange={(e) => updateEditingValue(p.id, "costPrice", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditField(p.id, "costPrice")
                    if (e.key === "Escape") cancelEditField(p.id, "costPrice")
                  }}
                  onBlur={() => commitEditField(p.id, "costPrice")}
                  className="input input-xs w-24"
                  disabled={savingField?.productId === p.id && savingField?.fieldName === "costPrice"}
                />
                <div className="flex flex-col join join-horizontal border border-base-content/10">
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "costPrice")}>
                    <CheckIcon className="h-[1em]" />
                  </button>
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "costPrice")}>
                    <XMarkIcon className="h-[1em]" />
                  </button>
                </div>
              </div>
            ) : (
              <span {...editableCellProps(p.id, "costPrice", p.costPrice)}>
                <span className="text-xs text-base-content/50">$ </span>
                {formatDecimal((p as any).costPrice)}
              </span>
            )}
          </td>
        ) : null}

        {visibleSalePriceColumn ? (
          <td>
            {canEditField("salePrice") && isEditing(p.id, "salePrice") ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/50">$ </span>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  min={0}
                  value={getEditingValue(p.id, "salePrice")}
                  onChange={(e) => updateEditingValue(p.id, "salePrice", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditField(p.id, "salePrice")
                    if (e.key === "Escape") cancelEditField(p.id, "salePrice")
                  }}
                  onBlur={() => commitEditField(p.id, "salePrice")}
                  className="input input-xs w-24"
                  disabled={savingField?.productId === p.id && savingField?.fieldName === "salePrice"}
                />
                <div className="flex flex-col join join-horizontal border border-base-content/10">
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "salePrice")}>
                    <CheckIcon className="h-[1em]" />
                  </button>
                  <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "salePrice")}>
                    <XMarkIcon className="h-[1em]" />
                  </button>
                </div>
              </div>
            ) : (
              <span {...editableCellProps(p.id, "salePrice", p.salePrice)}>
                <span className="text-xs text-base-content/50">$ </span>
                {formatDecimal((p as any).salePrice)}
              </span>
            )}
          </td>
        ) : null}

        <td>
          {canEditField("stockInitial") && isEditing(p.id, "stockInitial") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="number"
                min={0}
                step={1}
                value={getEditingValue(p.id, "stockInitial")}
                onChange={(e) => updateEditingValue(p.id, "stockInitial", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "stockInitial")
                  if (e.key === "Escape") cancelEditField(p.id, "stockInitial")
                }}
                onBlur={() => commitEditField(p.id, "stockInitial")}
                className="input input-xs w-20"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "stockInitial"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button
                  className="btn btn-ghost btn-xs join-item"
                  onClick={() => commitEditField(p.id, "stockInitial")}
                >
                  <CheckIcon className="h-[1em]" />
                </button>
                <button
                  className="btn btn-ghost btn-xs join-item"
                  onClick={() => cancelEditField(p.id, "stockInitial")}
                >
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <span {...editableCellProps(p.id, "stockInitial", p.stockInitial)}>
              {p.stockInitial}
            </span>
          )}
        </td>

        <td>
          {canEditField("stock") && isEditing(p.id, "stock") ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="number"
                min={0}
                step={1}
                value={getEditingValue(p.id, "stock")}
                onChange={(e) => updateEditingValue(p.id, "stock", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(p.id, "stock")
                  if (e.key === "Escape") cancelEditField(p.id, "stock")
                }}
                onBlur={() => commitEditField(p.id, "stock")}
                className="input input-xs w-20"
                disabled={savingField?.productId === p.id && savingField?.fieldName === "stock"}
              />
              <div className="flex flex-col join join-horizontal border border-base-content/10">
                <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(p.id, "stock")}>
                  <CheckIcon className="h-[1em]" />
                </button>
                <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(p.id, "stock")}>
                  <XMarkIcon className="h-[1em]" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {canEditStock ? (
                <div className="flex flex-row btn-group gap-1 items-center">
                  <button
                    className="btn btn-ghost btn-xs"
                    aria-label="decrement stock"
                    disabled={savingField?.productId === p.id && savingField?.fieldName === "stock"}
                    onClick={() => changeStockBy(p.id, -1)}
                  >
                    ▼
                  </button>
                  <span
                    className="cursor-pointer hover:bg-base-200 rounded px-1"
                    onClick={() => startEditStock(p.id, p.stock)}
                    title="Click para editar"
                  >
                    {p.stock}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs"
                    aria-label="increment stock"
                    disabled={savingField?.productId === p.id && savingField?.fieldName === "stock"}
                    onClick={() => changeStockBy(p.id, 1)}
                  >
                    ▲
                  </button>
                </div>
              ) : (
                <span>{p.stock}</span>
              )}
            </div>
          )}
        </td>

        <td>
          <span
            className={`badge badge-sm whitespace-nowrap ${p.senado ? "badge-secondary" : "badge-ghost"}`}
            title={p.senadoAt ? `Señado el ${formatInTimeZone(new Date(p.senadoAt), AR_TIME_ZONE, "dd/MM/yyyy HH:mm")}` : undefined}
          >
            {p.senado ? "Señado" : "Libre"}
          </span>
        </td>

        <td>
          {canEditState ? (
            <div className="dropdown dropdown-start relative">
              <div
                tabIndex={0}
                role="button"
                className="flex flex-row flex-nowrap gap-2 items-center cursor-pointer btn btn-xs btn-ghost py-2"
              >
                <span className={`text-nowrap badge badge-sm ${stateColorMap[p.state] ?? "badge-ghost"}`}>{p.state}</span>
                <ChevronDownIcon className="h-4 w-4" />
              </div>
              <ul tabIndex={-1} className="fixed dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 !z-[1000]">
                {stateOptions.map((s) => (
                  <li key={s} className="py-2 flex flex-row items-center gap-2">
                    <button
                      className={`w-full text-left btn btn-ghost btn-xs justify-between ${stateColorMap[s] ?? ""}`}
                      disabled={savingStateId === p.id}
                      onClick={() => changeState(p.id, s)}
                    >
                      <span className="truncate w-auto">{s}</span>
                      <div className={`w-2 h-2 rounded-full border ${stateColorMap[s] ?? ""}`}></div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <span className={`text-nowrap badge badge-sm ${stateColorMap[p.state] ?? "badge-ghost"}`}>{p.state}</span>
          )}
        </td>

        {hasProductActions ? (
          <td className="flex items-center gap-2">
            {canEditProducts ? (
              <Link href={`/dashboard/products/${p.id}/edit`} className="btn btn-xs btn-square btn-soft">
                <PencilIcon className="size-[1.2em]" />
              </Link>
            ) : null}

            {canDuplicateProducts ? (
              <button
                className="btn btn-xs btn-square btn-soft"
                onClick={() => duplicateProduct(p.id)}
                disabled={duplicatingId === p.id}
                title="Duplicar producto"
              >
                {duplicatingId === p.id ? (
                  <span className="loading loading-bars loading-xs"></span>
                ) : (
                  <DocumentDuplicateIcon className="size-[1.2em]" />
                )}
              </button>
            ) : null}

            {canDeleteProducts ? (
              <button
                className="btn btn-xs btn-square btn-soft btn-error"
                onClick={() => deleteProduct(p.id)}
                disabled={deletingId === p.id}
                aria-disabled={deletingId === p.id}
                title="Eliminar producto"
              >
                {deletingId === p.id ? <span className="loading loading-bars loading-xs"></span> : <TrashIcon className="size-[1.2em]" />}
              </button>
            ) : null}
          </td>
        ) : null}
        <td></td>
      </tr>
    )
  }

  function OperationalEditableCell({
    product,
    fieldName,
    children,
    className = "",
  }: {
    product: SerializedProduct
    fieldName: string
    children: React.ReactNode
    className?: string
  }) {
    if (canEditField(fieldName) && isEditing(product.id, fieldName)) {
      return (
        <input
          autoFocus
          type={["batteryPct", "salePrice"].includes(fieldName) ? "number" : "text"}
          min={fieldName === "batteryPct" ? 0 : undefined}
          max={fieldName === "batteryPct" ? 100 : undefined}
          step={fieldName === "salePrice" ? "0.01" : undefined}
          value={getEditingValue(product.id, fieldName)}
          onChange={(e) => updateEditingValue(product.id, fieldName, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEditField(product.id, fieldName)
            if (e.key === "Escape") cancelEditField(product.id, fieldName)
          }}
          onBlur={() => commitEditField(product.id, fieldName)}
          className={`input input-xs min-w-[72px] ${className}`}
          disabled={savingField?.productId === product.id && savingField?.fieldName === fieldName}
        />
      )
    }
    return (
      <span {...editableCellProps(product.id, fieldName, (product as any)[fieldName])} className={`block ${className}`}>
        {children}
      </span>
    )
  }

  function PhoneOperationalRow({ product }: { product: SerializedProduct }) {
    return (
      <tr>
        {/* <td>
          <input
            type="checkbox"
            className="checkbox checkbox-xs"
            checked={selectedProductIds.has(product.id)}
            onChange={() => toggleProductSelection(product.id)}
            aria-label={`Seleccionar ${product.modelName}`}
          />
        </td> */}
        <td className="font-mono text-xs">{getProductCode(product)}</td>
        <td>
          <RotationCell product={product} />
        </td>
        <td>
          <OperationalEditableCell product={product} fieldName="modelName">
            <span className={product.notes ? "underline decoration-dotted cursor-help text-nowrap" : ""} title={product.notes ?? ""}>
              {product.modelName}
            </span>
          </OperationalEditableCell>
        </td>
        <td>
          <SupplierCell product={product} />
        </td>
        {visibleImeiColumn ? (
          <td className="font-mono text-xs">
            {canEditField("imei") && isEditing(product.id, "imei") ? (
              <input
                autoFocus
                type="text"
                value={getEditingValue(product.id, "imei")}
                onChange={(e) => updateEditingValue(product.id, "imei", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditField(product.id, "imei")
                  if (e.key === "Escape") cancelEditField(product.id, "imei")
                }}
                onBlur={() => commitEditField(product.id, "imei")}
                className="input input-xs min-w-[72px]"
                disabled={savingField?.productId === product.id && savingField?.fieldName === "imei"}
              />
            ) : (
              <ImeiCellActions product={product} />
            )}
          </td>
        ) : null}
        <td>
          <OperationalEditableCell product={product} fieldName="capacityGB">
            <span className='text-nowrap'>{product.capacityGB ?? "-"} GB</span>
          </OperationalEditableCell>
        </td>
        <td>
          <OperationalEditableCell product={product} fieldName="color">
            <span className='text-nowrap'>{product.color ?? "-"}</span>
          </OperationalEditableCell>
        </td>
        <td>
          <OperationalEditableCell product={product} fieldName="batteryPct">
            <span className='text-nowrap'>{product.batteryPct ?? "-"}%</span>
          </OperationalEditableCell>
        </td>
        <td>
          <OperationalEditableCell product={product} fieldName="condition">
            {product.condition == null ? "-" : conditionLabelMap[product.condition] ?? product.condition}
          </OperationalEditableCell>
        </td>
        <td>
          {canEditState ? (
            <select
              className="w-36 select select-bordered select-xs"
              value={product.state}
              disabled={savingStateId === product.id}
              onChange={(e) => changeState(product.id, e.target.value)}
            >
              {stateOptions.map((state) => <option key={state} value={state}>{stateLabelMap[state] ?? state}</option>)}
            </select>
          ) : (
            <span className={`text-nowrap badge badge-sm ${stateColorMap[product.state] ?? "badge-ghost"}`}>{stateLabelMap[product.state] ?? product.state}</span>
          )}
        </td>
        {visibleLocationColumn ? (
          <td>
            {canEditField("branchId") ? (
              <BranchAutocomplete value={product.branchId} branches={branches} onChange={(branchId) => changeProductBranch(product.id, branchId)} compact loading={savingBranchProductId === product.id} />
            ) : (
              <span className='text-nowrap'>{product.branch?.name ?? product.location ?? "Sin sucursal"}</span>
            )}
          </td>
        ) : null}
        {visibleCostColumn ? (
          <td>
            <OperationalEditableCell product={product} fieldName="costPrice">$ 
              <span className='text-nowrap'>{formatDecimal(product.costPrice)}</span>
            </OperationalEditableCell>
          </td>
        ) : null}
        {visibleSalePriceColumn ? (
          <td>
            <OperationalEditableCell product={product} fieldName="salePrice">$ 
              <span className='text-nowrap'>{formatDecimal(product.salePrice)}</span>
            </OperationalEditableCell>
          </td>
        ) : null}
        {hasProductActions ? (
          <td>
            <div className="flex items-center gap-1">
              {canEditProducts ? <Link href={`/dashboard/products/${product.id}/edit`} className="btn btn-xs btn-square btn-soft"><PencilIcon className="size-[1.2em]" /></Link> : null}
              {canDuplicateProducts ? <button className="btn btn-xs btn-square btn-soft" onClick={() => duplicateProduct(product.id)} disabled={duplicatingId === product.id} title="Duplicar producto"><DocumentDuplicateIcon className="size-[1.2em]" /></button> : null}
              {canDeleteProducts ? <button className="btn btn-xs btn-square btn-soft btn-error" onClick={() => deleteProduct(product.id)} disabled={deletingId === product.id} title="Eliminar producto"><TrashIcon className="size-[1.2em]" /></button> : null}
            </div>
          </td>
        ) : null}
      </tr>
    )
  }

  function PhoneOperationalTable({ products }: { products: SerializedProduct[] }) {
    return (
      <div className="overflow-x-auto border-t border-base-content/10">
        <table className="table table-zebra table-xs w-full">
          <thead>
            <tr>
              {/* <th>Select</th> */}
              <th>Codigo</th>
              <th>Rotacion</th>
              <th>Modelo</th>
              <th>Proveedor</th>
              {visibleImeiColumn ? <th>IMEI</th> : null}
              <th>GB</th>
              <th>Color</th>
              <th>Bateria %</th>
              <th>Condicion</th>
              <th>Estado</th>
              {visibleLocationColumn ? <th>Sucursal</th> : null}
              {visibleCostColumn ? <th>Costo</th> : null}
              {visibleSalePriceColumn ? <th>Precio</th> : null}
              {hasProductActions ? <th>Acciones</th> : null}
            </tr>
          </thead>
          <tbody>{products.map((product) => <PhoneOperationalRow key={product.id} product={product} />)}</tbody>
        </table>
      </div>
    )
  }

  function IPhoneSeriesCluster({ sectionKey, series, products }: { sectionKey: string; series: string; products: SerializedProduct[] }) {
    const key = `${sectionKey}-${series}`
    const isOpen = !!expandedGroups[key]
    const available = products.reduce((sum, product) => sum + (product.stockAvailable ?? 0), 0)
    const locationSummary = Array.from(new Set(products.map((product) => product.branch?.name ?? product.location).filter(Boolean))).join(", ") || "-"
    return (
      <div className="rounded-box border border-base-content/10 bg-base-100 overflow-hidden">
        <button type="button" className="w-full flex flex-wrap items-center gap-3 p-3 text-left hover:bg-base-200/60" onClick={() => toggleGroup(key)}>
          <ChevronDownIcon className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          <span className="font-semibold">{series}</span>
          <span className="badge badge-ghost badge-sm">{products.length} unidades</span>
          <span className="text-xs text-base-content/60">Disponible: {available}</span>
          {visibleLocationColumn ? <span className="text-xs text-base-content/60">Sucursal: {locationSummary}</span> : null}
          {visibleSalePriceColumn ? <span className="ml-auto text-xs">Precio: $ {rangeLabelFromItems(products, "salePrice")}</span> : null}
        </button>
        {isOpen ? <PhoneOperationalTable products={products} /> : null}
      </div>
    )
  }

  function PhoneConditionSection({ sectionKey, title, groups }: { sectionKey: string; title: string; groups: { series: string; products: SerializedProduct[] }[] }) {
    const count = groups.reduce((sum, group) => sum + group.products.length, 0)
    return (
      <section className="rounded-box border border-base-content/10 bg-base-200/40 p-3">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-bold">{title}</h3>
          <span className="badge badge-primary badge-sm">{count} unidades</span>
        </div>
        {groups.length ? <div className="flex flex-col gap-2">{groups.map((group) => <IPhoneSeriesCluster key={group.series} sectionKey={sectionKey} {...group} />)}</div> : <div className="rounded-box bg-base-100 p-4 text-sm text-base-content/60">No hay productos en esta seccion.</div>}
      </section>
    )
  }



  return (
      <div className={`overflow-x-auto h-[70dvh] ${inventorySegment === "ACCESSORIES" ? "border border-base-content/10 rounded-box" : ""} `}>
        {isLoading && productsLocal.length === 0 ? (
          <div className="p-6">
            <div className="skeleton h-6 w-64 mb-3"></div>
            <div className="skeleton h-40 w-full"></div>
          </div>
        ) : inventorySegment === "PHONES" ? (
          <div className="flex flex-col gap-3">
            <PhoneConditionSection sectionKey="used" title="iPhones Usados" groups={phoneSections.used} />
            <PhoneConditionSection sectionKey="sealed" title="iPhones Sellados" groups={phoneSections.sealed} />
          </div>
        ) : inventorySegment === "TRADE_INS" ? (
          <div className="flex flex-col gap-3">
            {operationalProducts.length ? (
              <>
                <PhoneConditionSection sectionKey="trade-in-used" title="Canjes Pendientes Usados" groups={phoneSections.used} />
                <PhoneConditionSection sectionKey="trade-in-sealed" title="Canjes Pendientes Sellados" groups={phoneSections.sealed} />
              </>
            ) : (
              <div className="rounded-box border border-dashed border-base-content/20 bg-base-200/40 p-8 text-center text-base-content/60">
                No hay canjes pendientes para revisar.
              </div>
            )}
          </div>
        ) : viewMode === "DETAIL" ? (
          <table className={`table table-zebra w-full table-pin-rows table-pin-cols ${isTableExpanded ? "" : "table-xs"}`}>
            <thead>
              <tr>
                <th>Agregado</th>
                <th>Rotacion</th>
                {visibleOriginColumn ? <th>Origen</th> : null}
                <th>Proveedor</th>
                {visibleLocationColumn ? <th>Sucursal</th> : null}
                {visibleImeiColumn ? <th>IMEI</th> : null}
                <th>Modelo</th>
                <th>Bateria %</th>
                <th>Color </th>
                <th>Capacidad (GB)</th>
                <th>Condición</th>
                {visibleCostColumn ? <th>Costo (USD)</th> : null}
                {visibleSalePriceColumn ? <th>Precio Venta (USD)</th> : null}
                <th>Stock Inicial</th>
                <th>Stock</th>
                <th>Seña</th>
                <th>Estado</th>
                {hasProductActions ? <th>Acciones</th> : null}
                {renderSensitiveColumnsToggle()}
              </tr>
            </thead>
            <tbody key="filtered-products" className="h-full">
              {filteredProducts.map((p) => (
                <ProductRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        ) : (
          <table className={`table table-zebra w-full  table-pin-rows ${isTableExpanded ? "" : "table-xs"}`}>
            <thead>
              <tr>
                <th className="w-[40px]"></th>
                <th>Modelo</th>
                <th>Items</th>
                <th>Stock</th>
                <th>Disponible</th>
                {visibleCostColumn ? <th>Costo (USD)</th> : null}
                {visibleSalePriceColumn ? <th>Precio Venta (USD)</th> : null}
                <th className="text-right">Último agregado</th>
                {renderSensitiveColumnsToggle()}
              </tr>
            </thead>
            <tbody className="h-full">
              {grouped.map((g) => {
                const isOpen = !!expandedGroups[g.key]
                const last = g.newest ? formatInTimeZone(new Date(g.newest), AR_TIME_ZONE, "dd/MM HH:mm") : "-"
                const costLabel = rangeLabelFromItems(g.items, "costPrice")
                const saleLabel = rangeLabelFromItems(g.items, "salePrice")

                return (
                  <React.Fragment key={g.key}>
                    <tr
                      key={`group-${g.key}`}
                      className="cursor-pointer hover:bg-base-200/50"
                      onClick={() => toggleGroup(g.key)}
                      title="Click para expandir/contraer"
                    >
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleGroup(g.key)
                          }}
                          aria-label={isOpen ? "collapse group" : "expand group"}
                        >
                          <ChevronDownIcon className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      </td>
                      <td className="font-semibold">{g.label}</td>
                      <td>
                        <span className="badge badge-sm badge-ghost">{g.items.length}</span>
                      </td>
                      <td>{g.stockSum}</td>
                      <td>{g.availSum}</td>
                      {visibleCostColumn ? (
                        <td>
                          <span className="text-xs text-base-content/50">$ </span>
                          {costLabel}
                        </td>
                      ) : null}
                      {visibleSalePriceColumn ? (
                        <td>
                          <span className="text-xs text-base-content/50">$ </span>
                          {saleLabel}
                        </td>
                      ) : null}
                      <td className="text-right text-xs text-base-content/60">{last}</td>
                      <td></td>
                    </tr>

                    {isOpen ? (
                      <tr key={`group-body-${g.key}`}>
                        <td colSpan={generalColumnCount} className="p-0">
                          <div className="bg-base-100 border-t border-base-content/5">
                            <div className="px-3 py-2 text-xs text-base-content/60 flex items-center justify-between">
                              <span>
                                Detalle de <span className="font-semibold">{g.label}</span> — {g.items.length} items (filtrados)
                              </span>
                              <button className="btn btn-ghost btn-xs" onClick={() => toggleGroup(g.key)}>
                                Cerrar
                              </button>
                            </div>

                            <div className="overflow-x-auto">
                              <table className={`table table-zebra w-full ${isTableExpanded ? "" : "table-xs"}`}>
                                <thead>
                                  <tr>
                                    <th>Agregado</th>
                                    <th>Rotacion</th>
                                    {visibleOriginColumn ? <th>Origen</th> : null}
                                    <th>Proveedor</th>
                                    {visibleLocationColumn ? <th>Sucursal</th> : null}
                                    {visibleImeiColumn ? <th>IMEI</th> : null}
                                    <th>Modelo</th>
                                    <th>Bateria %</th>
                                    <th>Color</th>
                                    <th>Capacidad (GB)</th>
                                    <th>Condición</th>
                                    {visibleCostColumn ? <th>Costo (USD)</th> : null}
                                    {visibleSalePriceColumn ? <th>Precio Venta (USD)</th> : null}
                                    <th>Stock Inicial</th>
                                    <th>Stock</th>
                                    <th>Seña</th>
                                    <th>Estado</th>
                                    {hasProductActions ? <th>Acciones</th> : null}
                                    {renderSensitiveColumnsToggle()}
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.items
                                    .slice()
                                    .sort((a, b) => newestCreatedAt([b]) - newestCreatedAt([a]))
                                    .map((p) => (
                                      <ProductRow key={p.id} p={p} />
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
  )
}
