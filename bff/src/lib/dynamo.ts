import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export function documentClient(endpoint?: string): DynamoDBDocumentClient {
  const client = new DynamoDBClient(
    endpoint
      ? {
          endpoint,
          region: process.env.AWS_REGION ?? 'us-east-1',
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        }
      : {},
  );
  return DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
}

/** Local only: create the pk/sk table if it is missing. */
export async function ensureTable(doc: DynamoDBDocumentClient, table: string): Promise<void> {
  const client = doc.send.bind(doc) as unknown as DynamoDBClient['send'];
  try {
    await client(new DescribeTableCommand({ TableName: table }));
  } catch (e) {
    if (!(e instanceof ResourceNotFoundException)) throw e;
    await client(
      new CreateTableCommand({
        TableName: table,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
      }),
    );
  }
}
