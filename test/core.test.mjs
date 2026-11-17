// Fixtures in test/fixtures/ were downloaded from www.cdc.gov on 2026-11-17 (CDC data updated November 12, 2026):
// measles_hosp.json, MeaslesCasesMap.json, MeaslesCasesWeekly.json, MeaslesCasesYear.json as published, the CDC
// "Measles Cases and Outbreaks" page HTML, and a subset of the kindergarten MMR file (school years 2025-26, 2024-25,
// 2019-20 for every geography, plus every Texas year). Expected values were computed separately in Python from the same files:
// 2026: 5,412 cases, 591 of 5,412 hospitalized (11%), 8 deaths, 43 outbreaks, 96% (5,216) outbreak-associated, 47 jurisdictions,
// 18 among international visitors; 2025: 2,289 cases, 48 outbreaks. 1991 is the last year with more cases than 2026.
// Last 4 complete onset weeks (to 2026-11-07) 874 cases, the 4 before 879. 47 of 52 jurisdictions have 2026 cases (5,394),
// Pennsylvania first with 1,529, Texas 192 (8th); New York State outside NYC 210 + New York City 7.
// MMR 2025-26: 49 states and DC with data, 39 below 95%, median 91.5%, Idaho lowest 75.2%; Texas 93.2% (19th), 96.9% in 2019-20.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import {
  num, countPct, pctOf, isoDate, resolvePlace, parseOutbreaks, parseYearly, parseWeekly, weeklyTrend,
  casesUS, casesByState, casesHistory, mmrRates, InputError, UpstreamError, URLS, PAGE, UTM,
} from '../dist/core.js';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const FILES = {
  [URLS.hosp]: fx('measles_hosp.json'),
  [URLS.map]: fx('MeaslesCasesMap.json'),
  [URLS.weekly]: fx('MeaslesCasesWeekly.json'),
  [URLS.year]: fx('MeaslesCasesYear.json'),
  [URLS.mmr]: fx('mmr-subset.json'),
  [PAGE]: fx('measles-page.html'),
};
const seen = [];
const f = async (u) => { seen.push(u); if (!(u in FILES)) throw new Error(`HTTP 404 (no fixture for ${u})`); return FILES[u]; };
const NOW = new Date('2026-11-17T12:00:00Z');

test('string parsing: comma numbers, count (pct), pct (count of n), CDC dates', () => {
  assert.equal(num('5,412'), 5412); assert.equal(num(['8']), 8); assert.equal(num('NA'), null); assert.equal(num('94.3%'), 94.3);
  assert.deepEqual(countPct('951 (18%)'), { count: 951, pct: 18 });
  assert.deepEqual(pctOf('17% (160 of 951)'), { pct: 17, count: 160, of: 951 });
  assert.deepEqual(pctOf('(591 of 5,412 cases)'), { pct: null, count: 591, of: 5412 });
  assert.equal(isoDate('November 12, 2026'), '2026-11-12'); assert.equal(isoDate('Nov. 3, 2026'), '2026-11-03');
});

test('places: codes, names, New York split, DC; unknown state is an input error', () => {
  assert.deepEqual(resolvePlace('tx').geos, ['Texas']);
  assert.deepEqual(resolvePlace('New York').geos, ['New York', 'New York City']);
  assert.deepEqual(resolvePlace('NYC').geos, ['New York City']);
  assert.deepEqual(resolvePlace('New York State').geos, ['New York']);
  assert.deepEqual(resolvePlace('Washington, DC').geos, ['District of Columbia']);
  assert.deepEqual(resolvePlace('washington').geos, ['Washington']);
  assert.throws(() => resolvePlace('Ontario'), InputError);
});

