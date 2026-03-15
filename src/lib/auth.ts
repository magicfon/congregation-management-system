import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { supabase } from './supabase'
import { supabase as supabaseServer } from './supabase-server'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    // Email / password login
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const { data: member, error } = await supabase
          .from('members')
          .select('*')
          .eq('email', credentials.email)
          .single()

        if (error || !member || !member.active) {
          return null
        }

        const isPasswordValid = await compare(credentials.password, member.password)
        if (!isPasswordValid) {
          return null
        }

        return {
          id: member.id,
          email: member.email,
          name: member.name,
          role: member.role,
        }
      },
    }),

    // LINE LIFF login — authenticates by LINE UID stored in members.lineuid
    CredentialsProvider({
      id: 'line',
      name: 'LINE',
      credentials: {
        lineuid: { label: 'LINE UID', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.lineuid) {
          return null
        }

        const { data: member, error } = await supabaseServer
          .from('members')
          .select('*')
          .eq('lineuid', credentials.lineuid)
          .single()

        if (error || !member || !member.active) {
          return null
        }

        return {
          id: member.id,
          email: member.email,
          name: member.name,
          role: member.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as typeof user & { role: string }).role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { role: string; id: string }).role = token.role as string
        ;(session.user as typeof session.user & { role: string; id: string }).id = token.id as string
      }
      return session
    },
  },
}
