import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { FileRecord } from '../../shared/models/file.model';
import { Webhook } from '../../shared/models/webhook.model';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { ImageModule } from 'primeng/image';

interface WebhookOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [
    FormsModule,
    SelectModule,
    ButtonModule,
    DialogModule,
    TagModule,
    SkeletonModule,
    ConfirmDialogModule,
    TooltipModule,
    ImageModule
  ],
  providers: [ConfirmationService],
  template: `
    <div class="container">
      <div class="page-header">
        <h2>Files</h2>
        <p-select
          [options]="webhookOptions()"
          [(ngModel)]="selectedWebhookId"
          (ngModelChange)="loadFiles()"
          placeholder="All Webhooks"
          [showClear]="true"
          styleClass="webhook-filter"
        />
      </div>

      <!-- Loading State -->
      @if (loading() && files().length === 0) {
        <div class="files-grid">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="file-card">
              <p-skeleton height="200px" styleClass="mb-2" />
              <div class="p-3">
                <p-skeleton width="80%" height="1rem" styleClass="mb-2" />
                <p-skeleton width="60%" height="0.875rem" />
              </div>
            </div>
          }
        </div>
      }

      <!-- Files Grid -->
      @if (!loading() || files().length > 0) {
        @if (files().length > 0) {
          <div class="files-grid">
            @for (file of files(); track file.fileId) {
              <div class="file-card">
                <div class="file-preview" (click)="openFile(file)">
                  @if (isImage(file)) {
                    <img [src]="file.cloudFrontUrl" [alt]="file.filename" loading="lazy" />
                  } @else {
                    <div class="video-preview">
                      <i class="pi pi-play-circle" style="font-size: 3rem"></i>
                    </div>
                  }
                  <p-tag
                    [value]="getStatusLabel(file.status)"
                    [severity]="getStatusSeverity(file.status)"
                    styleClass="status-tag"
                  />
                </div>
                <div class="file-info">
                  <span class="filename" [title]="file.filename">{{ file.filename }}</span>
                  <span class="metadata">
                    {{ formatFileSize(file.size) }} · {{ formatDate(file.createdAt) }}
                  </span>
                </div>
                <div class="file-actions">
                  <p-button
                    icon="pi pi-copy"
                    [outlined]="true"
                    severity="secondary"
                    size="small"
                    pTooltip="Copy URL"
                    tooltipPosition="top"
                    (onClick)="copyUrl(file)"
                  />
                  <p-button
                    icon="pi pi-trash"
                    [outlined]="true"
                    severity="danger"
                    size="small"
                    pTooltip="Delete"
                    tooltipPosition="top"
                    (onClick)="confirmDelete(file)"
                  />
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">
            <i class="pi pi-images"></i>
            <h3>No files yet</h3>
            <p>Upload some files to see them here.</p>
          </div>
        }
      }

      <!-- Confirm Delete Dialog -->
      <p-confirmDialog />

      <!-- File Preview Dialog -->
      <p-dialog
        [(visible)]="showPreview"
        [modal]="true"
        [dismissableMask]="true"
        [style]="{ width: '90vw', maxWidth: '1200px' }"
        [contentStyle]="{ padding: 0, background: 'transparent' }"
        [showHeader]="false"
        styleClass="preview-dialog"
      >
        @if (previewFile()) {
          <div class="preview-content">
            <p-button
              icon="pi pi-times"
              [rounded]="true"
              severity="secondary"
              styleClass="close-btn"
              (onClick)="closePreview()"
            />
            @if (isImage(previewFile()!)) {
              <img
                [src]="previewFile()!.cloudFrontUrl"
                [alt]="previewFile()!.filename"
                class="preview-media"
              />
            } @else {
              <video
                [src]="previewFile()!.cloudFrontUrl"
                controls
                autoplay
                class="preview-media"
              ></video>
            }
            <div class="preview-info">
              <h4>{{ previewFile()!.filename }}</h4>
              <p>{{ formatFileSize(previewFile()!.size) }} · {{ formatDate(previewFile()!.createdAt) }}</p>
              <div class="flex gap-2 justify-content-center mt-3">
                <p-button
                  label="Copy URL"
                  icon="pi pi-copy"
                  [outlined]="true"
                  size="small"
                  (onClick)="copyUrl(previewFile()!)"
                />
                <p-button
                  label="Open in new tab"
                  icon="pi pi-external-link"
                  size="small"
                  (onClick)="openInNewTab(previewFile()!)"
                />
              </div>
            </div>
          </div>
        }
      </p-dialog>
    </div>
  `,
  styles: [`
    .webhook-filter {
      min-width: 200px;
    }

    .files-grid {
      display: grid;
      grid-template-columns: repeat(1, 1fr);
      gap: 1rem;
    }

    @media (min-width: 576px) {
      .files-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 768px) {
      .files-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (min-width: 992px) {
      .files-grid {
        grid-template-columns: repeat(4, 1fr);
      }
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
    }

    :host ::ng-deep .status-tag {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      font-size: 0.625rem;
      text-transform: uppercase;
    }

    .file-info {
      padding: 0.75rem;

      .filename {
        display: block;
        font-weight: 500;
        font-size: 0.875rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 0.25rem;
      }

      .metadata {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
    }

    .file-actions {
      display: flex;
      gap: 0.5rem;
      padding: 0 0.75rem 0.75rem;
    }

    .preview-content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    :host ::ng-deep {
      .preview-dialog {
        .p-dialog-content {
          background: transparent;
          border-radius: 8px;
          overflow: visible;
        }
      }

      .close-btn {
        position: absolute;
        top: -3rem;
        right: 0;
        z-index: 1;
      }
    }

    .preview-media {
      max-width: 100%;
      max-height: 70vh;
      border-radius: 8px;
    }

    .preview-info {
      margin-top: 1rem;
      text-align: center;
      color: white;

      h4 {
        margin: 0 0 0.5rem 0;
        word-break: break-all;
      }

      p {
        margin: 0;
        color: var(--text-secondary);
      }
    }
  `]
})
export class FilesComponent implements OnInit {
  private api = inject(ApiService);
  private confirmationService = inject(ConfirmationService);

