import { GetCommand, TransactWriteCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { AppError } from '../lib/http.js';

export type User = {
  userId: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export interface UserStore {
  create(u: User): Promise<void>;
  getByUsername(username: string): Promise<User | null>;
  getById(userId: string): Promise<User | null>;
  updateEmail(userId: string, email: string): Promise<void>;
}

export class MemoryUserStore implements UserStore {
  private byName = new Map<string, User>();
  private byId = new Map<string, User>();

  async create(u: User): Promise<void> {
    if (this.byName.has(u.username)) throw new AppError(409, 'username_taken');
    const copy = { ...u };
    this.byName.set(u.username, copy);
    this.byId.set(u.userId, copy);
  }
  async getByUsername(username: string): Promise<User | null> {
    const u = this.byName.get(username);
    return u ? { ...u } : null;
  }
  async getById(userId: string): Promise<User | null> {
    const u = this.byId.get(userId);
    return u ? { ...u } : null;
  }
  async updateEmail(userId: string, email: string): Promise<void> {
    const u = this.byId.get(userId);
    if (u) u.email = email;
  }
}

const SK = 'META';
const userKey = (username: string) => ({ pk: `U#${username}`, sk: SK });
const idKey = (userId: string) => ({ pk: `I#${userId}`, sk: SK });

export class DynamoUserStore implements UserStore {
  constructor(
    private doc: DynamoDBDocumentClient,
    private table: string,
  ) {}

  async create(u: User): Promise<void> {
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.table,
                Item: {
                  ...userKey(u.username),
                  userId: u.userId,
                  email: u.email,
                  passwordHash: u.passwordHash,
                  createdAt: u.createdAt,
                },
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
            {
              Put: {
                TableName: this.table,
                Item: { ...idKey(u.userId), username: u.username },
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
          ],
        }),
      );
    } catch (e) {
      if (e instanceof TransactionCanceledException) throw new AppError(409, 'username_taken');
      throw e;
    }
  }

  async getByUsername(username: string): Promise<User | null> {
    const r = await this.doc.send(new GetCommand({ TableName: this.table, Key: userKey(username) }));
    if (!r.Item) return null;
    const { userId, email, passwordHash, createdAt } = r.Item as Omit<User, 'username'>;
    return { userId, username, email, passwordHash, createdAt };
  }

  async getById(userId: string): Promise<User | null> {
    const r = await this.doc.send(new GetCommand({ TableName: this.table, Key: idKey(userId) }));
    const username = (r.Item as { username?: string } | undefined)?.username;
    return username ? this.getByUsername(username) : null;
  }

  async updateEmail(userId: string, email: string): Promise<void> {
    const r = await this.doc.send(new GetCommand({ TableName: this.table, Key: idKey(userId) }));
    const username = (r.Item as { username?: string } | undefined)?.username;
    if (!username) return;
    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: userKey(username),
        UpdateExpression: 'SET email = :e',
        ConditionExpression: 'attribute_exists(pk)',
        ExpressionAttributeValues: { ':e': email },
      }),
    );
  }
}
