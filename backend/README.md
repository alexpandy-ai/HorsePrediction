# HorsePredictor API

Java foundation for the HorsePredictor backend. It sits beside the React site and does not replace it. Harvis still serves the static frontend. This service is not deployed.

The service provides health, Actuator, OpenAPI, and a prediction API. It does not import racecards. Official results are stored only when a checked source supplies them. None are loaded in this slice.

## Versions

- Java 21
- Spring Boot 4.1.1, confirmed on Maven Central as the latest stable release. Spring Boot 4.1.1 runs on Java 17 through Java 26, so Java 21 is supported. Spring Boot 4.2.0 is still a milestone and is not used.
- springdoc OpenAPI 3.1.1, the Spring Boot 4 line
- Maven 3.6.3 or later. The build below used Maven 3.9.11.
- PostgreSQL 16 in Docker Compose and in the Testcontainers test

## Prerequisites

- JDK 21
- Maven 3.6.3 or later
- Docker, only when you want a local PostgreSQL server or the PostgreSQL integration test

The React app does not need this JDK.

## Local PostgreSQL

From `backend/`:

1. Copy `.env.example` to `.env`.
2. Set `POSTGRES_PASSWORD` and the same value in `SPRING_DATASOURCE_PASSWORD`.
3. Start the database:

```powershell
docker compose up -d
```

Compose publishes PostgreSQL on `127.0.0.1` only. The password is read from the environment and is not stored in source.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SPRING_DATASOURCE_URL` | JDBC URL. Default `jdbc:postgresql://127.0.0.1:5432/horsepredictor` |
| `SPRING_DATASOURCE_USERNAME` | Database user. Default `horsepredictor` |
| `SPRING_DATASOURCE_PASSWORD` | Database password. No default is stored in source |
| `SERVER_PORT` | HTTP port. Default `8080` |
| `POSTGRES_DB` | Database name for Compose |
| `POSTGRES_USER` | User for Compose |
| `POSTGRES_PASSWORD` | Password for Compose. Required |
| `POSTGRES_PORT` | Host port for Compose. Default `5432` |

The process listens on `127.0.0.1`.

## Run the application

From `backend/`, with PostgreSQL already running and the datasource password set:

```powershell
mvn spring-boot:run
```

## Tests and the JAR

```powershell
mvn verify
```

`mvn verify` runs the tests and packages `target/horsepredictor-api-0.1.0.jar`.

`PostgresFoundationTest` starts PostgreSQL with Testcontainers. If Docker is not available, that class is disabled and the build does not treat it as a passed database test.

## API

- Application health: `http://127.0.0.1:8080/api/v1/health`
- Race prediction: `http://127.0.0.1:8080/api/v1/races/{raceId}/prediction`
- Stored prediction: `http://127.0.0.1:8080/api/v1/predictions/{predictionId}`
- Accuracy summary: `http://127.0.0.1:8080/api/v1/accuracy/summary`
- Actuator liveness: `http://127.0.0.1:8080/actuator/health/liveness`
- Actuator readiness, including the database: `http://127.0.0.1:8080/actuator/health/readiness`
- OpenAPI document: `http://127.0.0.1:8080/v3/api-docs`
- Swagger UI: `http://127.0.0.1:8080/swagger-ui.html`

`/api/v1/health` returns the service name `horsepredictor` and a separate `database` status. HTTP 200 means the database check succeeded. HTTP 503 means the process is up and the database is not.

A prediction response uses status `READY` or `INSUFFICIENT_DATA`. `READY` probabilities cover the declared, non-withdrawn runners and sum to 1.0000. `INSUFFICIENT_DATA` leaves probabilities empty. Withdrawn runners are omitted. A changed declaration stores a new prediction and keeps the earlier one.

## Prediction and backtesting

Two fixed models are compared. Neither is trained on the stored races.

- `equal-probability-v1` gives every declared runner the same share. It is the baseline.
- `evidence-winrate-v1` uses only factors that exist before the race time: prior win rate, and separate rates for distance, course, surface, class, and going, plus margin, finish time, sectional time, carried weight, barrier, rest, and jockey or trainer statistics when the sample is large enough. Missing values stay unused. They are not scored as zero. A runner with no personal history is given the average strength of runners who have history, and that substitution is labelled.

The feature cutoff is the race time. A result at that time, or any later result, is ignored. Odds count only when they have a timestamp at or before the race. Odds without a timestamp, and odds after the race, are ignored. An evaluation window that starts at or before the end of a training window is rejected.

The accuracy summary returns strike rate, log loss, Brier score, calibration, and slices by country, distance, and race type only for races that have a single official winner and enough prior evidence. With no stored results those numbers are null and the status is `INSUFFICIENT_DATA`.

Current coverage: PostgreSQL has no official results for India, Australia, the United Kingdom, South Africa, or New Zealand. Indiarace cards and the FormFav snapshot are pre-race publications and are not loaded as results. Demonstration history is not used. No accuracy or profitability claim is made. A fixture test checks the arithmetic on invented runners and is not a measure of real races.

## Verification

`mvn test` was run with the installed Oracle Java 27 and Maven 3.10.0. The project is compiled for Java 21. Spring Boot 4.1.1 documents support through Java 26, so Java 27 is outside that documented range. This test run completed on Java 27. Docker is not installed, so the PostgreSQL integration test did not run.

Result: BUILD SUCCESS. 31 tests ran, 28 passed, 3 skipped.

Passed:

- `EvidenceModelTest` — probabilities sum to 1, a missing sectional is not zero, withdrawn runners are excluded, a future result is ignored, and a country with no stored results stays insufficient.
- `BacktestEngineTest` — an empty history produces no strike rate, log loss, or Brier score. A fixture replay scores only the later race, rejects overlapping windows, and ignores future and untimestamped odds.
- `PredictionApplicationServiceTest` — an empty database stores an insufficient prediction, keeps that row, stores a second row when a runner is withdrawn, and does not invent an accuracy score.
- `PredictionApiTest` — the three prediction routes and the not-found responses.
- `ApplicationStartupTest`, `HealthEndpointTest`, and `OpenApiAvailabilityTest`.

Skipped, because Docker is not available:

- `PostgresFoundationTest` — database connectivity, both Flyway migrations, and confirmation that the racing tables contain no rows.
