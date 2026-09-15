declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_BACKEND_URL?: string;
    EXPO_PUBLIC_BACKEND_ANON_KEY?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  }
}
