import { Hono } from 'hono';
import * as webhookService from '../services/webhook.js';
import { CreateWebhookRequest } from '../types/index.js';

const webhooks = new Hono();

// GET /webhooks - List user's webhooks
webhooks.get('/', async (c) => {
  const userId = c.get('userId');
  const result = await webhookService.getWebhooks(userId);
  return c.json(result);
});

// POST /webhooks - Create webhook
webhooks.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<CreateWebhookRequest>();

  if (!body.name || !body.webhookUrl) {
    return c.json({ error: 'name and webhookUrl are required' }, 400);
  }

  const webhook = await webhookService.createWebhook(userId, body);
  return c.json(webhook, 201);
});

// DELETE /webhooks/:id - Delete webhook
webhooks.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const webhookId = c.req.param('id');

  const success = await webhookService.deleteWebhook(userId, webhookId);
  if (!success) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  return c.body(null, 204);
});

export default webhooks;
