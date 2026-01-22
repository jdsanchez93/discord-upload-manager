# Discord Upload Manager

A web application for uploading full-resolution pictures and videos to Discord channels via webhooks.

## Architecture

- **Frontend**: Angular 19 static site hosted on S3 + CloudFront
- **API**: TypeScript + Hono Lambda behind API Gateway (HTTP API)
- **Webhook Executor**: Node.js Lambda triggered by S3 events (in StorageStack)
- **Storage**: S3 for files, DynamoDB for metadata
- **Authentication**: Auth0
- **Infrastructure**: AWS CDK (TypeScript)

## Project Structure

```
discord-upload-manager/
├── infrastructure/        # AWS CDK stacks
│   ├── bin/app.ts        # Stack definitions with stage support
│   └── lib/
│       ├── storage-stack.ts   # S3, DynamoDB, CloudFront, Webhook Lambda
│       ├── api-stack.ts       # API Gateway + API Lambda
│       └── frontend-stack.ts  # Frontend S3 + CloudFront
├── api/                   # TypeScript + Hono API
│   ├── src/
│   │   ├── app.ts        # Hono app factory
│   │   ├── lambda.ts     # AWS Lambda handler
│   │   ├── local.ts      # Local dev server (@hono/node-server)
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic
│   │   └── types/        # TypeScript interfaces
│   ├── .env.example      # Environment template
│   └── package.json
├── lambdas/               # Node.js Lambda functions
│   └── webhook-executor/
└── frontend/              # Angular 19 application
    └── src/environments/
        ├── environment.example.ts       # Dev template
        └── environment.prod.example.ts  # Prod template
```

## Upload Flow

1. Frontend requests presigned URL from API (includes webhook ID, file metadata)
2. Frontend uploads file directly to S3
3. S3 event triggers webhook-executor Lambda
4. Lambda posts to Discord webhook with `?wait=true`, receives message ID
5. Lambda updates DynamoDB with Discord message ID

## Local Development

### 1. Deploy Dev Stack (one-time)

```bash
cd infrastructure
cdk deploy -c stage=dev
```

Note the outputs: `FilesTableName`, `WebhooksTableName`, `UploadBucketName`, `CloudFrontDomain`

### 2. Configure API Environment

```bash
cd api
cp .env.example .env
```

Edit `.env` with your AWS profile and the stack outputs:
```
AWS_PROFILE=your-profile
AWS_REGION=us-east-1
FILES_TABLE_NAME=Dev-StorageStack-FilesTableXXX
WEBHOOKS_TABLE_NAME=Dev-StorageStack-WebhooksTableXXX
UPLOAD_BUCKET_NAME=dev-storagestack-uploadbucketXXX
CLOUDFRONT_DOMAIN=xxxxx.cloudfront.net
```

### 3. Configure Frontend Environment

```bash
cd frontend/src/environments
cp environment.example.ts environment.ts
```

Edit `environment.ts` with your Auth0 credentials.

### 4. Start Development Servers

```bash
# Terminal 1: API (runs on http://localhost:3002)
cd api
npm install
npm run dev

# Terminal 2: Frontend (runs on http://localhost:4200)
cd frontend
npm install
npm start
```

The Angular dev server proxies `/api/*` requests to the local Hono server.

## Developer Onboarding (AWS Credentials)

The dev stack creates an IAM Managed Policy (`LocalDevPolicyArn` output) with permissions for DynamoDB and S3 access. This policy can be attached to an IAM Identity Center permission set for team access.

### Admin Setup (One-time)

After deploying the dev stack:

1. Note the `LocalDevPolicyArn` from the CDK output
2. In IAM Identity Center console:
   - Create a permission set (e.g., "DevApiLocal")
   - Attach the managed policy using its ARN
   - Assign to developer users/groups

### Developer Setup

1. Configure AWS CLI SSO:
   ```bash
   aws configure sso
   # SSO session name: discord-upload-dev
   # SSO start URL: https://<org>.awsapps.com/start
   # SSO region: us-east-1
   # Choose the account and permission set
   # CLI profile name: discord-upload-dev
   ```

2. Update `api/.env`:
   ```
   AWS_PROFILE=discord-upload-dev
   ```

