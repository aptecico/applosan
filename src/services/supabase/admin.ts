import { supabase } from '@/services/supabase/client';
import { Branch, Permission, Profile, Role, TenantUser } from '@/types/saas';
import { getAuthErrorMessage } from '@/utils/auth-errors';

export type TenantUserRow = TenantUser & {
  profiles: Pick<Profile, 'id' | 'full_name' | 'phone' | 'status'> | null;
  roles: Pick<Role, 'id' | 'name' | 'code' | 'is_system'> | null;
  branches: Pick<Branch, 'id' | 'name' | 'code'> | null;
};

export type RoleWithPermissions = Role & {
  role_permissions: {
    permission_id?: string;
    permissions: Pick<Permission, 'id' | 'code' | 'name' | 'module'> | null;
  }[];
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function listTenantUsers() {
  const { data, error } = await supabase
    .from('tenant_users')
    .select(
      'id, tenant_id, user_id, role_id, branch_id, status, created_at, updated_at, profiles(id, full_name, phone, status), roles(id, name, code, is_system), branches(id, name, code)',
    )
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    role_id: row.role_id,
    branch_id: row.branch_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    profiles: firstRelation(row.profiles),
    roles: firstRelation(row.roles),
    branches: firstRelation(row.branches),
  })) as TenantUserRow[];
}

export async function listRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select(
      'id, tenant_id, name, code, description, is_system, created_at, updated_at, role_permissions(permission_id, permissions(id, code, name, module))',
    )
    .not('tenant_id', 'is', null)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    code: row.code,
    description: row.description,
    is_system: row.is_system,
    created_at: row.created_at,
    updated_at: row.updated_at,
    role_permissions: (row.role_permissions ?? []).map((item) => ({
      permission_id: item.permission_id,
      permissions: firstRelation(item.permissions),
    })),
  })) as RoleWithPermissions[];
}

export async function getRole(roleId: string) {
  const roles = await listRoles();
  const role = roles.find((item) => item.id === roleId);
  if (!role) {
    throw new Error('Rol no encontrado.');
  }
  return role;
}

/** Reemplaza permisos de un rol personalizado (no sistema). */
export async function replaceRolePermissions(roleId: string, permissionIds: string[]) {
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id, is_system, tenant_id')
    .eq('id', roleId)
    .maybeSingle();

  if (roleError) {
    throw new Error(getAuthErrorMessage(roleError));
  }
  if (!role) {
    throw new Error('Rol no encontrado.');
  }
  if (role.is_system) {
    throw new Error('Los roles de sistema no se editan aquí. Usa un rol personalizado.');
  }

  const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role_id', roleId);
  if (deleteError) {
    throw new Error(getAuthErrorMessage(deleteError));
  }

  if (permissionIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from('role_permissions').insert(
    permissionIds.map((permission_id) => ({ role_id: roleId, permission_id })),
  );
  if (insertError) {
    throw new Error(getAuthErrorMessage(insertError));
  }
}

export async function listPermissions() {
  const { data, error } = await supabase
    .from('permissions')
    .select('id, code, name, module, description, created_at')
    .order('module', { ascending: true })
    .order('code', { ascending: true });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []) as Permission[];
}

export async function listBranches() {
  const { data, error } = await supabase
    .from('branches')
    .select('id, tenant_id, name, code, address, phone, status, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []) as Branch[];
}
