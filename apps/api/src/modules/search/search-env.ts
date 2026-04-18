export type SearchEngineMode = 'postgres' | 'typesense';

export function getSearchEngine(): SearchEngineMode {
  const v = (process.env.SEARCH_ENGINE ?? 'postgres').toLowerCase();
  return v === 'typesense' ? 'typesense' : 'postgres';
}

export function getTypesenseFallback(): boolean {
  return process.env.SEARCH_TYPESENSE_FALLBACK === 'true';
}

/** Batch flush interval for in-memory search index queue (ms). Default 5000. */
export function getSearchIndexFlushIntervalMs(): number {
  const raw = process.env.SEARCH_INDEX_FLUSH_INTERVAL_MS?.trim();
  if (!raw) return 5000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 250 ? n : 5000;
}

export type TypesenseClientOptions = {
  nodes: Array<{ host: string; port: number; protocol: 'http' | 'https' }>;
  apiKey: string;
  connectionTimeoutSeconds: number;
};

/**
 * Returns Typesense JS client options when host + API key are set.
 * Set TYPESENSE_PORT (e.g. 443) and TYPESENSE_PROTOCOL=https for Typesense Cloud.
 */
export function getTypesenseConfigurationOptions(): TypesenseClientOptions | null {
  const apiKey = process.env.TYPESENSE_API_KEY?.trim();
  const host = process.env.TYPESENSE_HOST?.trim();
  if (!apiKey || !host) {
    return null;
  }

  const portStr = process.env.TYPESENSE_PORT?.trim();
  const port = portStr ? parseInt(portStr, 10) : 8108;
  const protocol = (process.env.TYPESENSE_PROTOCOL?.trim() || 'http') as
    | 'http'
    | 'https';

  return {
    nodes: [
      {
        host,
        port,
        protocol,
      },
    ],
    apiKey,
    connectionTimeoutSeconds: 5,
  };
}
