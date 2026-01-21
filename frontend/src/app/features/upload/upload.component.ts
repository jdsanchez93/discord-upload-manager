import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { MultipartUploadService } from '../../core/services/multipart-upload.service';
import { Webhook } from '../../shared/models/webhook.model';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { FloatLabelModule } from 'primeng/floatlabel';

interface UploadItem {
  file: File;
  previewUrl?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface WebhookOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    FormsModule,
    SelectModule,
    ButtonModule,
    InputTextModule,
    ProgressBarModule,
    TagModule,
    CardModule,
    FloatLabelModule
  ],
  template: `
    <div class="container">
      <h2>Upload Files</h2>

      <!-- Webhook Selection -->
      @if (webhooks().length > 0) {
        <p-card styleClass="mb-4">
          <div class="flex flex-column gap-3">
            <div class="field">
              <label for="webhook" class="block mb-2 font-medium">Select Webhook</label>
              <p-select
                id="webhook"
                [options]="webhookOptions()"
                [(ngModel)]="selectedWebhookId"
                placeholder="Choose a webhook..."
                styleClass="w-full"
              />
            </div>

            @if (selectedWebhookId) {
              <div class="field">
                <p-floatlabel>
                  <input
                    pInputText
                    id="customMessage"
                    [(ngModel)]="customMessage"
                    maxlength="500"
                    class="w-full"
                  />
                  <label for="customMessage">Message (optional)</label>
                </p-floatlabel>
              </div>
            }
          </div>
        </p-card>
      }

      @if (webhooks().length === 0 && !loading()) {
        <div class="empty-state">
          <i class="pi pi-link"></i>
          <h3>No webhooks configured</h3>
          <p>Add a webhook to start uploading files.</p>
          <p-button
            label="Add Webhook"
            icon="pi pi-plus"
            (onClick)="goToWebhooks()"
            class="mt-3"
          />
        </div>
      }

      <!-- Drop Zone -->
      @if (selectedWebhookId) {
        <div
          class="drop-zone"
          [class.drag-over]="isDragOver"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
        >
          <input
            #fileInput
            type="file"
            multiple
            accept="image/*,video/*"
            (change)="onFileSelect($event)"
            hidden
          />
          <div class="drop-zone-content">
            <i class="pi pi-cloud-upload" style="font-size: 3rem"></i>
            <p>Drag and drop files here, or click to select</p>
            <span>Images and videos only</span>
          </div>
        </div>
      }

      <!-- Upload Queue -->
      @if (uploadQueue().length > 0) {
        <div class="upload-queue">
          <div class="flex justify-content-between align-items-center mb-3">
            <h3 class="m-0">Upload Queue</h3>
            @if (hasQueuedItems()) {
              <p-button
                label="Upload All"
                icon="pi pi-upload"
                [loading]="uploading()"
                (onClick)="uploadAll()"
              />
            }
          </div>

          <div class="flex flex-column gap-2">
            @for (item of uploadQueue(); track item; let i = $index) {
              <div class="queue-item">
                <div class="file-preview">
                  @if (item.previewUrl) {
                    <img [src]="item.previewUrl" alt="Preview" />
                  } @else {
                    <i class="pi pi-play-circle" style="font-size: 1.5rem; color: var(--text-secondary)"></i>
                  }
                </div>

                <div class="file-info">
                  <div class="flex align-items-center gap-2 mb-1">
                    <span class="filename">{{ item.file.name }}</span>
                    @if (item.status === 'complete') {
                      <p-tag value="Uploaded" severity="success" />
                    } @else if (item.status === 'error') {
                      <p-tag [value]="item.error || 'Error'" severity="danger" />
                    }
                  </div>
                  <span class="filesize">{{ formatFileSize(item.file.size) }}</span>

                  @if (item.status === 'uploading') {
                    <p-progressbar
                      [value]="item.progress"
                      [showValue]="true"
                      styleClass="mt-2"
                      [style]="{ height: '6px' }"
                    />
                  }
                </div>

                @if (item.status === 'pending') {
                  <p-button
                    icon="pi pi-times"
                    [rounded]="true"
                    [text]="true"
                    severity="secondary"
                    (onClick)="removeFromQueue(i)"
                  />
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    h2 {
      margin-bottom: 1.5rem;
    }

    .field {
      display: flex;
      flex-direction: column;
    }

    .drop-zone {
      border: 2px dashed var(--border-color);
      border-radius: 8px;
      padding: 3rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 1.5rem;

      &:hover, &.drag-over {
        border-color: var(--primary-color);
        background-color: rgba(88, 101, 242, 0.1);
      }

      .drop-zone-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        color: var(--text-secondary);

        .pi {
          opacity: 0.5;
        }

        p {
          font-size: 1rem;
          font-weight: 500;
          margin: 0;
        }

        span {
          font-size: 0.875rem;
        }
      }
    }

    .upload-queue {
      h3 {
        font-size: 1.125rem;
      }
    }

    .queue-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      background-color: var(--surface-color);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    .file-preview {
      width: 60px;
      height: 60px;
      min-width: 60px;
      border-radius: 4px;
      overflow: hidden;
      background-color: var(--background-color);
      display: flex;
      align-items: center;
      justify-content: center;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .file-info {
      flex: 1;
      min-width: 0;

      .filename {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
      }

      .filesize {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
    }

    :host ::ng-deep {
      .p-card {
        .p-card-body {
          padding: 1.25rem;
        }
      }

      .p-progressbar {
        .p-progressbar-value {
          background: var(--primary-color);
        }
      }
    }

    @media (max-width: 576px) {
      .drop-zone {
        padding: 2rem 1rem;
      }

      .queue-item {
        flex-wrap: wrap;
      }

      .file-info {
        order: 1;
        width: calc(100% - 76px);
      }
    }
  `]
})
export class UploadComponent implements OnInit {
  private api = inject(ApiService);
  private multipartUpload = inject(MultipartUploadService);
  private router = inject(Router);

