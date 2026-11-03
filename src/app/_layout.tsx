import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { ProjectProvider } from '@/state/ProjectContext';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  const { t } = useT();
  return (
    <SafeAreaProvider>
      <ProjectProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="editor" options={{ title: t('nav.editor') }} />
          <Stack.Screen name="export" options={{ title: t('nav.export'), presentation: 'modal' }} />
        </Stack>
      </ProjectProvider>
    </SafeAreaProvider>
  );
}
