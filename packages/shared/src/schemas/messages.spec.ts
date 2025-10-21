import { describe, expect, it } from 'vitest';
import { messageSchema } from './messages';
import { x400AddressSchema } from './addresses';

const sampleAddress = x400AddressSchema.parse({
  orName: {
    c: 'DE',
    o: 'Modernization',
    surname: 'Operator'
  }
});

describe('messageSchema', () => {
  it('validates a minimal message', () => {
    const message = messageSchema.parse({
      envelope: {
        id: 'msg-1',
        subject: 'Hello',
        sender: sampleAddress,
        to: [sampleAddress],
        cc: [],
        bcc: [],
        priority: 'normal',
        sensitivity: 'normal',
        folder: 'inbox',
        status: 'delivered',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageId: '<msg-1@example.com>'
      },
      content: {
        text: 'Hi there',
        attachments: []
      },
      reports: []
    });

    expect(message.envelope.subject).toBe('Hello');
  });
});
