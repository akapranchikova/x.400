export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const assertUnreachable = (_value: never, message = 'Reached unreachable code'): never => {
  throw new Error(message);
};
