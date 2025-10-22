import path from 'node:path';
import { fileURLToPath } from 'node:url';

import SwaggerParser from '@apidevtools/swagger-parser';
import OpenAPIClientAxios from 'openapi-client-axios';
import { describe, expect, it } from 'vitest';

// Build an absolute file path to the OpenAPI spec located in core-service.
const specPath = path.resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../core-service/api/openapi.json',
);

describe('core-service OpenAPI contract', () => {
  it('parses and validates the contract document', async () => {
    // SwaggerParser can consume a filesystem path directly
    const api = await SwaggerParser.validate(specPath);

    expect(api.info?.title).toContain('X.400 Core Service');
    expect(api.paths).toHaveProperty('/folders');
    expect(api.paths).toHaveProperty('/messages');
    // components is not typed on the returned Document, so cast for the assertion
    expect((api as any).components?.schemas).toHaveProperty('MessageEnvelope');
  });

  it('generates an SDK client with expected operations', async () => {
    // IMPORTANT: OpenAPIClientAxios expects either an HTTP(S) URL or a JS object.
    // Passing a filesystem path will fail with ERR_INVALID_URL via axios.
    // So we parse/dereference the spec first and pass the object.
    const definition: any = await SwaggerParser.dereference(specPath);

    const api = new OpenAPIClientAxios({ definition });
    const client = await api.init();

    expect(typeof (client as any).listFolders).toBe('function');
    expect(typeof (client as any).listMessages).toBe('function');
    expect(typeof (client as any).getMessage).toBe('function');
    expect(typeof (client as any).composeMessage).toBe('function');
  });
});
