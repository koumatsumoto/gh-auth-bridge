export interface AuthUser {
  readonly login: string;
  readonly id: number;
  readonly avatarUrl: string;
}

export interface AuthState {
  readonly token: string | null;
  readonly user: AuthUser | null;
  readonly isLoading: boolean;
}

export interface AuthContextValue {
  readonly state: AuthState;
  readonly login: () => Promise<void>;
  readonly logout: () => void;
}

export interface TokenSet {
  readonly accessToken: string;
  readonly refreshToken: string | undefined;
  readonly expiresAt: number | undefined;
  readonly refreshExpiresAt: number | undefined;
}

export interface OAuthSuccessMessage {
  readonly type: "gh-auth-bridge:auth:success";
  readonly accessToken: string;
  readonly refreshToken?: string | undefined;
  readonly expiresIn?: number | undefined;
  readonly refreshTokenExpiresIn?: number | undefined;
}

export interface OAuthErrorMessage {
  readonly type: "gh-auth-bridge:auth:error";
  readonly error: string;
}

export type OAuthMessage = OAuthSuccessMessage | OAuthErrorMessage;

export interface GitHubUser {
  readonly login: string;
  readonly id: number;
  readonly avatar_url: string;
}
