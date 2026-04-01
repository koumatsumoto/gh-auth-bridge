export interface RateLimitInfo {
  readonly remaining: number;
  readonly resetAt: Date;
}

export function extractRateLimit(headers: Headers): RateLimitInfo {
  return {
    remaining: Number(headers.get("X-RateLimit-Remaining") ?? 0),
    resetAt: new Date(Number(headers.get("X-RateLimit-Reset") ?? 0) * 1000),
  };
}

export function isRateLimited(response: Response): boolean {
  if (response.status === 429) return true;
  return response.status === 403 && response.headers.get("X-RateLimit-Remaining") === "0";
}
