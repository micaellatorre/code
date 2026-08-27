"use client"

import { useRouter } from "next/navigation"
import { FormDialog } from "@/components/ui/dialog"
import SellerCommissionEditor from "./SellerCommissionEditor"
import type { CommissionPlanDto, SellerCommissionDto, SellerCommissionSaleDto } from "@/lib/domain/commissions"

type Seller = {
  id: string
  name: string | null
  email: string
  isActive: boolean
  currentBranch: { id: string; code: string; name: string } | null
}

type SellerCommissionDialogProps = {
  seller: Seller
  plans: CommissionPlanDto[]
  sales: SellerCommissionSaleDto[]
  commissions: SellerCommissionDto[]
}

export default function SellerCommissionDialog(props: SellerCommissionDialogProps) {
  const router = useRouter()

  function closeDialog() {
    router.back()
  }

  return (
    <FormDialog
      open
      title={`Comisiones de ${props.seller.name ?? props.seller.email}`}
      description="Genera y administra comisiones por venta del vendedor."
      size="fullscreen"
      responsiveFullscreen={false}
      onClose={closeDialog}
      footer={
        <button type="button" className="btn btn-ghost" onClick={closeDialog}>
          Volver
        </button>
      }
    >
      <SellerCommissionEditor {...props} />
    </FormDialog>
  )
}
