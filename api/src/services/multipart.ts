import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  FileRecord,
  InitiateUploadRequest,
  InitiateUploadResponse,
  PartUrlRequest,
  PartUrlResponse,
  CompleteUploadRequest,
  UploadPart,
} from '../types/index.js';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const tableName = process.env.FILES_TABLE_NAME || 'Files';
const bucketName = process.env.UPLOAD_BUCKET_NAME || '';
const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN || '';

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w\-_.]/g, '_');
}

export async function initiateMultipartUpload(
  userId: string,
  request: InitiateUploadRequest
): Promise<InitiateUploadResponse> {
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

  // Initiate multipart upload in S3
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: s3Key,
    ContentType: request.contentType,
  });

  const response = await s3Client.send(createCommand);

  if (!response.UploadId) {
    throw new Error('Failed to initiate multipart upload');
  }

  return {
    uploadId: response.UploadId,
    fileId,
    s3Key,
  };
}

export async function getPartUploadUrl(
  request: PartUrlRequest
): Promise<PartUrlResponse> {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: request.s3Key,
    UploadId: request.uploadId,
    PartNumber: request.partNumber,
  });

  // 1 hour expiry for each part
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return {
    url,
    partNumber: request.partNumber,
  };
}

export async function completeMultipartUpload(
  request: CompleteUploadRequest
): Promise<void> {
  // Sort parts by part number (required by S3)
  const sortedParts = [...request.parts].sort((a, b) => a.partNumber - b.partNumber);

  const completeCommand = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: request.s3Key,
    UploadId: request.uploadId,
    MultipartUpload: {
      Parts: sortedParts.map((part) => ({
        PartNumber: part.partNumber,
        ETag: part.etag,
      })),
    },
  });

  await s3Client.send(completeCommand);
}

export async function abortMultipartUpload(
  uploadId: string,
  s3Key: string
): Promise<void> {
  const abortCommand = new AbortMultipartUploadCommand({
    Bucket: bucketName,
    Key: s3Key,
    UploadId: uploadId,
  });

  await s3Client.send(abortCommand);
}
