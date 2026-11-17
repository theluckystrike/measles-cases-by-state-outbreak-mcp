// Pure core for measles-cases-by-state-outbreak-mcp. The only I/O is keyless reads of the CDC "Measles Cases and Outbreaks"
// page and the JSON files its charts load, done through an injected fetchText.
//
// Sources (public, no key, checked 2026-11-17):
//   https://www.cdc.gov/wcms/vizdata/measles/measles_hosp.json        current and previous year: total, ages, MMR status,
//                                                                   hospitalized, deaths. Values are strings such as "5,412", "951 (18%)".
//   https://www.cdc.gov/wcms/vizdata/measles/MeaslesCasesMap.json     52 jurisdictions (50 states minus New York State, which is
//                                                                   "New York" without New York City, plus New York City and DC)
//                                                                   x 3 years: cases_calendar_year, cases_range
//   https://www.cdc.gov/wcms/vizdata/measles/MeaslesCasesWeekly.json  weekly cases by rash onset week since 2022-01-02
//   https://www.cdc.gov/wcms/vizdata/measles/MeaslesCasesYear.json    yearly national cases since 1985 (two chart filters repeat rows)
//   https://www.cdc.gov/wcms/vizdata/measles/MeaslesKindergartenVaxcovExemptions.json
//                                                                   kindergarten MMR coverage by state, school years 2009-10 on
//   https://www.cdc.gov/measles/data-research/index.html              page text: outbreak count, outbreak-associated share,
//                                                                   jurisdictions with cases, cases among international visitors
// CDC updates the page and files on Wednesdays (counts as of noon Thursday in the previous release cycle; "lastUpdated" in each file).
import type { FetchText } from './types.js';

export const REPO = 'measles-cases-by-state-outbreak-mcp';
export const SITE = 'https://www.mcpstamp.com';
export const UTM = `utm_source=mcp&utm_medium=${REPO}`;
export const more = () => `${SITE}/servers/?${UTM}`;
export const BASE = 'https://www.cdc.gov/wcms/vizdata/measles/';
export const PAGE = 'https://www.cdc.gov/measles/data-research/index.html';
export const SOURCE = 'CDC Measles Cases and Outbreaks (confirmed cases notified to CDC), https://www.cdc.gov/measles/data-research/index.html. States post newer counts on their own health department sites.';
export const URLS = {
  hosp: `${BASE}measles_hosp.json`,
  map: `${BASE}MeaslesCasesMap.json`,
  weekly: `${BASE}MeaslesCasesWeekly.json`,
  year: `${BASE}MeaslesCasesYear.json`,
  mmr: `${BASE}MeaslesKindergartenVaxcovExemptions.json`,
};
const TTL = 3600;

export class InputError extends Error {}
export class UpstreamError extends Error {}

// ---------- parsing helpers ----------
/** "5,412" -> 5412, "NA"/"" -> null. */
export function num(s: unknown): number | null {
  if (s === null || s === undefined) return null;
  const t = String(Array.isArray(s) ? s[0] : s).replace(/[,%\s]/g, '');
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
const str = (v: unknown) => String(Array.isArray(v) ? v[0] ?? '' : v ?? '');
/** "951 (18%)" -> {count: 951, pct: 18}. */
export function countPct(v: unknown): { count: number | null; pct: number | null } {
  const m = /^\s*([\d,]+)\s*\((\d+(?:\.\d+)?)%\)/.exec(str(v));
  return m ? { count: num(m[1]), pct: Number(m[2]) } : { count: num(v), pct: null };
}
/** "17% (160 of 951)" or "(591 of 5,412 cases)" -> {pct, count, of}. */
export function pctOf(v: unknown): { pct: number | null; count: number | null; of: number | null } {
  const s = str(v);
  const m = /([\d,]+)\s+of\s+([\d,]+)/.exec(s);
  const p = /(\d+(?:\.\d+)?)%/.exec(s);
  return { pct: p ? Number(p[1]) : null, count: m ? num(m[1]) : null, of: m ? num(m[2]) : null };
}
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/** "November 12, 2026" -> "2026-11-12". */
export function isoDate(s: unknown): string | null {
  const m = /([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})/.exec(str(s));
  if (!m) return null;
  const mi = MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3)));
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? 'n/a' : n.toLocaleString('en-US'));
const plural = (n: number, w: string) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;

async function getJson(f: FetchText, url: string): Promise<any> {
  let body: string;
  try {
    body = await f(url, { cacheTtl: TTL, timeoutMs: 15000 });
  } catch (e) {
    throw new UpstreamError(`${url}: ${(e as Error).message}`);
  }
  try {
    return JSON.parse(body.replace(/^﻿/, ''));
  } catch {
    throw new UpstreamError(`${url} did not return JSON`);
  }
}

