import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Webhook, CreateWebhookRequest } from '../types/index.js';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.WEBHOOKS_TABLE_NAME || 'Webhooks';

export async function getWebhooks(userId: string): Promise<Webhook[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    })
  );

  return (result.Items || []) as Webhook[];
}

export async function getWebhook(
  userId: string,
  webhookId: string
): Promise<Webhook | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { userId, webhookId },
    })
  );

  return (result.Item as Webhook) || null;
}

export async function createWebhook(
  userId: string,
  request: CreateWebhookRequest
): Promise<Webhook> {
  const webhookId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const webhook: Webhook = {
    userId,
    webhookId,
    name: request.name,
    webhookUrl: request.webhookUrl,
    serverName: request.serverName,
    channelName: request.channelName,
    createdAt,
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: webhook,
    })
  );

  return webhook;
}

export async function deleteWebhook(
  userId: string,
  webhookId: string
): Promise<boolean> {
  const result = await docClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { userId, webhookId },
      ReturnValues: 'ALL_OLD',
    })
  );

  return !!result.Attributes;
}
