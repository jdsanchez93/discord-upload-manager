import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface StorageStackProps extends cdk.StackProps {
  filesDomainName?: string;
}

export class StorageStack extends cdk.Stack {
  public readonly uploadBucket: s3.Bucket;
  public readonly filesTable: dynamodb.Table;
  public readonly webhooksTable: dynamodb.Table;
  public readonly filesDistribution: cloudfront.Distribution;
  public readonly filesDistributionDomain: string;
  public readonly filesCertificate?: acm.Certificate;
  public readonly webhookFunction: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // S3 bucket for file uploads (private, accessed via CloudFront)
    this.uploadBucket = new s3.Bucket(this, 'UploadBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // DynamoDB table for files metadata
    this.filesTable = new dynamodb.Table(this, 'FilesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fileId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // GSI for querying by webhookId
    this.filesTable.addGlobalSecondaryIndex({
      indexName: 'webhookId-index',
      partitionKey: { name: 'webhookId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for looking up files by fileId (used by webhook Lambda)
    this.filesTable.addGlobalSecondaryIndex({
      indexName: 'fileId-index',
      partitionKey: { name: 'fileId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // DynamoDB table for webhooks
    this.webhooksTable = new dynamodb.Table(this, 'WebhooksTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'webhookId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // CloudFront Origin Access Control for S3
    const oac = new cloudfront.S3OriginAccessControl(this, 'FilesOAC', {
      description: 'OAC for Discord Upload Manager files bucket',
    });

    // ACM certificate for custom domain (if provided)
    if (props.filesDomainName) {
      this.filesCertificate = new acm.Certificate(this, 'FilesCertificate', {
        domainName: props.filesDomainName,
        validation: acm.CertificateValidation.fromDns(),
      });

      // Output certificate validation records
      new cdk.CfnOutput(this, 'FilesCertificateArn', {
        value: this.filesCertificate.certificateArn,
        description: 'ACM Certificate ARN for files domain',
      });
    }

    // CloudFront distribution for file access
    this.filesDistribution = new cloudfront.Distribution(this, 'FilesDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.uploadBucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
      },
      domainNames: props.filesDomainName ? [props.filesDomainName] : undefined,
      certificate: this.filesCertificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // Set the distribution domain
    this.filesDistributionDomain = props.filesDomainName || this.filesDistribution.distributionDomainName;

    // Output DNS configuration instructions
    if (props.filesDomainName) {
      new cdk.CfnOutput(this, 'FilesDnsRecord', {
        value: `Create CNAME record: ${props.filesDomainName} -> ${this.filesDistribution.distributionDomainName}`,
        description: 'DNS record to create in Route53',
      });
    }

    // Webhook executor Lambda (triggered by S3 uploads)
    this.webhookFunction = new lambdaNodejs.NodejsFunction(this, 'WebhookFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../lambdas/webhook-executor/src/index.ts'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        FILES_TABLE_NAME: this.filesTable.tableName,
        WEBHOOKS_TABLE_NAME: this.webhooksTable.tableName,
        CLOUDFRONT_DOMAIN: this.filesDistributionDomain,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant permissions to webhook Lambda
    this.filesTable.grantReadWriteData(this.webhookFunction);
    this.webhooksTable.grantReadData(this.webhookFunction);
    this.uploadBucket.grantRead(this.webhookFunction);

    // S3 event notification for new uploads
    this.uploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.webhookFunction),
      { prefix: 'uploads/' }
    );
  }
}
