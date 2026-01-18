import { S3Event, S3Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const FILES_TABLE_NAME = process.env.FILES_TABLE_NAME!;
const WEBHOOKS_TABLE_NAME = process.env.WEBHOOKS_TABLE_NAME!;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN!;

interface FileRecord {
  userId: string;
  fileId: string;
  webhookId: string;
  filename: string;
  s3Key: string;
  contentType: string;
  size: number;
  status: string;
  createdAt: string;
}

interface WebhookRecord {
  userId: string;
  webhookId: string;
  webhookUrl: string;
  name: string;
  channelName: string;
}

interface DiscordWebhookResponse {
  id: string;
  channel_id: string;
}

export const handler: S3Handler = async (event: S3Event) => {
  console.log('Received S3 event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const size = record.s3.object.size;

    console.log(`Processing file: ${key} from bucket: ${bucket}`);

    // Parse the S3 key: uploads/{fileId}/{filename}
    const keyParts = key.split('/');
    if (keyParts.length < 3 || keyParts[0] !== 'uploads') {
      console.log('Skipping non-upload file:', key);
      continue;
    }

    const fileId = keyParts[1];

    try {
      // Get file record from DynamoDB to find userId and webhookId
      // We need to scan or have a GSI - for now, we'll use object metadata
      // The presigned URL should include metadata with userId and webhookId
      const fileRecord = await findFileByFileId(fileId);

      if (!fileRecord) {
        console.error(`File record not found for fileId: ${fileId}`);
        continue;
      }

      // Get webhook URL
      const webhook = await getWebhook(fileRecord.userId, fileRecord.webhookId);

      if (!webhook) {
        console.error(`Webhook not found: ${fileRecord.webhookId}`);
        await updateFileStatus(fileRecord.userId, fileId, 'error', undefined, 'Webhook not found');
        continue;
      }

      // Construct CloudFront URL
      const cloudFrontUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;

      // Execute Discord webhook with wait=true
      const discordResponse = await executeDiscordWebhook(webhook.webhookUrl, cloudFrontUrl, fileRecord.filename);

      if (discordResponse) {
        // Update file record with Discord message ID
        await updateFileStatus(fileRecord.userId, fileId, 'posted', discordResponse.id);
        console.log(`Successfully posted to Discord. Message ID: ${discordResponse.id}`);
      } else {
        await updateFileStatus(fileRecord.userId, fileId, 'error', undefined, 'Failed to post to Discord');
      }
    } catch (error) {
      console.error('Error processing file:', error);
    }
  }
};

async function findFileByFileId(fileId: string): Promise<FileRecord | null> {
  // Use the fileId-index GSI for efficient lookup
  const result = await docClient.send(
    new QueryCommand({
      TableName: FILES_TABLE_NAME,
      IndexName: 'fileId-index',
      KeyConditionExpression: 'fileId = :fileId',
      ExpressionAttributeValues: {
        ':fileId': fileId,
      },
      Limit: 1,
    })
  );

  return (result.Items?.[0] as FileRecord) ?? null;
}

async function getWebhook(userId: string, webhookId: string): Promise<WebhookRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: WEBHOOKS_TABLE_NAME,
      Key: {
        userId,
        webhookId,
      },
    })
  );

  return result.Item as WebhookRecord | null;
}

async function executeDiscordWebhook(
  webhookUrl: string,
  fileUrl: string,
  filename: string
): Promise<DiscordWebhookResponse | null> {
  try {
    // Add wait=true to get the message ID back
    const urlWithWait = `${webhookUrl}?wait=true`;

    const response = await fetch(urlWithWait, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: fileUrl,
        // Discord will automatically embed the image/video from the URL
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Discord webhook failed: ${response.status} ${errorText}`);
      return null;
    }

    const data = await response.json();
    return data as DiscordWebhookResponse;
  } catch (error) {
    console.error('Error executing Discord webhook:', error);
    return null;
  }
}

async function updateFileStatus(
  userId: string,
  fileId: string,
  status: string,
  discordMessageId?: string,
  errorMessage?: string
): Promise<void> {
  const updateExpression = discordMessageId
    ? 'SET #status = :status, discordMessageId = :messageId, postedAt = :postedAt'
    : 'SET #status = :status, errorMessage = :errorMessage';

  const expressionAttributeValues: Record<string, unknown> = {
    ':status': status,
  };

  if (discordMessageId) {
    expressionAttributeValues[':messageId'] = discordMessageId;
    expressionAttributeValues[':postedAt'] = new Date().toISOString();
  } else if (errorMessage) {
    expressionAttributeValues[':errorMessage'] = errorMessage;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: FILES_TABLE_NAME,
      Key: {
        userId,
        fileId,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
}
