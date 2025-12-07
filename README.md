**SSE Update — Scalable Server-Sent Events Example**

This repository is an opinionated example showing how to implement Server-Sent Events (SSE) on a scalable backend and a small frontend for testing and experimentation.

- **Tech stack (backend):** Kotlin + Spring Boot, JMS for message propagation.
- **Tech stack (frontend):** Vite + React + TypeScript (in `web/`).
- **Extras:** Docker Compose for quick local integration (see `compose.yaml`).

**Why this repo**: SSE is simple to implement but requires thought when your backend is scaled across multiple instances. This example demonstrates how to use a message broker (JMS) to fan-out notifications from any server instance to all connected clients, while keeping the frontend minimal so you can focus on SSE behavior and scaling considerations.

**Quick Links**
- `bin/main/com/github/khopland/sse_update/` - backend Kotlin sources
- `web/` - frontend app (Vite + React)
- `compose.yaml` - local compose for services used by the example

**Getting Started (fast)**
1. Start everything with Docker Compose (recommended for quick local testing):

```bash
docker compose -f compose.yaml up --build
```

2. Or run backend and frontend separately:

- Backend (Kotlin/Spring Boot):

```bash
# from repository root
./gradlew clean build
./gradlew bootRun
```

- Frontend (web):

```bash
cd web
pnpm install
pnpm run dev
```

3. Visit the frontend in your browser (Vite default): `http://localhost:5173`.
   The backend defaults to `http://localhost:8080` (Spring Boot default).

**Build & Run (details)**

- Backend
  - Build: `./gradlew clean build` — produces a JAR under `build/`.
  - Run locally (dev): `./gradlew bootRun` — picks up `src/main/resources/application.yaml`.
  - Tests: `./gradlew test`.

- Frontend
  - Install: `pnpm install` (or `npm install` if you prefer).
  - Dev server: `pnpm run dev` — hot reloads while you edit.
  - Production build: `pnpm run build`.

- Docker Compose
  - Quick start for integrated local testing: `docker compose -f compose.yaml up --build`.
  - Tear down: `docker compose -f compose.yaml down`.

**How it works (overview)**
- Clients open an SSE connection to the backend (long-lived HTTP connection where the server sends events).
- When application events occur (e.g., `NotificationService` publishes an event), the server publishes to a JMS topic.
- A JMS listener (on each server instance) receives the message and forwards it to the set of connected SSE clients that instance knows about.
- This pattern ensures all server instances can produce events and all clients receive them (broker fan-out), which is important when scaling horizontally.

**Scaling considerations & best practices**
- Use a message broker (JMS, Redis Pub/Sub, Kafka) for cross-instance event distribution.
- Keep SSE connections simple and stateless on the server — keep only connection metadata in memory, and store durable information in a shared store if needed.
- Prefer sticky sessions only when you store per-connection state on a single instance — otherwise, rely on broker-based fan-out.
- Implement sensible reconnection logic on the client: SSE has automatic reconnect, but you should also consider backoff and re-subscription semantics.
- Monitor connection counts and test limits — each SSE connection consumes server resources.

**Testing & Observability**
- The frontend in `web/` provides a small UI for opening many SSE connections and sending test notifications.
- Add logging and metrics (connection open/close, events published/consumed) on the backend to observe behavior under load.

**Troubleshooting**
- If the frontend cannot connect to backend SSE endpoint:
  - Verify backend is running at `http://localhost:8080`.
  - Check browser console for CORS errors — adjust `WebConfiguration.kt` / Spring CORS if necessary.
- If messages are not arriving across instances, check the JMS/compose logs to ensure the broker is healthy and topics are being published.

**Where to look in this repo**
- Backend entrypoint: `bin/main/com/github/khopland/sse_update/SseUpdateApplication.kt`
- SSE and Web config: `bin/main/com/github/khopland/sse_update/WebConfiguration.kt`
- Notification handling: `bin/main/com/github/khopland/sse_update/NotificationService.kt`, `NotifcationController.kt` and `NotificationMessage.kt`
- Tasks & repository: `Task.kt`, `TaskReposetory.kt`, `OrderController.kt` (example domain logic)
- Frontend test client: `web/src/integrations/sse/` — minimal hooks and devtools for SSE testing

**Development tips**
- Start the broker first when using Compose, then run the backend so it can connect to JMS cleanly.
- Use your browser devtools network tab to observe the SSE connection and incoming `text/event-stream` frames.

**Contributing**
- Suggestions, bug reports, or improvements are welcome. Open an issue or submit a PR describing your change.

**License**
- This example repository is provided as-is for demonstration and learning purposes. Use it freely in your projects.

---

If you want, I can also:
- run the backend build and tests locally
- run the frontend dev server and open the app
- add a short `Makefile` or top-level `scripts` to simplify common commands

Tell me which you'd like next.
