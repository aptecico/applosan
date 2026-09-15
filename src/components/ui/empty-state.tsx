import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: AppIconName;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon = 'package', action }: EmptyStateProps) {
  return (
    <Card>
      <View style={styles.body}>
        <AppIcon name={icon} size={28} themeColor="textSecondary" />
        <ThemedText type="section">{title}</ThemedText>
        {description ? (
          <ThemedText themeColor="textSecondary" style={styles.description}>
            {description}
          </ThemedText>
        ) : null}
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  description: {
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.two,
    width: '100%',
  },
});
