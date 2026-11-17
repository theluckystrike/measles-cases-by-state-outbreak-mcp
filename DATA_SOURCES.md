# Data sources

All data is read at call time from the U.S. Centers for Disease Control and Prevention (CDC). No key is needed.

| URL | Used for |
| --- | --- |
| `https://www.cdc.gov/wcms/vizdata/measles/measles_hosp.json` | this year and last year: total cases, ages, MMR vaccination status, hospitalizations, deaths |
| `https://www.cdc.gov/wcms/vizdata/measles/MeaslesCasesMap.json` | cases by state (52 jurisdictions: 50 states with New York City separate from the rest of New York State, plus DC) for the last three years |
| `https://www.cdc.gov/wcms/vizdata/measles/MeaslesCasesWeekly.json` | weekly cases by rash onset week since 2022 |
| `https://www.cdc.gov/wcms/vizdata/measles/MeaslesCasesYear.json` | yearly national cases since 1985 |
| `https://www.cdc.gov/wcms/vizdata/measles/MeaslesKindergartenVaxcovExemptions.json` | kindergarten MMR coverage by state and school year since 2009-10 (SchoolVaxView) |
| `https://www.cdc.gov/measles/data-research/index.html` | the page text: outbreak count, share of outbreak-associated cases, jurisdictions with cases, cases among international visitors |

CDC updates the page weekly on Wednesdays; the counts are cases notified to CDC by noon the Thursday before. An outbreak is 3 or more related cases.

CDC data is a U.S. government work and is in the public domain.
