// Tool registry shared by the stdio and Worker entries.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { InputError, REPO, SITE, casesByState, casesHistory, casesUS, mmrRates } from './core.js';
import type { FetchText } from './types.js';

export const VERSION = '1.0.0';

export const META = {
  alias: 'measles-cases',
  metaDescription: 'MCP server for US measles cases by state: CDC confirmed measles cases this year, the 2026 measles outbreak count, hospitalizations and deaths, the weekly trend, yearly history since 1985 and kindergarten MMR vaccination rates by state.',
  intro: 'US measles cases and outbreaks for AI assistants, read live from the CDC Measles Cases and Outbreaks page and its data files, updated weekly.',
};

export const TOOL_INFO = [
  { name: 'measles_cases_us', blurb: 'US confirmed measles cases this year: total, outbreak count, share outbreak-associated, ages, vaccination status, hospitalizations, deaths and the weekly trend.' },
  { name: 'measles_cases_by_state', blurb: 'Measles cases in one state (2024 to this year, rank, kindergarten MMR rate) or every state ranked by cases this year.' },
  { name: 'measles_cases_history', blurb: 'Yearly US measles cases since 1985, or weekly cases by rash onset for a year since 2022.' },
  { name: 'mmr_vaccination_rates', blurb: 'Kindergarten MMR vaccination coverage by state and school year since 2009-10, against the 95% herd immunity target.' },
];

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

function ok(data: Record<string, unknown> & { summary: string }) {
  return { content: [{ type: 'text' as const, text: `${data.summary}\n\n${JSON.stringify(data, null, 2)}` }], structuredContent: data };
}
function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { isError: true, content: [{ type: 'text' as const, text: `${e instanceof InputError ? 'Error' : 'Upstream CDC error'}: ${msg}` }] };
}
const wrap = <A>(fn: (a: A) => unknown) => async (a: A) => { try { return ok((await fn(a)) as any); } catch (e) { return fail(e); } };

export function createServer(fetchText: FetchText): McpServer {
  const server = new McpServer({ name: REPO, version: VERSION, websiteUrl: SITE } as any, {
    instructions:
      'US measles cases and outbreaks, read at call time from the CDC Measles Cases and Outbreaks page (updated weekly on Wednesdays). ' +
      'A model cannot know this week\'s counts. Use measles_cases_us for "how many measles cases this year" or "measles outbreak", measles_cases_by_state for one state or the state ranking, ' +
      'measles_cases_history for past years or the weekly curve, and mmr_vaccination_rates for kindergarten MMR coverage. Mention that state health departments often post newer numbers.',
  });

  server.registerTool('measles_cases_us', {
    title: 'US measles cases this year',
    description:
      'Confirmed US measles cases for this year (or 2025) from CDC: the total, the number of outbreaks and the share of cases that are outbreak-associated, ' +
      'jurisdictions with cases, cases by age, vaccination status, percent hospitalized, deaths, the previous year for comparison and the trend over the last complete weeks.',
    inputSchema: {
      year: z.number().int().min(1985).max(2100).optional().describe('Year. Default the current year. Full breakdowns exist for this year and last year; earlier years give the total only.'),
    },
    annotations: { title: 'US measles cases', ...RO },
  }, wrap((a: any) => casesUS(fetchText, a)));

  server.registerTool('measles_cases_by_state', {
    title: 'Measles cases by state',
    description:
      'Confirmed measles cases by state from CDC. With a state: its cases this year, last year and the year before, its rank, and its kindergarten MMR coverage. ' +
      'Without a state: every state ranked by cases this year and the states with none. New York City is reported separately from the rest of New York State; "NY" adds both.',
    inputSchema: {
      state: z.string().optional().describe('State name or two-letter code, "New York City", "New York State" or "DC". Omit for all states.'),
      year: z.number().int().min(2024).max(2100).optional().describe('Year, one of the last three. Default the current year.'),
      top: z.number().int().min(1).max(52).optional().describe('How many states to list in the summary when no state is given. Default 15.'),
    },
    annotations: { title: 'Measles cases by state', ...RO },
  }, wrap((a: any) => casesByState(fetchText, a)));

  server.registerTool('measles_cases_history', {
    title: 'Measles cases history',
    description:
      'US measles case history from CDC. view yearly (default): confirmed cases per year from 1985 to this year, with the highest and lowest year in the range. ' +
      'view weekly: cases per week by rash onset for one year (2022 on), monthly totals, the peak week and the recent trend.',
    inputSchema: {
      view: z.enum(['yearly', 'weekly']).optional().describe('yearly (default) or weekly.'),
      from_year: z.number().int().min(1900).max(2100).optional().describe('yearly: first year. Default 2000.'),
      to_year: z.number().int().min(1900).max(2100).optional().describe('yearly: last year. Default the current year.'),
      year: z.number().int().min(2022).max(2100).optional().describe('weekly: the year. Default the current year.'),
    },
    annotations: { title: 'Measles cases history', ...RO },
  }, wrap((a: any) => casesHistory(fetchText, a)));

  server.registerTool('mmr_vaccination_rates', {
    title: 'Kindergarten MMR vaccination rates',
    description:
      'Kindergarten MMR vaccination coverage (2 doses) from CDC. With a state: its rate for the latest or a given school year, its rank, the change since 2019-20 and the trend. ' +
      'Without a state: every state ranked from lowest, how many are below the 95% herd immunity target, and the state median. School years 2009-10 to the latest.',
    inputSchema: {
      state: z.string().optional().describe('State name or code, "New York City" or "Houston". Omit for all states.'),
      school_year: z.string().optional().describe('School year such as 2025-26 (or 2025). Default the latest.'),
    },
    annotations: { title: 'MMR vaccination rates', ...RO },
  }, wrap((a: any) => mmrRates(fetchText, a)));

  return server;
}
