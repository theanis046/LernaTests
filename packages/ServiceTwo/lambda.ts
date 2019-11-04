import "reflect-metadata";
import lambdaProxy from '../../../common/aws/lambdaProxy';
import app from  "./app";

export const handler = lambdaProxy(app);