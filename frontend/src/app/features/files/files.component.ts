import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { FileRecord } from '../../shared/models/file.model';
import { Webhook } from '../../shared/models/webhook.model';

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container">
      <div class="page-header">
        <h2>Files</h2>
        <div class="filter">
          <select [(ngModel)]="selectedWebhookId" (ngModelChange)="loadFiles()">
            <option value="">All Webhooks</option>
            @for (webhook of webhooks(); track webhook) {
              <option [value]="webhook.webhookId">
                {{ webhook.name }}
              </option>
            }
          </select>
        </div>
      </div>
    
      <!-- Loading State -->
      @if (loading()) {
        <div class="loading">
          <p>Loading files...</p>
        </div>
      }
    
      <!-- Files Grid -->
      @if (!loading() && files().length > 0) {
        <div class="files-grid">
          @for (file of files(); track file) {
            <div class="file-card">
              <div class="file-preview" (click)="openFile(file)">
                @if (isImage(file)) {
                  <img [src]="file.cloudFrontUrl" [alt]="file.filename" loading="lazy" />
                }
                @if (!isImage(file)) {
                  <div class="video-preview">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                }
                <div class="status-badge" [class]="file.status">
                  {{ getStatusLabel(file.status) }}
                </div>
              </div>
              <div class="file-info">
                <span class="filename" [title]="file.filename">{{ file.filename }}</span>
                <span class="metadata">
                  {{ formatFileSize(file.size) }} - {{ formatDate(file.createdAt) }}
                </span>
              </div>
              <div class="file-actions">
                <button class="secondary" (click)="copyUrl(file)" title="Copy URL">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
                <button class="danger" (click)="deleteFile(file)" title="Delete">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          }
        </div>
      }
    
      <!-- Empty State -->
      @if (!loading() && files().length === 0) {
        <div class="empty-state card">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <h3>No files yet</h3>
          <p>Upload some files to see them here.</p>
        </div>
      }
    
      <!-- File Preview Modal -->
      @if (previewFile()) {
        <div class="modal-backdrop" (click)="closePreview()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <button class="close-btn" (click)="closePreview()">X</button>
            @if (isImage(previewFile()!)) {
              <img [src]="previewFile()!.cloudFrontUrl" [alt]="previewFile()!.filename" />
            }
            @if (!isImage(previewFile()!)) {
              <video [src]="previewFile()!.cloudFrontUrl" controls autoplay></video>
            }
            <div class="preview-info">
              <h4>{{ previewFile()!.filename }}</h4>
              <p>{{ formatFileSize(previewFile()!.size) }} - {{ formatDate(previewFile()!.createdAt) }}</p>
              <a [href]="previewFile()!.cloudFrontUrl" target="_blank" class="primary">Open in new tab</a>
            </div>
          </div>
        </div>
      }
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

      .filter select {
        padding: 8px 12px;
        background-color: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        color: var(--text-primary);
        font-size: 14px;
      }
    }

    .loading {
      text-align: center;
      padding: 48px;
      color: var(--text-secondary);
    }

    .files-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }

    .file-card {
      background-color: var(--surface-color);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border-color);
      transition: transform 0.2s, box-shadow 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
    }

    .file-preview {
      position: relative;
      aspect-ratio: 1;
      background-color: var(--background-color);
      cursor: pointer;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .video-preview {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
      }

      .status-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;

        &.posted {
          background-color: rgba(59, 165, 92, 0.9);
          color: white;
        }

        &.uploading {
          background-color: rgba(250, 166, 26, 0.9);
          color: white;
        }

        &.error {
          background-color: rgba(237, 66, 69, 0.9);
          color: white;
        }
      }
    }

    .file-info {
      padding: 12px;

      .filename {
        display: block;
        font-weight: 500;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
      }

      .metadata {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }

    .file-actions {
      display: flex;
      gap: 8px;
      padding: 0 12px 12px;

      button {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
      }
    }

    .empty-state {
      text-align: center;
      padding: 64px;

      svg {
        color: var(--text-secondary);
        opacity: 0.5;
        margin-bottom: 16px;
      }

      h3 {
        margin-bottom: 8px;
      }

      p {
        color: var(--text-secondary);
      }
    }

    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 24px;
    }

    .modal-content {
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      align-items: center;

      .close-btn {
        position: absolute;
        top: -40px;
        right: 0;
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 8px;
      }

      img, video {
        max-width: 100%;
        max-height: 70vh;
        border-radius: 8px;
      }

      .preview-info {
        margin-top: 16px;
        text-align: center;
        color: white;

        h4 {
          margin-bottom: 8px;
        }

        p {
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        a {
          display: inline-block;
          padding: 8px 16px;
          background-color: var(--primary-color);
          color: white;
          border-radius: 4px;
          text-decoration: none;

          &:hover {
            background-color: var(--primary-hover);
          }
        }
      }
    }
  `]
})
export class FilesComponent implements OnInit {
  private api = inject(ApiService);

  files = signal<FileRecord[]>([]);
  webhooks = signal<Webhook[]>([]);
  loading = signal(false);
  selectedWebhookId = '';
  previewFile = signal<FileRecord | null>(null);

  ngOnInit() {
    this.loadWebhooks();
    this.loadFiles();
  }

  loadWebhooks() {
    this.api.getWebhooks().subscribe({
      next: (webhooks) => this.webhooks.set(webhooks),
      error: (err) => console.error('Failed to load webhooks:', err)
    });
  }

  loadFiles() {
    this.loading.set(true);
    const webhookId = this.selectedWebhookId || undefined;

    this.api.getFiles(webhookId).subscribe({
      next: (files) => {
        this.files.set(files);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load files:', err);
        this.loading.set(false);
      }
    });
  }

  openFile(file: FileRecord) {
    this.previewFile.set(file);
  }

  closePreview() {
    this.previewFile.set(null);
  }

  copyUrl(file: FileRecord) {
    if (file.cloudFrontUrl) {
      navigator.clipboard.writeText(file.cloudFrontUrl);
    }
  }

  deleteFile(file: FileRecord) {
    if (!confirm(`Delete "${file.filename}"? This will also remove it from Discord.`)) return;

    this.api.deleteFile(file.fileId).subscribe({
      next: () => {
        this.files.update(files => files.filter(f => f.fileId !== file.fileId));
      },
      error: (err) => {
        console.error('Failed to delete file:', err);
        alert('Failed to delete file');
      }
    });
  }

  isImage(file: FileRecord): boolean {
    return file.contentType.startsWith('image/');
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'posted': return 'Posted';
      case 'uploading': return 'Processing';
      case 'error': return 'Error';
      default: return status;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }
}
