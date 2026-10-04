declare module 'bun:test' {
  type Matchers = {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toThrow(expected?: unknown): void;
    toHaveLength(expected: number): void;
  };
  export function describe(name: string, callback: () => void): void;
  export function it(name: string, callback: () => void): void;
  export const expect: (actual: unknown) => Matchers;
}
