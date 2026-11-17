# measles-cases-by-state-outbreak-mcp

US measles cases by state for AI assistants: how many confirmed measles cases the United States has this year, how many outbreaks, which states have cases and how many, hospitalizations and deaths, whether cases are rising, the history back to 1985 and kindergarten MMR vaccination rates by state. Ask how many measles cases Texas has, how bad the 2026 measles outbreak is compared with 2025, or which states are below the 95% MMR target.

This is a Model Context Protocol (MCP) server. It reads the CDC Measles Cases and Outbreaks page and the data files behind its charts at call time (CDC updates them weekly, on Wednesdays). It needs no API key.

## Tools

| Tool | What it returns |
| --- | --- |
| `measles_cases_us` | Confirmed US cases this year (or a past year): total, outbreak count and share of cases that are outbreak-associated, jurisdictions with cases, ages, vaccination status, percent hospitalized, deaths, last year for comparison and the trend over the last 4 complete weeks. |
| `measles_cases_by_state` | One state's cases this year, last year and the year before, its rank and its kindergarten MMR rate; or every state ranked by cases and the states with none. New York City is reported separately; "NY" adds both. |
| `measles_cases_history` | Yearly US cases from 1985 to this year with the highest and lowest year, or weekly cases by rash onset for a year since 2022 with monthly totals and the peak week. |
| `mmr_vaccination_rates` | Kindergarten MMR coverage (2 doses) by state for any school year since 2009-10: rank, change since 2019-20, how many states are below the 95% target and the state median. |

Every result has structured JSON, a plain-text summary, `as_of`, `source` and `more` (a page on [mcpstamp.com](https://www.mcpstamp.com/servers/?utm_source=mcp&utm_medium=measles-cases-by-state-outbreak-mcp)). Every tool is marked read-only.

## What it knows that your model does not

- This week's CDC count: 5,412 confirmed US measles cases in 2026 as of November 12, 2026, 43 outbreaks and 8 deaths, numbers that change every week.
- Cases for each state for this year and the two before, with New York City and the rest of New York State kept apart the way CDC reports them.
- The latest kindergarten MMR coverage by state (2025-26), which is published after any model's training data was collected.

## Install

### Hosted (custom connector, ChatGPT developer mode, any remote MCP client)

Paste this URL. No token, no sign-up.

```
https://measles-cases-by-state-outbreak-mcp.lipmichal.workers.dev/mcp
```

### Cursor

Add to `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "measles-cases": { "url": "https://measles-cases-by-state-outbreak-mcp.lipmichal.workers.dev/mcp" }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`.

```json
{
  "servers": {
    "measles-cases": { "type": "http", "url": "https://measles-cases-by-state-outbreak-mcp.lipmichal.workers.dev/mcp" }
  }
}
```

### Local stdio

The npm package is not published. Build it from this repository with Node 20 or newer, then point your MCP client at `node /path/to/measles-cases-by-state-outbreak-mcp/dist/stdio.js`.

```
git clone https://github.com/theluckystrike/measles-cases-by-state-outbreak-mcp && cd measles-cases-by-state-outbreak-mcp
npm install && npm run build
node dist/stdio.js
```

## Example prompts

- "How many measles cases are there in the US this year?"
- "How many measles cases does Texas have, and how does that compare with last year?"
- "Which states have the most measles cases right now?"
- "Is the measles outbreak getting better or worse?"
- "Which states have kindergarten MMR vaccination rates below 95%?"

## Data sources

Full list in [DATA_SOURCES.md](DATA_SOURCES.md).

- CDC Measles Cases and Outbreaks: https://www.cdc.gov/measles/data-research/index.html (page text and the chart data files under https://www.cdc.gov/wcms/vizdata/measles/)
- CDC SchoolVaxView kindergarten MMR coverage, as published on the same page

## Limitations

- Counts are confirmed cases notified to CDC, updated once a week. State health departments often post newer numbers, and probable cases are not included.
- CDC publishes state counts only for the current year and the two before, and no county or city counts except New York City.
- The outbreak count is read from the CDC page text; if CDC rewords that paragraph the tools still return case data and say the outbreak count could not be read.
- Weekly counts are by rash onset; the latest weeks rise as late reports arrive, so the trend uses complete weeks only.

## More

More MCP servers that answer questions your assistant cannot answer alone are on [mcpstamp.com](https://www.mcpstamp.com/servers/?utm_source=mcp&utm_medium=measles-cases-by-state-outbreak-mcp).

Part of the Zovo MCP collection at https://mcp.zovo.one

Built by [theluckystrike](https://github.com/theluckystrike).

## Development

```
npm install
npm test                              # builds, then runs the fixture tests and an offline stdio test
node scripts/stdio-transcript.mjs     # live stdio round trip, writes .live/stdio-transcript.jsonl
```

CI (`.github/workflows/bundle.yml`) runs the tests, the type check and `wrangler deploy --dry-run --outdir out`, and uploads the Worker bundle as an artifact.

## License

MIT
