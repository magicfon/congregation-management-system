import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import LineProvider from 'next-auth/providers/line'
import { compare, hash } from 'bcryptjs'
import { prisma } from './db'
import { randomUUID } from 'crypto'

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

      const data = profile as { displayName?: string; name?: string } | undefined
      const lineName = data?.displayName || data?.name || null
      const member = await prisma.member.findUnique({ where: { lineuid: lineUid } })
      if (member) {
        if (!member.active) return false
        await prisma.member.update({
          where: { id: member.id },
          data: { lineDisplayName: lineName },
        })
      } else {
        await prisma.member.create({
          data: {
            name: lineName || `LINE用戶-${lineUid.slice(0, 8)}`,
            email: `line-${randomUUID()}@line.local`,
            password: await hash(randomUUID(), 10),
            role: 'publisher', active: true,
            lineuid: lineUid, lineDisplayName: lineName,
          },
        })
      }

      return true
    },

    // Populate JWT token with member data
    async jwt({ token, user, account }) {
      if (account?.provider === 'line' && account.providerAccountId) {
        token.lineUid = account.providerAccountId
        const member = await prisma.member.findUnique({ where: { lineuid: account.providerAccountId } })
        token.id = member?.id
      } else if (user) {
        token.id = user.id
        delete token.lineUid
      }

      // Older LINE sessions used the provider UID as subject.
      const uid = typeof token.lineUid === 'string' ? token.lineUid
        : typeof token.sub === 'string' && /^U[0-9a-f]{32}$/i.test(token.sub) ? token.sub : null
      const member = typeof token.id === 'string'
        ? await prisma.member.findUnique({ where: { id: token.id } }) : null
      if (!member?.active || (uid && member.lineuid !== uid)) {
        delete token.id
        delete token.role
        token.name = null
        token.email = null
        return token
      }
      token.role = member.role
      token.name = member.name
      token.email = member.email
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        const u = session.user as typeof session.user & { role: string; id: string }
        u.role = token.role as string
        u.id = token.id as string
        u.name = token.name
        u.email = token.email
      }
      return session
    },
  },
}
