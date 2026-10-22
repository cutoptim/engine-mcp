// GENERATED copy of the hosted server's MCP core by scripts/gen-mcp.ts — DO NOT EDIT.
// CutOptim MCP core: the tool dispatcher and the result formatter.
//
// ONE file, shared by the hosted server (https://api.cutoptim.com/mcp) and the local stdio package
// (@cutoptim/mcp). The package carries a byte-identical copy (core.gen.ts, written by `npm run gen:mcp`),
// so this file imports nothing but the MCP SDK and must stay free of server-only code.
//
// A tool call is exactly one Engine API call: the dispatcher turns the arguments into the HTTP request the
// REST API documents and hands it to `call`, which the host implements (the hosted server: a loopback request
// into the engine itself, so auth, rate limits, quota and billing are the REST ones; the stdio package: the
// official TypeScript client). Nothing here decides what is billed.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations: { title: string; readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
  /** The REST operation behind the tool. `pathParam` names the argument that fills the `{id}` segment. */
  http: { method: 'GET' | 'POST'; path: string; operationId: string; pathParam?: string };
}

/** The REST request a tool call becomes. `args` are the tool arguments as received (a client SDK may dispatch on them). */
export interface ApiRequest { method: 'GET' | 'POST'; path: string; body?: unknown; operationId: string; args: Record<string, unknown> }
export interface ApiAnswer {
  status: number;
  body: unknown;
  /** X-RateLimit-Remaining when the API sent it (monthly calls left, or the demo key's daily allowance). */
  remaining?: number | null;
  /** True when the public demo key answered. */
  demo?: boolean;
}
export type ApiCall = (req: ApiRequest, signal?: AbortSignal) => Promise<ApiAnswer>;

export const SERVER_NAME = 'cutoptim';

export const SERVER_INSTRUCTIONS =
  'CutOptim cutting optimization: 2D panels (optimize_2d), 1D bars and profiles (optimize_1d), timber with ' +
  'cross-sections (optimize_wood) and true-shape nesting (optimize_nest). Every optimize_* call is one metered ' +
  'Engine API call; validate_* is free and checks a request without solving it, so validate first when unsure. ' +
  'All sizes are unit-agnostic numbers: keep one unit (e.g. mm) across parts, stock and kerf. ' +
  'engine "max" runs asynchronously: the answer is a jobId, poll it with get_job. ' +
  'get_usage shows the calls left this month. Reference: https://cutoptim.com/engine/reference';

/** Export strings that are elided from the JSON text block (they stay in structuredContent). */
const EXPORT_FIELDS = ['svg', 'dxf', 'csv', 'pdf', 'labelsPdf'] as const;
const MAX_TABLE_ROWS = 25;

