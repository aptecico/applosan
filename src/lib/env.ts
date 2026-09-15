const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const backendAnonKey =
  process.env.EXPO_PUBLIC_BACKEND_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseUrl = backendUrl;
export const supabaseAnonKey = backendAnonKey;

export function getBackendConfig() {
  if (!backendUrl || !backendAnonKey) {
    throw new Error(
      'Faltan EXPO_PUBLIC_BACKEND_URL/EXPO_PUBLIC_BACKEND_ANON_KEY o las equivalentes de Supabase. Copia .env.example a .env.',
    );
  }

  return { url: backendUrl, anonKey: backendAnonKey };
}

export function getSupabaseConfig() {
  const { url, anonKey } = getBackendConfig();
  return { supabaseUrl: url, supabaseAnonKey: anonKey };
}
