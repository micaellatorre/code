import SaleFormDialog from "@/components/sales/SaleFormDialog"

export default function EditSaleModalPage({ params }: { params: { id: string } }) {
  return <SaleFormDialog mode="edit" saleId={params.id} />
}
