export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

export const assertUnreachable = (_value: never, message = 'Reached unreachable code'): never => {
  throw new Error(message);
};
