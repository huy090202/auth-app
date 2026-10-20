import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

export type Config = {
  stage: string;
  table: string;
  authGateBaseUrl: string;
  authGateClientId: string;
  authGateClientKey: string;
  sessionSecret: string;
  originVerify: string | null;
  trace: boolean;
  dynamoEndpoint?: string;
};

type Env = Record<string, string | undefined>;

export async function loadConfig(env: Env = process.env): Promise<Config> {
  const stage = env.STAGE ?? '';
  let clientKey = env.AUTHGATE_CLIENT_KEY;
  let sessionSecret = env.SESSION_SECRET;
  let origin = env.ORIGIN_VERIFY;
  const onLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  if (onLambda && !stage) throw new Error('STAGE is required on Lambda');

  if (stage && (!clientKey || !sessionSecret || !origin)) {
    const ssm = new SSMClient({ region: 'ap-southeast-1' });
    const get = async (name: string): Promise<string> => {
      const r = await ssm.send(
        new GetParameterCommand({ Name: `/auth-app/${stage}/${name}`, WithDecryption: true }),
      );
      const v = r.Parameter?.Value;
      if (!v) throw new Error(`missing SSM parameter /auth-app/${stage}/${name}`);
      return v;
    };
    [clientKey, sessionSecret, origin] = await Promise.all([
      clientKey || get('authgate-client-key'),
      sessionSecret || get('session-secret'),
      origin || get('origin-verify'),
    ]);
  }

  if (!sessionSecret) throw new Error('SESSION_SECRET is empty');
  if (onLambda && !origin) throw new Error('ORIGIN_VERIFY is required on Lambda');

  const cfg: Config = {
    stage,
    table: env.TABLE ?? 'auth-app-local',
    authGateBaseUrl: env.AUTHGATE_BASE_URL ?? '',
    authGateClientId: env.AUTHGATE_CLIENT_ID ?? '',
    authGateClientKey: clientKey ?? '',
    sessionSecret,
    originVerify: origin || null,
    trace: env.TRACE === '1',
  };
  if (env.DYNAMO_ENDPOINT) cfg.dynamoEndpoint = env.DYNAMO_ENDPOINT;
  return cfg;
}
