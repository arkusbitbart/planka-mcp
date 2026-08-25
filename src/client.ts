/**
 * HTTP client for PLANKA API with automatic authentication.
 *
 * Supports two authentication modes:
 * - API key (preferred): set PLANKA_API_KEY, sent as X-Api-Key header on every
 *   request. No login request is ever made in this mode.
 * - Email/password (fallback): set PLANKA_AGENT_EMAIL and PLANKA_AGENT_PASSWORD,
 *   exchanged for a JWT via POST /api/access-tokens and refreshed automatically.
 */
import {
  PlankaAuthError,
  PlankaConfigError,
  PlankaNetworkError,
  createPlankaError,
} from "./errors.js";
import { AuthResponse } from "./schemas/responses.js";

type ClientConfig =
  | { baseUrl: string; authMode: "apiKey"; apiKey: string }
  | { baseUrl: string; authMode: "credentials"; email: string; password: string };

/**
 * Validates and returns the configuration from environment variables.
 * PLANKA_API_KEY takes precedence; email/password are only required without it.
 */
function getConfig(): ClientConfig {
  const baseUrl = process.env.PLANKA_BASE_URL;
  const apiKey = process.env.PLANKA_API_KEY;
  const email = process.env.PLANKA_AGENT_EMAIL;
  const password = process.env.PLANKA_AGENT_PASSWORD;

  if (!baseUrl) {
    throw new PlankaConfigError(
      "Missing required environment variable: PLANKA_BASE_URL"
    );
  }

  // Validate URL format
  try {
    new URL(baseUrl);
  } catch {
    throw new PlankaConfigError(`Invalid PLANKA_BASE_URL: ${baseUrl}`);
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash

  if (apiKey) {
    return { baseUrl: normalizedBaseUrl, authMode: "apiKey", apiKey };
  }

  const missing: string[] = [];
  if (!email) missing.push("PLANKA_AGENT_EMAIL");
  if (!password) missing.push("PLANKA_AGENT_PASSWORD");

  if (missing.length > 0) {
    throw new PlankaConfigError(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Either set PLANKA_API_KEY, or set both PLANKA_AGENT_EMAIL and PLANKA_AGENT_PASSWORD."
    );
  }

  return {
    baseUrl: normalizedBaseUrl,
    authMode: "credentials",
    email: email!,
    password: password!,
  };
}

/**
 * PLANKA API client with automatic JWT token management.
 */
class PlankaClient {
  private config: ClientConfig | null = null;
  private token: string | null = null;
  private tokenExpiresAt: number = 0;

  /**
   * Gets or initializes the configuration.
   */
  private getConfig(): ClientConfig {
    if (!this.config) {
      this.config = getConfig();
    }
    return this.config;
  }

  /** Request timeout in milliseconds */
  private static readonly REQUEST_TIMEOUT_MS = 30000;

  /**
   * Creates an AbortSignal with timeout.
   * Uses AbortSignal.timeout() which automatically cleans up when the request completes.
   */
  private createTimeoutSignal(): AbortSignal {
    return AbortSignal.timeout(PlankaClient.REQUEST_TIMEOUT_MS);
  }

  /**
   * Authenticates with email/password and retrieves a new JWT token.
   * Only used in credentials mode; API key mode never calls this.
   */
  private async authenticate(): Promise<string> {
    const config = this.getConfig();
    if (config.authMode !== "credentials") {
      throw new PlankaAuthError(
        "Internal error: login attempted in API key mode"
      );
    }
    const url = `${config.baseUrl}/api/access-tokens`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailOrUsername: config.email,
          password: config.password,
        }),
        signal: this.createTimeoutSignal(),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new PlankaNetworkError(
          `Request timeout connecting to PLANKA at ${config.baseUrl}`,
          error
        );
      }
      throw new PlankaNetworkError(
        `Failed to connect to PLANKA at ${config.baseUrl}`,
        error
      );
    }

    if (!response.ok) {
      const body = await this.safeParseJson(response);
      throw new PlankaAuthError(
        `Authentication failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const parsed = AuthResponse.parse(data);

    // PLANKA tokens are valid for 30 minutes by default.
    // We refresh after 25 minutes to avoid edge cases.
    // If PLANKA's token lifetime changes, adjust this value.
    this.tokenExpiresAt = Date.now() + 25 * 60 * 1000;
    this.token = parsed.item;

    return this.token;
  }

  /**
   * Gets a valid token, refreshing if necessary.
   */
  private async getToken(): Promise<string> {
    if (!this.token || Date.now() >= this.tokenExpiresAt) {
      return this.authenticate();
    }
    return this.token;
  }

  /**
   * Builds the authentication headers for a request.
   * API key mode sends X-Api-Key; credentials mode sends a Bearer token.
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const config = this.getConfig();
    if (config.authMode === "apiKey") {
      return { "X-Api-Key": config.apiKey };
    }
    const token = await this.getToken();
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Safely parses JSON from a response, returning null on failure.
   */
  private async safeParseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Makes an authenticated request to the PLANKA API.
   * FormData bodies are sent as multipart/form-data (fetch sets the boundary);
   * all other bodies are JSON-encoded.
   * @param isRetry - Internal flag to prevent infinite retry loops on 401
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    isRetry = false
  ): Promise<T> {
    const config = this.getConfig();
    const url = `${config.baseUrl}${path}`;

    const headers: Record<string, string> = await this.getAuthHeaders();

    let requestBody: string | FormData | undefined;
    if (body instanceof FormData) {
      // Let fetch set the multipart Content-Type incl. boundary
      requestBody = body;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: requestBody,
        signal: this.createTimeoutSignal(),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new PlankaNetworkError(`Request timeout: ${method} ${path}`, error);
      }
      throw new PlankaNetworkError(`Network error: ${method} ${path}`, error);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const data = await this.safeParseJson(response);

    if (!response.ok) {
      if (response.status === 401) {
        if (config.authMode === "apiKey") {
          // API keys are static; retrying cannot help
          throw new PlankaAuthError(
            "Authentication failed: PLANKA rejected the API key (X-Api-Key). Check PLANKA_API_KEY."
          );
        }
        // If token expired and this is not already a retry, get fresh token and retry once
        if (this.token && !isRetry) {
          this.token = null;
          this.tokenExpiresAt = 0;
          return this.request(method, path, body, true);
        }
      }
      throw createPlankaError(response.status, data, `${method} ${path}`);
    }

    return data as T;
  }

  /**
   * GET request.
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  /**
   * POST request.
   */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  /**
   * POST request with a multipart/form-data body.
   */
  async postForm<T>(path: string, form: FormData): Promise<T> {
    return this.request<T>("POST", path, form);
  }

  /**
   * PATCH request.
   */
  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  /**
   * DELETE request.
   */
  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

// Singleton client instance
export const plankaClient = new PlankaClient();
