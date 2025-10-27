import { x400AddressSchema } from '../../schemas';
import type { OrName, X400Address } from '../../schemas/addresses';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -';

const makeRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const randomInt = (next: () => number, min: number, max: number) => {
  return min + Math.floor(next() * (max - min + 1));
};

const randomToken = (next: () => number, min: number, max: number, charset = CHARSET) => {
  const length = randomInt(next, min, max);
  let output = '';
  for (let index = 0; index < length; index += 1) {
    const char = charset[Math.floor(next() * charset.length)] ?? 'A';
    output += char;
  }
  return output.trim().length === 0 ? 'X' : output;
};

const randomOptional = <T>(
  next: () => number,
  generator: () => T,
  probability = 0.35,
): T | undefined => {
  return next() < probability ? generator() : undefined;
};

export const createAddressGenerator = (seed = 1337) => {
  const next = makeRandom(seed);

  const generateOrName = (): OrName => {
    const ouCount = randomInt(next, 0, 4);
    const ou = Array.from({ length: ouCount }, () => randomToken(next, 2, 16));
    return {
      c: randomToken(next, 2, 2, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
      admd: randomOptional(next, () => randomToken(next, 2, 16)),
      prmd: randomOptional(next, () => randomToken(next, 2, 16)),
      o: randomOptional(next, () => randomToken(next, 3, 24)),
      ou,
      surname: randomOptional(next, () => randomToken(next, 3, 24)) ?? 'Operator',
      givenName: randomOptional(next, () => randomToken(next, 3, 24)),
      initials: randomOptional(next, () => randomToken(next, 1, 4)),
      generationQualifier: randomOptional(next, () => randomToken(next, 1, 4)),
    };
  };

  const generateAddress = (): X400Address => {
    const orName = generateOrName();
    const ddaCount = randomInt(next, 0, 3);
    const routingCount = randomInt(next, 0, 3);
    const address = {
      orName,
      dda: Array.from({ length: ddaCount }, (_, index) => ({
        type: `DDA-${index + 1}`,
        value: randomToken(next, 4, 20),
      })),
      routingHints: Array.from({ length: routingCount }, () => randomToken(next, 4, 16)),
    } satisfies X400Address;
    return x400AddressSchema.parse(address);
  };

  const renderOrAddress = (address: X400Address): string => {
    const { orName } = address;
    const parts: string[] = [];
    const push = (key: string, value?: string) => {
      if (!value) return;
      parts.push(`${key}=${value}`);
    };
    push('C', orName.c);
    push('ADMD', orName.admd);
    push('PRMD', orName.prmd);
    push('O', orName.o);
    orName.ou.forEach((value, index) => push(`OU${index + 1}`, value));
    push('S', orName.surname);
    push('G', orName.givenName);
    return parts.join(';');
  };

  const generateRfc822 = () => {
    const local = randomToken(next, 3, 12, 'abcdefghijklmnopqrstuvwxyz0123456789');
    const domain = randomToken(next, 3, 12, 'abcdefghijklmnopqrstuvwxyz0123456789');
    return `${local}@${domain}.example.com`;
  };

  return {
    next,
    nextOrName: () => generateOrName(),
    nextAddress: () => generateAddress(),
    nextOrAddressString: () => renderOrAddress(generateAddress()),
    toOrAddressString: (address: X400Address) => renderOrAddress(address),
    nextRfc822: () => generateRfc822(),
  };
};
