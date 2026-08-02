# Database Client Standards

> Covers preferred and avoided client libraries per database paradigm across languages. See `database-standards.md` for schema/query guidance; overrides take precedence at `planifest-overrides/library-standards/databases/prefer-avoid.md`.

---

## SQL

### PostgreSQL

| Language | Prefer | Avoid | Notes |
|----------|--------|-------|-------|
| TypeScript/Node.js | `postgres` (porsager), `drizzle`, `prisma` | `pg` + knex alone | drizzle/prisma for ORM; postgres/pg for raw queries |
| Python | `asyncpg` (async), `psycopg` v3 | `psycopg2` (sync-only) | psycopg3 supports both sync and async |
| Go | `pgx` v5 | `lib/pq` | pgx is the modern standard |
| Java | `Spring Data JPA` + Hibernate, or `jOOQ` | JDBC alone for complex queries | |
| Rust | `sqlx` | `diesel` (acceptable) | sqlx is async and compile-time checked |

### MySQL / MariaDB

| Language | Prefer | Avoid | Notes |
|----------|--------|-------|-------|
| TypeScript/Node.js | `drizzle` (mysql2 driver), `prisma` | `mysql` (deprecated), `sequelize` | mysql2 is the maintained driver |
| Python | `aiomysql` or `PyMySQL` | `MySQLdb` | aiomysql for async |
| Go | `go-sql-driver/mysql` | `ziutek/mymysql` | |

### SQLite

| Language | Prefer | Avoid | Notes |
|----------|--------|-------|-------|
| TypeScript/Node.js | `better-sqlite3` (sync), `drizzle` | `sqlite3` (callbacks) | better-sqlite3 is synchronous and faster |
| Python | `stdlib sqlite3` | — | stdlib is sufficient |
| Go | `modernc.org/sqlite` (pure Go) | `mattn/go-sqlite3` (requires CGo) | pure Go avoids CGo compilation |

---

## NoSQL

### MongoDB

| Language | Prefer | Avoid | Notes |
|----------|--------|-------|-------|
| TypeScript/Node.js | MongoDB Node.js driver v6 | `mongoose` (unless justified) | Mongoose adds ODM magic that can obscure query behaviour |
| Python | `motor` (async) or `pymongo` | `mongoengine` | motor for FastAPI/asyncio |
| Go | `mongo-driver` v2 | — | |

### Redis

| Language | Prefer | Avoid | Notes |
|----------|--------|-------|-------|
| TypeScript/Node.js | `ioredis` | `redis` v3 and earlier | ioredis has better cluster support |
| Python | `redis-py` v5 (async via `aioredis` merged) | `aioredis` standalone (merged into redis-py) | |
| Go | `go-redis` v9 | `redigo` | go-redis is more actively maintained |

### DynamoDB

| Language | Prefer | Avoid | Notes |
|----------|--------|-------|-------|
| TypeScript/Node.js | `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` | `aws-sdk` v2 | AWS SDK v3 is modular and tree-shakeable |
| Python | `boto3` + `botocore` | `pynamodb` (acceptable for ORM-style) | |
| Go | `aws-sdk-go-v2` | `aws-sdk-go` v1 | |

---

## Document Stores

### Firestore

Official SDK per language: `firebase-admin` (server) / `firebase` (client) for Node.js, `google-cloud-firestore` for Python, `cloud.google.com/go/firestore` for Go.

---

## Data Lakes

### Delta Lake / Apache Iceberg

| Language | Prefer | Notes |
|----------|--------|-------|
| Python | `delta-spark` (PySpark), `deltalake` (standalone) | Use `deltalake` for non-Spark workloads |
| Java/Scala | `delta-core` (Spark), `iceberg` Java API | Standard for Spark-based pipelines |

---

## Graph

### Neo4j

Official driver per language: `neo4j-driver` (Node.js), `neo4j` driver (Python), `neo4j-go-driver` (Go). Avoid `py2neo` (unmaintained).

---

## Time-Series

### InfluxDB / TimescaleDB

| Concern | Prefer | Notes |
|---------|--------|-------|
| InfluxDB | Official language client (`@influxdata/influxdb-client-js`, `influxdb-client-python`) | Use line protocol for high-throughput writes |
| TimescaleDB | Same client as PostgreSQL (it is a PG extension) | pgx/asyncpg/drizzle all work |

---

## Search

### Elasticsearch / OpenSearch

| Language | Prefer | Avoid | Notes |
|----------|--------|-------|-------|
| TypeScript/Node.js | `@elastic/elasticsearch` v8 or `@opensearch-project/opensearch` | `elasticsearch` v7 and older | Use the versioned client matching your server |
| Python | `elasticsearch-py` v8 or `opensearch-py` | — | |
| Go | `go-elasticsearch` v8 or `opensearch-go` | — | |
