export function getAuthErrorMessage(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: string }).message)
      : String(error);

  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión.';
  }
  if (normalized.includes('user already registered')) {
    return 'Ya existe una cuenta con este correo.';
  }
  if (normalized.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (normalized.includes('unable to validate email')) {
    return 'El correo no es válido.';
  }
  if (normalized.includes('not authenticated')) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  }
  if (normalized.includes('profile does not exist')) {
    return 'Falta tu perfil. Ejecuta el hotfix en Supabase (hotfix_ensure_profile.sql) e intenta de nuevo.';
  }
  if (normalized.includes('default free plan is not seeded')) {
    return 'Falta el plan Gratis en la base de datos. Revisa el catálogo en Supabase.';
  }
  if (normalized.includes('admin role template is not seeded')) {
    return 'Faltan los roles del sistema en la base de datos.';
  }

  return message || 'Ocurrió un error inesperado.';
}
