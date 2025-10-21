import { createMockTransport } from '@x400/sdk-wrapper';

let transportInstance = createMockTransport({ baseUrl: 'http://127.0.0.1:7878' });

export const getTransport = () => transportInstance;

export const reconnectTransport = async () => {
  transportInstance = createMockTransport({ baseUrl: 'http://127.0.0.1:7878' });
  await transportInstance.connect();
  return transportInstance;
};
