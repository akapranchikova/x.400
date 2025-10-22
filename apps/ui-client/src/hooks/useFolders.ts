import { useEffect, useState } from 'react';

import { getTransport } from '../lib/transport';

import type { Folder } from '@x400/shared';

export const useFolders = () => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const transport = getTransport();
        await transport.connect();
        if (!mounted) return;
        const data = await transport.folders.listFolders();
        if (mounted) {
          setFolders(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError((err as Error).message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return { folders, loading, error };
};
