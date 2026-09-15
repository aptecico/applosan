/**
 * Adaptador del proveedor. El resto de la app importa `@/services/backend`.
 */
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { authStorage } from '@/lib/auth-storage';
import { getSupabaseConfig } from '@/lib/env';

const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
