import { Injectable, inject } from '@angular/core';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { UploadPart } from '../../shared/models/file.model';

@Injectable({
  providedIn: 'root',
})
export class MultipartUploadService {
  private api = inject(ApiService);

  private readonly PART_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB
  private readonly MAX_RETRIES = 3;

  needsMultipart(file: File): boolean {
    return file.size >= this.MULTIPART_THRESHOLD;
  }

  async upload(
    file: File,
    webhookId: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    // 1. Initiate multipart upload
    const initResponse = await firstValueFrom(
      this.api.initiateMultipartUpload({
        filename: file.name,
        webhookId,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      })
    );

    const { uploadId, fileId, s3Key } = initResponse;
    const totalParts = Math.ceil(file.size / this.PART_SIZE);
    const parts: UploadPart[] = [];
    let completedParts = 0;

    try {
      // 2. Upload each part
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * this.PART_SIZE;
        const end = Math.min(start + this.PART_SIZE, file.size);
        const chunk = file.slice(start, end);

        const etag = await this.uploadPartWithRetry(
          uploadId,
          s3Key,
          partNumber,
          chunk
        );

        parts.push({ partNumber, etag });
        completedParts++;
        onProgress(Math.round((completedParts / totalParts) * 100));
      }

      // 3. Complete the multipart upload
      await firstValueFrom(
        this.api.completeMultipartUpload({
          uploadId,
          s3Key,
          fileId,
          parts,
        })
      );
    } catch (error) {
      // Abort the upload on failure
      try {
        await firstValueFrom(
          this.api.abortMultipartUpload({ uploadId, s3Key })
        );
      } catch (abortError) {
        console.error('Failed to abort multipart upload:', abortError);
      }
      throw error;
    }
  }

  private async uploadPartWithRetry(
    uploadId: string,
    s3Key: string,
    partNumber: number,
    chunk: Blob
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.uploadPart(uploadId, s3Key, partNumber, chunk);
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Part ${partNumber} upload failed (attempt ${attempt}/${this.MAX_RETRIES}):`,
          error
        );

        if (attempt < this.MAX_RETRIES) {
          // Wait before retry (exponential backoff)
          await this.delay(1000 * Math.pow(2, attempt - 1));
        }
      }
    }

    throw lastError || new Error(`Failed to upload part ${partNumber}`);
  }

  private async uploadPart(
    uploadId: string,
    s3Key: string,
    partNumber: number,
    chunk: Blob
  ): Promise<string> {
    // Get presigned URL for this part
    const { url } = await firstValueFrom(
      this.api.getPartUploadUrl({ uploadId, s3Key, partNumber })
    );

    // Upload the part and extract ETag from response
    return new Promise<string>((resolve, reject) => {
      this.api.uploadPart(url, chunk).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.Response) {
            const response = event as HttpResponse<unknown>;
            const etag = response.headers.get('ETag');

            if (etag) {
              // Remove quotes from ETag if present
              resolve(etag.replace(/"/g, ''));
            } else {
              reject(new Error('No ETag in response'));
            }
          }
        },
        error: (err) => reject(err),
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
