# Bookmark Manager — GraphQL API

A GraphQL API for organizing bookmarks into folders, with search and cursor-based pagination. Built for the Burdenoff Product Engineering Intern (Full Stack) take-home assignment.

## Tech Stack

- **Runtime:** Bun + TypeScript (strict mode, no `any`)
- **API:** GraphQL Yoga, schema-first
- **Database:** PostgreSQL via Docker Compose
- **ORM:** Prisma
- **Validation:** Zod
- **Testing:** `bun:test` — unit tests (mocked Prisma) + integration test (real Postgres)

## Setup

```bash
git clone <your-repo-url>
cd bookmark-manager

# 1. Start Postgres
docker compose up -d

# 2. Install dependencies
bun install

# 3. Copy env file and run migrations
cp .env.example .env
bun run gendb

# 4. Start the dev server
bun run dev
```

The server runs at `http://localhost:4000/graphql` — GraphiQL is available in the browser at that URL for exploring the schema and running queries interactively.

## Environment Variables

| Variable       | Description                              | Example                                                                         |
| -------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL` | Postgres connection string used by Prisma | `postgresql://bookmark_user:bookmark_pass@localhost:5432/bookmark_manager?schema=public` |

See `.env.example` — it matches the credentials already set in `docker-compose.yml`, so no values need changing for local development.

## Database

Postgres runs in Docker (`docker-compose.yml`), exposed on `localhost:5432` with a named volume so data survives container restarts. The schema lives in `prisma/schema.prisma`:

- **Folder** — `id`, `name`, `createdAt`, and a `bookmarks` relation
- **Bookmark** — `id`, `title`, `url`, `tags` (native Postgres string array), `folderId`, `createdAt`

Indexes: `folderId` (the most common filter), `title` (supports the `search` filter), and a composite `(createdAt, id)` index used for cursor pagination ordering. Deleting a folder cascades to delete its bookmarks (`onDelete: Cascade`).

Migrations are generated with Prisma's own tooling — nothing here is hand-written SQL:

```bash
bun run gendb          # runs `prisma migrate dev`
bunx prisma studio     # optional — browse the data in a GUI
```

## Running Tests

```bash
bun run test:unit          # mocked Prisma — no database needed
bun run test:integration   # requires: docker compose up -d && bun run gendb
bun run test               # both suites together
```

Unit tests cover resolver logic and validation (happy paths + error paths: empty/whitespace titles, malformed URLs, missing folders) with Prisma mocked at the call-site level — no module-level mocking, so tests stay isolated from each other. The integration test hits the real Postgres instance from `docker-compose.yml`: it creates a folder and bookmark, reads them back, verifies the folder ↔ bookmark relationship round-trips, and checks cascade delete, cleaning up after itself in `afterAll`.

## API

### Queries

| Query                                          | Description                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `folders`                                       | Returns all folders                                                  |
| `folder(id: ID!)`                               | Returns a folder with its nested `bookmarks`                         |
| `bookmarks(folderId, search, take, cursor)`     | Cursor-paginated bookmarks, optionally filtered by folder and/or title substring |

```graphql
query {
  folder(id: "folder_123") {
    name
    bookmarks { id title url }
  }
}

query {
  bookmarks(folderId: "folder_123", search: "docs", take: 10) {
    edges { cursor node { id title } }
    pageInfo { endCursor hasNextPage }
  }
}
```

### Mutations

| Mutation                              | Description                                     |
| -------------------------------------- | ------------------------------------------------ |
| `createFolder(input)`                  | Creates a folder                                  |
| `createBookmark(input)`                | Creates a bookmark (validates title + URL, checks folder exists) |
| `updateBookmark(id, input)`            | Partially updates a bookmark's title/url/tags     |
| `deleteBookmark(id)`                   | Deletes a bookmark                                |
| `moveBookmark(id, folderId)`           | Moves a bookmark to another folder (checks both exist) |

```graphql
mutation {
  createBookmark(input: {
    title: "Prisma Docs"
    url: "https://prisma.io/docs"
    folderId: "folder_123"
  }) {
    id title url createdAt
  }
}
```

All validation and not-found failures return proper GraphQL errors (`extensions.code`: `BAD_USER_INPUT`, `FOLDER_NOT_FOUND`, `BOOKMARK_NOT_FOUND`) rather than unhandled exceptions or generic 500s.

## Pagination Approach

`bookmarks` uses cursor-based pagination, not offset/limit. The cursor is a bookmark's own `id`.

On each request, the resolver fetches `take + 1` rows ordered by `(createdAt ASC, id ASC)` — starting *after* the given cursor via Prisma's `cursor` + `skip: 1`. The extra row (`take + 1`th) is used purely to detect `hasNextPage` and then sliced off before returning; `endCursor` is always the id of the actual last item in the returned page. The next request passes that `endCursor` back as `cursor`, so pagination advances correctly across multiple requests instead of re-serving a fixed offset window (which breaks under concurrent inserts). Ordering by `(createdAt, id)` rather than `createdAt` alone avoids skipped/duplicated rows when multiple bookmarks share a timestamp.

## How I'd Extend This

If this became a real production system:

- **Authentication & Authorization** — JWT-based auth, folders/bookmarks scoped per user, ownership checks on every mutation.
- **Caching** — DataLoader for the `Bookmark.folder` and `Folder.bookmarks` field resolvers to avoid N+1 queries once nesting gets deeper; Redis for hot `folders` lists.
- **Search improvements** — the current `title` index doesn't accelerate substring (`ILIKE '%x%'`) search well. Postgres full-text search (`tsvector`/`tsquery`) or `pg_trgm` trigram indexes would be the real fix, or an external index (Meilisearch/Elasticsearch) if search became a first-class feature.
- **Observability** — structured logging per resolver, request tracing (OpenTelemetry), and error monitoring (Sentry) instead of console errors.
- **API versioning** — schema evolution via deprecation directives first; a `/graphql/v2` split only if a breaking change is unavoidable.
- **Scaling** — connection pooling (PgBouncer) once concurrent load grows, read replicas for the `bookmarks` search/list path, and horizontal scaling of the Yoga server behind a load balancer since it's stateless.

None of the above is implemented — intentionally out of scope for this assignment.