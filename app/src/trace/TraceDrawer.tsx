import { Affix, Badge, Box, Button, Code, Collapse, Drawer, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { monoFont } from '../theme';
import { traceStore, useTrace, type TraceEntry } from './TraceStore';

export function toCurl(e: TraceEntry): string {
  const parts = [`curl -X ${e.method} "$AUTH_GATE_URL${e.path}"`, `-H 'x-internal-access-key: <client key>'`];
  if (e.requestBody !== undefined && e.requestBody !== null) {
    parts.push(`-H 'content-type: application/json'`, `-d '${JSON.stringify(e.requestBody).replace(/'/g, `'\\''`)}'`);
  }
  return parts.join(' \\\n  ');
}

function Entry({ e }: { e: TraceEntry }) {
  const [open, setOpen] = useState(false);
  const ok = e.status < 400;
  return (
    <Box style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }} py="sm">
      <UnstyledButton onClick={() => setOpen((o) => !o)} w="100%" aria-expanded={open}>
        <Text ff={monoFont} fz="xs">
          {e.method} {e.path} →{' '}
          <Text span inherit c={ok ? 'green.7' : 'red.7'} fw={600}>
            {e.status}
          </Text>{' '}
          <Text span inherit c="dimmed">({e.ms} ms)</Text>
        </Text>
      </UnstyledButton>
      <Collapse in={open}>
        <Stack gap="xs" mt="sm">
          <Text fz="xs" c="dimmed">request</Text>
          <Code block ff={monoFont}>{JSON.stringify(e.requestBody ?? null, null, 2)}</Code>
          <Text fz="xs" c="dimmed">response</Text>
          <Code block ff={monoFont}>{JSON.stringify(e.responseBody ?? null, null, 2)}</Code>
          <Group>
            <Button size="compact-xs" variant="subtle" onClick={() => void navigator.clipboard?.writeText(toCurl(e))}>
              Copy as curl
            </Button>
          </Group>
        </Stack>
      </Collapse>
    </Box>
  );
}

const openedFromUrl = () => new URLSearchParams(window.location.search).get('trace') === '1';

export function TraceDrawer() {
  const entries = useTrace();
  const [opened, setOpened] = useState(openedFromUrl);
  // "Try it" in the docs is a client-side navigation, so watch the URL too.
  const { search } = useLocation();
  useEffect(() => {
    if (new URLSearchParams(search).get('trace') === '1') setOpened(true);
  }, [search]);
  return (
    <>
      <Affix position={{ bottom: 16, right: 16 }}>
        <Button variant="default" ff={monoFont} onClick={() => setOpened(true)}
          rightSection={<Badge size="sm" circle={entries.length < 10}>{entries.length}</Badge>}>
          trace
        </Button>
      </Affix>
      <Drawer opened={opened} onClose={() => setOpened(false)} position="right" size="lg"
        title={<Text ff={monoFont} fw={600}>auth-gate calls</Text>}>
        <Group mb="sm">
          <Button size="xs" variant="default" onClick={() => traceStore.clear()} disabled={!entries.length}>Clear</Button>
          <Button size="xs" variant="default" disabled={!entries.length}
            onClick={() => void navigator.clipboard?.writeText(entries.map(toCurl).join('\n\n'))}>
            Copy as curl
          </Button>
        </Group>
        {entries.length === 0 ? (
          <Text c="dimmed" fz="sm">
            Nothing yet. Every call the backend makes to auth-gate shows up here.
          </Text>
        ) : (
          entries.map((e, i) => <Entry key={i} e={e} />)
        )}
      </Drawer>
    </>
  );
}
