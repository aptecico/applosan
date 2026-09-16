import { Redirect } from 'expo-router';

import { ExpenseFormScreen } from '@/features/expenses/expense-form-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function NewExpenseRoute() {
  const { hasPermission } = useWorkspace();
  if (!hasPermission('expenses.create')) return <Redirect href="/" />;
  return <ExpenseFormScreen />;
}
