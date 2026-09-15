import { ComingSoonScreen } from '@/features/shared/coming-soon-screen';

type Props = {
  title: string;
  description: string;
  permission?: string;
};

export function ModulePlaceholder({ title, description, permission }: Props) {
  return (
    <ComingSoonScreen description={description} permission={permission} title={title} />
  );
}