export function createCutOptimMcpServer(opts: { tools: ToolDef[]; call: ApiCall; version: string }): Server {
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const server = new Server(
    { name: SERVER_NAME, title: 'CutOptim Engine', version: opts.version },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: opts.tools.map((t) => ({
      name: t.name, title: t.title, description: t.description,
      inputSchema: t.inputSchema as { type: 'object' },
      ...(t.outputSchema ? { outputSchema: t.outputSchema as { type: 'object' } } : {}),
      annotations: t.annotations,
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const tool = byName.get(request.params.name);
    if (!tool) throw new McpError(ErrorCode.InvalidParams, `unknown tool: ${request.params.name}`);
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const req = toApiRequest(tool, args);
    if ('error' in req) return errorResult(req.error);
    let answer: ApiAnswer;
    try {
      answer = await opts.call(req, extra.signal);
    } catch (e) {
      return errorResult(`The CutOptim Engine API could not be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
    return toToolResult(tool, answer);
  });
  return server;
}

/** Arguments → the documented REST request. POST tools send the arguments verbatim as the JSON body. */
export function toApiRequest(tool: ToolDef, args: Record<string, unknown>): ApiRequest | { error: string } {
  const { method, path, operationId, pathParam } = tool.http;
  if (pathParam) {
    const v = args[pathParam];
    if (typeof v !== 'string' || v === '') return { error: `${tool.name} needs "${pathParam}" (a string).` };
    return { method, operationId, args, path: path.replace(/\{[^}]+\}/, encodeURIComponent(v)) };
  }
  return method === 'POST' ? { method, path, operationId, args, body: args } : { method, path, operationId, args };
}

function errorResult(text: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text }] };
}

export function toToolResult(tool: ToolDef, a: ApiAnswer): CallToolResult {
  const body = (a.body && typeof a.body === 'object' ? a.body : {}) as Record<string, any>;
  if (a.status < 200 || a.status > 299) {
    const code = typeof body.error === 'string' ? body.error : `http_${a.status}`;
    const msg = typeof body.message === 'string' ? body.message : 'no message';
    const lines = [`CutOptim API error ${a.status} ${code}: ${msg}`];
    if (body.details != null) lines.push(`details: ${JSON.stringify(body.details)}`);
    if (a.status === 401) lines.push('Send your API key as "Authorization: Bearer co_live_… / co_test_…" in the MCP client configuration. A free test key (never billed): https://cutoptim.com/dashboard?api=test#api-keys');
    return errorResult(lines.join('\n'));
  }
  const content: CallToolResult['content'] = [{ type: 'text', text: summarize(tool, a, body) }];
  const elided: Record<string, unknown> = { ...body };
  for (const f of EXPORT_FIELDS) {
    if (typeof body[f] === 'string') elided[f] = `[${f}: ${body[f].length} characters, in structuredContent]`;
  }
  content.push({ type: 'text', text: JSON.stringify(elided) });
  if (typeof body.svg === 'string') {
    content.push({ type: 'resource', resource: { uri: `cutoptim://layout/${tool.name}.svg`, mimeType: 'image/svg+xml', text: body.svg } });
  }
  return { content, structuredContent: body };
}

// ── human summaries ────────────────────────────────────────────────────────────────────────────────
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '–');
const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export function summarize(tool: ToolDef, a: ApiAnswer, b: Record<string, any>): string {
  const out: string[] = [];
  const op = tool.http.operationId;
  if (a.status === 202 && typeof b.jobId === 'string') {
    out.push(`Job queued: ${b.jobId} (engine ${b.engine ?? 'max'}, mode ${b.mode ?? '?'}). Poll it with get_job after about ${Math.ceil((Number(b.pollAfterMs) || 1000) / 1000)} s.`);
  } else if (op.startsWith('validate')) {
    out.push(b.valid === true
      ? `Valid ${b.mode ?? ''} request: ${n(b.parts?.rows)} part rows (${n(b.parts?.total)} pieces), ${n(b.stock?.rows)} stock rows. Not solved and not billed.`
      : `Request is not valid: ${JSON.stringify(b)}`);
    warnings(out, b);
  } else if (op === 'getUsage') {
    out.push(`Plan ${b.plan ?? '?'}: ${n(b.used)} of ${n(b.limit)} calls used this period, ${n(b.remaining)} left (period ends ${b.periodEnd ?? '?'}, key ${b.keyPrefix ?? '?'}…).`);
  } else if (op === 'getJob') {
    out.push(`Job ${b.jobId ?? '?'}: ${b.status ?? '?'} (engine ${b.engine ?? '?'}, mode ${b.mode ?? '?'}).`);
    if (b.status === 'queued' || b.status === 'running') out.push('Not finished yet: poll get_job again in a few seconds.');
    if (b.status === 'failed' && b.error) out.push(`Error: ${b.error}`);
    if (b.result && typeof b.result === 'object') planSummary(out, b.mode === 'nest' ? 'nest' : '2d', b.result);
  } else {
    planSummary(out, op === 'optimize1d' ? '1d' : op === 'optimizeWood' ? 'wood' : op === 'optimizeNest' ? 'nest' : '2d', b);
  }
  if (a.remaining != null) out.push(a.demo ? `Demo key: ${a.remaining} demo calls left today from this address.` : `Calls left this month: ${a.remaining}.`);
  return out.join('\n');
}

function planSummary(out: string[], mode: '2d' | '1d' | 'wood' | 'nest', b: Record<string, any>): void {
  const m = b.metrics ?? {};
  const price = typeof m.totalPrice === 'number' && m.totalPrice > 0 ? `, total price ${n(m.totalPrice)}` : '';
  if (mode === '2d') {
    out.push(`2D plan (engine ${b.engine ?? '?'}): ${n(m.placed)}/${n(m.total)} parts on ${n(m.sheetCount)} sheets, yield ${n(m.yieldPct)}%, ${n(m.cutLines)} cuts${price}.`);
    table(out, ['sheet', 'size', 'parts', 'offcuts'], list(b.sheets).map((s, i) => [String(i + 1), `${n(s.w)} × ${n(s.h)}`, String(list(s.parts).length), String(list(s.offcuts).length)]));
  } else if (mode === '1d') {
    out.push(`1D plan (engine ${b.engine ?? '?'}): ${n(m.placed)}/${n(m.total)} parts on ${n(m.rodCount)} bars, yield ${n(m.yieldPct)}%, ${n(m.cuts)} cuts${price}.`);
    table(out, ['bar', 'length', 'parts', 'remaining'], list(b.rods).map((r, i) => [String(i + 1), n(r.length), String(list(r.parts).length), n(r.remaining)]));
  } else if (mode === 'wood') {
    out.push(`Timber plan (engine ${b.engine ?? '?'}): ${n(m.placed)}/${n(m.total)} parts in ${n(m.sectionCount)} cross-sections on ${n(m.rodCount)} pieces of stock, yield ${n(m.yieldPct)}%${price}.`);
    table(out, ['section', 'stock', 'pieces', 'yield %'], list(b.sections).map((s) => [String(s.section ?? `${n(s.sw)}×${n(s.sh)}`), String(s.stockName ?? '–'), String(list(s.rods).length), n(s.metrics?.yieldPct)]));
    if (list(b.unmatched).length) out.push(`No stock for: ${list(b.unmatched).map((u) => u.section ?? u.name ?? JSON.stringify(u)).join(', ')}`);
  } else {
    out.push(`Nesting plan (engine ${b.engine ?? '?'}): ${n(m.placed)}/${n(m.total)} parts on ${n(m.sheetCount)} sheets, density ${n((Number(m.density) || 0) * 100)}%${price}.`);
    table(out, ['sheet', 'size', 'parts', 'density %'], list(b.sheets).map((s, i) => [String(i + 1), `${n(s.w)} × ${n(s.h)}`, String(list(s.parts).length), n((Number(s.density) || 0) * 100)]));
  }
  const unplaced = list(b.unplaced);
  if (unplaced.length) out.push(`Not placed (${unplaced.length}): ${unplaced.slice(0, 10).map((u) => `${u.name ?? u.id ?? '?'}${u.qty ? ` ×${u.qty}` : ''}${u.reason ? ` (${u.reason})` : ''}`).join(', ')}${unplaced.length > 10 ? ', …' : ''}`);
  warnings(out, b);
  if (typeof b.svg === 'string') out.push('An SVG drawing of the layout is attached.');
}

function warnings(out: string[], b: Record<string, any>): void {
  const w = list(b.warnings).filter((x) => typeof x === 'string');
  if (w.length) out.push(`Warnings: ${w.join(' | ')}`);
}

function table(out: string[], head: string[], rows: string[][]): void {
  if (!rows.length) return;
  out.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`);
  for (const r of rows.slice(0, MAX_TABLE_ROWS)) out.push(`| ${r.join(' | ')} |`);
  if (rows.length > MAX_TABLE_ROWS) out.push(`(${rows.length - MAX_TABLE_ROWS} more rows in the JSON)`);
}