  files = signal<FileRecord[]>([]);
  webhooks = signal<Webhook[]>([]);
  webhookOptions = signal<WebhookOption[]>([]);
  loading = signal(false);
  selectedWebhookId: string | null = null;
  previewFile = signal<FileRecord | null>(null);
  showPreview = false;

  ngOnInit() {
    this.loadWebhooks();
    this.loadFiles();
  }

  loadWebhooks() {
    this.api.getWebhooks().subscribe({
      next: (webhooks) => {
        this.webhooks.set(webhooks);
        this.webhookOptions.set(
          webhooks.map(w => ({ label: w.name, value: w.webhookId }))
        );
      },
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
    this.showPreview = true;
  }

  closePreview() {
    this.showPreview = false;
    this.previewFile.set(null);
  }

  copyUrl(file: FileRecord) {
    if (file.cloudFrontUrl) {
      navigator.clipboard.writeText(file.cloudFrontUrl);
    }
  }

  openInNewTab(file: FileRecord) {
    if (file.cloudFrontUrl) {
      window.open(file.cloudFrontUrl, '_blank');
    }
  }

  confirmDelete(file: FileRecord) {
    this.confirmationService.confirm({
      message: `Delete "${file.filename}"? This will also remove it from Discord.`,
      header: 'Delete File',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteFile(file)
    });
  }

  deleteFile(file: FileRecord) {
    this.api.deleteFile(file.fileId).subscribe({
      next: () => {
        this.files.update(files => files.filter(f => f.fileId !== file.fileId));
      },
      error: (err) => {
        console.error('Failed to delete file:', err);
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

  getStatusSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' {
    switch (status) {
      case 'posted': return 'success';
      case 'uploading': return 'warn';
      case 'error': return 'danger';
      default: return 'info';
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
