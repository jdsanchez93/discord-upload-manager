import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface PermissionStackProps extends cdk.StackProps {
  filesTable: dynamodb.ITable;
  webhooksTable: dynamodb.ITable;
  uploadBucket: s3.IBucket;
}

export class PermissionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PermissionStackProps) {
    super(scope, id, props);

    // Policy for running local API server
    const localDevPolicy = new iam.ManagedPolicy(this, 'LocalDevPolicy', {
      managedPolicyName: `${id}-LocalDevPolicy`,
      description: 'Run local API server against dev resources',
      statements: [
        new iam.PolicyStatement({
          sid: 'DynamoDBAccess',
          actions: [
            'dynamodb:GetItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:BatchWriteItem',
          ],
          resources: [
            props.filesTable.tableArn,
            `${props.filesTable.tableArn}/index/*`,
            props.webhooksTable.tableArn,
            `${props.webhooksTable.tableArn}/index/*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'S3Access',
          actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
          resources: [props.uploadBucket.arnForObjects('*')],
        }),
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'LocalDevPolicyArn', {
      value: localDevPolicy.managedPolicyArn,
      description: 'Policy for local API development',
    });
  }
}
