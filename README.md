# Discord Upload Manager

Upload full-resolution images and videos to Discord channels via webhooks, with file management and gallery view.

> Created with [Claude AI](https://claude.ai)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Angular 19 |
| API | TypeScript, Hono |
| Infrastructure | AWS CDK, Lambda, DynamoDB, S3, CloudFront |
| Auth | Auth0 |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [AWS CLI](https://aws.amazon.com/cli/) configured with credentials
- [Angular CLI](https://angular.io/cli): `npm install -g @angular/cli`

## Project Structure

```
├── frontend/        # Angular SPA
├── api/             # Hono API (runs locally + Lambda)
├── infrastructure/  # AWS CDK stacks
└── lambdas/         # S3 event handler for Discord webhooks
```

## Quick Start

See [claude.md](claude.md) for detailed setup instructions.

```bash
# Install dependencies
cd infrastructure && npm install
cd ../api && npm install
cd ../frontend && npm install

# Start local development
cd api && npm run dev        # Terminal 1: API on :3002
cd frontend && npm start     # Terminal 2: Frontend on :4200
```

## License

MIT
