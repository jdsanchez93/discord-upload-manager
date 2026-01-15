export interface FileRecord {
  userId: string;
  fileId: string;
  filename: string;
  s3Key: string;
  webhookId: string;
  discordMessageId?: string;
  status: 'uploading' | 'posted' | 'error';
  contentType: string;
  size: number;
  createdAt: string;
  postedAt?: string;
  cloudFrontUrl?: string;
  errorMessage?: string;
}

export interface UploadUrlRequest {
  filename: string;
  webhookId: string;
  contentType: string;
  size: number;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  fileId: string;
  s3Key: string;
}

// Multipart upload types
export interface InitiateUploadRequest {
  filename: string;
  webhookId: string;
  contentType: string;
  size: number;
}

export interface InitiateUploadResponse {
  uploadId: string;
  fileId: string;
  s3Key: string;
}

export interface PartUrlRequest {
  uploadId: string;
  s3Key: string;
  partNumber: number;
}

export interface PartUrlResponse {
  url: string;
  partNumber: number;
}

export interface UploadPart {
  partNumber: number;
  etag: string;
}

export interface CompleteUploadRequest {
  uploadId: string;
  s3Key: string;
  fileId: string;
  parts: UploadPart[];
}

export interface AbortUploadRequest {
  uploadId: string;
  s3Key: string;
}
