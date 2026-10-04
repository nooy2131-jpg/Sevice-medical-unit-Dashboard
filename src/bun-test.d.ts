declare module "bun:test" {
  type Matchers = {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toThrow(expected?: unknown): void;
    toHaveLength(expected: number): void;
    toBeNull(): void;
    toBeInstanceOf(expected: unknown): void;
    toBeDefined(): void;
    readonly not: Matchers;
    readonly rejects: Matchers;
  };
  export const describe: {
    (name: string, callback: () => void): void;
    skip(name: string, callback: () => void): void;
  };
  export const it: {
    (name: string, callback: () => void): void;
    skip(name: string, callback: () => void): void;
  };
  export const test: {
    (name: string, callback: () => void): void;
    skip(name: string, callback: () => void): void;
  };
  export function beforeAll(callback: () => void): void;
  export function afterAll(callback: () => void): void;
  export const expect: (actual: unknown) => Matchers;
}
