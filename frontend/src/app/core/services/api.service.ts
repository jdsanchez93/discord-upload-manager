import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Webhook, CreateWebhookRequest } from '../../shared/models/webhook.model';
import { FileRecord, UploadUrlRequest, UploadUrlResponse } from '../../shared/models/file.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Webhooks
  getWebhooks(): Observable<Webhook[]> {
    return this.http.get<Webhook[]>(`${this.apiUrl}/webhooks`);
  }

  createWebhook(request: CreateWebhookRequest): Observable<Webhook> {
    return this.http.post<Webhook>(`${this.apiUrl}/webhooks`, request);
  }

  deleteWebhook(webhookId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/webhooks/${webhookId}`);
  }

  // Files
  getFiles(webhookId?: string): Observable<FileRecord[]> {
    const params = webhookId ? `?webhookId=${webhookId}` : '';
    return this.http.get<FileRecord[]>(`${this.apiUrl}/files${params}`);
  }

  getFile(fileId: string): Observable<FileRecord> {
    return this.http.get<FileRecord>(`${this.apiUrl}/files/${fileId}`);
  }

  getUploadUrl(request: UploadUrlRequest): Observable<UploadUrlResponse> {
    return this.http.post<UploadUrlResponse>(`${this.apiUrl}/files/upload-url`, request);
  }

  deleteFile(fileId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/files/${fileId}`);
  }

  // Direct S3 upload
  uploadToS3(uploadUrl: string, file: File): Observable<void> {
    return this.http.put<void>(uploadUrl, file, {
      headers: {
        'Content-Type': file.type
      }
    });
  }
}
