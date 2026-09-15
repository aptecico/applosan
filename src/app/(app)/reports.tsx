import { ModulePlaceholder } from '@/features/shared/module-placeholder';

export default function ReportsRoute() {
  return (
    <ModulePlaceholder
      description="Reportes básicos del plan. Los avanzados requieren plan superior."
      permission="reports.view"
      title="Reportes"
    />
  );
}
