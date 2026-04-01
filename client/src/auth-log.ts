interface AuthLogEntry {
  readonly timestamp: string;
  readonly event: string;
  readonly detail?: string | undefined;
}

const MAX_ENTRIES = 50;
let entries: AuthLogEntry[] = [];

export function authLog(event: string, detail?: string): void {
  entries = [...entries, { timestamp: new Date().toISOString(), event, detail }].slice(-MAX_ENTRIES);
}

export function getAuthLog(): readonly AuthLogEntry[] {
  return [...entries];
}

export function clearAuthLog(): void {
  entries = [];
}
