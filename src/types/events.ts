/**
 * TypeScript types for all Planifest telemetry event types.
 * These types mirror schemas/telemetry-event.schema.json — the JSON Schema is the source of truth.
 */

export type EventType =
  | 'phase_start'
  | 'phase_end'
  | 'spec_gap'
  | 'validation_failure'
  | 'deviation'
  | 'migration_proposal'
  | 'context_pressure'
  | 'mcp_impact'
  | 'self_correction'
  | 'phase_skip'
  | 'security_finding'
  | 'retry_limit_exceeded'
  | 'adr_decision'
  | 'doc_gap'
  | 'context_reset'
  | 'approval_requested'
  | 'fast_path_engaged'
  | 'test_failure'
  | 'performance_regression'
  | 'dependency_blocked'
  | 'schema_migration_applied';

export type Phase =
  | 'orchestrator'
  | 'spec'
  | 'adr'
  | 'codegen'
  | 'validate'
  | 'security'
  | 'docs'
  | 'change'
  | 'ship';

export type McpMode = 'none' | 'workspace' | 'context' | 'workspace+context';

// ── Typed payloads ────────────────────────────────────────────────────────────

export interface PhaseStartData {
  readonly phase_name: string;
}

export interface PhaseEndData {
  readonly phase_name: string;
  readonly status: 'pass' | 'fail';
  readonly duration_ms: number;
  readonly content_type?: string;
}

export interface SpecGapData {
  readonly question: string;
  readonly phase_name: string;
}

export interface ValidationFailureData {
  readonly failure_type: string;
  readonly phase_name: string;
  readonly attempt_number: number;
  readonly action_id: string;
}

export interface DeviationData {
  readonly component_id: string;
  readonly description: string;
  readonly severity: 'low' | 'medium' | 'high';
}

export interface MigrationProposalData {
  readonly component_id: string;
  readonly proposal_path: string;
  readonly destructive: boolean;
}

export interface ContextPressureData {
  readonly context_fill_pct: number;
  readonly unused_sources: readonly string[];
  readonly trigger: string;
}

export interface McpImpactData {
  readonly mcp_mode: McpMode;
  readonly avg_token_delta: number;
  readonly peak_fill_pct: number;
}

export interface SelfCorrectionData {
  readonly phase_name: string;
  readonly attempt_number: number;
  readonly action_id: string;
  readonly correction_type: string;
}

export interface PhaseSkipData {
  readonly phase_name: string;
  readonly reason: string;
}

export interface SecurityFindingData {
  readonly component_id: string;
  readonly title: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly cwe?: string;
}

export interface RetryLimitExceededData {
  readonly phase_name: string;
  readonly action_id: string;
  readonly attempt_count: number;
}

export interface AdrDecisionData {
  readonly adr_id: string;
  readonly title: string;
  readonly chosen_option: string;
}

export interface DocGapData {
  readonly component_id: string;
  readonly description: string;
}

export interface ContextResetData {
  readonly phase_name: string;
  readonly reason: string;
}

export interface ApprovalRequestedData {
  readonly phase_name: string;
  readonly subject: string;
  readonly action_id: string;
}

export interface FastPathEngagedData {
  readonly change_type: string;
  readonly reason: string;
}

export interface TestFailureData {
  readonly test_name: string;
  readonly phase_name: string;
  readonly attempt_number: number;
  readonly error_summary?: string;
}

export interface PerformanceRegressionData {
  readonly metric: string;
  readonly threshold: number;
  readonly actual: number;
  readonly phase_name: string;
}

export interface DependencyBlockedData {
  readonly phase_name: string;
  readonly dependency: string;
  readonly reason: string;
}

export interface SchemaMigrationAppliedData {
  readonly component_id: string;
  readonly migration_path: string;
  readonly destructive: boolean;
}

export type EventData =
  | PhaseStartData
  | PhaseEndData
  | SpecGapData
  | ValidationFailureData
  | DeviationData
  | MigrationProposalData
  | ContextPressureData
  | McpImpactData
  | SelfCorrectionData
  | PhaseSkipData
  | SecurityFindingData
  | RetryLimitExceededData
  | AdrDecisionData
  | DocGapData
  | ContextResetData
  | ApprovalRequestedData
  | FastPathEngagedData
  | TestFailureData
  | PerformanceRegressionData
  | DependencyBlockedData
  | SchemaMigrationAppliedData;

// ── Common envelope ───────────────────────────────────────────────────────────

export interface TelemetryEvent {
  readonly schema_version: '1.0';
  readonly event: EventType;
  readonly session_id: string;
  readonly initiative_id?: string;
  readonly phase: Phase;
  readonly agent: string;
  readonly tool: string;
  readonly model: string;
  readonly mcp_mode: McpMode;
  readonly timestamp: string;
  readonly model_config?: Record<string, unknown>;
  readonly data?: EventData;
}

// ── Storage row (includes server-assigned fields) ─────────────────────────────

export interface StoredEvent extends TelemetryEvent {
  readonly id: string;
  readonly inserted_at: string;
}
