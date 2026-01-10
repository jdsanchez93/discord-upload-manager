#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

// Stage: 'dev' or 'prod' (default: dev)
const stage = app.node.tryGetContext('stage') || 'dev';
const Stage = stage.charAt(0).toUpperCase() + stage.slice(1); // Capitalize for stack names

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Context values (only used for prod)
const filesDomainName = app.node.tryGetContext('filesDomainName');
const appDomainName = app.node.tryGetContext('appDomainName');
const auth0Domain = app.node.tryGetContext('auth0Domain');
const auth0Audience = app.node.tryGetContext('auth0Audience');

// Storage Stack (both dev and prod)
const storageStack = new StorageStack(app, `${Stage}-StorageStack`, {
  env,
  filesDomainName: stage === 'prod' ? filesDomainName : undefined,
});

// Outputs for local development .env file
new cdk.CfnOutput(storageStack, 'FilesTableName', {
  value: storageStack.filesTable.tableName,
  description: 'DynamoDB Files table name',
});

new cdk.CfnOutput(storageStack, 'WebhooksTableName', {
  value: storageStack.webhooksTable.tableName,
  description: 'DynamoDB Webhooks table name',
});

new cdk.CfnOutput(storageStack, 'UploadBucketName', {
  value: storageStack.uploadBucket.bucketName,
  description: 'S3 upload bucket name',
});

new cdk.CfnOutput(storageStack, 'CloudFrontDomain', {
  value: storageStack.filesDistributionDomain,
  description: 'CloudFront domain for file access',
});

// API and Frontend stacks (prod only)
if (stage === 'prod') {
  const apiStack = new ApiStack(app, `${Stage}-ApiStack`, {
    env,
    filesTable: storageStack.filesTable,
    webhooksTable: storageStack.webhooksTable,
    uploadBucket: storageStack.uploadBucket,
    cloudFrontDomain: storageStack.filesDistributionDomain,
    auth0Domain,
    auth0Audience,
  });

  const frontendStack = new FrontendStack(app, `${Stage}-FrontendStack`, {
    env,
    appDomainName,
    apiUrl: apiStack.apiUrl,
  });

  new cdk.CfnOutput(apiStack, 'ApiEndpoint', {
    value: apiStack.apiUrl,
    description: 'API Gateway endpoint URL',
  });

  new cdk.CfnOutput(frontendStack, 'FrontendUrl', {
    value: frontendStack.distributionDomain,
    description: 'Frontend CloudFront distribution domain',
  });
}

app.synth();
