import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Webhook, CreateWebhookRequest } from '../../shared/models/webhook.model';
import {
  FileRecord,
  UploadUrlRequest,
  UploadUrlResponse,
  InitiateUploadRequest,
  InitiateUploadResponse,
  PartUrlRequest,
  PartUrlResponse,
  CompleteUploadRequest,
  AbortUploadRequest,
} from '../../shared/models/file.model';

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

  // Direct S3 upload (single PUT for small files)
  uploadToS3(uploadUrl: string, file: File): Observable<HttpEvent<void>> {
    return this.http.put<void>(uploadUrl, file, {
      reportProgress: true,
      observe: 'events',
    });
  }

  // Multipart upload methods
  initiateMultipartUpload(request: InitiateUploadRequest): Observable<InitiateUploadResponse> {
    return this.http.post<InitiateUploadResponse>(`${this.apiUrl}/files/upload/initiate`, request);
  }

  getPartUploadUrl(request: PartUrlRequest): Observable<PartUrlResponse> {
    return this.http.post<PartUrlResponse>(`${this.apiUrl}/files/upload/part-url`, request);
  }

  completeMultipartUpload(request: CompleteUploadRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/files/upload/complete`, request);
  }

  abortMultipartUpload(request: AbortUploadRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/files/upload/abort`, request);
  }

  // Upload part directly to S3 (returns ETag from response header)
  uploadPart(url: string, chunk: Blob): Observable<HttpEvent<unknown>> {
    return this.http.put(url, chunk, {
      reportProgress: true,
      observe: 'events',
    });
  }
}
