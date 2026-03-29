import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import prisma from "@/lib/prisma"

type Role = "ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO"

const SIMULABLE_ROLES: Role[] = ["VENDEDOR", "STOCK", "SOCIO"]

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      })

      if (!dbUser) return false
      if (!dbUser.isActive) return false

      await prisma.user.update({
        where: { email: user.email },
        data: { lastLoginAt: new Date() },
      })

      return true
    },

    async jwt({ token, trigger, session }) {
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        })

        if (dbUser) {
          token.uid = dbUser.id
          token.role = dbUser.role
          token.tenantId = dbUser.tenantId
          token.isActive = dbUser.isActive

          if (!token.activeRole) {
            token.activeRole = dbUser.role
          }

          if (dbUser.role !== "ADMIN") {
            token.activeRole = dbUser.role
          }
        }
      }

      if (trigger === "update" && session?.activeRole) {
        const requestedRole = session.activeRole as Role

        if (token.role === "ADMIN") {
          if (requestedRole === "ADMIN" || SIMULABLE_ROLES.includes(requestedRole)) {
            token.activeRole = requestedRole
          }
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string
        session.user.role = token.role as Role
        session.user.activeRole = (token.activeRole as Role) ?? (token.role as Role)
        session.user.tenantId = token.tenantId ?? null
        session.user.isActive = Boolean(token.isActive)
        session.user.isSimulatingRole = session.user.role === "ADMIN" && session.user.activeRole !== "ADMIN"
      }

      return session
    },
  },
}