import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { MultipartUploadService } from '../../core/services/multipart-upload.service';
import { Webhook } from '../../shared/models/webhook.model';

interface UploadItem {
  file: File;
  previewUrl?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container">
      <h2>Upload Files</h2>
    
      <!-- Webhook Selection -->
      @if (webhooks().length > 0) {
        <div class="card webhook-select">
          <label for="webhook">Select Webhook</label>
          <select id="webhook" [(ngModel)]="selectedWebhookId">
            <option value="">Choose a webhook...</option>
            @for (webhook of webhooks(); track webhook) {
              <option [value]="webhook.webhookId">
                {{ webhook.name }} {{ webhook.channelName ? '(' + webhook.channelName + ')' : '' }}
              </option>
            }
          </select>
        </div>
      }
    
      @if (webhooks().length === 0 && !loading()) {
        <div class="no-webhooks card">
          <p>No webhooks configured.</p>
          <button class="primary" (click)="goToWebhooks()">Add Webhook</button>
        </div>
      }
    
      <!-- Custom Message -->
      @if (selectedWebhookId) {
        <div class="card message-input">
          <label for="customMessage">Message (optional)</label>
          <input
            type="text"
            id="customMessage"
            [(ngModel)]="customMessage"
            placeholder="Add a message to appear with your upload..."
            maxlength="500"
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
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p>Drag and drop files here, or click to select</p>
            <span>Images and videos only</span>
          </div>
        </div>
      }
    
      <!-- Upload Queue -->
      @if (uploadQueue().length > 0) {
        <div class="upload-queue">
          <h3>Upload Queue</h3>
          @for (item of uploadQueue(); track item; let i = $index) {
            <div class="queue-item">
              <div class="file-preview">
                @if (item.previewUrl) {
                  <img [src]="item.previewUrl" alt="Preview" />
                }
                @if (!item.previewUrl) {
                  <div class="video-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                }
              </div>
              <div class="file-info">
                <span class="filename">{{ item.file.name }}</span>
                <span class="filesize">{{ formatFileSize(item.file.size) }}</span>
                @if (item.status === 'uploading') {
                  <div class="progress-bar">
                    <div class="progress" [style.width.%]="item.progress"></div>
                  </div>
                }
                <span class="status" [class]="item.status">
                  {{ item.status === 'complete' ? 'Uploaded' : item.status === 'error' ? item.error : '' }}
                </span>
              </div>
              @if (item.status === 'pending') {
                <button
                  class="remove-btn"
                  (click)="removeFromQueue(i)"
                  >
                  X
                </button>
              }
            </div>
          }
        </div>
      }
    
      <!-- Upload Button -->
      @if (uploadQueue().length > 0 && hasQueuedItems()) {
        <div class="upload-actions">
          <button class="primary" (click)="uploadAll()" [disabled]="uploading()">
            {{ uploading() ? 'Uploading...' : 'Upload All' }}
          </button>
        </div>
      }
    </div>
    `,
  styles: [`
    h2 {
      margin-bottom: 24px;
    }

    .webhook-select {
      margin-bottom: 24px;

      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
      }

      select {
        width: 100%;
        padding: 10px 12px;
        background-color: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        color: var(--text-primary);
        font-size: 14px;

        &:focus {
          outline: none;
          border-color: var(--primary-color);
        }
      }
    }

    .no-webhooks {
      text-align: center;
      padding: 32px;

      p {
        margin-bottom: 16px;
        color: var(--text-secondary);
      }
    }

    .message-input {
      margin-bottom: 24px;

      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
      }

      input {
        width: 100%;
        padding: 10px 12px;
        background-color: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        color: var(--text-primary);
        font-size: 14px;

        &:focus {
          outline: none;
          border-color: var(--primary-color);
        }

        &::placeholder {
          color: var(--text-secondary);
        }
      }
    }

    .drop-zone {
      border: 2px dashed var(--border-color);
      border-radius: 8px;
      padding: 48px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 24px;

      &:hover, &.drag-over {
        border-color: var(--primary-color);
        background-color: rgba(88, 101, 242, 0.1);
      }

      .drop-zone-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: var(--text-secondary);

        svg {
          opacity: 0.5;
        }

        p {
          font-size: 16px;
          font-weight: 500;
        }

        span {
          font-size: 14px;
        }
      }
    }

    .upload-queue {
      h3 {
        margin-bottom: 16px;
      }
    }

    .queue-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px;
      background-color: var(--surface-color);
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .file-preview {
      width: 60px;
      height: 60px;
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

      .video-icon {
        color: var(--text-secondary);
      }
    }

    .file-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .filename {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 300px;
      }

      .filesize {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .progress-bar {
        height: 4px;
        background-color: var(--background-color);
        border-radius: 2px;
        overflow: hidden;

        .progress {
          height: 100%;
          background-color: var(--primary-color);
          transition: width 0.2s;
        }
      }

      .status {
        font-size: 12px;

        &.complete {
          color: var(--success-color);
        }

        &.error {
          color: var(--error-color);
        }
      }
    }

    .remove-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 8px;

      &:hover {
        color: var(--error-color);
      }
    }

    .upload-actions {
      margin-top: 24px;
      text-align: center;
    }
  `]
})
export class UploadComponent implements OnInit {
  private api = inject(ApiService);
  private multipartUpload = inject(MultipartUploadService);
  private router = inject(Router);

  webhooks = signal<Webhook[]>([]);
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
        // Update status to uploading
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

        // Check if file needs multipart upload (>50MB)
        if (this.multipartUpload.needsMultipart(item.file)) {
          // Use multipart upload for large files
          await this.multipartUpload.upload(
            item.file,
            this.selectedWebhookId,
            updateProgress,
            this.customMessage || undefined
          );
        } else {
          // Use single PUT upload for small files
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

        // Mark as complete
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
