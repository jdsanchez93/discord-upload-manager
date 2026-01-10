import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Webhook } from '../../shared/models/webhook.model';

@Component({
  selector: 'app-webhooks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="page-header">
        <h2>Webhooks</h2>
        <button class="primary" (click)="showAddForm = true" *ngIf="!showAddForm">
          Add Webhook
        </button>
      </div>

      <!-- Add Webhook Form -->
      <div class="card add-form" *ngIf="showAddForm">
        <h3>Add New Webhook</h3>
        <form (ngSubmit)="addWebhook()">
          <div class="form-group">
            <label for="name">Name</label>
            <input
              id="name"
              type="text"
              [(ngModel)]="newWebhook.name"
              name="name"
              placeholder="e.g., Photos Channel"
              required
            />
          </div>
          <div class="form-group">
            <label for="webhookUrl">Webhook URL</label>
            <input
              id="webhookUrl"
              type="url"
              [(ngModel)]="newWebhook.webhookUrl"
              name="webhookUrl"
              placeholder="https://discord.com/api/webhooks/..."
              required
            />
          </div>
          <div class="form-group">
            <label for="channelName">Channel Name (optional)</label>
            <input
              id="channelName"
              type="text"
              [(ngModel)]="newWebhook.channelName"
              name="channelName"
              placeholder="e.g., #photos"
            />
          </div>
          <div class="form-actions">
            <button type="button" class="secondary" (click)="cancelAdd()">Cancel</button>
            <button type="submit" class="primary" [disabled]="loading()">
              {{ loading() ? 'Adding...' : 'Add Webhook' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Webhooks List -->
      <div class="webhooks-list">
        <div class="card webhook-card" *ngFor="let webhook of webhooks()">
          <div class="webhook-info">
            <h4>{{ webhook.name }}</h4>
            <p class="channel-name" *ngIf="webhook.channelName">{{ webhook.channelName }}</p>
            <p class="webhook-url">{{ maskWebhookUrl(webhook.webhookUrl) }}</p>
            <p class="created-at">Added {{ formatDate(webhook.createdAt) }}</p>
          </div>
          <div class="webhook-actions">
            <button class="danger" (click)="deleteWebhook(webhook)" [disabled]="loading()">
              Delete
            </button>
          </div>
        </div>

        <div class="empty-state" *ngIf="webhooks().length === 0 && !loading()">
          <p>No webhooks configured yet.</p>
          <p>Add a webhook to start uploading files to Discord.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;

      h2 {
        margin: 0;
      }
    }

    .add-form {
      margin-bottom: 24px;

      h3 {
        margin-bottom: 16px;
      }
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 16px;
    }

    .webhooks-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .webhook-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .webhook-info {
      h4 {
        margin: 0 0 8px 0;
        font-size: 16px;
      }

      p {
        margin: 0;
        font-size: 14px;
        color: var(--text-secondary);
      }

      .channel-name {
        color: var(--primary-color);
        margin-bottom: 4px;
      }

      .webhook-url {
        font-family: monospace;
        font-size: 12px;
      }

      .created-at {
        margin-top: 8px;
        font-size: 12px;
      }
    }

    .empty-state {
      text-align: center;
      padding: 48px;
      color: var(--text-secondary);

      p {
        margin: 8px 0;
      }
    }
  `]
})
export class WebhooksComponent implements OnInit {
  private api = inject(ApiService);

  webhooks = signal<Webhook[]>([]);
  loading = signal(false);
  showAddForm = false;
  newWebhook = {
    name: '',
    webhookUrl: '',
    channelName: ''
  };

  ngOnInit() {
    this.loadWebhooks();
  }

  loadWebhooks() {
    this.loading.set(true);
    this.api.getWebhooks().subscribe({
      next: (webhooks) => {
        this.webhooks.set(webhooks);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load webhooks:', err);
        this.loading.set(false);
      }
    });
  }

  addWebhook() {
    if (!this.newWebhook.name || !this.newWebhook.webhookUrl) return;

    this.loading.set(true);
    this.api.createWebhook({
      name: this.newWebhook.name,
      webhookUrl: this.newWebhook.webhookUrl,
      channelName: this.newWebhook.channelName || undefined
    }).subscribe({
      next: (webhook) => {
        this.webhooks.update(list => [webhook, ...list]);
        this.cancelAdd();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to add webhook:', err);
        this.loading.set(false);
      }
    });
  }

  deleteWebhook(webhook: Webhook) {
    if (!confirm(`Delete webhook "${webhook.name}"?`)) return;

    this.loading.set(true);
    this.api.deleteWebhook(webhook.webhookId).subscribe({
      next: () => {
        this.webhooks.update(list => list.filter(w => w.webhookId !== webhook.webhookId));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to delete webhook:', err);
        this.loading.set(false);
      }
    });
  }

  cancelAdd() {
    this.showAddForm = false;
    this.newWebhook = { name: '', webhookUrl: '', channelName: '' };
  }

  maskWebhookUrl(url: string): string {
    // Show only first part of the webhook URL for security
    const match = url.match(/^(https:\/\/discord\.com\/api\/webhooks\/\d+)\/.+$/);
    return match ? `${match[1]}/...` : url.substring(0, 50) + '...';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }
}
