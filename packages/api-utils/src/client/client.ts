import {
  ApiResponse,
  ErrorCode,
  createErrorResponse,
  isApiResponse,
} from '../core/api.types.js';

export interface ApiClientOptions {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  credentials?: RequestCredentials;
  retryCount?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private credentials: RequestCredentials;
  private retryCount: number;
  private retryDelay: number;
  private onRetry?: (attempt: number, error: Error) => void;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || '/api';
    this.defaultHeaders = options.defaultHeaders || {
      'Content-Type': 'application/json',
    };
    this.timeout = options.timeout || 10000;
    this.credentials = options.credentials || 'include';
    this.retryCount = options.retryCount || 0;
    this.retryDelay = options.retryDelay || 1000;
    this.onRetry = options.onRetry;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.defaultHeaders, ...options.headers };
    const timeout = options.timeout || this.timeout;
    const maxRetries = options.retryCount ?? this.retryCount;
    const retryDelay = options.retryDelay ?? this.retryDelay;
    const onRetry = options.onRetry || this.onRetry;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Declared outside the try block: the catch below calls
      // clearTimeout(timeoutId) on every failure/retry, so timeoutId has
      // to still be in scope there. Declaring it with `const` inside the
      // try (as originally written) throws "timeoutId is not defined" the
      // moment fetch throws or the request aborts — i.e. on every single
      // network error or timeout, before any error handling could run.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          headers,
          credentials: this.credentials,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
          // If the response is already an ApiResponse, use it
          if (isApiResponse(data)) {
            return data;
          }

          return {
            success: false,
            message: data.message || `Request failed with status ${response.status}`,
            data: null,
            timestamp: new Date().toISOString(),
            errors: data.errors || [{
              code: ErrorCode.INTERNAL_ERROR,
              message: 'Request failed'
            }],
          };
        }

        return data as ApiResponse<T>;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error as Error;

        if (attempt < maxRetries) {
          if (onRetry) {
            onRetry(attempt + 1, lastError);
          }

          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
          continue;
        }

        if (lastError instanceof Error && lastError.name === 'AbortError') {
          return createErrorResponse(
            ErrorCode.SERVICE_UNAVAILABLE,
            { message: 'Request timed out' }
          ) as ApiResponse<T>;
        }

        console.error('API request error:', lastError);
        return createErrorResponse(
          ErrorCode.SERVICE_UNAVAILABLE,
          { message: lastError instanceof Error ? lastError.message : 'Network error' }
        ) as ApiResponse<T>;
      }
    }

    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      { message: 'Request failed after retries' }
    ) as ApiResponse<T>;
  }

  get<T = any>(
    endpoint: string,
    query?: Record<string, any>,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = query ? `${endpoint}?${new URLSearchParams(query)}` : endpoint;
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  post<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  patch<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  delete<T = any>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Streaming support
  async stream<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ReadableStream<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.defaultHeaders, ...options.headers };
    const timeout = options.timeout || this.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        credentials: this.credentials,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok || !response.body) {
      throw new Error(`Stream request failed: ${response.status}`);
    }

    return response.body.pipeThrough(
      new TransformStream({
        async transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk);
          const lines = text.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              controller.enqueue(data);
            } catch {
              // Skip malformed lines
            }
          }
        },
      })
    );
  }

  // File upload support
  async upload<T = any>(
    endpoint: string,
    file: File | Blob,
    options: {
      fieldName?: string;
      additionalData?: Record<string, any>;
    } = {},
    requestOptions?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append(options.fieldName || 'file', file);

    if (options.additionalData) {
      for (const [key, value] of Object.entries(options.additionalData)) {
        formData.append(key, JSON.stringify(value));
      }
    }

    const url = `${this.baseUrl}${endpoint}`;
    // `RequestInit['headers']` (HeadersInit) can be a Headers instance or
    // string[][], neither of which TS lets you index/delete a key from
    // after a plain object spread — this client only ever accepts a plain
    // record here, so narrow it explicitly.
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(requestOptions?.headers as Record<string, string> | undefined),
    };
    delete headers['Content-Type']; // Let the browser set it (with boundary) for FormData

    const timeout = requestOptions?.timeout || this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...requestOptions,
        headers,
        method: 'POST',
        body: formData,
        credentials: this.credentials,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'Upload failed',
          data: null,
          timestamp: new Date().toISOString(),
          errors: data.errors,
        };
      }

      return data as ApiResponse<T>;
    } catch (error) {
      clearTimeout(timeoutId);

      return createErrorResponse(
        ErrorCode.UPLOAD_FAILED,
        { message: error instanceof Error ? error.message : 'Upload failed' }
      ) as ApiResponse<T>;
    }
  }
}

export function createServerApiClient(baseUrl?: string): ApiClient {
  return new ApiClient({
    baseUrl: baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    credentials: 'include',
    timeout: 15000,
    retryCount: 2,
    retryDelay: 1000,
    defaultHeaders: {
      'Content-Type': 'application/json',
    },
  });
}
