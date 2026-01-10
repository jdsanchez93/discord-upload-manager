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