// ---------- jurisdictions ----------
export const STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'],
  ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'],
  ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export interface Place {
  /** What the user asked for, as a display name. */
  label: string;
  /** Geography names in the CDC case map that make up this place. */
  geos: string[];
  note: string | null;
}

/** Resolve "TX", "texas", "New York", "NYC", "New York State", "Washington DC". New York (state) = New York State + New York City. */
export function resolvePlace(input: unknown): Place {
  const raw = String(input ?? '').trim();
  const n = norm(raw);
  if (!n) throw new InputError('state is empty. Use a state name or two-letter code, "New York City" or "DC".');
  if (['nyc', 'newyorkcity', 'newyorkny', 'cityofnewyork'].includes(n)) return { label: 'New York City', geos: ['New York City'], note: null };
  if (['newyorkstate', 'nystate', 'newyorkexcludingnyc', 'newyorkexclnyc'].includes(n)) {
    return { label: 'New York State (outside New York City)', geos: ['New York'], note: 'CDC reports New York City separately from the rest of New York State.' };
  }
  if (n === 'ny' || n === 'newyork') {
    return { label: 'New York', geos: ['New York', 'New York City'], note: 'CDC reports New York City and the rest of New York State separately; the total adds both.' };
  }
  if (['washingtondc', 'dc', 'districtofcolumbia', 'washingtond', 'thedistrictofcolumbia'].includes(n)) return { label: 'District of Columbia', geos: ['District of Columbia'], note: null };
  const hit = STATES.find(([a, name]) => norm(a) === n || norm(name) === n);
  if (!hit) throw new InputError(`unknown state "${raw}". Use a US state name or two-letter code, "New York City" or "DC".`);
  return { label: hit[1], geos: [hit[1]], note: null };
}

// ---------- national summary ----------
export interface YearSummary {
  year: number;
  total_cases: number | null;
  ages: { under_5: ReturnType<typeof countPct>; age_5_to_19: ReturnType<typeof countPct>; age_20_plus: ReturnType<typeof countPct>; unknown: ReturnType<typeof countPct> };
  vaccination_status_pct: { unvaccinated_or_unknown: number | null; one_mmr_dose: number | null; two_mmr_doses: number | null };
  hospitalized: { pct: number | null; count: number | null; of: number | null };
  hospitalized_by_age: { under_5: ReturnType<typeof pctOf>; age_5_to_19: ReturnType<typeof pctOf>; age_20_plus: ReturnType<typeof pctOf>; unknown: ReturnType<typeof pctOf> };
  deaths: number | null;
  deaths_text: string | null;
}

export function parseHosp(doc: any): { as_of: string | null; years: YearSummary[] } {
  const data = doc?.data;
  if (!data || typeof data !== 'object') throw new UpstreamError('measles_hosp.json has no data object');
  const years = Object.keys(data).filter((k) => /^\d{4}$/.test(k)).map((k) => {
    const r = data[k];
    const h = pctOf(r.hospitalized_sentence);
    return {
      year: Number(k),
      total_cases: num(r.total_cases),
      ages: { under_5: countPct(r.case_age_under_5), age_5_to_19: countPct(r.case_age_5_to_19), age_20_plus: countPct(r.case_age_20_up), unknown: countPct(r.case_age_unknown) },
      vaccination_status_pct: { unvaccinated_or_unknown: num(r.case_unvax_unknown), one_mmr_dose: num(r.case_one_mmr), two_mmr_doses: num(r.case_two_mmr) },
      hospitalized: { pct: num(r.pct_hospitalized) ?? h.pct, count: h.count, of: h.of },
      hospitalized_by_age: { under_5: pctOf(r.hosp_age_under_5), age_5_to_19: pctOf(r.hosp_age_5_to_19), age_20_plus: pctOf(r.hosp_age_20_up), unknown: pctOf(r.hosp_age_unknown) },
      deaths: num(r.total_deaths),
      deaths_text: r.deaths_sentence ? str(r.deaths_sentence) : null,
    } as YearSummary;
  }).sort((a, b) => b.year - a.year);
  if (!years.length) throw new UpstreamError('measles_hosp.json has no years');
  return { as_of: isoDate(doc.lastUpdated), years };
}

export interface Week { week_start: string; week_end: string; cases: number; partial: boolean }
export function parseWeekly(doc: any, asOf: string | null): Week[] {
  const rows = Array.isArray(doc?.data) ? doc.data : [];
  const out: Week[] = [];
  for (const r of rows) {
    const c = num(r.cases);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.week_start)) || c === null) continue;
    out.push({ week_start: r.week_start, week_end: r.week_end, cases: c, partial: Boolean(asOf && String(r.week_end) > asOf) });
  }
  out.sort((a, b) => a.week_start.localeCompare(b.week_start));
  if (!out.length) throw new UpstreamError('MeaslesCasesWeekly.json has no weeks');
  return out;
}

