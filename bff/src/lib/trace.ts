export type TraceEntry = {
  method: string;
  path: string;
  requestBody: unknown;
  status: number;
  responseBody: unknown;
  ms: number;
};

export function redact(body: unknown): unknown {
  if (Array.isArray(body)) return body.map(redact);
  if (body === null || typeof body !== 'object') return body;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'pin') out[key] = '***';
    else if (key === 'credential') out[key] = { redacted: true };
    else if ((key === 'token' || key === 'stepUpToken') && typeof value === 'string') {
      out[key] = `${value.slice(0, 16)}…`;
    } else out[key] = redact(value);
  }
  return out;
}

export class TraceRecorder {
  private readonly list: TraceEntry[] = [];

  constructor(private readonly enabled: boolean) {}

  record(e: TraceEntry): void {
    if (!this.enabled) return;
    this.list.push({ ...e, requestBody: redact(e.requestBody), responseBody: redact(e.responseBody) });
  }

  entries(): TraceEntry[] | undefined {
    return this.enabled ? [...this.list] : undefined;
  }
}
