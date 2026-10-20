import { Hono } from 'hono';
import type { JWTVerifyGetKey } from 'jose';
import type { AuthGate } from './authgate/client.js';
import type { Config } from './config.js';
import { errorHandler, notFound, type Vars } from './lib/http.js';
import { originVerify } from './lib/origin-verify.js';
import { TraceRecorder } from './lib/trace.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { stepupRoutes } from './routes/stepup.js';
import type { Session } from './session/cookie.js';
import type { UserStore } from './users/store.js';

export type Deps = { config: Config; users: UserStore; authGate: AuthGate; jwks: JWTVerifyGetKey };

export type AppEnv = { Variables: Vars & { session?: Session } };

export function buildApp(deps: Deps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', originVerify(deps.config.originVerify));
  app.use('*', async (c, next) => {
    c.set('trace', new TraceRecorder(deps.config.trace));
    await next();
  });
  app.get('/api/health', (c) => c.json({ ok: true }));
  app.route('/api/auth', authRoutes(deps) as unknown as Hono<AppEnv>);
  app.route('/api/me', meRoutes(deps) as unknown as Hono<AppEnv>);
  app.route('/api/stepup', stepupRoutes(deps) as unknown as Hono<AppEnv>);
  app.onError(errorHandler);
  app.notFound(notFound);
  return app;
}