export interface Outbreaks {
  as_of: string | null; year: number | null; cases: number | null; reported_by_jurisdictions: number | null; jurisdictions: number | null;
  international_visitors: number | null; outbreaks: number | null; outbreak_associated_pct: number | null; outbreak_associated_cases: number | null;
  from_outbreaks_starting_this_year: number | null; from_outbreaks_starting_last_year: number | null;
  previous_year: { year: number; outbreaks: number; outbreak_associated_pct: number; outbreak_associated_cases: number | null; cases: number | null } | null;
}

/** Text-scrape of the CDC page's "As of ..." paragraph. Every field is null when the wording changes; callers degrade to a note. */
export function parseOutbreaks(htmlText: string): Outbreaks {
  const t = htmlText.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&rsquo;|&#8217;/g, "'").replace(/\s+/g, ' ');
  const o: Outbreaks = {
    as_of: null, year: null, cases: null, reported_by_jurisdictions: null, jurisdictions: null, international_visitors: null, outbreaks: null,
    outbreak_associated_pct: null, outbreak_associated_cases: null, from_outbreaks_starting_this_year: null, from_outbreaks_starting_last_year: null, previous_year: null,
  };
  const a = /As of ([A-Z][a-z]+\.? \d{1,2}, \d{4}), ([\d,]+) confirmed\*? measles cases were reported in the United States in (\d{4})\.(?: Among these, ([\d,]+) measles cases were reported by (\d+) jurisdictions)?/.exec(t);
  if (a) { o.as_of = isoDate(a[1]); o.cases = num(a[2]); o.year = Number(a[3]); o.reported_by_jurisdictions = num(a[4]); o.jurisdictions = num(a[5]); }
  const after = a ? t.slice(a.index) : t;
  const iv = /A total of ([\d,]+) measles cases were reported among international visitors/.exec(after);
  if (iv) o.international_visitors = num(iv[1]);
  const ob = /There (?:have been|were) ([\d,]+) (?:new )?outbreaks\*{0,2} (?:\([^)]*\) )?reported in (\d{4}), and (\d+(?:\.\d+)?)% of (?:confirmed )?cases \(([\d,]+) of ([\d,]+)\) (?:are|were) outbreak-associated(?: \(([\d,]+) from outbreaks starting in \d{4} and ([\d,]+) from outbreaks that started in \d{4}\))?/.exec(after);
  if (ob && (!o.year || Number(ob[2]) === o.year)) {
    o.outbreaks = num(ob[1]); o.outbreak_associated_pct = Number(ob[3]); o.outbreak_associated_cases = num(ob[4]);
    o.from_outbreaks_starting_this_year = num(ob[6]); o.from_outbreaks_starting_last_year = num(ob[7]);
    if (!o.year) o.year = Number(ob[2]);
  }
  if (o.year) {
    const py = o.year - 1;
    const re = new RegExp(`There were ([\\d,]+) outbreaks\\*{0,2} (?:\\([^)]*\\) )?reported in ${py}, and (\\d+(?:\\.\\d+)?)% of (?:confirmed )?cases \\(([\\d,]+) of ([\\d,]+)\\) were outbreak-associated`);
    const p = re.exec(after);
    if (p) o.previous_year = { year: py, outbreaks: num(p[1]) as number, outbreak_associated_pct: Number(p[2]), outbreak_associated_cases: num(p[3]), cases: num(p[4]) };
  }
  return o;
}

async function outbreaksSafe(f: FetchText): Promise<{ data: Outbreaks | null; note: string | null }> {
  try {
    const html = await f(PAGE, { cacheTtl: TTL, timeoutMs: 15000, accept: 'text/html,application/xhtml+xml' });
    const o = parseOutbreaks(html);
    if (o.outbreaks === null && o.cases === null) return { data: o, note: 'The outbreak count could not be read from the CDC page text (wording changed); case data below is unaffected.' };
    return { data: o, note: null };
  } catch (e) {
    return { data: null, note: `The CDC page with the outbreak count did not answer (${(e as Error).message}); case data below is unaffected.` };
  }
}

