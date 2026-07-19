# Java — Library Standards

> See `_version-policy.md` for pinning rules. Check `planifest-overrides/library-standards/java/prefer-avoid.md` first.

---

## Web Framework

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| API framework | `Spring Boot 3.x` (WebFlux for reactive, MVC for traditional) | `JAX-RS` alone, `Quarkus` (acceptable alt), older Spring Boot 2.x | Spring Boot 3 requires Java 17+, has excellent ecosystem |
| Minimal / cloud-native | `Quarkus` or `Micronaut` | Spring Boot (if startup time is critical) | Quarkus/Micronaut have faster startup for serverless |

## Persistence

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| ORM | `Spring Data JPA` + `Hibernate` or `jOOQ` | `MyBatis` (acceptable), raw JDBC only | jOOQ for type-safe SQL; Spring Data JPA for standard CRUD |
| Migrations | `Flyway` | `Liquibase` (acceptable) | Flyway is simpler; Liquibase for XML-heavy orgs |

## Validation

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Validation | `jakarta.validation` (Bean Validation) + `Hibernate Validator` | hand-rolled | Standard API; works with Spring Boot natively |

## HTTP Client

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| HTTP client | `WebClient` (Spring) or `java.net.http.HttpClient` (Java 11+) | `Apache HttpClient 4.x`, `OkHttp` (acceptable) | WebClient is reactive; stdlib HttpClient is sufficient for non-reactive |

## Serialisation

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| JSON | `Jackson` | `Gson` (acceptable), `org.json` | Jackson is the Spring default and most feature-complete |

## Logging

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Logging | `SLF4J` + `Logback` or `Log4j2` | `java.util.logging` directly | SLF4J is the standard façade; never log to System.out |

## Build

| Concern | Prefer | Avoid | Reason |
|---------|--------|-------|--------|
| Build tool | `Gradle` (Kotlin DSL) | `Maven` (acceptable), Groovy DSL | Kotlin DSL has IDE support and type safety |
