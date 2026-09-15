import type { Session } from '@supabase/supabase-js';

import type { AuthSession } from '@/services/backend/types';
import { supabase } from '@/services/supabase/client';
import { RegisterTenantInput, SessionContext } from '@/types/saas';
import { getAuthErrorMessage } from '@/utils/auth-errors';

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session?.user) {
    return null;
  }

  return {
    accessToken: session.access_token,
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
    },
  };
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
  return toAuthSession(data.session);
}

export function subscribeAuth(onSession: (session: AuthSession | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    onSession(toAuthSession(nextSession));
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return toAuthSession(data.session);
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
): Promise<{ session: AuthSession | null }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
    },
  });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return { session: toAuthSession(data.session) };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const { data, error } = await supabase.rpc('get_my_session_context');
  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
  return (data as SessionContext | null) ?? null;
}

export async function registerTenant(input: RegisterTenantInput): Promise<string> {
  const { data, error } = await supabase.rpc('register_tenant', {
    p_name: input.name,
    p_commercial_name: input.commercialName ?? null,
    p_document_number: input.documentNumber ?? null,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_address: input.address ?? null,
    p_branch_name: input.branchName ?? 'Principal',
    p_branch_code: input.branchCode ?? 'MAIN',
  });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return data as string;
}

export async function updateOwnProfile(values: { full_name?: string; phone?: string | null }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error(getAuthErrorMessage(userError ?? new Error('Not authenticated')));
  }

  const { error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userData.user.id);

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}