export function parseYearly(doc: any): { year: number; cases: number }[] {
  const rows = Array.isArray(doc?.data) ? doc.data : [];
  const m = new Map<number, number>();
  for (const r of rows) {
    const y = num(r.year), c = num(r.cases);
    if (y === null || c === null || y < 1900) continue;
    m.set(y, c);
  }
  if (!m.size) throw new UpstreamError('MeaslesCasesYear.json has no years');
  return [...m.entries()].map(([year, cases]) => ({ year, cases })).sort((a, b) => a.year - b.year);
}

/** Trend from complete weeks only: the week still in progress (ending after the data date) is excluded. */
export function weeklyTrend(weeks: Week[], n = 4) {
  const full = weeks.filter((w) => !w.partial);
  const last = full.slice(-n), prev = full.slice(-2 * n, -n);
  const sl = last.reduce((s, w) => s + w.cases, 0), sp = prev.reduce((s, w) => s + w.cases, 0);
  const change_pct = sp > 0 ? Math.round(((sl - sp) / sp) * 1000) / 10 : null;
  const direction = sp === 0 && sl === 0 ? 'flat at zero' : change_pct === null ? 'up from zero' : change_pct > 10 ? 'rising' : change_pct < -10 ? 'falling' : 'about level';
  return { last_weeks: last, last_weeks_cases: sl, previous_weeks_cases: sp, change_pct, direction, weeks_compared: n };
}

// ---------- tool 1: national ----------
export async function casesUS(f: FetchText, a: { year?: number } = {}, now = new Date()) {
  const [hospDoc, weeklyDoc, yearDoc, ob] = await Promise.all([getJson(f, URLS.hosp), getJson(f, URLS.weekly), getJson(f, URLS.year), outbreaksSafe(f)]);
  const hosp = parseHosp(hospDoc);
  const yearly = parseYearly(yearDoc);
  const latestYear = hosp.years[0].year;
  const year = a.year ?? latestYear;
  const asOf = hosp.as_of ?? isoDate(weeklyDoc?.lastUpdated);
  const ys = hosp.years.find((y) => y.year === year);
  const yearlyRow = yearly.find((y) => y.year === year);
  if (!ys && !yearlyRow) throw new InputError(`no CDC measles count for ${year}. National totals cover ${yearly[0].year} to ${yearly[yearly.length - 1].year}.`);
  const prevTotal = yearly.find((y) => y.year === year - 1)?.cases ?? null;
  const weeks = parseWeekly(weeklyDoc, asOf);
  const trend = year === latestYear ? weeklyTrend(weeks) : null;
  const recent = year === latestYear ? weeks.slice(-8) : [];
  const higherSince = year > yearly[0].year ? yearly.filter((y) => y.year < year && y.cases > (ys?.total_cases ?? yearlyRow!.cases)).map((y) => y.year).pop() ?? null : null;
  const total = ys?.total_cases ?? yearlyRow!.cases;
  const obData = ob.data && ob.data.year === year ? ob.data : null;
  const prevOb = ob.data?.previous_year?.year === year ? ob.data.previous_year : null;

  const lines: string[] = [];
  lines.push(`${year === latestYear ? `As of ${asOf ?? 'the latest CDC update'}, ` : 'For '}${fmt(total)} confirmed measles cases were reported in the United States in ${year}${year === latestYear ? ' so far' : ''}` +
    (prevTotal !== null ? ` (${year - 1}: ${fmt(prevTotal)})` : '') + '.' +
    (higherSince ? ` That is the most since ${higherSince}.` : year > yearly[0].year ? ` That is the highest yearly count in CDC's series since ${yearly[0].year}.` : ''));
  if (ys) {
    lines.push(`Hospitalized: ${ys.hospitalized.pct ?? 'n/a'}% (${fmt(ys.hospitalized.count)} of ${fmt(ys.hospitalized.of)}). Deaths: ${fmt(ys.deaths)}.`);
    lines.push(`Ages: under 5 ${fmt(ys.ages.under_5.count)} (${ys.ages.under_5.pct}%), 5-19 ${fmt(ys.ages.age_5_to_19.count)} (${ys.ages.age_5_to_19.pct}%), 20+ ${fmt(ys.ages.age_20_plus.count)} (${ys.ages.age_20_plus.pct}%). ` +
      `Vaccination: ${ys.vaccination_status_pct.unvaccinated_or_unknown}% unvaccinated or unknown, ${ys.vaccination_status_pct.one_mmr_dose}% one MMR dose, ${ys.vaccination_status_pct.two_mmr_doses}% two doses.`);
  }
  if (obData && obData.outbreaks !== null) {
    lines.push(`Outbreaks (3 or more related cases): ${obData.outbreaks} reported in ${year}; ${obData.outbreak_associated_pct}% of cases (${fmt(obData.outbreak_associated_cases)}) are outbreak-associated.` +
      (obData.jurisdictions !== null ? ` Cases in ${obData.jurisdictions} jurisdictions` : '') + (obData.international_visitors !== null ? `, plus ${fmt(obData.international_visitors)} among international visitors.` : '.'));
  } else if (prevOb) {
    lines.push(`Outbreaks (3 or more related cases): ${prevOb.outbreaks} reported in ${year}; ${prevOb.outbreak_associated_pct}% of cases were outbreak-associated.`);
  }
  if (trend) {
    lines.push(`Trend by rash-onset week: ${fmt(trend.last_weeks_cases)} cases in the last ${trend.weeks_compared} complete weeks (${trend.last_weeks[0]?.week_start} to ${trend.last_weeks[trend.last_weeks.length - 1]?.week_end}) against ${fmt(trend.previous_weeks_cases)} in the 4 weeks before: ${trend.direction}` +
      (trend.change_pct !== null ? ` (${trend.change_pct > 0 ? '+' : ''}${trend.change_pct}%)` : '') + '. Recent weeks rise as late reports arrive.');
  }
  return {
    summary: lines.join('\n'),
    year, latest_year: latestYear, total_cases: total, previous_year_cases: prevTotal,
    details: ys ?? null,
    outbreaks: obData ?? (prevOb ? { year, outbreaks: prevOb.outbreaks, outbreak_associated_pct: prevOb.outbreak_associated_pct, outbreak_associated_cases: prevOb.outbreak_associated_cases } : null),
    weekly_trend: trend, recent_weeks: recent,
    data_updated: asOf, as_of: asOf ?? now.toISOString().slice(0, 10), source: SOURCE,
    notes: [ob.note, ys ? null : `CDC publishes the age, vaccination and hospitalization breakdown only for ${hosp.years.map((y) => y.year).join(' and ')}; ${year} has the total only.`,
      'Counts are confirmed cases notified to CDC, updated weekly on Wednesdays. State health departments often post newer numbers.'].filter(Boolean),
    more: more(),
  };
}

