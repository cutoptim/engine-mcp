#!/usr/bin/env node
// npx @cutoptim/mcp — the CutOptim MCP server over stdio.
//   CUTOPTIM_API_KEY   your key (co_live_…, co_test_…, or the public demo key); not needed for validate_*
//   CUTOPTIM_BASE_URL  default https://api.cutoptim.com
// stdout carries the MCP protocol only; diagnostics go to stderr.
import { CutOptim } from '@cutoptim/engine';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCutOptimToolServer, VERSION } from './server.js';

const client = new CutOptim({
  apiKey: process.env.CUTOPTIM_API_KEY || undefined,
  baseUrl: process.env.CUTOPTIM_BASE_URL || undefined,
});
const server = createCutOptimToolServer(client);
await server.connect(new StdioServerTransport());
console.error(`cutoptim-mcp ${VERSION} ready (stdio)${process.env.CUTOPTIM_API_KEY ? '' : ' — no CUTOPTIM_API_KEY: only validate_* will work'}`);
