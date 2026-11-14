// The few Node file APIs the map baker uses (the project has no @types/node on purpose).
declare module 'node:fs' {
  export function writeFileSync(path: string, data: string | Uint8Array): void;
  export function readFileSync(path: string): Uint8Array;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
}
