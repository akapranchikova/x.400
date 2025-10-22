import path from 'node:path';
import { fileURLToPath } from 'node:url';

import SwaggerParser from '@apidevtools/swagger-parser';
import OpenAPIClientAxios from 'openapi-client-axios';
import { describe, expect, it } from 'vitest';

const specPath = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../core-service/api/openapi.json',
);

describe('core-service OpenAPI contract', () => {
  it('parses and validates the contract document', async () => {
    const api = await SwaggerParser.validate(specPath);
    expect(api.info?.title).toContain('X.400 Core Service');
    expect(api.paths).toHaveProperty('/folders');
    expect(api.paths).toHaveProperty('/messages');
    expect((api as any).components?.schemas).toHaveProperty('MessageEnvelope');
  });

  it('generates an SDK client with expected operations', async () => {
    const api = new OpenAPIClientAxios({ definition: specPath });
    const client = await api.init();

    expect(typeof client.listFolders).toBe('function');
    expect(typeof client.listMessages).toBe('function');
    expect(typeof client.getMessage).toBe('function');
    expect(typeof client.composeMessage).toBe('function');
  });
});
