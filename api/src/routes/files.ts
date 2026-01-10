import { Hono } from 'hono';
import * as fileService from '../services/file.js';
import * as webhookService from '../services/webhook.js';
import { UploadUrlRequest } from '../types/index.js';

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

export default files;
