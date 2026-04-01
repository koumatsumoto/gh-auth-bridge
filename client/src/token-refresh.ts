export type TokenRefreshFn = () => Promise<string>;

let registeredRefreshFn: TokenRefreshFn | null = null;

export function registerTokenRefresh(fn: TokenRefreshFn): void {
  registeredRefreshFn = fn;
}

export function getTokenRefreshFn(): TokenRefreshFn | null {
  return registeredRefreshFn;
}

/** Reset module state for testing */
export function _resetTokenRefresh(): void {
  registeredRefreshFn = null;
}
