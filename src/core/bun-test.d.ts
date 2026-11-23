declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export interface ExpectMatchers<T> {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toMatch(pattern: RegExp | string): void;
    toContain(item: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    rejects: {
      toThrow(expected?: string | RegExp): Promise<void>;
    };
    not: ExpectMatchers<T>;
  }
  export function expect<T>(actual: T): ExpectMatchers<T>;
}
