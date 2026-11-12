// The few Node file APIs the map baker uses (the project has no @types/node on purpose).
declare module 'node:fs' {
  export function writeFileSync(path: string, data: string): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
}
