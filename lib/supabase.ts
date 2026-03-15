import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gkclvxkuvyoenpvzubxm.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrY2x2eGt1dnlvZW5wdnp1YnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MzI4NTMsImV4cCI6MjA4OTEwODg1M30.GnXkq0Sl47enU8Tk3Rh8vLZ3dpcU_Av-7v7qGOz5mL8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