  webhooks = signal<Webhook[]>([]);
  webhookOptions = signal<WebhookOption[]>([]);
  uploadQueue = signal<UploadItem[]>([]);
  loading = signal(false);
  uploading = signal(false);
  selectedWebhookId = '';
  customMessage = '';
  isDragOver = false;

  ngOnInit() {
    this.loadWebhooks();
  }

  loadWebhooks() {
    this.loading.set(true);
    this.api.getWebhooks().subscribe({
      next: (webhooks) => {
        this.webhooks.set(webhooks);
        this.webhookOptions.set(
          webhooks.map(w => ({
            label: w.name + (w.channelName ? ` (#${w.channelName})` : ''),
            value: w.webhookId
          }))
        );
        if (webhooks.length === 1) {
          this.selectedWebhookId = webhooks[0].webhookId;
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load webhooks:', err);
        this.loading.set(false);
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files) {
      this.addFiles(Array.from(files));
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  addFiles(files: File[]) {
    const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const newItems: UploadItem[] = validFiles.map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      progress: 0,
      status: 'pending' as const
    }));
    this.uploadQueue.update(queue => [...queue, ...newItems]);
  }

  removeFromQueue(index: number) {
    const item = this.uploadQueue()[index];
    if (item?.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    this.uploadQueue.update(queue => queue.filter((_, i) => i !== index));
  }

  hasQueuedItems(): boolean {
    return this.uploadQueue().some(item => item.status === 'pending');
  }

  async uploadAll() {
    if (!this.selectedWebhookId) return;

    this.uploading.set(true);

    for (let i = 0; i < this.uploadQueue().length; i++) {
      const item = this.uploadQueue()[i];
      if (item.status !== 'pending') continue;

      try {
        this.uploadQueue.update(queue => {
          const newQueue = [...queue];
          newQueue[i] = { ...item, status: 'uploading', progress: 0 };
          return newQueue;
        });

        const updateProgress = (progress: number) => {
          this.uploadQueue.update(queue => {
            const newQueue = [...queue];
            newQueue[i] = { ...newQueue[i], progress };
            return newQueue;
          });
        };

        if (this.multipartUpload.needsMultipart(item.file)) {
          await this.multipartUpload.upload(
            item.file,
            this.selectedWebhookId,
            updateProgress,
            this.customMessage || undefined
          );
        } else {
          const response = await firstValueFrom(
            this.api.getUploadUrl({
              filename: item.file.name,
              webhookId: this.selectedWebhookId,
              contentType: item.file.type || 'application/octet-stream',
              size: item.file.size,
              customMessage: this.customMessage || undefined,
            })
          );

          await this.uploadToS3(response.uploadUrl, item.file, updateProgress);
        }

        this.uploadQueue.update(queue => {
          const newQueue = [...queue];
          newQueue[i] = { ...newQueue[i], status: 'complete', progress: 100 };
          return newQueue;
        });
      } catch (error) {
        console.error('Upload failed:', error);
        this.uploadQueue.update(queue => {
          const newQueue = [...queue];
          newQueue[i] = { ...newQueue[i], status: 'error', error: 'Upload failed' };
          return newQueue;
        });
      }
    }

    this.uploading.set(false);
  }

  private uploadToS3(url: string, file: File, onProgress: (progress: number) => void): Promise<void> {
    const upload$ = this.api.uploadToS3(url, file).pipe(
      tap(event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      }),
      catchError(err => {
        onProgress(0);
        console.error('S3 upload error:', err);
        throw err;
      })
    );

    return lastValueFrom(upload$).then(() => {
      onProgress(100);
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  goToWebhooks() {
    this.router.navigate(['/webhooks']);
  }
}
