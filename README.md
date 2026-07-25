# Combat Achievements Tracker

An interactive web app for exploring and tracking the Old School RuneScape
[Combat Achievements](https://oldschool.runescape.wiki/w/Combat_Achievements/All_tasks)
(646 tasks). Filter, search, sort by the wiki's global completion %, **pivot** from any
task to every task on the same boss, and track your own completions with progress meters
per tier.

> Design docs live in the author's Obsidian vault (`Projects/Combat Achievements Tracker`):
> Requirements, Design, Current State, Future State, Known Issues.

## Stack

- **Backend** — Spring Boot 4.1 (Java 21), Gradle 9.5, Spring Data JPA + Flyway, `RestClient`.
- **Database** — PostgreSQL 17.
- **Frontend** — React + TypeScript (Vite), TanStack Query + Table, Tailwind CSS.
- **Data source** — the OSRS Wiki **Bucket API** (`combat_achievement` bucket) + the
  `completion.json` data page, cached in Postgres and refreshed on a schedule.

## Repository layout

```
backend/    Spring Boot API + wiki ingestion  (Java 21)
frontend/   React + TypeScript SPA             (coming soon)
```

## Prerequisites

- **JDK 21** (Temurin). The backend pins its Gradle daemon to JDK 21 via
  `backend/gradle.properties` (`org.gradle.java.home`), so it does **not** depend on your
  machine `JAVA_HOME` — it coexists with older JDKs used by other projects.
- **PostgreSQL 17** running locally with a database named `combat_achievements`.
- **Node 20+** (for the frontend).

## Running the backend

```bash
cd backend
./gradlew bootRun
```

Starts on `http://localhost:8080`. Flyway applies the schema on first boot. Health check:
`GET /actuator/health`. Datasource defaults to `postgres`/`postgres` on
`localhost:5432/combat_achievements` — override the password with
`SPRING_DATASOURCE_PASSWORD`.

## License

MIT (see `LICENSE`).
