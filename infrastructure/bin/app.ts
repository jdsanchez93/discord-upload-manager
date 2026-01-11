#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { AppStack } from '../lib/app-stack';

const app = new cdk.App();

// Stage: 'dev' or 'prod' (default: dev)
const stage = app.node.tryGetContext('stage') || 'dev';
const Stage = stage.charAt(0).toUpperCase() + stage.slice(1); // Capitalize for stack names

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stage-specific config from cdk.json, with CLI overrides
const stageConfig = app.node.tryGetContext(stage) || {};
const filesDomainName = app.node.tryGetContext('filesDomainName') || stageConfig.filesDomainName;
const appDomainName = app.node.tryGetContext('appDomainName') || stageConfig.appDomainName;
const auth0Domain = app.node.tryGetContext('auth0Domain') || stageConfig.auth0Domain;
const auth0Audience = app.node.tryGetContext('auth0Audience') || stageConfig.auth0Audience;

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

// App Stack - combined frontend + API (prod only)
if (stage === 'prod') {
  const appStack = new AppStack(app, `${Stage}-AppStack`, {
    env,
    appDomainName,
    filesTable: storageStack.filesTable,
    webhooksTable: storageStack.webhooksTable,
    uploadBucket: storageStack.uploadBucket,
    cloudFrontDomain: storageStack.filesDistributionDomain,
    auth0Domain,
    auth0Audience,
  });

  new cdk.CfnOutput(appStack, 'AppUrl', {
    value: appStack.distributionDomain,
    description: 'Application URL',
  });
}

app.synth();
