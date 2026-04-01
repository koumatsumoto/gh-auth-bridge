export interface ClientConfig {
  readonly proxyUrl: string;
}

let config: ClientConfig | null = null;

export function configure(options: ClientConfig): void {
  config = options;
}

export function getProxyUrl(): string {
  if (!config) {
    throw new Error("gh-auth-bridge-client is not configured. Call configure({ proxyUrl }) before use.");
  }
  return config.proxyUrl;
}
