import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

export interface AppStackProps extends cdk.StackProps {
  appDomainName?: string;
  filesTable: dynamodb.Table;
  webhooksTable: dynamodb.Table;
  uploadBucket: s3.Bucket;
  cloudFrontDomain: string;
  auth0Domain?: string;
  auth0Audience?: string;
}

export class AppStack extends cdk.Stack {
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly distributionDomain: string;
  public readonly appCertificate?: acm.Certificate;
  public readonly apiFunction: lambdaNodejs.NodejsFunction;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // S3 bucket for static website
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // TypeScript + Hono Lambda function for API
    this.apiFunction = new lambdaNodejs.NodejsFunction(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        FILES_TABLE_NAME: props.filesTable.tableName,
        WEBHOOKS_TABLE_NAME: props.webhooksTable.tableName,
        UPLOAD_BUCKET_NAME: props.uploadBucket.bucketName,
        CLOUDFRONT_DOMAIN: props.cloudFrontDomain,
        AUTH0_DOMAIN: props.auth0Domain || '',
        AUTH0_AUDIENCE: props.auth0Audience || '',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        format: lambdaNodejs.OutputFormat.ESM,
        mainFields: ['module', 'main'],
        esbuildArgs: {
          '--conditions': 'module',
        },
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant permissions to API Lambda
    props.filesTable.grantReadWriteData(this.apiFunction);
    props.webhooksTable.grantReadWriteData(this.apiFunction);
    props.uploadBucket.grantReadWrite(this.apiFunction);

    // Grant presigned URL generation permission
    this.apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject'],
        resources: [props.uploadBucket.arnForObjects('*')],
      })
    );

    // HTTP API Gateway (no CORS needed - same origin via CloudFront)
    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: 'DiscordUploadManagerApi',
    });

    // Lambda integration
    const lambdaIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'ApiIntegration',
      this.apiFunction
    );

    // Add routes - all under /api path
    httpApi.addRoutes({
      path: '/api/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    // Also add /api root path
    httpApi.addRoutes({
      path: '/api',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    this.apiUrl = httpApi.url!;

    // CloudFront Origin Access Control for S3
    const oac = new cloudfront.S3OriginAccessControl(this, 'WebsiteOAC', {
      description: 'OAC for Discord Upload Manager frontend',
    });

    // ACM certificate for custom domain (if provided)
    if (props.appDomainName) {
      this.appCertificate = new acm.Certificate(this, 'AppCertificate', {
        domainName: props.appDomainName,
        validation: acm.CertificateValidation.fromDns(),
      });

      new cdk.CfnOutput(this, 'AppCertificateArn', {
        value: this.appCertificate.certificateArn,
        description: 'ACM Certificate ARN for app domain',
      });
    }

    // API Gateway origin for CloudFront
    // Extract the API Gateway domain from the URL (remove https:// and trailing /)
    const apiDomain = cdk.Fn.select(2, cdk.Fn.split('/', httpApi.url!));
    const apiOrigin = new origins.HttpOrigin(apiDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // S3 origin for CloudFront
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.websiteBucket, {
      originAccessControl: oac,
    });

    // CloudFront distribution with path-based routing
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      domainNames: props.appDomainName ? [props.appDomainName] : undefined,
      certificate: this.appCertificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // Set the distribution domain
    this.distributionDomain = props.appDomainName || this.distribution.distributionDomainName;

    // Deploy frontend assets (if built)
    const frontendPath = path.join(__dirname, '../../frontend/dist/discord-upload-manager/browser');

    // Only deploy if frontend has been built
    if (fs.existsSync(frontendPath)) {
      new s3deploy.BucketDeployment(this, 'DeployWebsite', {
        sources: [s3deploy.Source.asset(frontendPath)],
        destinationBucket: this.websiteBucket,
        distribution: this.distribution,
        distributionPaths: ['/*'],
      });
    } else {
      console.log('Frontend not built yet. Build with: cd frontend && npm run build');
      console.log('Then run cdk deploy again to deploy the frontend.');
    }

    // Output DNS configuration instructions
    if (props.appDomainName) {
      new cdk.CfnOutput(this, 'AppDnsRecord', {
        value: `Create CNAME record: ${props.appDomainName} -> ${this.distribution.distributionDomainName}`,
        description: 'DNS record to create in Route53',
      });
    }

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: httpApi.url!,
      description: 'API Gateway URL (for debugging)',
    });
  }
}
