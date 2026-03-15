import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { supabase } from './supabase'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
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
