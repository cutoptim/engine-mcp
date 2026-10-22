<p align="center">
  <a href="https://cutoptim.com/engine"><img src="https://raw.githubusercontent.com/cutoptim/engine-mcp/main/.github/logo.png" width="88" height="88" alt="CutOptim"></a>
</p>

<h1 align="center">CutOptim MCP server</h1>

<p align="center">
  Cutting optimization as tools for AI assistants: <b>2D panels</b>, <b>1D bars</b>, <b>timber</b> and <b>true-shape nesting</b>,<br>
  through the <a href="https://cutoptim.com/engine">CutOptim Engine API</a> and the Model Context Protocol.
</p>

<p align="center">
  <a href="https://cutoptim.com/engine/reference/guides/mcp">MCP guide</a> ·
  <a href="https://cutoptim.com/engine/reference">API reference</a> ·
  <a href="https://cutoptim.com/dashboard?api=test#api-keys">Get a free test key</a>
</p>

---

## Two ways to connect

**Hosted (no install)** — point your MCP client at `https://api.cutoptim.com/mcp` with the header
`Authorization: Bearer <your API key>`. Configurations for Claude Code, Cursor, VS Code and Claude Desktop are in the
[MCP guide](https://cutoptim.com/engine/reference/guides/mcp).

**Local (this package, stdio)** — runs on your machine and calls the same API with your key:

```json
{
  "mcpServers": {
    "cutoptim": {
      "command": "npx",
      "args": ["-y", "@cutoptim/mcp"],
      "env": { "CUTOPTIM_API_KEY": "co_test_YOUR_KEY" }
    }
  }
}
```

Claude Code: `claude mcp add cutoptim --env CUTOPTIM_API_KEY=co_test_YOUR_KEY -- npx -y @cutoptim/mcp`

| Variable | Meaning |
|---|---|
| `CUTOPTIM_API_KEY` | your key: `co_live_…`, `co_test_…` (never billed) or the public demo key. Without one, only the `validate_*` tools work. |
| `CUTOPTIM_BASE_URL` | default `https://api.cutoptim.com` |

Node 18 or newer.

## Tools

| Tool | What it does | Cost |
|---|---|---|
| `optimize_2d` | rectangular parts from sheets: layout, cut plan, yield | one API call |
| `optimize_1d` | lengths from bars, tubes, profiles | one API call |
| `optimize_wood` | timber parts by cross-section | one API call |
| `optimize_nest` | free-form polygon parts on sheets | one API call |
| `validate_2d` · `validate_1d` · `validate_wood` · `validate_nest` | check a request without solving it | free |
| `get_job` | read an async `engine: "max"` job | free |
| `get_usage` | calls used and left this month | free |

The arguments of each tool are exactly the request body of its endpoint — the schemas are generated from the
[OpenAPI document](https://cutoptim.com/engine/openapi.json). Every result carries a short summary for the assistant
and the API's JSON answer as `structuredContent`.

## Quota and billing

One tool call is one Engine API call: the same key, quota, rate limits and billing as calling the REST API yourself.
The client sends an `Idempotency-Key` with every optimize call, so its own retries are never charged twice.

## License and support

MIT. This repository is published from the CutOptim monorepo; report a bug in
[Issues](https://github.com/cutoptim/engine-mcp/issues) or write to support@cutoptim.com.
