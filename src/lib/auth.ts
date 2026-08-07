import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import LineProvider from 'next-auth/providers/line'
import { compare, hash } from 'bcryptjs'
import { prisma } from './db'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    // Session stays valid for 30 days of activity.
    // Token refreshes every 24h (sliding window).
    maxAge: 30 * 24 * 60 * 60,       // 30 days
    updateAge: 24 * 60 * 60,          // 1 day
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    // ── Email / password ──────────────────────────────────────────────────────
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const member = await prisma.member.findUnique({
          where: { email: credentials.email },
        })

        if (!member || !member.active) return null

        const isPasswordValid = await compare(credentials.password, member.password)
        if (!isPasswordValid) return null

        return {
          id: member.id,
          email: member.email,
          name: member.name,
          role: member.role,
        }
      },
    }),

    // ── LINE OAuth ────────────────────────────────────────────────────────────
    // Anyone with a LINE account can sign in. Role defaults to 'publisher'.
    // Admins can promote users to 'elder' or 'admin' afterwards.
    ...(process.env.LINE_CLIENT_ID && process.env.LINE_CLIENT_SECRET
      ? [LineProvider({
          clientId: process.env.LINE_CLIENT_ID,
          clientSecret: process.env.LINE_CLIENT_SECRET,
        })]
      : []),
  ],

  callbacks: {
    // LINE login: auto-create or auto-login any user.
    // Everyone is allowed in; role defaults to 'publisher'.
    async signIn({ account, profile }) {
      if (account?.provider !== 'line') return true

      const lineUid = account.providerAccountId
      if (!lineUid) return false

      const lineEmail = (profile as any)?.email
      const lineName = (profile as any)?.displayName
        || (profile as any)?.name
        || `LINE用戶-${lineUid.slice(0, 8)}`

      // Check if member exists by lineuid or email
      let member = await prisma.member.findFirst({
        where: { lineuid: lineUid },
      })

      if (!member && lineEmail) {
        member = await prisma.member.findUnique({
          where: { email: lineEmail },
        })
      }

      if (!member) {
        // Auto-create a new publisher account
        member = await prisma.member.create({
          data: {
            name: lineName,
            email: lineEmail || `line-${lineUid}@line.local`,
            password: await hash(
              `line-oauth-${lineUid}-${Date.now()}`, 10
            ),
            role: 'publisher',
            active: true,
            lineuid: lineUid,
          },
        })
      } else if (!member.lineuid) {
        // Link LINE UID to existing member
        await prisma.member.update({
          where: { id: member.id },
          data: { lineuid: lineUid },
        })
      }

      return true
    },

    // Populate JWT token with member data
    async jwt({ token, user, account }) {
      // LINE OAuth: look up member by LINE UID
      if (account?.provider === 'line' && account.providerAccountId) {
        const member = await prisma.member.findFirst({
          where: {
            OR: [
              { lineuid: account.providerAccountId },
              { email: (token.email ?? '') as string },
            ]
          },
        })

        if (member) {
          token.id = member.id
          token.role = member.role
          token.email = member.email
          token.name = member.name
        }
        return token
      }

      // Credentials provider: user object already has member data
      if (user) {
        token.role = (user as typeof user & { role: string }).role
        token.id = (user as typeof user & { id: string }).id
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        const u = session.user as typeof session.user & { role: string; id: string }
        u.role = token.role as string
        u.id = token.id as string
      }
      return session
    },
  },
}
