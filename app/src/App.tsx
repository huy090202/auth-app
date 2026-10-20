import { ActionIcon, AppShell, Container, Group, SegmentedControl, Text, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { Link } from 'react-router';
import { useLang, type Lang } from './lib/i18n';
import { AppRoutes } from './routes';
import { monoFont } from './theme';
import { TraceDrawer } from './trace/TraceDrawer';

function SchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  const next = scheme === 'dark' ? 'light' : 'dark';
  return (
    <ActionIcon variant="default" onClick={() => setColorScheme(next)} aria-label={`Switch to ${next} theme`}>
      <Text fz="xs" ff={monoFont}>{scheme === 'dark' ? 'L' : 'D'}</Text>
    </ActionIcon>
  );
}

export function App() {
  const [lang, setLang] = useLang();
  return (
    <AppShell header={{ height: 52 }} padding="lg">
      <AppShell.Header style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="lg">
            <Text component={Link} to="/docs/what-it-is" ff={monoFont} fw={600}>auth-app</Text>
            <Text component={Link} to="/docs/what-it-is" fz="sm">Docs</Text>
            <Text component={Link} to="/app/login" fz="sm">Demo</Text>
          </Group>
          <Group gap="sm">
            <SegmentedControl size="xs" value={lang} onChange={(v) => setLang(v as Lang)}
              data={[{ label: 'EN', value: 'en' }, { label: 'VI', value: 'vi' }]} />
            <SchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="72ch" px={0}>
          <AppRoutes />
        </Container>
      </AppShell.Main>
      <TraceDrawer />
    </AppShell>
  );
}
