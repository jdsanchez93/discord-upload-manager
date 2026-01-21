import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FileRecord, UploadUrlRequest, UploadUrlResponse } from '../types/index.js';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const tableName = process.env.FILES_TABLE_NAME || 'Files';
const bucketName = process.env.UPLOAD_BUCKET_NAME || '';
const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN || '';

export async function getFiles(
  userId: string,
  webhookId?: string
): Promise<FileRecord[]> {
  const params: {
    TableName: string;
    KeyConditionExpression: string;
    ExpressionAttributeValues: Record<string, string>;
    FilterExpression?: string;
    ScanIndexForward: boolean;
  } = {
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
    ScanIndexForward: false,
  };

  if (webhookId) {
    params.FilterExpression = 'webhookId = :webhookId';
    params.ExpressionAttributeValues[':webhookId'] = webhookId;
  }

  const result = await docClient.send(new QueryCommand(params));
  return (result.Items || []) as FileRecord[];
}

export async function getFile(
  userId: string,
  fileId: string
): Promise<FileRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { userId, fileId },
    })
  );

  return (result.Item as FileRecord) || null;
}

export async function createUploadUrl(
  userId: string,
  request: UploadUrlRequest
): Promise<UploadUrlResponse> {
  const fileId = crypto.randomUUID();
  const safeFilename = sanitizeFilename(request.filename);
  const s3Key = `uploads/${fileId}/${safeFilename}`;
  const createdAt = new Date().toISOString();

  // Create file record with 'uploading' status
  const fileRecord: FileRecord = {
    userId,
    fileId,
    filename: request.filename,
    s3Key,
    webhookId: request.webhookId,
    status: 'uploading',
    contentType: request.contentType,
    size: request.size,
    createdAt,
    cloudFrontUrl: `https://${cloudFrontDomain}/${s3Key}`,
    ...(request.customMessage && { customMessage: request.customMessage }),
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: fileRecord,
    })
  );

  // Generate presigned URL
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    ContentType: request.contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  return {
    uploadUrl,
    fileId,
    s3Key,
  };
}

export async function deleteFile(
  userId: string,
  fileId: string,
  s3Key: string,
  discordMessageId?: string,
  webhookUrl?: string
): Promise<boolean> {
  try {
    // Delete from S3
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      })
    );

    // Delete Discord message if exists
    if (discordMessageId && webhookUrl) {
      await deleteDiscordMessage(webhookUrl, discordMessageId);
    }

    // Delete from DynamoDB
    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { userId, fileId },
      })
    );

    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

async function deleteDiscordMessage(
  webhookUrl: string,
  messageId: string
): Promise<void> {
  try {
    const deleteUrl = `${webhookUrl}/messages/${messageId}`;
    const response = await fetch(deleteUrl, { method: 'DELETE' });

    if (!response.ok) {
      console.error(`Failed to delete Discord message: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting Discord message:', error);
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w\-_.]/g, '_');
}