// ---------- tool 2: by state ----------
interface MapRow { geography: string; year: number; cases: number | null; range: string; by_year: Record<string, number | null> }
export function parseMap(doc: any): { as_of: string | null; rows: MapRow[]; years: number[] } {
  const rows: MapRow[] = [];
  for (const r of Array.isArray(doc?.data) ? doc.data : []) {
    const y = num(r.year);
    if (!r.geography || y === null) continue;
    const by: Record<string, number | null> = {};
    for (const k of Object.keys(r)) { const m = /^cases_(\d{4})$/.exec(k); if (m) by[m[1]] = num(r[k]); }
    rows.push({ geography: String(r.geography), year: y, cases: num(r.cases_calendar_year), range: String(r.cases_range ?? ''), by_year: by });
  }
  if (!rows.length) throw new UpstreamError('MeaslesCasesMap.json has no rows');
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);
  return { as_of: isoDate(doc.lastUpdated), rows, years };
}

const RANGE_NOTE = 'CDC maps states in the bands 0, 1-49, 50-99, 100-499, 500-999 and 1000+.';

export async function casesByState(f: FetchText, a: { state?: string; year?: number; top?: number } = {}, now = new Date()) {
  const place = a.state ? resolvePlace(a.state) : null;
  const doc = await getJson(f, URLS.map);
  const map = parseMap(doc);
  const year = a.year ?? map.years[0];
  if (!map.years.includes(year)) throw new InputError(`CDC's state map covers ${map.years.slice().reverse().join(', ')}; ${year} is not in it.`);
  const rowsY = map.rows.filter((r) => r.year === year);
  const ranked = rowsY.filter((r) => (r.cases ?? 0) > 0).sort((x, y) => (y.cases ?? 0) - (x.cases ?? 0) || x.geography.localeCompare(y.geography));
  const rankOf = (g: string) => { const r = ranked.find((x) => x.geography === g); if (!r) return null; return 1 + ranked.filter((x) => (x.cases ?? 0) > (r.cases ?? 0)).length; };
  const asOf = map.as_of;
  if (place) {
    const parts = place.geos.map((g) => {
      const r = rowsY.find((x) => x.geography === g);
      if (!r) throw new UpstreamError(`${g} is missing from the CDC state map`);
      const byYear: Record<string, number | null> = {};
      for (const y of map.years) byYear[String(y)] = map.rows.find((x) => x.geography === g && x.year === y)?.cases ?? null;
      return { geography: g, cases: r.cases, cases_band: r.range, rank_among_jurisdictions: rankOf(g), cases_by_year: byYear };
    });
    const total = parts.reduce((s, p) => s + (p.cases ?? 0), 0);
    const byYear: Record<string, number> = {};
    for (const y of map.years) byYear[String(y)] = parts.reduce((s, p) => s + (p.cases_by_year[String(y)] ?? 0), 0);
    let mmr: { school_year: string; pct: number | null } | null = null, mmrNote: string | null = null;
    try {
      const rows = parseMmr(await getJson(f, URLS.mmr));
      const geo = place.geos.includes('New York') ? 'New York' : place.geos[0];
      const latest = rows.filter((r) => r.geography === geo).sort((x, y) => y.school_year.localeCompare(x.school_year))[0];
      if (latest) mmr = { school_year: latest.school_year, pct: latest.pct };
    } catch (e) { mmrNote = `Kindergarten MMR coverage could not be read (${(e as Error).message}).`; }
    const yrs = map.years.slice().sort((x, y) => x - y);
    const summary = `${place.label}: ${plural(total, 'confirmed measles case')} in ${year}${year === map.years[0] ? ` as of ${asOf ?? 'the latest CDC update'}` : ''}` +
      (parts.length === 1 && parts[0].rank_among_jurisdictions ? ` (${ordinal(parts[0].rank_among_jurisdictions)} of ${ranked.length} jurisdictions with cases)` : '') + '. ' +
      `By year: ${yrs.map((y) => `${y} ${fmt(byYear[String(y)])}`).join(', ')}.` +
      (parts.length > 1 ? ` ${parts.map((p) => `${p.geography === 'New York' ? 'New York State outside NYC' : p.geography} ${fmt(p.cases)}`).join(', ')}.` : '') +
      (mmr && mmr.pct !== null ? ` Kindergarten MMR coverage ${mmr.pct}% (${mmr.school_year}${mmr.pct < 95 ? ', below the 95% target' : ''}).` : '');
    return {
      summary, state: place.label, year, cases: total, cases_by_year: byYear, jurisdictions: parts, kindergarten_mmr: mmr,
      data_updated: asOf, as_of: asOf ?? now.toISOString().slice(0, 10), source: SOURCE,
      notes: [place.note, mmrNote, RANGE_NOTE, 'Cases are counted by the patient\'s state of residence. State health departments often post newer numbers than CDC\'s weekly update.'].filter(Boolean),
      more: more(),
    };
  }
  const top = Math.max(1, Math.min(52, Math.floor(a.top ?? 15)));
  const zero = rowsY.filter((r) => (r.cases ?? 0) === 0).map((r) => r.geography).sort();
  const total = ranked.reduce((s, r) => s + (r.cases ?? 0), 0);
  const list = ranked.map((r) => ({ rank: rankOf(r.geography), geography: r.geography, cases: r.cases, cases_band: r.range, cases_by_year: r.by_year }));
  const summary = `${year} confirmed measles cases by state${year === map.years[0] ? ` as of ${asOf ?? 'the latest CDC update'}` : ''}: ${ranked.length} of ${rowsY.length} jurisdictions have cases (${fmt(total)} cases among U.S. residents). ` +
    `Highest: ${list.slice(0, top).map((r) => `${r.geography} ${fmt(r.cases)}`).join(', ')}.` + (zero.length ? ` No cases: ${zero.join(', ')}.` : '');
  return {
    summary, year, jurisdictions_with_cases: ranked.length, jurisdictions_total: rowsY.length, cases_total_residents: total,
    states: list, top: list.slice(0, top), no_cases: zero, data_updated: asOf, as_of: asOf ?? now.toISOString().slice(0, 10), source: SOURCE,
    notes: ['The 52 jurisdictions are the 50 states with New York City reported separately from the rest of New York State, plus DC. "New York" means New York State outside New York City.', RANGE_NOTE, 'Cases among international visitors are not assigned to a state.'],
    more: more(),
  };
}
const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// ---------- tool 3: history ----------
export async function casesHistory(f: FetchText, a: { view?: string; from_year?: number; to_year?: number; year?: number } = {}, now = new Date()) {
  const view = (a.view ?? 'yearly').toLowerCase();
  if (view !== 'yearly' && view !== 'weekly') throw new InputError('view must be yearly or weekly');
  if (view === 'yearly') {
    const doc = await getJson(f, URLS.year);
    const all = parseYearly(doc);
    const lo = all[0].year, hi = all[all.length - 1].year;
    const from = a.from_year ?? 2000, to = a.to_year ?? hi;
    if (from > to) throw new InputError(`from_year ${from} is after to_year ${to}`);
    if (to < lo || from > hi) throw new InputError(`CDC's yearly series covers ${lo} to ${hi}`);
    const rows = all.filter((r) => r.year >= from && r.year <= to);
    const peak = rows.reduce((m, r) => (r.cases > m.cases ? r : m), rows[0]);
    const low = rows.reduce((m, r) => (r.cases < m.cases ? r : m), rows[0]);
    const asOf = isoDate(doc.lastUpdated);
    const summary = `U.S. confirmed measles cases ${rows[0].year} to ${rows[rows.length - 1].year}: highest ${fmt(peak.cases)} in ${peak.year}, lowest ${fmt(low.cases)} in ${low.year}. ` +
      `${rows.slice(-12).map((r) => `${r.year} ${fmt(r.cases)}`).join(', ')}.` + (hi === rows[rows.length - 1].year ? ` ${hi} is year to date as of ${asOf ?? 'the latest CDC update'}.` : '');
    return { summary, view, from_year: rows[0].year, to_year: rows[rows.length - 1].year, years: rows, highest: peak, lowest: low, series_starts: lo,
      data_updated: asOf, as_of: asOf ?? now.toISOString().slice(0, 10), source: SOURCE,
      notes: ['Measles was declared eliminated in the United States in 2000 (no continuous spread for 12 months or more).', `The latest year (${hi}) is year to date.`], more: more() };
  }
  const doc = await getJson(f, URLS.weekly);
  const asOf = isoDate(doc.lastUpdated);
  const weeks = parseWeekly(doc, asOf);
  const years = [...new Set(weeks.map((w) => Number(w.week_end.slice(0, 4))))];
  const year = a.year ?? Math.max(...years);
  const ws = weeks.filter((w) => Number(w.week_end.slice(0, 4)) === year);
  if (!ws.length) throw new InputError(`CDC's weekly series covers ${Math.min(...years)} to ${Math.max(...years)} (weeks by rash onset since 2022-01-02); ${year} is not in it.`);
  const peak = ws.reduce((m, w) => (w.cases > m.cases ? w : m), ws[0]);
  const sum = ws.reduce((s, w) => s + w.cases, 0);
  const months: Record<string, number> = {};
  for (const w of ws) { const k = w.week_end.slice(0, 7); months[k] = (months[k] ?? 0) + w.cases; }
  const trend = weeklyTrend(weeks);
  const summary = `${year} measles cases by rash-onset week (${ws.length} weeks${ws.some((w) => w.partial) ? ', the last one still in progress' : ''}): ${fmt(sum)} cases, peak week ${peak.week_start} to ${peak.week_end} with ${fmt(peak.cases)}. ` +
    `Last 8 weeks: ${ws.slice(-8).map((w) => `${w.week_end.slice(5)} ${fmt(w.cases)}${w.partial ? '*' : ''}`).join(', ')}.` +
    (year === Math.max(...years) ? ` Last 4 complete weeks ${fmt(trend.last_weeks_cases)} against ${fmt(trend.previous_weeks_cases)} before: ${trend.direction}.` : '');
  return { summary, view, year, weeks: ws, cases_by_month: months, peak_week: peak, total_by_onset_week: sum, weekly_trend: year === Math.max(...years) ? trend : null,
    data_updated: asOf, as_of: asOf ?? now.toISOString().slice(0, 10), source: SOURCE,
    notes: ['Weeks are by rash onset date (week ending date shown, MM-DD; * still in progress). Recent weeks rise as late reports arrive.', 'The onset-week total can differ slightly from the reported year total, which counts by report.'], more: more() };
}

