declare module 'pg' {
  type QueryConfig = {
    text: string;
    values?: unknown[];
    name?: string;
  };

  export interface QueryResult<T = unknown> {
    rows: T[];
    rowCount: number;
    command: string;
    oid: number;
    fields: Array<{ name: string }>;
  }

  export type PoolConfig = {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    [key: string]: unknown;
  };

  export class Pool {
    constructor(config?: PoolConfig);
    query<T = unknown>(queryConfig: QueryConfig | string, values?: unknown[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}