3. Login and run:
   ```bash
   aws sso login --profile discord-upload-dev
   cd api && npm run dev
   ```

## CDK Stages

The infrastructure supports two stages:

| Stage | Command | Stacks Created |
|-------|---------|----------------|
| dev | `cdk deploy -c stage=dev` | `Dev-StorageStack` only |
| prod | `cdk deploy -c stage=prod` | `Prod-StorageStack`, `Prod-ApiStack`, `Prod-FrontendStack` |

### Context Parameters (prod only)

- `appDomainName`: Frontend domain (e.g., "app.example.com")
- `filesDomainName`: Files CDN domain (e.g., "files.example.com")
- `auth0Domain`: Auth0 tenant domain
- `auth0Audience`: Auth0 API identifier

## Prerequisites

- Node.js 20+
- AWS CLI configured with appropriate profile
- Angular CLI (`npm install -g @angular/cli`)

## Auth0 Setup

1. Create an Auth0 account at https://auth0.com
2. Create a new Application (Single Page Application)
3. Note the Domain and Client ID
4. Create an API in Auth0 and note the API Identifier (Audience)
5. Configure Allowed Callback URLs: `http://localhost:4200, https://app.yourdomain.com`
6. Configure Allowed Logout URLs: `http://localhost:4200, https://app.yourdomain.com`
7. Configure Allowed Web Origins: `http://localhost:4200, https://app.yourdomain.com`

## Deployment (Production)

### Step 1: Deploy Infrastructure

```bash
cd infrastructure
cdk deploy "*" -c stage=prod \
  -c appDomainName=app.example.com \
  -c filesDomainName=files.example.com \
  -c auth0Domain=your-tenant.auth0.com \
  -c auth0Audience=your-api-identifier
```

### Step 2: Configure Frontend Environment

```bash
cd frontend/src/environments
cp environment.prod.example.ts environment.prod.ts
```

Update with the API URL from Step 1 and your Auth0 credentials.

### Step 3: Build and Deploy Frontend

```bash
cd frontend
npm run build

cd ../infrastructure
cdk deploy Prod-FrontendStack -c stage=prod
```

### Step 4: Configure DNS

After deployment, CDK outputs ACM certificate validation records and CloudFront domains.

In your DNS provider:
1. Add the ACM validation CNAME records
2. Wait for certificate validation (up to 30 minutes)
3. Add CNAME records pointing your domains to CloudFront distributions

## Discord Webhook Setup

1. In Discord, go to Server Settings > Integrations > Webhooks
2. Click "New Webhook"
3. Name your webhook and select the channel
4. Copy the Webhook URL
5. Add the webhook in the Discord Upload Manager application

## DynamoDB Tables

### Files Table

- Partition Key: `userId` (String)
- Sort Key: `fileId` (String)
- GSI: `webhookId-index` (webhookId + createdAt)
- Attributes: s3Key, webhookId, discordMessageId, status, createdAt, filename, contentType, size, cloudFrontUrl

### Webhooks Table

- Partition Key: `userId` (String)
- Sort Key: `webhookId` (String)
- Attributes: name, webhookUrl, channelName, createdAt

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

## Environment Variables

### API Lambda / Local Dev

- `FILES_TABLE_NAME`: DynamoDB files table name
- `WEBHOOKS_TABLE_NAME`: DynamoDB webhooks table name
- `UPLOAD_BUCKET_NAME`: S3 bucket for uploads
- `CLOUDFRONT_DOMAIN`: Files CloudFront distribution domain
- `AUTH0_DOMAIN`: Auth0 domain for JWT validation (optional for local dev)
- `AUTH0_AUDIENCE`: Auth0 API audience (optional for local dev)

### Webhook Executor Lambda

- `FILES_TABLE_NAME`: DynamoDB files table name
- `WEBHOOKS_TABLE_NAME`: DynamoDB webhooks table name
- `CLOUDFRONT_DOMAIN`: Files CloudFront distribution domain

## Files Not in Version Control

These files contain secrets and must be created locally:

- `api/.env` (copy from `api/.env.example`)
- `frontend/src/environments/environment.ts` (copy from `.example.ts`)
- `frontend/src/environments/environment.prod.ts` (copy from `.example.ts`)
