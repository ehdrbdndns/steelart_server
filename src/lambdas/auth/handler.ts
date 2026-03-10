import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

export const handler: APIGatewayProxyHandlerV2 = async () => ({
  statusCode: 501,
  headers: {
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    data: null,
    meta: null,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Auth handler bootstrap placeholder',
    },
  }),
});
