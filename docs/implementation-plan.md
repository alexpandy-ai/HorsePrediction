# HorsePredictor implementation plan

Phase 1 audit of the existing application at `https://horsepredictor.harvis.page`. This document records what is in the repository on `main` at `89f4415`. It does not change the frontend, the importers, or the deployment.

## 1. What already exists

### Frontend

- React 19 and Vite 7. Entry point: `src/main.tsx`, which mounts `src/App.tsx`.
- Routing is a hash router in `src/router.ts`. There is no React Router.
- Working routes:
  - `#/` India meetings from the published Indiarace snapshot.
  - `#/meeting/:date/:venueId`, `#/race-card/:date/:venueId/:raceNumber`, `#/handicap/:date/:venueId/:raceNumber`.
  - `#/ff/:country` for Australia (`au`), the United Kingdom (`gb`), South Africa (`za`), and New Zealand (`nz`), then meeting, race, and handicapping routes.
  - `#/sample`, `#/meetings`, `#/race/:id`, `#/courses`, `#/course/:id`, and `#/engine/:raceId` for labelled demonstration cards.
- `#/live` is parsed but `App.tsx` does not render `LiveRaceView`. That view still calls `/api` and is not part of the production screen.
- The production pages load static JSON with `fetch` and `cache: "no-store"`. They do not call FormFav, PuntersEdge, The Racing API, or Indiarace from the browser.
- Theme and layout live in `src/styles.css`. Country tabs, meeting cards, racecards, and separate handicapping pages are already in use.

### Current racecards and results

- India: `public/data/meetings.json`, `public/data/racecards.json`, and `public/data/last-updated.json`, built by `server/indiarace/`. The source is the public Indiarace fixture list and racecard HTML. A card includes race number, name, printed IST time, distance, class text, runners, horse number, draw, weight, jockey, trainer, rating, and a short form string. Withdrawn runners stay on the card. This is today's or a selected day's card, not a historical results archive.
- FormFav: `public/data/formfav/meetings-au.json`, `meetings-uk.json`, `meetings-za.json`, `meetings-nz.json`, `racecards.json`, and `import-status.json`. The scheduled importer calls documented free endpoints only unless `FORMFAV_PLAN` is `pro` or `premium`.
- Demonstration history in `src/data/history.ts` is generated sample text. It is not an official result and must not be loaded into a results database.

### Backend today

- There is no Java, Maven, Spring, PostgreSQL, or other database.
- `server/` is a Node process for local development and for the GitHub Actions importer. `npm run dev` starts it beside Vite. Vite proxies `/api` to `127.0.0.1:8787` in development only.
- Production hosting is Harvis, which serves the static `dist/` build. The workflow is `.github/workflows/publish-racecards.yml`. It runs Indiarace sync, FormFav sync, `npm run build`, and `npx harvis deploy dist`.
- Persistence is JSON files in `public/data/` plus gitignored `server/data/` cache. The browser stores only handicapping weights in `localStorage`.

### Prediction logic

- `src/engine/handicap.ts` scores the labelled sample cards. A missing form figure on those sample cards can become a neutral 50. That behaviour must stay inside the sample engine.
- `src/stride/handicappingEngine.ts` scores an Indiarace card from published form and weight only. Missing factors stay unavailable. It does not copy Indiarace selections.
- `src/stride/formfav/handicap.ts` scores a FormFav card separately. FormFav win probabilities and prices are displayed apart from the STRIDE score.
- Nothing stores a prediction, compares it with a later result, or calculates historical accuracy.

### Animation and simulation

- No canvas, race simulator, or virtual-trial code exists. The only SVG is the brand mark.

### Git

- Branch `main` matches `origin/main` at `89f4415`.
- The working tree was clean at the start of this audit.
- `.env` is gitignored. API keys are not in the frontend source.

## 2. Provider data that the current code actually uses

Unknowns are stated as unknown. A field is "supported" only when this repository already reads it or the checked FormFav OpenAPI marks it.

