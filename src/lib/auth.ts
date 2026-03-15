import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import LineProvider from 'next-auth/providers/line'
import { compare } from 'bcryptjs'
import { supabase } from './supabase'
import { supabase as supabaseServer } from './supabase-server'

type MemberRow = {
  id: string
  email: string
  name: string
  role: string
  active: boolean
  lineuid: string | null
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
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

        const { data: member, error } = await supabase
          .from('members')
          .select('*')
          .eq('email', credentials.email)
          .single()

        if (error || !member || !member.active) return null

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
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID ?? '',
      clientSecret: process.env.LINE_CLIENT_SECRET ?? '',
    }),
  ],

  callbacks: {
    // Validate LINE users against our members table; reject unknown LINE UIDs.
    async signIn({ account }) {
      if (account?.provider !== 'line') return true

      const lineUid = account.providerAccountId
      if (!lineUid) return false

      const { data: member, error } = await supabaseServer
        .from('members')
        .select('id, active')
        .eq('lineuid', lineUid)
        .single()

      if (error || !member || !member.active) {
        // Redirect back to login with a descriptive error code
        return '/login?error=LineNotLinked'
      }

      return true
    },

    // Populate JWT token with our member's data on first sign-in.
    async jwt({ token, user, account }) {
      // LINE OAuth: look up member by LINE UID to get our internal data
      if (account?.provider === 'line' && account.providerAccountId) {
        const { data: member } = await supabaseServer
          .from('members')
          .select('id, email, name, role')
          .eq('lineuid', account.providerAccountId)
          .single<MemberRow>()

        if (member) {
          token.id = member.id
          token.role = member.role
          token.email = member.email
          token.name = member.name
        }
        return token
      }

      // Credentials provider: user object already has our member data
      if (user) {
        token.role = (user as typeof user & { role: string }).role
        token.id = user.id
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
