const productCatalogRelations = {
  catalogModel: {
    select: {
      id: true,
      type: true,
      name: true,
      normalizedName: true,
      source: true,
      isActive: true,
    },
  },
  catalogCapacity: {
    select: {
      id: true,
      capacityGB: true,
      label: true,
      source: true,
      isActive: true,
    },
  },
  catalogColor: {
    select: {
      id: true,
      name: true,
      hexColor: true,
      source: true,
      isActive: true,
    },
  },
} as const

export const productCatalogDisplaySelect = {
  catalogModelId: true,
  catalogCapacityId: true,
  catalogColorId: true,
  ...productCatalogRelations,
} as const

export const productCatalogDisplayInclude = productCatalogRelations
