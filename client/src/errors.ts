export class AuthError extends Error {
  override readonly name = "AuthError" as const;
}

export type TokenRefreshFailureReason = "invalid_grant" | "transient";

export class TokenRefreshError extends AuthError {
  readonly reason: TokenRefreshFailureReason;
  constructor(reason: TokenRefreshFailureReason, message: string, options?: ErrorOptions) {
    super(message, options);
    this.reason = reason;
  }
}

export class GitHubApiError extends Error {
  override readonly name = "GitHubApiError" as const;
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    super(`GitHub API error: ${String(status)}`);
    this.status = status;
    this.body = body;
  }
}

export class NetworkError extends Error {
  override readonly name = "NetworkError" as const;
}

export class RateLimitError extends Error {
  override readonly name = "RateLimitError" as const;
  readonly resetAt: Date;
  constructor(resetAt: Date) {
    super(`GitHub API rate limit exceeded. Resets at ${resetAt.toLocaleTimeString()}`);
    this.resetAt = resetAt;
  }
}
