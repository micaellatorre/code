"use client"

import type { RefObject } from "react"
import { displaySaleUser } from "./salesUtils"
import type { SerializedSale, UserSearchResult } from "./types"

type SaleSellerEditorProps = {
  sale: SerializedSale
  isAdmin: boolean
  isEditing: boolean
  isSearchingUsers: boolean
  isSavingSeller: boolean
  userSearchQuery: string
  userSearchResults: UserSearchResult[]
  editorRef: RefObject<HTMLDivElement>
  onOpen: () => void
  onClose: () => void
  onUserSearchQueryChange: (value: string) => void
  onSelectUser: (user: UserSearchResult) => void
}

export default function SaleSellerEditor({
  sale,
  isAdmin,
  isEditing,
  isSearchingUsers,
  isSavingSeller,
  userSearchQuery,
  userSearchResults,
  editorRef,
  onOpen,
  onClose,
  onUserSearchQueryChange,
  onSelectUser,
}: SaleSellerEditorProps) {
  const seller = displaySaleUser(sale.createdByUser)

  if (!isAdmin) return <span>{seller}</span>

  if (!isEditing) {
    return (
      <button type="button" className="rounded px-1 text-left hover:bg-base-200" onClick={onOpen}>
        {seller}
      </button>
    )
  }

  return (
    <div ref={editorRef} className="relative min-w-64">
      <input
        type="text"
        autoFocus
        value={userSearchQuery}
        onChange={(event) => onUserSearchQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !isSavingSeller) onClose()
        }}
        placeholder="Buscar usuario..."
        disabled={isSavingSeller}
        className="input input-bordered input-sm w-full"
      />
      <div className="absolute z-20 mt-1 w-full rounded-lg border border-base-300 bg-base-100 shadow-lg">
        {isSavingSeller ? (
          <div className="px-3 py-2 text-sm text-base-content/70">Guardando...</div>
        ) : isSearchingUsers ? (
          <div className="px-3 py-2 text-sm text-base-content/70">Buscando...</div>
        ) : userSearchResults.length === 0 ? (
          <div className="px-3 py-2 text-sm text-base-content/70">Sin resultados</div>
        ) : (
          <ul className="max-h-60 overflow-y-auto py-1">
            {userSearchResults.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onSelectUser(user)}
                  disabled={isSavingSeller}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{user.name?.trim() || user.email}</span>
                    <span className="truncate text-xs text-base-content/60">{user.email}</span>
                  </span>
                  <span className="badge badge-outline badge-sm shrink-0">{user.role}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
