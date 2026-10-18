export function singleFlight<T>(callback: () => Promise<T>): (() => Promise<T>) & { reset(): void };