// ---------- tool 4: MMR coverage ----------
export interface MmrRow { geography: string; school_year: string; pct: number | null; kindergartners: number | null; percent_surveyed: number | null; survey_type: string | null }
export function parseMmr(doc: any): MmrRow[] {
  const rows = Array.isArray(doc) ? doc : Array.isArray(doc?.data) ? doc.data : [];
  const out: MmrRow[] = [];
  for (const r of rows) {
    if (!r.geography || !/^\d{4}-\d{2}$/.test(String(r.school_year))) continue;
    out.push({ geography: String(r.geography), school_year: String(r.school_year), pct: num(r.estimate_pct), kindergartners: num(r.population_size), percent_surveyed: num(r.percent_surveyed),
      survey_type: r.survey_type && r.survey_type !== 'NA' ? String(r.survey_type) : null });
  }
  if (!out.length) throw new UpstreamError('the kindergarten MMR file has no rows');
  return out;
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10) : null; };

export async function mmrRates(f: FetchText, a: { state?: string; school_year?: string } = {}, now = new Date()) {
  const rows = parseMmr(await getJson(f, URLS.mmr));
  const years = [...new Set(rows.map((r) => r.school_year))].sort().reverse();
  let sy = a.school_year?.trim();
  if (sy && /^\d{4}$/.test(sy)) sy = `${sy}-${String((Number(sy) + 1) % 100).padStart(2, '0')}`;
  if (sy && /^\d{4}-\d{4}$/.test(sy)) sy = `${sy.slice(0, 4)}-${sy.slice(7)}`;
  if (sy && !years.includes(sy)) throw new InputError(`school_year ${a.school_year} is not in CDC's data (${years[years.length - 1]} to ${years[0]}). Use the form 2025-26.`);
  const year = sy ?? years[0];
  const states = new Set(STATES.map(([, n]) => n));
  if (a.state) {
    const raw = norm(a.state);
    const geo = ['nyc', 'newyorkcity'].includes(raw) ? 'New York City' : raw === 'houston' ? 'Houston' : resolvePlace(a.state).geos[0];
    const hist = rows.filter((r) => r.geography === geo).sort((x, y) => y.school_year.localeCompare(x.school_year));
    if (!hist.length) throw new InputError(`no kindergarten MMR data for ${geo}`);
    const cur = hist.find((r) => r.school_year === year) ?? hist[0];
    const pre = hist.find((r) => r.school_year === '2019-20');
    const latestKnown = hist.find((r) => r.pct !== null);
    const nat = rows.filter((r) => r.school_year === cur.school_year && states.has(r.geography) && r.pct !== null);
    const med = median(nat.map((r) => r.pct as number));
    const rank = cur.pct !== null ? 1 + nat.filter((r) => (r.pct as number) > (cur.pct as number)).length : null;
    const summary = cur.pct === null
      ? `${geo}: CDC has no kindergarten MMR estimate for ${cur.school_year}.` + (latestKnown ? ` Latest: ${latestKnown.pct}% in ${latestKnown.school_year}.` : '')
      : `${geo}: ${cur.pct}% of kindergartners had 2 doses of MMR in ${cur.school_year}${cur.pct < 95 ? ' (below the 95% target for measles herd immunity)' : ' (meets the 95% target)'}` +
        (rank ? `, ${ordinal(rank)} highest of ${nat.length} states and DC (state median ${med}%)` : '') + '.' +
        (pre && pre.pct !== null ? ` 2019-20: ${pre.pct}% (${cur.pct - pre.pct >= 0 ? '+' : ''}${Math.round((cur.pct - pre.pct) * 10) / 10} points).` : '') +
        ` Trend: ${hist.slice(0, 6).map((r) => `${r.school_year} ${r.pct ?? 'n/a'}${r.pct !== null ? '%' : ''}`).join(', ')}.`;
    return { summary, geography: geo, school_year: cur.school_year, coverage_pct: cur.pct, current: cur, rank_among_states: rank, state_median_pct: med, history: hist,
      data_updated: null, as_of: cur.school_year, source: 'CDC SchoolVaxView kindergarten vaccination coverage (2 doses of MMR), as published on the CDC measles cases page. ' + SOURCE,
      notes: ['Coverage is 2 doses of MMR among kindergartners. Survey methods differ by state (census, sample or voluntary response); some states have no estimate for some years.', 'Houston and New York City are reported separately as well as inside Texas and New York.'], more: more() };
  }
  const ys = rows.filter((r) => r.school_year === year && states.has(r.geography));
  const known = ys.filter((r) => r.pct !== null).sort((x, y) => (x.pct as number) - (y.pct as number));
  const below = known.filter((r) => (r.pct as number) < 95);
  const med = median(known.map((r) => r.pct as number));
  const na = ys.filter((r) => r.pct === null).map((r) => r.geography);
  const summary = `Kindergarten MMR coverage ${year}: ${below.length} of ${known.length} states and DC with data are below the 95% target; state median ${med}%. ` +
    `Lowest: ${known.slice(0, 8).map((r) => `${r.geography} ${r.pct}%`).join(', ')}. Highest: ${known.slice(-5).reverse().map((r) => `${r.geography} ${r.pct}%`).join(', ')}.` +
    (na.length ? ` No estimate: ${na.join(', ')}.` : '');
  return { summary, school_year: year, states_with_data: known.length, below_95: below.length, state_median_pct: med,
    states: known.map((r) => ({ geography: r.geography, coverage_pct: r.pct, kindergartners: r.kindergartners, percent_surveyed: r.percent_surveyed, survey_type: r.survey_type })),
    no_estimate: na, school_years_available: years, data_updated: null, as_of: year,
    source: 'CDC SchoolVaxView kindergarten vaccination coverage (2 doses of MMR), as published on the CDC measles cases page. ' + SOURCE,
    notes: ['The median is computed here over the states and DC with an estimate; CDC\'s own national figure is a weighted estimate and can differ.', 'Survey methods differ by state.'], more: more() };
}
