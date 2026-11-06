import { handle } from 'hono/aws-lambda';
import { buildApp } from './app.js';
import { AuthGate } from './authgate/client.js';
import { remoteJwks } from './authgate/token.js';
import { loadConfig } from './config.js';
import { documentClient } from './lib/dynamo.js';
import { DynamoUserStore } from './users/store.js';

// Built once per cold start: SSM reads, clients and the JWKS cache are reused.
const config = await loadConfig();
const doc = documentClient();

const app = buildApp({
  config,
  users: new DynamoUserStore(doc, config.table),
  authGate: new AuthGate({ baseUrl: config.authGateBaseUrl, clientKey: config.authGateClientKey }),
  jwks: remoteJwks(config.authGateBaseUrl),
});

export const handler = handle(app);