| Need | Indiarace | FormFav | PuntersEdge | The Racing API |
| --- | --- | --- | --- | --- |
| Today's racecard | Yes, for the Indian courses the importer already maps | Yes, on the free plan, for a date window of 30 days back to 7 days ahead | Local client has `GET /v1/racing/events`, acceptances, and next-to-go. Not used by the production pages | Local client has `GET /v1/racecards/free?day=today\|tomorrow`. Not used by the production pages |
| Country and course | Five Indian states are mapped by course name. An unknown course stays "State unavailable" | Country code on the meeting. Venue list has name, race type, and country. No state. The UI says "Region unavailable" | Country code on the event. The sync code records that PuntersEdge does not publish Indian meetings | Region on the free racecard. The normalizer knows several country codes, including GB, IE, AU, ZA, and IN. Live coverage of each code was not retested in this audit |
| Runners and non-runners | Horse number, draw, and withdrawn status | Number, name, barrier, and `scratched` | Saddle number, barrier, and scratched flag | Number, draw, and the runners array. A dedicated non-runner flag was not found on the mapped free-card runner |
| Historical form | Short form string printed on the card | `form` and `last20Starts`, plus career, track, distance, condition, first-up, and second-up strike rates on the free form payload | `last10` or `form` when the payload includes them | `form` and `last_run` on the free card |
| Official finishing position | Not imported. The card is pre-race | Documented on Pro `GET /v1/results` and `GET /v1/results/meeting`. The scheduled job does not call them | Local `GET /v1/racing/results` maps `position`. Not in the production snapshot | Not present on the free racecard mapper. A results endpoint was not found in `server/provider.ts` |
| Race times | Printed IST clock. Not an official winning time | UTC `startTime` plus a timezone field for display | Start time on the event | `off_time` and `off_dt` |
| Sectional times | Not parsed. Unknown whether the HTML contains them | Not in the mapped FormFav models. Unknown on the current plan | Not mapped | Not mapped |
| Horse, jockey, and trainer identifiers | Names only. No stable horse id is stored | Names and runner number. No persistent horse id is mapped. Unknown whether the free payload has one | `horse_ref` or `runner_ref` when present, otherwise a generated name key. Jockey and trainer are names | `horse_id` on the runner. Jockey and trainer are names. `course_id` and `race_id` are present |
| Odds and timestamps | Not on the imported card | Premium `GET /v1/prices` can supply fixed win prices. The free plan returns HTTP 403, and the scheduled job does not call it | Quotes with bookmaker, win, place, and quote time when the payload includes them | Not mapped on the free card |

FormFav country codes `au`, `gb`, `za`, and `nz` are in the provider enum. A successful import has seen thoroughbred venues for all four. A date can still have zero meetings. That is an empty confirmed day, not missing coverage.

PuntersEdge and The Racing API remain optional local feeds. Their credentials are server environment variables. The GitHub workflow does not pass `PUNTERSEDGE_API_KEY`, `RACING_API_USERNAME`, or `RACING_API_PASSWORD` into a step, so those feeds are not part of the Harvis publish.

## 3. What can be reused

- The hash routes, country tabs, meeting cards, racecard tables, and handicapping pages.
- The published JSON as the first read-only source for the new database. The backend can import files the site already trusts before it calls a provider itself.
- Indiarace and FormFav normalizers as the specification for adapter output. Port the rules. Do not change their current Node behaviour in the first backend slice.
- The rule that a STRIDE score is separate from a provider prediction, and that a missing factor is unavailable.
- The GitHub Actions schedule as the pattern for ingestion. The JVM job should live on the backend host, not on Harvis.
- Sample cards stay behind `#/sample` and stay labelled as demonstration data.

## 4. What is missing

- A Java service, PostgreSQL schema, and authenticated ingestion.
- A stored history of official results and race times.
- Stable horse identities across meetings, which virtual trials need.
- Sectional times.
- Saved predictions and a backtest against later results.
- A 2D race simulator and a trial built from horses selected out of different past races.
- A production path from the browser to anything except static files.

## 5. Blocking limits

- Harvis serves static files only. It cannot run Spring Boot, PostgreSQL, or a scheduler. The backend needs its own HTTPS host. The Harvis site can call that host later, with CORS limited to `https://horsepredictor.harvis.page`.
- FormFav free access is 1,000 requests a day and does not include official results, the provider's own predictions, or live odds. Historical backtesting needs a Pro plan or another source that has been checked. Predictions on FormFav are documented for Australia only.
- Indiarace, as implemented, does not provide a results archive or sectional times.
- PuntersEdge does not publish Indian meetings, and its client is not on the production page.
- The Racing API code path used here is the free racecard list for today and tomorrow. It is not a historical results API in this repository.
- Sample history must not be migrated as real results.
- Virtual trials cannot be honest until two horses from different races can be matched by a stable id and a comparable distance and time. Those ids and times are not all present.

