/**
 * Generic API envelope and shared HTTP shapes.
 *
 * Every route handler that returns JSON must declare its response as
 * `Response<ApiResponse<T>>` so that the wire shape is type-checked at
 * compile time. The frontend re-exports this same shape to keep both
 * sides in sync.
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  aiProviderConfigured: boolean;
  aiModel: string;
  microservice: {
    binaryPath: string;
    catalogPath: string;
    binaryFound: boolean;
    catalogFound: boolean;
    connected: boolean;
  };
  totalRuns: number;
  latestRun: {
    source_name: string;
    findings_count: number;
    created_at: string;
  } | null;
  process: {
    pid: number;
    hostname: string;
    port: number;
    startedAt: string;
  };
  /** Whether `gdb` is available on PATH (probed once at startup). Stage 5 of the implementation plan. */
  gdbAvailable?: boolean;
}
