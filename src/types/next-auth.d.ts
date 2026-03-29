import { DefaultSession } from "next-auth"

type Role = "ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role: Role
      activeRole: Role
      tenantId?: string | null
      isActive: boolean
      isSimulatingRole: boolean
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string
    role?: Role
    activeRole?: Role
    tenantId?: string | null
    isActive?: boolean
  }
}