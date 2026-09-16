export type TenantStatus = 'active' | 'suspended' | 'cancelled';
export type BranchStatus = 'active' | 'inactive';
export type ProfileStatus = 'active' | 'inactive';
export type MembershipStatus = 'active' | 'inactive' | 'invited';
export type PlanStatus = 'active' | 'inactive';
export type BillingPeriod = 'none' | 'monthly' | 'yearly';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';

export type Tenant = {
  id: string;
  name: string;
  commercial_name: string | null;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
};

export type Branch = {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  status: BranchStatus;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  status: ProfileStatus;
  active_tenant_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Role = {
  id: string;
  tenant_id: string | null;
  name: string;
  code: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type Permission = {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  created_at: string;
};

export type TenantUser = {
  id: string;
  tenant_id: string;
  user_id: string;
  role_id: string;
  branch_id: string | null;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
};

export type Plan = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  price: number;
  billing_period: BillingPeriod;
  status: PlanStatus;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantSettings = {
  tenant_id: string;
  currency: string;
  timezone: string;
  default_min_stock: number;
  allow_credit_sales: boolean;
  allow_partial_payments: boolean;
  default_opening_cash: number;
  business_name: string | null;
  invoice_name: string | null;
  extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SessionContext = {
  profile: Profile;
  tenant: Tenant | null;
  membership: TenantUser | null;
  role: Role | null;
  branch: Branch | null;
  permissions: string[];
  subscription: Subscription | null;
  plan: Plan | null;
  features: string[];
  settings: TenantSettings | null;
};

export type RegisterTenantInput = {
  name: string;
  commercialName?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  branchName?: string;
  branchCode?: string;
};
