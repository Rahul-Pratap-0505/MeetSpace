// Re-export the supabase client and types from the integrations folder
export { supabase } from '@/integrations/supabase/client'
export type { Database } from '@/integrations/supabase/types'

// Keep the existing Database type for backwards compatibility
export type {
  Database as LegacyDatabase
} from '@/integrations/supabase/types'
