export interface Webhook {
  userId: string;
  webhookId: string;
  name: string;
  webhookUrl: string;
  channelName?: string;
  createdAt: string;
}

export interface CreateWebhookRequest {
  name: string;
  webhookUrl: string;
  channelName?: string;
}
