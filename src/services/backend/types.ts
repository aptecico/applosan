/** Tipos de auth del producto. No dependen de un SDK concreto (Supabase, InsForge, etc.). */
export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};
