/**
 * Import a module that may not exist yet (other streams still building).
 * Returns null instead of failing the whole `npm test` run; tests then skip with a visible reason.
 * Variable path + @vite-ignore keeps Vite from resolving it at transform time; the "@/" alias still works at runtime.
 */
export const tryImport = <T = Record<string, unknown>>(path: string): Promise<T | null> =>
  import(/* @vite-ignore */ path).then((m) => m as T).catch(() => null);