test('page text: outbreak count, outbreak-associated share, jurisdictions, international visitors, previous year', () => {
  const o = parseOutbreaks(FILES[PAGE]);
  assert.equal(o.as_of, '2026-11-12'); assert.equal(o.year, 2026); assert.equal(o.cases, 5412);
  assert.equal(o.reported_by_jurisdictions, 5394); assert.equal(o.jurisdictions, 47); assert.equal(o.international_visitors, 18);
  assert.equal(o.outbreaks, 43); assert.equal(o.outbreak_associated_pct, 96); assert.equal(o.outbreak_associated_cases, 5216);
  assert.equal(o.from_outbreaks_starting_this_year, 3831); assert.equal(o.from_outbreaks_starting_last_year, 1385);
  assert.deepEqual(o.previous_year, { year: 2025, outbreaks: 48, outbreak_associated_pct: 90, outbreak_associated_cases: 2066, cases: 2289 });
  const none = parseOutbreaks('<p>Something else entirely</p>');
  assert.equal(none.outbreaks, null); assert.equal(none.cases, null);
});

test('measles_cases_us: 2026 totals, hospitalized, deaths, outbreaks, record since 1991, trend from complete weeks only', async () => {
  const r = await casesUS(f, {}, NOW);
  assert.equal(r.year, 2026); assert.equal(r.total_cases, 5412); assert.equal(r.previous_year_cases, 2289);
  assert.deepEqual(r.details.hospitalized, { pct: 11, count: 591, of: 5412 });
  assert.equal(r.details.deaths, 8); assert.deepEqual(r.details.ages.under_5, { count: 951, pct: 18 });
  assert.equal(r.details.vaccination_status_pct.unvaccinated_or_unknown, 96);
  assert.equal(r.outbreaks.outbreaks, 43);
  assert.equal(r.weekly_trend.last_weeks_cases, 874); assert.equal(r.weekly_trend.previous_weeks_cases, 879); assert.equal(r.weekly_trend.direction, 'about level');
  assert.equal(r.weekly_trend.last_weeks.at(-1).week_end, '2026-11-07');
  assert.equal(r.recent_weeks.at(-1).partial, true);
  assert.match(r.summary, /5,412 confirmed measles cases/); assert.match(r.summary, /most since 1991/); assert.match(r.summary, /43 reported in 2026/);
  assert.equal(r.data_updated, '2026-11-12'); assert.ok(r.more.includes(UTM));
  const r25 = await casesUS(f, { year: 2025 }, NOW);
  assert.equal(r25.total_cases, 2289); assert.equal(r25.details.deaths, 3); assert.equal(r25.outbreaks.outbreaks, 48); assert.equal(r25.weekly_trend, null);
  const r19 = await casesUS(f, { year: 2019 }, NOW);
  assert.equal(r19.details, null); assert.ok(r19.total_cases > 1000);
  await assert.rejects(casesUS(f, { year: 1970 }, NOW), InputError);
});

test('measles_cases_us degrades when the CDC page is down: case data stays, a note explains', async () => {
  const g = async (u) => { if (u === PAGE) throw new Error('HTTP 503'); return f(u); };
  const r = await casesUS(g, {}, NOW);
  assert.equal(r.total_cases, 5412); assert.equal(r.outbreaks, null); assert.match(r.notes[0], /did not answer/);
});

test('measles_cases_by_state: Texas, New York combined, ranking and zero-case states', async () => {
  const tx = await casesByState(f, { state: 'TX' }, NOW);
  assert.equal(tx.cases, 192); assert.deepEqual(tx.cases_by_year, { 2026: 192, 2025: 803, 2024: 1 });
  assert.equal(tx.jurisdictions[0].rank_among_jurisdictions, 8); assert.deepEqual(tx.kindergarten_mmr, { school_year: '2025-26', pct: 93.2 });
  assert.match(tx.summary, /Texas: 192 confirmed measles cases in 2026/); assert.match(tx.summary, /8th of 47/);
  const ny = await casesByState(f, { state: 'New York' }, NOW);
  assert.equal(ny.cases, 217); assert.equal(ny.cases_by_year['2025'], 41);
  const all = await casesByState(f, {}, NOW);
  assert.equal(all.jurisdictions_with_cases, 47); assert.equal(all.jurisdictions_total, 52); assert.equal(all.cases_total_residents, 5394);
  assert.equal(all.states[0].geography, 'Pennsylvania'); assert.equal(all.states[0].cases, 1529);
  assert.deepEqual(all.no_cases, ['Arkansas', 'Hawaii', 'Mississippi', 'Nevada', 'New Hampshire']);
  const y24 = await casesByState(f, { state: 'Texas', year: 2024 }, NOW);
  assert.equal(y24.cases, 1);
  await assert.rejects(casesByState(f, { year: 2020 }, NOW), InputError);
  await assert.rejects(casesByState(f, { state: 'Narnia' }, NOW), InputError);
});

