import { Hono } from 'hono';
import * as fileService from '../services/file.js';
import * as multipartService from '../services/multipart.js';
import * as webhookService from '../services/webhook.js';
import {
  UploadUrlRequest,
  InitiateUploadRequest,
  PartUrlRequest,
  CompleteUploadRequest,
  AbortUploadRequest,
} from '../types/index.js';

const files = new Hono();

// GET /files - List user's files
files.get('/', async (c) => {
  const userId = c.get('userId');
  const webhookId = c.req.query('webhookId');

  const result = await fileService.getFiles(userId, webhookId);
  return c.json(result);
});

// GET /files/:id - Get file details
files.get('/:id', async (c) => {
  const userId = c.get('userId');
  const fileId = c.req.param('id');

  const file = await fileService.getFile(userId, fileId);
  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  return c.json(file);
});

// POST /files/upload-url - Get presigned upload URL
files.post('/upload-url', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<UploadUrlRequest>();

  if (!body.filename || !body.webhookId || !body.contentType) {
    return c.json({ error: 'filename, webhookId, and contentType are required' }, 400);
  }

  // Verify webhook exists and belongs to user
  const webhook = await webhookService.getWebhook(userId, body.webhookId);
  if (!webhook) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const result = await fileService.createUploadUrl(userId, body);
  return c.json(result);
});

// DELETE /files/:id - Delete file
files.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const fileId = c.req.param('id');

  const file = await fileService.getFile(userId, fileId);
  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  // Get webhook to delete Discord message
  const webhook = await webhookService.getWebhook(userId, file.webhookId);

  const success = await fileService.deleteFile(
    userId,
    fileId,
    file.s3Key,
    file.discordMessageId,
    webhook?.webhookUrl
  );

  if (!success) {
    return c.json({ error: 'Failed to delete file' }, 500);
  }

  return c.body(null, 204);
});

// ============ Multipart Upload Routes ============

// POST /files/upload/initiate - Start multipart upload
files.post('/upload/initiate', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<InitiateUploadRequest>();

  if (!body.filename || !body.webhookId || !body.contentType || !body.size) {
    return c.json({ error: 'filename, webhookId, contentType, and size are required' }, 400);
  }

  // Verify webhook exists and belongs to user
  const webhook = await webhookService.getWebhook(userId, body.webhookId);
  if (!webhook) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const result = await multipartService.initiateMultipartUpload(userId, body);
  return c.json(result);
});

// POST /files/upload/part-url - Get presigned URL for a part
files.post('/upload/part-url', async (c) => {
  const body = await c.req.json<PartUrlRequest>();

  if (!body.uploadId || !body.s3Key || !body.partNumber) {
    return c.json({ error: 'uploadId, s3Key, and partNumber are required' }, 400);
  }

  const result = await multipartService.getPartUploadUrl(body);
  return c.json(result);
});

// POST /files/upload/complete - Complete multipart upload
files.post('/upload/complete', async (c) => {
  const body = await c.req.json<CompleteUploadRequest>();

  if (!body.uploadId || !body.s3Key || !body.fileId || !body.parts || body.parts.length === 0) {
    return c.json({ error: 'uploadId, s3Key, fileId, and parts are required' }, 400);
  }

  await multipartService.completeMultipartUpload(body);
  return c.json({ success: true });
});

// POST /files/upload/abort - Abort multipart upload
files.post('/upload/abort', async (c) => {
  const body = await c.req.json<AbortUploadRequest>();

  if (!body.uploadId || !body.s3Key) {
    return c.json({ error: 'uploadId and s3Key are required' }, 400);
  }

  await multipartService.abortMultipartUpload(body.uploadId, body.s3Key);
  return c.json({ success: true });
});

export default files;
