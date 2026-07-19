# External Skills Library

Curated open-source Claude Code skills from permissively-licensed upstream repositories.
200 skills across 19 upstream sources + 8 original works.

## Using This Library

Copy skills to your Claude Code skills directory:

`ash
# All external skills (opt-in flag in setup scripts)
./setup.sh --include-full-skill-library
# Windows
./setup.ps1 --include-full-skill-library
`

Without the flag, external skills are not copied.

## Licence Compliance

All upstream skills are sourced from MIT or Apache-2.0 repositories. Full licence text and
attribution details are in each skill's `attribution.txt` file.

## Skill Index

| Skill | Description |
|-------|-------------|
| `37signals-way` | Build lean, opinionated products using the 37signals philosophy from Getting Real, Rework, and Sh... |
| `ab-test-setup` | When the user wants to plan, design, or implement an A/B test or experiment, or build a growth ex... |
| `ab-testing` | Controlled online experiment workflow for product changes with causal inference, randomization in... |
| `acceptance-criteria-design` | Design executable acceptance criteria for approved requirements by converting goals/specs into bi... |
| `accessibility-compliance-accessibility-audit` | You are an accessibility expert specializing in WCAG compliance, inclusive design, and assistive ... |
| `accessibility-design` | Accessibility-first design workflow for specifying semantics, keyboard/focus behavior, readabilit... |
| `ad-creative` | When the user wants to generate, iterate, or scale ad creative — headlines, descriptions, primary... |
| `ai-seo` | When the user wants to optimize content for AI search engines, get cited by LLMs, or appear in AI... |
| `algorithm-complexity-analysis` | Analyze candidate algorithms for time/space complexity, scalability limits, and resource-budget f... |
| `algorithm-design` | Design algorithms by modeling constraints, enumerating candidate strategies, proving correctness,... |
| `algorithm-expert` | Generate a glossary of advanced terms from any technical content — each entry includes a 2-senten... |
| `analytics-tracking` | When the user wants to set up, improve, or audit analytics tracking and measurement. Also use whe... |
| `android-development` | Create production-quality Android applications following Google's official architecture guidance ... |
| `api-and-interface-design` | Guides stable API and interface design. Use when designing APIs, module boundaries, or any public... |
| `api-contract-testing` | Consumer-provider contract testing and release-gate design for compatibility matrices, contract a... |
| `api-design` | Generate secure, composable code changes for an existing project from structured JSON input. |
| `api-design-graphql` | GraphQL schema and resolver contract design for type boundaries, nullability, authz, and query-co... |
| `api-design-rest` | Resource-oriented REST/OpenAPI contract design for URI/method semantics, idempotency, pagination,... |
| `api-error-handling` | API failure-contract design for status mapping, stable error codes, retryability semantics, and t... |
| `api-gateway` | AWS API Gateway for REST and HTTP API management. Use when creating APIs, configuring integration... |
| `api-security` | Generate a STRIDE-per-element threat model for a system design. |
| `api-testing-observability-api-mock` | API mocking expert specializing in realistic mock services for development, testing, and simulati... |
| `api-versioning` | API version lifecycle governance for breaking-change classification, deprecation windows, migrati... |
| `architecture-c4-modeling` | C4 architecture modeling workflow for context, container, and component views that make boundarie... |
| `architecture-clean-architecture` | Clean Architecture workflow for enforcing dependency direction, stable domain boundaries, and use... |
| `architecture-ddd` | Domain-driven design workflow for bounded context partitioning, aggregate design, and context map... |
| `architecture-decision-records` | Architecture Decision Record workflow for capturing technical decisions, alternatives, trade-offs... |
| `architecture-event-driven` | Event-driven architecture workflow for asynchronous integration, decoupled workflows, and failure... |
| `architecture-microservices` | Microservices architecture workflow for service boundary design, independent deployability, and d... |
| `architecture-monolith` | Modular monolith architecture workflow for strong domain boundaries, transactional consistency, a... |
| `architecture-principles` | Define architecture principles and review guardrails before choosing monolith, microservices, ser... |
| `architecture-serverless` | Serverless architecture workflow for event-driven and bursty workloads using managed compute and ... |
| `architecture-tradeoff-analysis` | Architecture trade-off analysis workflow for comparing options with explicit criteria, weighting,... |
| `aso-audit` | When the user wants to audit or optimize an App Store or Google Play listing. |
| `autoplan` | Engineering manager skill for automated planning. |
| `aws-agentic-ai` | AWS Bedrock AgentCore comprehensive expert for deploying and managing AI agents at scale. |
| `aws-cdk-development` | AWS Cloud Development Kit (CDK) expert for building cloud infrastructure with TypeScript/Python. ... |
| `aws-cost-operations` | AWS cost optimization, monitoring, and operational excellence expert. Use when analyzing AWS bill... |
| `aws-serverless-eda` | AWS serverless and event-driven architecture expert based on Well-Architected Framework. |
| `azure` | Azure cloud development guidelines for ARM templates, Azure Pipelines, Kubernetes, and cloud-nati... |
| `b2b-saas-pm` | Generate a structured Product Requirements Document (PRD) from a product idea or description. |
| `bash-scripting` | Bash scripting workflow for creating production-ready shell scripts with defensive patterns, erro... |
| `bash-style-guide` | Style, review, and refactoring standards for Bash shell scripting. |
| `batch-processing-jobs` | Batch processing job design and orchestration patterns. |
| `benchmark` | Performance benchmarking workflow. |
| `benchmark-models` | Benchmark and evaluate ML models. |
| `brainstorming` | Use before any creative work — creating features, building components, adding functionality. |
| `brand-guidelines` | Applies brand colors and typography to artifacts. |
| `browse` | Exploratory testing via browser interaction. |
| `browser-testing-with-devtools` | Tests in real browsers. Use when building or debugging anything that runs in a browser. |
| `build-systems` | Build system configuration and optimisation. |
| `c4-diagramming` | Turn any concept, system, or data into a Mermaid diagram with a visual explanation. |
| `canary` | Canary deployment and observability patterns. |
| `canvas-design` | Create beautiful visual art in .png and .pdf documents using design philosophy. |
| `capacity-planning` | Analyse server log files to identify patterns, anomalies, and reliability issues. |
| `careful` | Careful disaster recovery and safe operations. |
| `chaos-engineering` | Extract structured incident intelligence from cybersecurity breach articles. |
| `chaos-engineering-basics` | Design and execute controlled chaos experiments to validate resilience assumptions. |
| `churn-prevention` | When the user wants to reduce churn, build cancellation flows, or recover failed payments. |
| `ci-cd-and-automation` | Automates CI/CD pipeline setup. Use when setting up or modifying build and deployment pipelines. ... |
| `ci-cd-pipeline-design` | Design CI/CD pipelines with explicit stage order, quality gates, artifact traceability, and rollb... |
| `claude-api` | Build, debug, and optimize Claude API / Anthropic SDK apps with prompt caching. |
| `clean-architecture` | Structure software around the Dependency Rule: source code dependencies point inward. |
| `clean-ddd-hexagonal` | Proactively apply when designing APIs, microservices, or scalable backend structure. |
| `cloud-architect` | Analyse a Terraform plan and produce a structured Markdown summary. |
| `cloudflare-workers-expert` | Expert in Cloudflare Workers and the Edge Computing ecosystem. Covers Wrangler, KV, D1, Durable O... |
| `cloud-penetration-testing` | Conduct comprehensive security assessments of cloud infrastructure across Azure, AWS, and GCP. |
| `cloud-security` | Produce a network threat landscape report from open port and service scan data. |
| `code-quality` | Explain code, security tool output, or configuration text with security insights. |
| `code-review-and-quality` | Conducts multi-axis code review. Use before merging any change. |
| `code-reviewer` | Perform a comprehensive code review assessing correctness, security, performance, and style. |
| `code-review-general` | Run full-scope code review for correctness, maintainability, and regression risk. |
| `code-review-performance` | Run performance-focused code review when changes may affect latency, throughput, or resource use. |
| `code-review-security` | Run security-focused code review when changes cross trust boundaries or affect authentication. |
| `code-simplification` | Simplifies code for clarity without changing behavior. |
| `codex` | Rubber-duck debugging and code explanation. |
| `cold-email` | Write B2B cold emails and follow-up sequences that get replies. |
| `co-marketing` | When the user wants to find co-marketing partners or plan joint campaigns. |
| `community-marketing` | Build and leverage online communities to drive product growth and brand loyalty. |
| `competitive-analysis` | Analyse the societal impact of a technology project — objectives, technologies, outcomes. |
| `competitor-alternatives` | When the user wants to create competitor comparison pages for SEO and sales enablement. |
| `competitor-profiling` | When the user wants to research, profile, or analyze competitors from their URLs. |
| `concurrency-patterns` | Design and review concurrency strategy for shared state, coordination, and contention control. |
| `consumer-pm` | Analyse and prioritise product feedback by consolidating similar themes and scoring usefulness. |
| `content-design` | Rewrite and improve an LLM prompt using proven prompt engineering techniques. |
| `content-strategy` | When the user wants to plan a content strategy or decide what content to create. |
| `context-engineering` | Optimizes agent context setup. Use when starting a new session or when agent output degrades. |
| `continuous-discovery` | Build a weekly cadence of customer touchpoints using Opportunity Solution Trees. |
| `copy-editing` | When the user wants to edit, review, or improve existing marketing copy. |
| `copywriting` | When the user wants to write or improve marketing copy for any page. |
| `cost-optimization-cloud` | Optimize cloud spend with explicit tradeoffs across cost, performance, and reliability. |
| `cpp-pro` | Write idiomatic C++ code with modern features, RAII, smart pointers, and STL algorithms. |
| `cqrs-implementation` | Implement Command Query Responsibility Segregation for scalable architectures. |
| `csharp-style-guide` | Style, review, and refactoring standards for C#/.NET codebases. |
| `cso` | DevSecOps and cloud security operations. |
| `customer-research` | When the user wants to conduct, analyze, or synthesize customer research. |
| `database-admin` | Expert database administrator specializing in modern cloud databases, automation, and reliability. |
| `database-design` | Database design principles and decision-making. Schema design, indexing strategy, ORM selection. |
| `data-encryption` | Data encryption patterns and cryptography implementation. |
| `data-engineering-data-pipeline` | Data pipeline architecture expert specializing in scalable, reliable, and cost-effective pipelines. |
| `data-structures` | Select data structures using explicit access patterns, mutation behavior, and memory limits. |
| `data-visualization` | Create effective visualizations using matplotlib and seaborn for exploratory analysis. |
| `db-backup-recovery` | Database backup and recovery workflow for defining RPO/RTO-aligned retention and restore strategy. |
| `db-conceptual-modeling` | Conceptual data modeling workflow for domain entities, relationships, and lifecycle boundaries. |
| `db-index-strategy` | Index strategy workflow for balancing read latency, write amplification, and plan stability. |
| `db-logical-design` | Logical database design workflow for table structure, key strategy, constraints, and relational co... |
| `db-migration-strategy` | Schema migration strategy workflow for sequencing changes, compatibility windows, and rollback. |
| `db-normalization` | Normalization workflow for reducing update anomalies while balancing query practicality. |
| `db-physical-design` | Physical database design workflow for storage layout, partitioning, and engine settings. |
| `db-query-optimization` | Query optimization workflow for reducing latency and resource cost through plan-aware rewrites. |
| `db-replication-sharding` | Replication and sharding workflow for scaling read/write throughput while managing consistency. |
| `db-transaction-design` | Transaction design workflow for boundary definition, isolation-level choice, and contention contro... |
| `dbt-transformation-patterns` | Production-ready patterns for dbt including model organization, testing strategies, and performanc... |
| `debug-root-cause` | Systematic debugging workflow for isolating software root causes and implementing proportional fix... |
| `debugging-and-error-recovery` | Guides systematic root-cause debugging. Use when tests fail, builds break, or behavior is wrong. |
| `deployment-strategy-blue-green` | Design blue-green deployment strategy with cutover checks, rollback triggers, and state/session mi... |
| `deployment-strategy-canary` | Design canary rollout strategy with progressive traffic steps and guardrail metrics. |
| `deprecation-and-migration` | Manages deprecation and migration. Use when removing old systems, APIs, or features. |
| `design-consultation` | UX design consultation and guidance. |
| `design-critique` | Conduct a detailed architecture design review. |
| `design-principles` | Define and align product design principles for consistent UX decisions. |
| `design-qa-implementation-parity` | Verify implementation parity against approved design specs with severity-based decisions. |
| `design-review` | Run structured design reviews that produce actionable findings and clear approval decisions. |
| `design-shotgun` | Rapid wireframing and design ideation. |
| `design-system-foundations` | Define scalable design-system foundations with clear ownership and adoption boundaries. |
| `design-tokens` | Design token architecture workflow for semantic, scalable, implementation-ready token systems. |
| `directory-submissions` | When the user wants to submit their product to startup, SaaS, AI, or review directories. |
| `dispatching-parallel-agents` | Use when facing 2+ independent tasks that can be worked on without shared state. |
| `distributed-consensus` | Consensus workflow for quorum, leader election, commit semantics, and membership change safety. |
| `distributed-systems-basics` | Distributed-systems workflow for failure-mode analysis, consistency choices, and reliability. |
| `django-app-development` | Django application development workflow for production-grade app changes. |
| `docker-basics` | Design and review container runtime basics for reproducible local/service execution. |
| `docker-compose-patterns` | Design multi-service local orchestration with Docker Compose. |
| `docker-expert` | Advanced Docker containerization expert with comprehensive knowledge of containers and orchestrati... |
| `dockerfile-best-practices` | Design Dockerfiles for secure, deterministic, and efficient image builds. |
| `documentation-and-adrs` | Records decisions and documentation. Use when making architectural decisions or changing public API... |
| `documentation-api-reference` | Author API reference documentation that is accurate, complete, and implementation-aligned. |
| `documentation-architecture` | Author architecture documentation explaining boundaries, dependencies, and operational constraints. |
| `documentation-rfc` | Author RFC documents for proposed technical changes with problem framing, options, and tradeoffs. |
| `document-release` | Stakeholder communication and release documentation. |
| `domain-driven-design` | Model software around the business domain using bounded contexts, aggregates, and ubiquitous langu... |
| `dotnet-architect` | Expert .NET backend architect specializing in C#, ASP.NET Core, Entity Framework, and enterprise p... |
| `doubt-driven-development` | Subjects every non-trivial decision to a fresh-context adversarial review before it stands. |
| `dynamic-programming` | Design dynamic programming solutions by defining state, transitions, and base cases. |
| `eks` | AWS EKS Kubernetes management for clusters, node groups, and workloads. |
| `elixir-pro` | Write idiomatic Elixir code with OTP patterns, supervision trees, and Phoenix LiveView. |
| `email-sequence` | When the user wants to create or optimize an email sequence or drip campaign. |
| `executing-plans` | Use when you have a written implementation plan to execute in a separate session. |
| `express-api-development` | Express API development workflow for production-ready Node.js services. |
| `fastapi-service-development` | FastAPI service development workflow for production-grade Python APIs. |
| `feature-flag-strategy` | Feature flag lifecycle governance for safe rollout, blast-radius control, and cleanup discipline. |
| `figma-automation` | Automate Figma tasks via MCP: files, components, design tokens, comments, exports. |
| `figma-handoff` | Design-to-engineering handoff workflow for packaging implementation-ready Figma specifications. |
| `finishing-a-development-branch` | Use when implementation is complete and you need to decide how to integrate the branch. |
| `fixing-accessibility` | Audit and fix HTML accessibility issues including ARIA labels and keyboard navigation. |
| `flutter-expert` | Master Flutter development with Dart 3, advanced widgets, and multi-platform deployment. |
| `form-cro` | When the user wants to optimize forms — lead capture, checkout, survey, or contact forms. |
| `fp-pragmatic` | A practical, jargon-free guide to functional programming — the 80/20 approach that gets results. |
| `free-tool-strategy` | When the user wants to plan or build a free tool for marketing purposes. |
| `frontend-design` | Create distinctive, production-grade frontend interfaces with high design quality. |
| `frontend-ui-engineering` | Builds production-quality UIs. Use when building or modifying user-facing interfaces. |
| `gcp-development` | Google Cloud Platform (GCP) development best practices for Cloud Functions, Cloud Run, Firestore. |
| `gdpr-compliance-audit` | GDPR compliance audit and privacy regulation analysis. |
| `git-bisect-debugging` | Locate regression-introducing commits using git bisect with deterministic classification. |
| `git-branch-strategy` | Define branch topology, lifecycle rules, and merge policy that match team delivery and release risk... |
| `git-cherry-pick-hotfix` | Select and apply minimal hotfix commits across branches via cherry-pick. |
| `git-commit-hygiene` | Enforce atomic commits, clear commit messages, and auditable change intent before push. |
| `git-history-investigation` | Reconstruct change history using log/show/diff/blame evidence. |
| `github-actions-workflow-design` | Design and maintain GitHub Actions workflows with explicit trigger scope and security boundaries. |
| `github-address-comments` | Resolve GitHub PR review comments with structured triage and focused code changes. |
| `github-codeowners-management` | Govern CODEOWNERS rules so review routing reflects real ownership and risk boundaries. |
| `github-fix-ci` | Respond to GitHub Actions failures with evidence-based triage and root-cause isolation. |
| `github-release-management` | Package and publish GitHub Releases with exact version/tag mapping and accurate release notes. |
| `git-merge-conflict-resolution` | Resolve Git merge/rebase conflicts with explicit intent tracking and post-resolution verification. |
| `git-pr-sync-workflow` | Keep pull request branches synchronized with target branch updates. |
| `git-rebase-workflow` | Linearize local branch history with safe rebase practices before integration. |
| `git-release-tagging` | Create immutable release tags and traceable release notes from Git history. |
| `git-revert-recovery` | Recover safely from problematic merges or commits using explicit revert strategy. |
| `git-workflow-and-versioning` | Structures git workflow practices. Use when making any code change or committing. |
| `golang-pro` | Master Go 1.21+ with modern patterns, advanced concurrency, and performance optimization. |
| `go-style-guide` | Style, review, and refactoring standards for Go codebases. |
| `gpt-image-2` | Image generation and editing skill for GPT Image 2. |
| `graph-algorithms` | Graph algorithm workflow for modeling entities/relations and selecting traversal and path algorithms. |
| `graphql-architect` | Master modern GraphQL with federation, performance optimization, and enterprise security. |
| `growth-engine` | Growth engine for digital products — growth hacking, SEO, ASO, viral loops, email marketing. |
| `health` | Technical debt assessment and codebase health review. |
| `iam` | AWS Identity and Access Management for users, roles, policies, and permissions. |
| `idea-refine` | Refines ideas iteratively through structured divergent and convergent thinking. |
| `image` | When the user wants to create, generate, edit, or optimize images for marketing. |
| `incident-postmortem` | Incident postmortem workflow for evidence-backed root cause analysis and systemic prevention. |
| `incident-responder` | Expert SRE incident responder specializing in rapid problem resolution and modern observability. |
| `incremental-implementation` | Delivers changes incrementally. Use when implementing any feature that touches more than one file. |
| `interaction-design` | Interaction design workflow for user flows, state transitions, and feedback behavior. |
| `internal-comms` | Write all kinds of internal communications using established formats. |
| `interview-coach` | Full job search coaching — JD decoding, resume, storybank, mock interviews, transcript analysis. |
| `investigate` | Incident investigation and response. |
| `java-pro` | Master Java 21+ with modern features like virtual threads, pattern matching, and Spring Boot 3.x. |
| `javascript-style-guide` | Style, review, and refactoring standards for JavaScript codebases. |
| `java-style-guide` | Style, review, and refactoring standards for Java codebases. |
| `jest-testing-workflow` | Jest verification workflow for JavaScript/TypeScript codebases. |
| `jobs-to-be-done` | Discover what customers truly need by analyzing the job they hire your product to do. |
| `jupyter-notebook` | Notebook delivery workflow for software teams requiring reproducible execution. |
| `k6-load-testing` | Comprehensive k6 load testing skill for API, browser, and scalability testing. |
| `kafka-development` | Best practices and guidelines for Apache Kafka event streaming and distributed messaging. |
| `kb-retriever` | Local knowledge base retrieval and Q&A assistant. |
| `kotlin-coroutines-expert` | Expert patterns for Kotlin Coroutines and Flow, covering structured concurrency and error handling. |
| `kubernetes-basics` | Kubernetes fundamentals workflow for workload deployment and service discovery. |
| `kubernetes-deployment` | Kubernetes deployment workflow for container orchestration, Helm charts, and service mesh. |
| `kubernetes-security` | Kubernetes security workflow for cluster hardening, workload isolation, and policy enforcement. |
| `kubernetes-workload-design` | Kubernetes workload design workflow for resource sizing, autoscaling, and safe rollout strategies. |
| `land-and-deploy` | DevOps engineer skill for landing and deploying changes. |
| `launch-strategy` | When the user wants to plan a product launch, feature announcement, or release strategy. |
| `lead-magnets` | When the user wants to create or optimize a lead magnet for email capture. |
| `lean-ux` | Apply lean thinking to UX: hypothesis-driven design, collaborative sketching, and rapid experiment... |
| `linux-troubleshooting` | Linux system troubleshooting workflow for diagnosing system issues and performance problems. |
| `localization-qa` | Localization QA workflow for language correctness, layout resilience, and locale-specific behavior. |
| `marketing-ideas` | When the user needs marketing ideas, inspiration, or strategies for their SaaS product. |
| `marketing-psychology` | When the user wants to apply psychological principles or behavioral science to marketing. |
| `marketplace-pm` | Marketplace product management — liquidity, supply/demand balance, take rate, and network effects. |
| `memory-safety-patterns` | Cross-language patterns for memory-safe programming including RAII, ownership, and smart pointers. |
| `microservices-patterns` | Master microservices architecture patterns including service boundaries and inter-service communica... |
| `ml-data-preprocessing` | ML data preprocessing workflow for cleaning, normalization, and leakage-safe dataset preparation. |
| `ml-experiment-tracking` | ML experiment tracking workflow for reproducibility and run comparison traceability. |
| `ml-feature-engineering` | ML feature engineering workflow for feature definition, lineage, and online-offline parity. |
| `ml-model-evaluation` | ML model evaluation workflow for metric design, threshold setting, and failure segmentation. |
| `ml-model-selection` | ML model selection workflow for transparent trade-offs across accuracy, latency, and cost. |
| `mlops-model-serving` | MLOps model serving workflow for serving topology, latency SLOs, and safe rollout controls. |
| `mlops-monitoring-drift` | MLOps drift monitoring workflow for detecting data drift, concept drift, and quality degradation. |
| `mlops-pipeline-design` | MLOps pipeline design workflow for orchestrating training, validation, packaging, and promotion. |
| `ml-problem-framing` | ML problem framing workflow for objective definition and target variable design. |
| `ml-training-optimization` | ML training optimization workflow for convergence stability, efficiency, and cost control. |
| `mom-test` | Talk to customers without leading them using Mom Test rules. |
| `nelson` | Orchestrates multi-agent task execution using a Royal Navy squadron metaphor. |
| `network-engineer` | Expert network engineer specializing in modern cloud networking and security architectures. |
| `nextjs-app-router` | Next.js App Router implementation workflow for route structure and server/client boundaries. |
| `nextjs-best-practices` | Next.js App Router principles. Server Components, data fetching, routing patterns. |
| `nodejs-best-practices` | Node.js development principles and decision-making. Framework selection, async patterns, security. |
| `non-functional-requirements` | Quality attribute specification workflow after functional requirements are defined. |
| `observability-alerting` | Observability alerting workflow for signal quality, routing policy, and actionable thresholds. |
| `observability-logging` | Observability logging workflow for structured schema, correlation, and incident triage utility. |
| `observability-metrics` | Observability metrics workflow for metric model design aligned to service health and business impac... |
| `observability-tracing` | Observability tracing workflow for distributed trace coverage and critical-path diagnosis. |
| `office-hours` | Product strategy office hours and advisory. |
| `okr-planning` | Writing and running OKRs — objective quality, key result measurability, grading, and check-in cada... |
| `okr-writing` | Write effective Objectives and Key Results that align teams and communicate priorities. |
| `onboarding-cro` | When the user wants to optimize post-signup onboarding, user activation, or first-run experience. |
| `on-call-handoff-patterns` | Effective patterns for on-call shift transitions ensuring continuity and context transfer. |
| `open-source-contributor` | Contributes effectively to open source projects — first contributions, navigation, and maintenance. |
| `page-cro` | When the user wants to optimize or increase conversions on any marketing page. |
| `paid-ads` | When the user wants help with paid advertising campaigns on Google Ads, Meta, or other platforms. |
| `paywall-upgrade-cro` | When the user wants to create or optimize in-app paywalls, upgrade screens, or upsell modals. |
| `performance-capacity-planning` | Performance capacity planning workflow for forecasting demand and defining headroom policy. |
| `performance-load-testing` | Performance load testing workflow for realistic workload simulation and bottleneck detection. |
| `performance-optimization` | Optimizes application performance. Use when performance requirements exist or bottlenecks are suspe... |
| `performance-profiling` | Performance profiling workflow for CPU/memory/I/O hotspot localization. |
| `php-pro` | Write idiomatic PHP code with generators, iterators, and SPL data structures. |
| `plan-ceo-review` | CEO-perspective product plan review. |
| `plan-devex-review` | Developer experience plan review. |
| `plan-eng-review` | Engineering architecture plan review. |
| `planning-and-task-breakdown` | Breaks work into ordered tasks. Use when you have a spec or clear requirements. |
| `platform-engineering` | Platform engineering covering Internal Developer Platform design and golden paths. |
| `platform-pm` | Platform product management — developer ecosystems, APIs as product, extensibility design. |
| `playwright` | Playwright browser verification workflow for user-journey evidence with deterministic replay. |
| `popup-cro` | When the user wants to create or optimize popups, modals, overlays, or banners for conversion. |
| `postgresql-optimization` | PostgreSQL database optimization workflow for query tuning and indexing strategies. |
| `powershell-style-guide` | Style, review, and refactoring standards for PowerShell scripting. |
| `pricing-strategy` | When the user wants help with pricing decisions, packaging, or monetization strategy. |
| `privacy-by-design` | Privacy-by-design workflow for embedding data minimization, lawful basis, and retention controls. |
| `product-marketing-context` | When the user wants to create or update their product marketing context document. |
| `programmatic-seo` | When the user wants to create SEO-driven pages at scale using templates and data. |
| `project-estimation` | Project estimation workflow for dependency-aware breakdowns and uncertainty-calibrated effort ranges. |
| `pytest-workflow` | Pytest verification workflow for Python changes with deterministic fixtures. |
| `python-pro` | Master Python 3.12+ with modern features, async programming, and production-ready patterns. |
| `python-style-guide` | Style, review, and refactoring standards for Python codebases with strong typing. |
| `qa-only` | QA-focused testing strategy and verification. |
| `rag-engineer` | Expert in building Retrieval-Augmented Generation systems with embedding and retrieval strategies. |
| `react-component-design` | React component design workflow for state ownership and composition boundaries. |
| `reactive-programming` | Reactive programming patterns and event stream design. |
| `react-nextjs-development` | React and Next.js 14+ application development with App Router, Server Components, and TypeScript. |
| `real-time-features` | Real-time system features and live data synchronisation. |
| `receiving-code-review` | Use when receiving code review feedback, before implementing suggestions. |
| `redis-caching-patterns` | Redis caching workflow for latency improvement with explicit key strategy and TTL/invalidation polic... |
| `refactoring-ui` | Audit and fix visual hierarchy, spacing, color, and depth in web UIs. |
| `referral-program` | When the user wants to create, optimize, or analyze a referral or affiliate program. |
| `release-it` | Build production-ready systems with stability patterns: circuit breakers, bulkheads, timeouts. |
| `release-management` | Release management workflow for go/no-go governance, readiness evidence, and rollback preparedness. |
| `remotion` | Generate walkthrough videos from Stitch projects using Remotion with smooth transitions. |
| `requesting-code-review` | Use when completing tasks or before merging to verify work meets requirements. |
| `requirement-elicitation` | Requirement elicitation workflow for collecting, reconciling, and structuring evidence. |
| `requirement-prioritization` | Requirement prioritization workflow for dependency-aware ranking and release cut-line decisions. |
| `requirements-definition` | Canonical requirement baseline workflow after evidence collection. |
| `responsive-layout-design` | Responsive layout design workflow for adaptive structure across viewports. |
| `retro` | Retrospective facilitation and team improvement. |
| `review` | Security testing and code review. |
| `revops` | When the user wants help with revenue operations or lead lifecycle management. |
| `risk-requirements-analysis` | Requirement risk analysis workflow for failure scenarios, scoring, and mitigation. |
| `ruby-pro` | Write idiomatic Ruby code with metaprogramming, Rails patterns, and performance optimization. |
| `runbook-authoring` | Runbook authoring workflow for clear, executable operational procedures for on-call responders. |
| `rust-pro` | Master Rust 1.75+ with modern async patterns and advanced type system features. |
| `rust-style-guide` | Style, review, and refactoring standards for Rust codebases. |
| `saga-orchestration` | Patterns for managing distributed transactions and long-running business processes. |
| `sales-enablement` | When the user wants to create sales collateral, pitch decks, or objection handling docs. |
| `scala-pro` | Master enterprise-grade Scala development with functional programming and distributed systems. |
| `schema-evolution-governance` | Schema evolution governance workflow for safe migration sequencing and compatibility control. |
| `schema-markup` | When the user wants to add, fix, or optimize schema markup and structured data on their site. |
| `screenshot` | Visual evidence capture workflow for reproducible screenshots in engineering and QA tasks. |
| `secrets-manager` | AWS Secrets Manager for secure secret storage and rotation. |
| `security-and-hardening` | Hardens code against vulnerabilities. Use when handling user input, authentication, or data storage. |
| `security-authentication` | Security workflow for authentication architecture, credential lifecycle, and session/token assurance. |
| `security-authorization` | Security workflow for authorization boundaries, least-privilege policy, and enforcement design. |
| `security-incident-response` | Security incident workflow for triage, containment, eradication, and recovery. |
| `security-secrets-management` | Security workflow for secret inventory, storage, distribution, rotation, and auditability. |
| `security-secure-coding` | Security workflow for secure-by-default coding decisions and vulnerability prevention. |
| `security-threat-modeling` | Security workflow for threat modeling using assets, trust boundaries, and attacker capabilities. |
| `security-vulnerability-management` | Security workflow for vulnerability intake, triage, remediation planning, and fix verification. |
| `seo-audit` | When the user wants to audit, review, or diagnose SEO issues on their site. |
| `service-mesh-expert` | Expert service mesh architect specializing in Istio, Linkerd, and cloud-native networking. |
| `shipping-and-launch` | Prepares production launches. Use when preparing to deploy to production. |
| `sh-style-guide` | Style, review, and refactoring standards for POSIX sh scripting. |
| `signup-flow-cro` | When the user wants to optimize signup, registration, or trial activation flows. |
| `site-architecture` | When the user wants to plan or restructure their website's page hierarchy and navigation. |
| `snowflake-development` | Comprehensive Snowflake development assistant covering SQL best practices and data pipeline design. |
| `social-content` | When the user wants help creating or optimizing social media content for LinkedIn, Twitter, etc. |
| `software-design-philosophy` | Manage software complexity through deep modules, information hiding, and strategic programming. |
| `soul` | Embody a digital identity. Read SOUL.md first, then STYLE.md, then examples/. |
| `source-driven-development` | Grounds every implementation decision in official documentation. |
| `spec-driven-development` | Creates specs before coding. Use when starting a new project, feature, or significant change. |
| `sqlalchemy-orm-patterns` | SQLAlchemy ORM workflow for model mapping, session/transaction boundaries, and query loading. |
| `sql-style-guide` | Style, review, and refactoring standards for SQL schema, migration, and query artifacts. |
| `sre-sli-slo` | SRE SLI/SLO workflow for reliability target definition and error-budget policy. |
| `stakeholder-interview` | Internal stakeholder interview workflow for capturing constraints and decision authority. |
| `supply-chain-risk-auditor` | Identifies dependencies at heightened risk of exploitation or takeover. |
| `swiftui-expert-skill` | Write, review, or improve SwiftUI code following best practices for state management. |
| `systematic-debugging` | Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes. |
| `system-design` | Design scalable distributed systems using structured approaches for load balancing and caching. |
| `team-scaling` | Design team structures, hiring plans, and organizational processes that scale engineering capability. |
| `technical-roadmapping` | Technical roadmap workflow for sequencing initiatives, dependencies, and risk-aware milestones. |
| `terraform-infrastructure` | Terraform infrastructure as code workflow for provisioning cloud resources and reusable modules. |
| `terraform-skill` | Use when writing, reviewing, or debugging Terraform/OpenTofu modules, tests, CI, or state. |
| `terraform-style-guide` | Style, review, and refactoring standards for Terraform infrastructure-as-code. |
| `test-automator` | Master AI-powered test automation with modern frameworks and self-healing tests. |
| `test-data-generation` | Test data generation and management patterns. |
| `test-driven-development` | Use when implementing any feature or bugfix, before writing implementation code. |
| `testing-bdd` | Behavior-driven scenario design for shared business language and executable acceptance evidence. |
| `testing-contract` | Provider-consumer compatibility testing for service interface changes. |
| `testing-e2e` | End-to-end test planning for critical user journeys across integrated systems. |
| `testing-integration` | Integration-boundary testing for component and service collaboration correctness. |
| `testing-mutation` | Mutation-testing workflow for exposing weak assertions and missing behavioral checks. |
| `testing-property-based` | Property-based testing workflow for invariant validation over broad input spaces. |
| `testing-regression-strategy` | Risk-based regression suite curation for release gating under time and budget limits. |
| `testing-tdd` | Red-green-refactor workflow for test-first implementation feedback loops. |
| `testing-unit` | Deterministic unit-test strategy for isolated logic and fast feedback. |
| `theme-factory` | Toolkit for styling artifacts — slides, docs, reports, HTML — with a consistent theme. |
| `threat-modeling-expert` | Expert in threat modeling methodologies, security architecture review, and risk assessment. |
| `typescript-expert` | TypeScript and JavaScript expert with deep knowledge of type-level programming and performance. |
| `typescript-style-guide` | Style, review, and refactoring standards for TypeScript codebases. |
| `unit-testing-test-generate` | Generate comprehensive, maintainable unit tests across languages with strong coverage. |
| `use-case-modeling` | Use case modeling workflow for clarifying actor interactions and boundary behavior. |
| `user-story-writing` | User story authoring workflow for turning prioritized requirements into implementable stories. |
| `using-git-worktrees` | Use when starting feature work that needs isolation from the current workspace. |
| `ux-research-synthesis` | UX research synthesis workflow for turning mixed evidence into prioritized design actions. |
| `vector-database-engineer` | Expert in vector databases, embedding strategies, and semantic search implementation. |
| `verification-before-completion` | Use when about to claim work is complete, before committing or creating PRs. |
| `video` | When the user wants to create or produce video content using AI tools or programmatic methods. |
| `vue-best-practices` | Use for Vue.js tasks. Recommends Composition API with script setup and TypeScript. |
| `vulnerability-scanner` | Advanced vulnerability analysis. OWASP 2025, Supply Chain Security, attack surface mapping. |
| `webapp-testing` | Toolkit for interacting with and testing local web applications using Playwright. |
| `web-design-engineer` | Web design engineering and frontend implementation. |
| `web-video-presentation` | Turn an article into a click-driven 16:9 web presentation that looks like a video. |
| `writing-plans` | Use when you have a spec or requirements for a multi-step task, before touching code. |
| `zero-trust-architecture` | Zero-trust architecture design and implementation. |
| `zsh-style-guide` | Style, review, and refactoring standards for Zsh scripting. |
