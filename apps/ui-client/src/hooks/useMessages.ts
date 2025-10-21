import { useCallback, useEffect, useState } from 'react';
import type { Message, MessageEnvelope } from '@x400/shared';
import { getTransport } from '../lib/transport';

export const useMessages = (folder: string) => {
  const [messages, setMessages] = useState<MessageEnvelope[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const transport = getTransport();
      const items = await transport.messages.listMessages(folder);
      setMessages(items);
      setError(null);
      if (items.length > 0) {
        const message = await transport.messages.getMessage(items[0].id);
        setSelected(message);
      } else {
        setSelected(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const selectMessage = useCallback(async (messageId: string) => {
    try {
      const transport = getTransport();
      const message = await transport.messages.getMessage(messageId);
      setSelected(message);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const submitMessage = useCallback(
    async (subject: string, body: string, sender: string, recipients: string[]) => {
      const transport = getTransport();
      await transport.compose({
        sender: {
          orName: { c: 'DE', o: sender, surname: 'Operator', ou: [], admd: undefined, prmd: undefined, givenName: undefined, initials: undefined, generationQualifier: undefined },
          dda: [],
          routingHints: []
        },
        recipients: recipients.map((entry) => ({
          orName: { c: 'DE', o: entry, surname: 'Recipient', ou: [], admd: undefined, prmd: undefined, givenName: undefined, initials: undefined, generationQualifier: undefined },
          dda: [],
          routingHints: []
        })),
        subject,
        body
      });
      await loadMessages();
    },
    [loadMessages],
  );

  return { messages, selected, loading, error, selectMessage, reload: loadMessages, submitMessage };
};
