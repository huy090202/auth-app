import { serve } from '@hono/node-server';
import { buildApp } from './app.js';
import { AuthGate } from './authgate/client.js';
import { remoteJwks } from './authgate/token.js';
import { loadConfig } from './config.js';
import { documentClient, ensureTable } from './lib/dynamo.js';
import { DynamoUserStore } from './users/store.js';

const config = await loadConfig();
const doc = documentClient(config.dynamoEndpoint);
if (config.dynamoEndpoint) await ensureTable(doc, config.table);

const app = buildApp({
  config,
  users: new DynamoUserStore(doc, config.table),
  authGate: new AuthGate({ baseUrl: config.authGateBaseUrl, clientKey: config.authGateClientKey }),
  jwks: remoteJwks(config.authGateBaseUrl),
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`bff listening on :${port}`);
