export type IPhoneTradeInCatalogSeries = {
  series: string
  models: {
    modelName: string
    capacities: number[]
  }[]
}

export const IPHONE_TRADE_IN_CATALOG: IPhoneTradeInCatalogSeries[] = [
  {
    series: "iPhone 11 Series",
    models: [
      { modelName: "iPhone 11", capacities: [64, 128, 256] },
      { modelName: "iPhone 11 Pro", capacities: [64, 256, 512] },
      { modelName: "iPhone 11 Pro Max", capacities: [64, 256, 512] },
    ],
  },
  {
    series: "iPhone 12 Series",
    models: [
      { modelName: "iPhone 12 Mini", capacities: [64, 128, 256] },
      { modelName: "iPhone 12", capacities: [64, 128, 256] },
      { modelName: "iPhone 12 Pro", capacities: [128, 256, 512] },
      { modelName: "iPhone 12 Pro Max", capacities: [128, 256, 512] },
    ],
  },
  {
    series: "iPhone 13 Series",
    models: [
      { modelName: "iPhone 13 Mini", capacities: [128, 256, 512] },
      { modelName: "iPhone 13", capacities: [128, 256, 512] },
      { modelName: "iPhone 13 Pro", capacities: [128, 256, 512, 1024] },
      { modelName: "iPhone 13 Pro Max", capacities: [128, 256, 512, 1024] },
    ],
  },
  {
    series: "iPhone 14 Series",
    models: [
      { modelName: "iPhone 14", capacities: [128, 256, 512] },
      { modelName: "iPhone 14 Plus", capacities: [128, 256, 512] },
      { modelName: "iPhone 14 Pro", capacities: [128, 256, 512, 1024] },
      { modelName: "iPhone 14 Pro Max", capacities: [128, 256, 512, 1024] },
    ],
  },
  {
    series: "iPhone 15 Series",
    models: [
      { modelName: "iPhone 15", capacities: [128, 256, 512] },
      { modelName: "iPhone 15 Plus", capacities: [128, 256, 512] },
      { modelName: "iPhone 15 Pro", capacities: [128, 256, 512, 1024] },
      { modelName: "iPhone 15 Pro Max", capacities: [256, 512, 1024] },
    ],
  },
  {
    series: "iPhone 16 Series",
    models: [
      { modelName: "iPhone 16", capacities: [128, 256, 512] },
      { modelName: "iPhone 16 Plus", capacities: [128, 256, 512] },
      { modelName: "iPhone 16 Pro", capacities: [128, 256, 512, 1024] },
      { modelName: "iPhone 16 Pro Max", capacities: [256, 512, 1024] },
    ],
  },
]

export const IPHONE_TRADE_IN_MODELS = IPHONE_TRADE_IN_CATALOG.flatMap((series) =>
  series.models.map((model) => model.modelName)
)
