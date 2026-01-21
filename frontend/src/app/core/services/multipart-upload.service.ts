import { Injectable, inject } from '@angular/core';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { UploadPart } from '../../shared/models/file.model';

interface PartTask {
  partNumber: number;
  chunk: Blob;
}

@Injectable({
  providedIn: 'root',
})
export class MultipartUploadService {
  private api = inject(ApiService);

  private readonly PART_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB
  private readonly MAX_RETRIES = 3;
  private readonly PARALLEL_UPLOADS = 4;

  needsMultipart(file: File): boolean {
    return file.size >= this.MULTIPART_THRESHOLD;
  }

  async upload(
    file: File,
    webhookId: string,
    onProgress: (progress: number) => void,
    customMessage?: string
  ): Promise<void> {
    // 1. Initiate multipart upload
    const initResponse = await firstValueFrom(
      this.api.initiateMultipartUpload({
        filename: file.name,
        webhookId,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        customMessage,
      })
    );

    const { uploadId, fileId, s3Key } = initResponse;
    const totalParts = Math.ceil(file.size / this.PART_SIZE);

    // Prepare all part tasks
    const partTasks: PartTask[] = [];
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * this.PART_SIZE;
      const end = Math.min(start + this.PART_SIZE, file.size);
      partTasks.push({
        partNumber,
        chunk: file.slice(start, end),
      });
    }

    try {
      // 2. Upload parts in parallel with concurrency limit
      const parts = await this.uploadPartsInParallel(
        uploadId,
        s3Key,
        partTasks,
        totalParts,
        onProgress
      );

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

  private async uploadPartsInParallel(
    uploadId: string,
    s3Key: string,
    partTasks: PartTask[],
    totalParts: number,
    onProgress: (progress: number) => void
  ): Promise<UploadPart[]> {
    const results: UploadPart[] = [];
    let completedCount = 0;
    let taskIndex = 0;

    // Worker function that processes tasks from the queue
    const worker = async (): Promise<void> => {
      while (taskIndex < partTasks.length) {
        const currentIndex = taskIndex++;
        const task = partTasks[currentIndex];

        const etag = await this.uploadPartWithRetry(
          uploadId,
          s3Key,
          task.partNumber,
          task.chunk
        );

        results.push({ partNumber: task.partNumber, etag });
        completedCount++;
        onProgress(Math.round((completedCount / totalParts) * 100));
      }
    };

    // Start parallel workers
    const workers: Promise<void>[] = [];
    const workerCount = Math.min(this.PARALLEL_UPLOADS, partTasks.length);

    for (let i = 0; i < workerCount; i++) {
      workers.push(worker());
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    // Sort by part number (required for S3 CompleteMultipartUpload)
    return results.sort((a, b) => a.partNumber - b.partNumber);
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