test('measles_cases_history: yearly 2000-2026 high and low, weekly 2026 peak and months', async () => {
  const y = await casesHistory(f, {}, NOW);
  assert.equal(y.from_year, 2000); assert.equal(y.to_year, 2026); assert.deepEqual(y.highest, { year: 2026, cases: 5412 }); assert.deepEqual(y.lowest, { year: 2020, cases: 13 });
  assert.equal(y.series_starts, 1985);
  const w = await casesHistory(f, { view: 'weekly' }, NOW);
  assert.equal(w.year, 2026); assert.equal(w.weeks.length, 46); assert.equal(w.total_by_onset_week, 5594);
  assert.deepEqual(w.peak_week, { week_start: '2026-01-11', week_end: '2026-01-17', cases: 296, partial: false });
  await assert.rejects(casesHistory(f, { view: 'weekly', year: 2019 }, NOW), InputError);
  await assert.rejects(casesHistory(f, { from_year: 2010, to_year: 2000 }, NOW), InputError);
});

test('mmr_vaccination_rates: all states 2025-26, Texas rank and change since 2019-20, school year forms', async () => {
  const all = await mmrRates(f, {}, NOW);
  assert.equal(all.school_year, '2025-26'); assert.equal(all.states_with_data, 49); assert.equal(all.below_95, 39); assert.equal(all.state_median_pct, 91.5);
  assert.deepEqual(all.states[0].geography, 'Idaho'); assert.equal(all.states[0].coverage_pct, 75.2);
  assert.deepEqual(all.no_estimate, ['Kansas', 'Montana']);
  const tx = await mmrRates(f, { state: 'texas' }, NOW);
  assert.equal(tx.coverage_pct, 93.2); assert.equal(tx.rank_among_states, 19); assert.match(tx.summary, /\(-3\.7 points\)/);
  const tx24 = await mmrRates(f, { state: 'TX', school_year: '2024' }, NOW);
  assert.equal(tx24.school_year, '2024-25');
  const nyc = await mmrRates(f, { state: 'NYC' }, NOW);
  assert.equal(nyc.geography, 'New York City');
  await assert.rejects(mmrRates(f, { school_year: '1999-00' }, NOW), InputError);
});

test('upstream failures are UpstreamError, not crashes', async () => {
  const bad = async () => 'not json';
  await assert.rejects(casesByState(bad, {}, NOW), UpstreamError);
  const empty = async () => '{"data": []}';
  await assert.rejects(casesHistory(empty, {}, NOW), UpstreamError);
});

test('stdio: initialize, tools/list with annotations and a tools/call error over JSON-RPC (offline)', async () => {
  const child = spawn(process.execPath, [new URL('../dist/stdio.js', import.meta.url).pathname], { stdio: ['pipe', 'pipe', 'ignore'] });
  const lines = []; let buf = '';
  const got = (id) => new Promise((res) => { const iv = setInterval(() => { const m = lines.find((l) => l.id === id); if (m) { clearInterval(iv); res(m); } }, 10); });
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const send = (m) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
  send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal((await got(1)).result.serverInfo.name, 'measles-cases-by-state-outbreak-mcp');
  send({ method: 'notifications/initialized' });
  send({ id: 2, method: 'tools/list' });
  const tools = (await got(2)).result.tools;
  assert.deepEqual(tools.map((t) => t.name), ['measles_cases_us', 'measles_cases_by_state', 'measles_cases_history', 'mmr_vaccination_rates']);
  for (const t of tools) { assert.ok(t.title); assert.equal(t.annotations.readOnlyHint, true); assert.equal(t.annotations.destructiveHint, false); assert.equal(t.annotations.openWorldHint, true); }
  send({ id: 3, method: 'tools/call', params: { name: 'measles_cases_by_state', arguments: { state: 'Narnia' } } });
  const r3 = await got(3);
  child.kill();
  assert.equal(r3.result?.isError ?? Boolean(r3.error), true);
});
