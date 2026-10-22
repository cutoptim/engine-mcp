// @cutoptim/mcp — the CutOptim tools as a local MCP server, on top of the official @cutoptim/engine client.
//
// The tool list (tools.gen.ts) and the dispatcher/formatter (core.gen.ts) are the ones the hosted server at
// https://api.cutoptim.com/mcp runs — generated from the same source, so both answer the same way. Every tool call is
// exactly one Engine API call through the client: same key, quota and billing as calling the REST API yourself; the
// client adds an Idempotency-Key to optimize calls, so its own retries are never charged twice.

import { createCutOptimMcpServer, type ApiAnswer, type ApiRequest } from './core.gen.js';
import { TOOLS } from './tools.gen.js';
import { VERSION } from './version.js';

export { TOOLS, VERSION };

type Opts = { signal?: AbortSignal };
/** The part of the @cutoptim/engine client (`new CutOptim(...)`) the tools use. */
export interface EngineClient {
  optimize2d(body: any, opts?: Opts): Promise<unknown>;
  optimize1d(body: any, opts?: Opts): Promise<unknown>;
  optimizeWood(body: any, opts?: Opts): Promise<unknown>;
  optimizeNest(body: any, opts?: Opts): Promise<unknown>;
  validate2d(body: any, opts?: Opts): Promise<unknown>;
  validate1d(body: any, opts?: Opts): Promise<unknown>;
  validateWood(body: any, opts?: Opts): Promise<unknown>;
  validateNest(body: any, opts?: Opts): Promise<unknown>;
  getJob(jobId: string, opts?: Opts): Promise<unknown>;
  usage(opts?: Opts): Promise<unknown>;
}

const OPS: Record<string, (c: EngineClient, a: Record<string, unknown>, o: Opts) => Promise<unknown>> = {
  optimize2d: (c, a, o) => c.optimize2d(a, o),
  optimize1d: (c, a, o) => c.optimize1d(a, o),
  optimizeWood: (c, a, o) => c.optimizeWood(a, o),
  optimizeNest: (c, a, o) => c.optimizeNest(a, o),
  validate2D: (c, a, o) => c.validate2d(a, o),
  validate1D: (c, a, o) => c.validate1d(a, o),
  validateWood: (c, a, o) => c.validateWood(a, o),
  validateNest: (c, a, o) => c.validateNest(a, o),
  getJob: (c, a, o) => c.getJob(String(a.jobId), o),
  getUsage: (c, _a, o) => c.usage(o),
};

const isJobAccepted = (r: any) => !!r && typeof r === 'object' && typeof r.jobId === 'string' && r.status === 'queued';

export async function dispatch(client: EngineClient, req: ApiRequest, signal?: AbortSignal): Promise<ApiAnswer> {
  const op = OPS[req.operationId];
  if (!op) return { status: 400, body: { error: 'invalid_request', message: `no client method for ${req.operationId}` } };
  try {
    const body = await op(client, req.args, { signal });
    return { status: req.operationId.startsWith('optimize') && isJobAccepted(body) ? 202 : 200, body };
  } catch (e: any) {
    // CutOptimError (status, code, details) → the API's error envelope; anything else (network) propagates.
    if (e && typeof e.status === 'number' && typeof e.code === 'string') {
      return { status: e.status || 504, body: { error: e.code, message: e.message, ...(e.details != null ? { details: e.details } : {}) } };
    }
    throw e;
  }
}

/** An MCP server (not yet connected) whose tools call the CutOptim Engine API through `client`. */
export function createCutOptimToolServer(client: EngineClient) {
  return createCutOptimMcpServer({ tools: TOOLS, version: VERSION, call: (req, signal) => dispatch(client, req, signal) });
}
