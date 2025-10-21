import type { X400Address } from '@x400/shared';

type AddressComponents = Partial<Record<'c' | 'admd' | 'prmd' | 'o' | 'ou1' | 'ou2' | 'ou3' | 'ou4' | 's' | 'g', string>>;

const normalizeKey = (key: string) => key.trim().toLowerCase();

export const parseOrAddress = (raw: string): X400Address => {
  const components: AddressComponents = {};

  raw.split(';').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (!key || !value) return;
    components[normalizeKey(key) as keyof AddressComponents] = value.trim();
  });

  const ous = ['ou1', 'ou2', 'ou3', 'ou4'].flatMap((ouKey) =>
    components[ouKey as keyof AddressComponents] ? [components[ouKey as keyof AddressComponents] as string] : [],
  );

  return {
    orName: {
      c: components.c ?? 'XX',
      admd: components.admd,
      prmd: components.prmd,
      o: components.o,
      ou: ous,
      surname: components.s,
      givenName: components.g
    },
    dda: [],
    routingHints: []
  };
};

export const parseOrAddresses = (rawValues: string[]): X400Address[] => rawValues.map(parseOrAddress);
