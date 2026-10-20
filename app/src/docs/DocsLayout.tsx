import { Box, Group, NavLink, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useLang } from '../lib/i18n';
import { pages } from './loader';

// The EN/VI toggle and the Demo link live in the app header (App.tsx), shared with /app.
export function DocsLayout({ children }: { children: ReactNode }) {
  const [lang] = useLang();
  const { page } = useParams();
  return (
    <Group align="flex-start" gap="xl" wrap="nowrap">
      <Box component="nav" w={180} style={{ flexShrink: 0, position: 'sticky', top: 76 }} visibleFrom="sm">
        <Text fz="xs" c="dimmed" tt="uppercase" mb="xs">auth-gate</Text>
        <Stack gap={0}>
          {pages[lang].map((p) => (
            <NavLink key={p.slug} component={Link} to={`/docs/${p.slug}`} label={p.title}
              active={p.slug === page} variant="subtle" px="xs" py={4} />
          ))}
        </Stack>
      </Box>
      <Box style={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Group>
  );
}
