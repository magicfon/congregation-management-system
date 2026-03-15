import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gkclvxkuvyoenpvzubxm.supabase.co'
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || ''

if (!supabaseSecretKey) {
  console.warn('Warning: SUPABASE_SECRET_KEY not configured')
}

export const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
