interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SPA_ORIGIN: string;
}

interface GitHubTokenResponse {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly refresh_token_expires_in?: number;
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "3600",
  };
}

function jsonResponseHeaders(origin: string): Record<string, string> {
  return { ...corsHeaders(origin), ...securityHeaders() };
}

function parseCookies(cookie: string): Record<string, string> {
  return Object.fromEntries(
    cookie
      .split(";")
      .map((pair) => pair.trim().split("="))
      .filter((parts): parts is [string, ...string[]] => parts[0] !== undefined && parts[0] !== "")
      .map(([key, ...rest]): [string, string] => [key, rest.join("=")]),
  );
}

function clearCookieHeader(): string {
  return "oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/";
}

function escapeForJs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/</g, "\\u003c");
}

function escapeForHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function standaloneCallbackResponse(title: string, message: string, extraHeaders?: Record<string, string>): Response {
  const safeTitle = escapeForHtml(title);
  const safeMessage = escapeForHtml(message);
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
</head>
<body>
<h1>${safeTitle}</h1>
<p>${safeMessage}</p>
<p>You can close this tab and return to GitHub or the app.</p>
</body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Security-Policy": "default-src 'none'",
      ...securityHeaders(),
      ...extraHeaders,
    },
  });
}

function postMessageResponse(origin: string, message: object, extraHeaders?: Record<string, string>): Response {
  const json = JSON.stringify(message).replace(/</g, "\\u003c");
  const safeOrigin = escapeForJs(origin);
  const html = `<!DOCTYPE html>
<html>
<body>
<p>Logging in...</p>
<script>
if(window.opener){window.opener.postMessage(${json},"${safeOrigin}");}
window.close();
</script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'",
      ...securityHeaders(),
      ...extraHeaders,
    },
  });
}

async function exchangeToken(env: Env, body: Record<string, string>): Promise<GitHubTokenResponse> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      ...body,
    }),
  });
  return res.json();
}

function handleLogin(url: URL, env: Env): Response {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/auth/callback`,
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params.toString()}`,
      "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
      ...securityHeaders(),
    },
  });
}

async function handleCallback(url: URL, request: Request, env: Env, spaOrigin: string): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(request.headers.get("Cookie") ?? "");
  const cookieState = cookies["oauth_state"];
  const clearCookie = { "Set-Cookie": clearCookieHeader() };

  if (!state) {
    if (code) {
      return standaloneCallbackResponse(
        "Authorization complete",
        "GitHub App authorization finished. Return to GitHub and continue the installation flow.",
        clearCookie,
      );
    }

    return standaloneCallbackResponse(
      "Authorization not completed",
      "GitHub App authorization did not return a code. Return to GitHub and try the installation flow again.",
      clearCookie,
    );
  }

  if (!code) {
    return postMessageResponse(spaOrigin, { type: "gh-auth-bridge:auth:error", error: "missing_params" }, clearCookie);
  }

  if (cookieState !== state) {
    return postMessageResponse(spaOrigin, { type: "gh-auth-bridge:auth:error", error: "invalid_state" }, clearCookie);
  }

  try {
    const tokenData = await exchangeToken(env, { code });
    if (!tokenData.access_token) {
      return postMessageResponse(spaOrigin, { type: "gh-auth-bridge:auth:error", error: "token_exchange_failed" }, clearCookie);
    }

    return postMessageResponse(
      spaOrigin,
      {
        type: "gh-auth-bridge:auth:success",
        accessToken: tokenData.access_token,
        ...(tokenData.refresh_token
          ? {
              refreshToken: tokenData.refresh_token,
              expiresIn: tokenData.expires_in,
              refreshTokenExpiresIn: tokenData.refresh_token_expires_in,
            }
          : {}),
      },
      clearCookie,
    );
  } catch {
    return postMessageResponse(spaOrigin, { type: "gh-auth-bridge:auth:error", error: "token_exchange_failed" }, clearCookie);
  }
}

async function handleRefresh(request: Request, env: Env, spaOrigin: string): Promise<Response> {
  const requestOrigin = request.headers.get("Origin");
  const normalizedRequestOrigin = requestOrigin ? normalizeOrigin(requestOrigin) : null;
  if (!normalizedRequestOrigin || normalizedRequestOrigin !== spaOrigin) {
    return Response.json({ error: "forbidden_origin" }, { status: 403, headers: jsonResponseHeaders(spaOrigin) });
  }

  let body: { refreshToken?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: jsonResponseHeaders(spaOrigin) });
  }

  if (!body.refreshToken) {
    return Response.json({ error: "missing_refresh_token" }, { status: 400, headers: jsonResponseHeaders(spaOrigin) });
  }

  try {
    const tokenData = await exchangeToken(env, { grant_type: "refresh_token", refresh_token: body.refreshToken });

    if (!tokenData.access_token) {
      return Response.json({ error: "refresh_failed" }, { status: 401, headers: jsonResponseHeaders(spaOrigin) });
    }

    return Response.json(
      {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        refreshTokenExpiresIn: tokenData.refresh_token_expires_in,
      },
      { status: 200, headers: jsonResponseHeaders(spaOrigin) },
    );
  } catch {
    return Response.json({ error: "refresh_failed" }, { status: 502, headers: jsonResponseHeaders(spaOrigin) });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const spaOrigin = normalizeOrigin(env.SPA_ORIGIN);
    if (!spaOrigin) {
      return new Response("Invalid SPA_ORIGIN", { status: 500, headers: securityHeaders() });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: jsonResponseHeaders(spaOrigin),
      });
    }

    if (url.pathname === "/auth/login" && request.method === "GET") {
      return handleLogin(url, env);
    }

    if (url.pathname === "/auth/callback" && request.method === "GET") {
      return handleCallback(url, request, env, spaOrigin);
    }

    if (url.pathname === "/auth/refresh" && request.method === "POST") {
      return handleRefresh(request, env, spaOrigin);
    }

    if (url.pathname === "/auth/health") {
      return new Response("OK", { status: 200, headers: securityHeaders() });
    }

    return new Response("Not Found", { status: 404, headers: securityHeaders() });
  },
} satisfies ExportedHandler<Env>;
