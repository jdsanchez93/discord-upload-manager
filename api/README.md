# Discord Upload Manager API

TypeScript + Hono API for managing Discord webhooks and file uploads.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your values
```

## Development

```bash
npm run dev
```

Runs on http://localhost:3002 with hot reload.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AWS_PROFILE` | AWS credentials profile |
| `AWS_REGION` | AWS region (e.g., `us-east-1`) |
| `FILES_TABLE_NAME` | DynamoDB files table name |
| `WEBHOOKS_TABLE_NAME` | DynamoDB webhooks table name |
| `UPLOAD_BUCKET_NAME` | S3 bucket for uploads |
| `CLOUDFRONT_DOMAIN` | CloudFront domain for file URLs |
| `AUTH0_DOMAIN` | Auth0 domain (optional for local dev) |
| `AUTH0_AUDIENCE` | Auth0 API audience (optional for local dev) |

## Project Structure

```
src/
├── app.ts          # Hono app factory
├── lambda.ts       # AWS Lambda handler
├── local.ts        # Local dev server
├── routes/
│   ├── webhooks.ts # Webhook CRUD endpoints
│   └── files.ts    # File management endpoints
├── services/
│   ├── auth.ts     # Auth0 JWT validation
│   ├── webhook.ts  # Webhook DynamoDB operations
│   └── file.ts     # File S3/DynamoDB operations
└── types/
    └── index.ts    # TypeScript interfaces
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /webhooks | List user's webhooks |
| POST | /webhooks | Create webhook |
| DELETE | /webhooks/:id | Delete webhook |
| GET | /files | List user's files |
| GET | /files/:id | Get file details |
| POST | /files/upload-url | Get presigned upload URL |
| DELETE | /files/:id | Delete file and Discord message |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start local dev server with hot reload |
| `npm run build` | Bundle for Lambda deployment |
| `npm run deploy` | Build, zip, and deploy to Lambda |
