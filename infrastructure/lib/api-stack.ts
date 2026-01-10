import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  filesTable: dynamodb.Table;
  webhooksTable: dynamodb.Table;
  uploadBucket: s3.Bucket;
  cloudFrontDomain: string;
  auth0Domain?: string;
  auth0Audience?: string;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly apiFunction: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // TypeScript + Hono Lambda function for API
    this.apiFunction = new lambdaNodejs.NodejsFunction(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
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

    // Grant permissions
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

    // HTTP API Gateway
    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: 'DiscordUploadManagerApi',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'ApiIntegration',
      this.apiFunction
    );

    // Add routes
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    // Also add root path
    httpApi.addRoutes({
      path: '/',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    this.apiUrl = httpApi.url!;
  }
}
