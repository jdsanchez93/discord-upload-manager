import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Webhook } from '../../shared/models/webhook.model';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-webhooks',
  standalone: true,
  imports: [
    FormsModule,
    CardModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    FloatLabelModule,
    InputGroupModule,
    InputGroupAddonModule,
    ConfirmDialogModule,
    SkeletonModule
  ],
  providers: [ConfirmationService],
  template: `
    <div class="container">
      <div class="page-header">
        <h2>Webhooks</h2>
        <p-button
          label="Add Webhook"
          icon="pi pi-plus"
          (onClick)="showAddDialog = true"
        />
      </div>

      <!-- Add Webhook Dialog -->
      <p-dialog
        header="Add New Webhook"
        [(visible)]="showAddDialog"
        [modal]="true"
        [style]="{ width: '90vw', maxWidth: '500px' }"
        [draggable]="false"
        [resizable]="false"
      >
        <form (ngSubmit)="addWebhook()" class="webhook-form">
          <div class="field">
            <p-floatlabel>
              <input
                pInputText
                id="name"
                [(ngModel)]="newWebhook.name"
                name="name"
                class="w-full"
                required
              />
              <label for="name">Name</label>
            </p-floatlabel>
            <small class="text-secondary">e.g., Photos Channel</small>
          </div>

          <div class="field">
            <p-floatlabel>
              <input
                pInputText
                id="webhookUrl"
                [(ngModel)]="newWebhook.webhookUrl"
                name="webhookUrl"
                class="w-full"
                required
              />
              <label for="webhookUrl">Webhook URL</label>
            </p-floatlabel>
            <small class="text-secondary">https://discord.com/api/webhooks/...</small>
          </div>

          <div class="field">
            <p-floatlabel>
              <input
                pInputText
                id="serverName"
                [(ngModel)]="newWebhook.serverName"
                name="serverName"
                class="w-full"
              />
              <label for="serverName">Server Name (optional)</label>
            </p-floatlabel>
          </div>

          <div class="field">
            <label for="channelName" class="block mb-2 text-secondary">Channel Name (optional)</label>
            <p-inputgroup>
              <p-inputgroup-addon>#</p-inputgroup-addon>
              <input
                pInputText
                id="channelName"
                [(ngModel)]="newWebhook.channelName"
                name="channelName"
                placeholder="photos"
              />
            </p-inputgroup>
          </div>
        </form>

        <ng-template #footer>
          <div class="flex justify-content-end gap-2">
            <p-button
              label="Cancel"
              [outlined]="true"
              severity="secondary"
              (onClick)="cancelAdd()"
            />
            <p-button
              label="Add Webhook"
              icon="pi pi-check"
              [loading]="loading()"
              (onClick)="addWebhook()"
            />
          </div>
        </ng-template>
      </p-dialog>

      <!-- Confirm Delete Dialog -->
      <p-confirmDialog />

      <!-- Loading State -->
      @if (loading() && webhooks().length === 0) {
        <div class="flex flex-column gap-3">
          @for (i of [1, 2, 3]; track i) {
            <p-card>
              <div class="flex justify-content-between align-items-center">
                <div class="flex-1">
                  <p-skeleton width="40%" height="1.5rem" styleClass="mb-2" />
                  <p-skeleton width="60%" height="1rem" styleClass="mb-2" />
                  <p-skeleton width="80%" height="0.875rem" />
                </div>
                <p-skeleton width="80px" height="2.5rem" />
              </div>
            </p-card>
          }
        </div>
      }

      <!-- Webhooks List -->
      @if (!loading() || webhooks().length > 0) {
        <div class="flex flex-column gap-3">
          @for (webhook of webhooks(); track webhook.webhookId) {
            <p-card styleClass="webhook-card">
              <div class="flex flex-column sm:flex-row justify-content-between align-items-start sm:align-items-center gap-3">
                <div class="webhook-info flex-1">
                  <h4 class="m-0 mb-2 text-lg">{{ webhook.name }}</h4>
                  @if (webhook.serverName || webhook.channelName) {
                    <p class="m-0 mb-1 text-primary">
                      {{ formatLocation(webhook.serverName, webhook.channelName) }}
                    </p>
                  }
                  <p class="m-0 mb-2 text-sm text-secondary font-mono webhook-url">
                    {{ maskWebhookUrl(webhook.webhookUrl) }}
                  </p>
                  <p class="m-0 text-xs text-secondary">
                    Added {{ formatDate(webhook.createdAt) }}
                  </p>
                </div>
                <p-button
                  label="Delete"
                  icon="pi pi-trash"
                  severity="danger"
                  [outlined]="true"
                  size="small"
                  [loading]="loading()"
                  (onClick)="confirmDelete(webhook)"
                />
              </div>
            </p-card>
          }

          @if (webhooks().length === 0) {
            <div class="empty-state">
              <i class="pi pi-link"></i>
              <h3>No webhooks configured</h3>
              <p>Add a webhook to start uploading files to Discord.</p>
              <p-button
                label="Add Your First Webhook"
                icon="pi pi-plus"
                (onClick)="showAddDialog = true"
                class="mt-3"
              />
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .webhook-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding-top: 0.5rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .text-secondary {
      color: var(--text-secondary);
    }

    .text-primary {
      color: var(--primary-color);
    }

    .font-mono {
      font-family: monospace;
    }

    .webhook-url {
      word-break: break-all;
      overflow-wrap: break-word;
    }

    .webhook-info {
      min-width: 0;
    }

    :host ::ng-deep {
      .webhook-card {
        border: 1px solid var(--border-color);

        .p-card-body {
          padding: 1rem;
        }
      }

      .p-floatlabel {
        width: 100%;
      }

      .p-dialog-content {
        padding-bottom: 0;
      }
    }
  `]
})
export class WebhooksComponent implements OnInit {
  private api = inject(ApiService);
  private confirmationService = inject(ConfirmationService);

  webhooks = signal<Webhook[]>([]);
  loading = signal(false);
  showAddDialog = false;
  newWebhook = {
    name: '',
    webhookUrl: '',
    serverName: '',
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
      serverName: this.newWebhook.serverName || undefined,
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

  confirmDelete(webhook: Webhook) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${webhook.name}"?`,
      header: 'Delete Webhook',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteWebhook(webhook)
    });
  }

  deleteWebhook(webhook: Webhook) {
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
    this.showAddDialog = false;
    this.newWebhook = { name: '', webhookUrl: '', serverName: '', channelName: '' };
  }

  maskWebhookUrl(url: string): string {
    const match = url.match(/^https:\/\/discord\.com\/api\/webhooks\/(\d+)\/.+$/);
    return match ? `Webhook ID: ${match[1]}` : 'Invalid webhook URL';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  formatLocation(serverName?: string, channelName?: string): string {
    const channel = channelName ? `#${channelName.replace(/^#/, '')}` : '';
    if (serverName && channel) {
      return `${serverName} > ${channel}`;
    }
    return serverName || channel;
  }
}
