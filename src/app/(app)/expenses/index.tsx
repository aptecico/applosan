import { Redirect } from 'expo-router';

import { ExpensesListScreen } from '@/features/expenses/expenses-list-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function ExpensesIndexRoute() {
  const { hasPermission } = useWorkspace();
  if (!hasPermission('expenses.view') && !hasPermission('expenses.create')) {
    return <Redirect href="/" />;
  }
  return <ExpensesListScreen />;
}
