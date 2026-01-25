import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://viepcknoasmnnhltmftv.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_tcIYUMQR-0ZrN90O_XpU2g_IM-EJ7s0'

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)