## 6. Proposed Java backend

Use a modular monolith. Do not split services.

- Java 21.
- The current stable Spring Boot release that documents Java 21 support on the day the module is created. Check Maven Central then. Do not guess a patch version in advance.
- Maven, Spring Web MVC, Spring Data JPA, PostgreSQL, Bean Validation, Actuator, and springdoc OpenAPI.
- New directory `backend/`, left beside the existing Vite app. Do not replace `src/` or `server/`.

Suggested packages under `page.harvis.horsepredictor`:

- `api` for REST controllers.
- `racing` for meeting, race, runner, horse, and person entities.
- `result` for official finishing positions and times.
- `prediction` for STRIDE scores, stored predictions, and accuracy.
- `ingestion` for scheduled pulls and the provider ports.
- `provider.indiarace`, `provider.formfav`, `provider.puntersedge`, and `provider.racingapi` for adapters.
- `simulation` only after results and horse identity exist.

Proposed tables:

- `country`, `venue`, `meeting`, `race`, `runner_entry`.
- `horse`, `person`, and `entry_person` for jockey and trainer.
- `race_result` and `runner_result`.
- `odds_quote` only when a provider actually returns a price and a timestamp.
- `prediction` and `prediction_outcome`.
- `trial` and `trial_runner` for a later phase.

Proposed application endpoints, to be added only when the data behind them exists:

- `GET /api/v1/meetings?country=&date=`
- `GET /api/v1/meetings/{id}`
- `GET /api/v1/races/{id}`
- `GET /api/v1/horses/{id}/form`
- `POST /api/v1/races/{id}/predictions`
- `GET /api/v1/predictions/accuracy?from=&to=`
- `POST /api/v1/trials` once historical identity is real.

Provider adapters implement one port: load meetings for a country and date, load a racecard, and load results when the provider documents them. Each adapter records the source name and the fetch time. A failed fetch does not delete the last good rows.

Secrets stay in the backend host environment and in GitHub Actions secrets. The frontend never receives them. `.env` stays gitignored. `.env.example` keeps names only.

The first backend slices do not change the Harvis pages. When a later phase connects the site, the browser calls the new HTTPS API and continues to render the current routes.

Tests: JPA slice tests with PostgreSQL via Testcontainers, adapter tests against saved provider fixtures, and a backtest test that refuses to score a race before its result time. The existing Node tests stay as they are.

Deployment: build the JAR separately from `npm run build`. Publish the JAR to the backend host. Keep `npx harvis deploy dist` for the frontend only.

## 7. Phased checklist

1. Audit. This document. No application change.
2. Add `backend/` with health, Actuator, OpenAPI, and an empty PostgreSQL schema. No frontend change.
3. Import the existing Indiarace and FormFav JSON into PostgreSQL through a one-way loader.
4. Add scheduled ingestion for those two providers on the backend host, using the same endpoints the Node importers already call.
5. Add official results only for a provider and plan that has been checked. Keep races without results unmarked rather than estimated.
6. Store STRIDE predictions at publish time and score them after a result arrives.
7. Design the 2D simulator against stored sectionals or, if sectionals are still absent, against a clearly labelled time-and-position model. Do not present it as tracked GPS.
8. Add virtual trials only for horses with a stable id and a recorded finish. The trial screen is a new route in the existing React app, not a second site.

## 8. Risks

- Connecting the current pages to a new API too early can break the static Harvis site.
- Treating FormFav career percentages or sample history as official results would make accuracy and trials false.
- Free-plan limits can stop a nightly import if results, predictions, and odds are all requested.
- Horse names collide. Trials built on names alone will mix different horses.

## 9. Next recommended task

After approval, add only the `backend/` Maven module with health and OpenAPI, and a local PostgreSQL connection. Do not change React routes, do not call new provider endpoints, and do not deploy.
