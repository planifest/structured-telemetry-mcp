#!/usr/bin/env node
/**
 * structured-telemetry-mcp CLI
 *
 * Usage:
 *   structured-telemetry-mcp setup    — Register the MCP server in agent tool config
 *   structured-telemetry-mcp doctor   — Diagnose installation
 */

import * as p from '@clack/prompts';
import color from 'picocolors';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In the bundle, __dirname is the project root (cli.bundle.mjs and server.bundle.mjs are siblings).
// In dev (tsx running src/cli.ts), __dirname is src/ so server.bundle.mjs is one level up.
const BUNDLE_PATH = existsSync(resolve(__dirname, 'server.bundle.mjs'))
  ? resolve(__dirname, 'server.bundle.mjs')
  : resolve(__dirname, '../server.bundle.mjs');
const DEFAULT_DB_PATH = join(homedir(), '.planifest', 'telemetry.db');

// ── Agent tool configs ────────────────────────────────────────────────────────

interface McpEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

function buildMcpEntry(dbPath: string): McpEntry {
  return {
    command: 'node',
    args: [BUNDLE_PATH],
    env: { PLANIFEST_TELEMETRY_DB: dbPath },
  };
}

function findClaudeSettingsPath(): string | null {
  const candidates = [
    join(process.cwd(), '.claude', 'settings.json'),
    join(homedir(), '.claude', 'settings.json'),
  ];
  return candidates.find((p) => existsSync(dirname(p))) ?? candidates[0] ?? null;
}

// ── setup command ─────────────────────────────────────────────────────────────

async function runSetup(): Promise<void> {
  p.intro(color.bgCyan(color.black(' structured-telemetry-mcp setup ')));

  const dbPath = (await p.text({
    message: 'Where should telemetry events be stored?',
    placeholder: DEFAULT_DB_PATH,
    defaultValue: DEFAULT_DB_PATH,
  })) as string;

  if (p.isCancel(dbPath)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  const tool = (await p.select({
    message: 'Which agent tool are you using?',
    options: [
      { value: 'claude-code', label: 'Claude Code' },
      { value: 'cursor', label: 'Cursor' },
      { value: 'other', label: 'Other (manual)' },
    ],
  })) as string;

  if (p.isCancel(tool)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  mkdirSync(dirname(dbPath), { recursive: true });

  if (tool === 'claude-code') {
    const settingsPath = findClaudeSettingsPath();
    if (settingsPath === null) {
      p.log.warn('Could not locate .claude/settings.json. Creating at project root.');
    }
    const target = settingsPath ?? join(process.cwd(), '.claude', 'settings.json');
    registerInClaudeSettings(target, buildMcpEntry(dbPath));
    p.log.success(`Registered in ${target}`);
  } else if (tool === 'cursor') {
    const cursorPath = join(process.cwd(), '.cursor', 'mcp.json');
    registerInCursorMcp(cursorPath, buildMcpEntry(dbPath));
    p.log.success(`Registered in ${cursorPath}`);
  } else {
    p.log.info('Manual configuration required. Add the following to your tool\'s MCP config:');
    p.log.message(JSON.stringify({ 'structured-telemetry-mcp': buildMcpEntry(dbPath) }, null, 2));
  }

  p.outro(color.green('Setup complete. Run `npm run doctor` to verify.'));
}

function registerInClaudeSettings(settingsPath: string, entry: McpEntry): void {
  mkdirSync(dirname(settingsPath), { recursive: true });
  const settings = existsSync(settingsPath)
    ? (JSON.parse(readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '')) as Record<string, unknown>)
    : {};

  const mcpServers = (settings['mcpServers'] ?? {}) as Record<string, unknown>;
  mcpServers['structured-telemetry-mcp'] = entry;
  settings['mcpServers'] = mcpServers;

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

function registerInCursorMcp(mcpPath: string, entry: McpEntry): void {
  mkdirSync(dirname(mcpPath), { recursive: true });
  const existing = existsSync(mcpPath)
    ? (JSON.parse(readFileSync(mcpPath, 'utf8').replace(/^\uFEFF/, '')) as Record<string, unknown>)
    : {};

  const mcpServers = (existing['mcpServers'] ?? {}) as Record<string, unknown>;
  mcpServers['structured-telemetry-mcp'] = entry;
  existing['mcpServers'] = mcpServers;

  writeFileSync(mcpPath, JSON.stringify(existing, null, 2) + '\n');
}

// ── doctor command ────────────────────────────────────────────────────────────

async function runDoctor(): Promise<void> {
  p.intro(color.bgCyan(color.black(' structured-telemetry-mcp doctor ')));

  const checks: Array<{ label: string; pass: boolean; detail?: string }> = [];

  // Check 1: server bundle exists.
  checks.push({
    label: 'server.bundle.mjs exists',
    pass: existsSync(BUNDLE_PATH),
    detail: BUNDLE_PATH,
  });

  // Check 2: DuckDB parent directory writable.
  const dbPath = process.env['PLANIFEST_TELEMETRY_DB'] ?? DEFAULT_DB_PATH;
  const dbDir = dirname(dbPath);
  let dbDirOk = false;
  try {
    mkdirSync(dbDir, { recursive: true });
    dbDirOk = true;
  } catch { /* not writable */ }
  checks.push({ label: 'Telemetry DB directory writable', pass: dbDirOk, detail: dbDir });

  // Check 3: can open DuckDB and write a test event.
  let dbOk = false;
  let dbDetail = '';
  try {
    const { openDatabase, closeDatabase } = await import('./db/index.js');
    const { DuckDbEventRepository } = await import('./db/duckdb-event-repository.js');
    const db = await openDatabase(dbPath);
    const repo = new DuckDbEventRepository(db);
    const result = await repo.write({
      schema_version: '1.0',
      event: 'phase_start',
      session_id: 'doctor-check',
      phase: 'orchestrator',
      agent: 'structured-telemetry-mcp-cli',
      tool: 'cli',
      model: 'n/a',
      mcp_mode: 'none',
      timestamp: new Date().toISOString(),
      data: { phase_name: 'doctor' },
    });
    dbOk = result.ok;
    dbDetail = result.ok ? `event id: ${result.id}` : `error: ${(result as { errors: readonly string[] }).errors.join(', ')}`;
    closeDatabase();
  } catch (err) {
    dbDetail = String(err);
  }
  checks.push({ label: 'DuckDB write test event', pass: dbOk, detail: dbDetail });

  // Print results.
  for (const check of checks) {
    if (check.pass) {
      p.log.success(`${check.label}${check.detail ? ` (${check.detail})` : ''}`);
    } else {
      p.log.error(`${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
    }
  }

  const allPass = checks.every((c) => c.pass);
  p.outro(allPass ? color.green('All checks passed.') : color.red('Some checks failed. See above.'));
  process.exit(allPass ? 0 : 1);
}

// ── Non-interactive setup ─────────────────────────────────────────────────────

async function runSetupNonInteractive(dbPath: string, tool: string): Promise<void> {
  mkdirSync(dirname(dbPath), { recursive: true });
  const entry = buildMcpEntry(dbPath);

  if (tool === 'cursor') {
    const cursorPath = join(process.cwd(), '.cursor', 'mcp.json');
    registerInCursorMcp(cursorPath, entry);
    process.stdout.write(`Registered in ${cursorPath}\n`);
  } else if (tool === 'other') {
    process.stdout.write(JSON.stringify({ 'structured-telemetry-mcp': entry }, null, 2) + '\n');
  } else {
    // Default: claude-code
    const settingsPath = findClaudeSettingsPath() ?? join(process.cwd(), '.claude', 'settings.json');
    registerInClaudeSettings(settingsPath, entry);
    process.stdout.write(`Registered in ${settingsPath}\n`);
  }

  process.stdout.write('Setup complete.\n');
}

// ── Entry ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const nonInteractive = args.includes('--non-interactive');
const dbPathArg = (() => {
  const idx = args.indexOf('--db-path');
  return idx !== -1 ? args[idx + 1] : undefined;
})();
const toolArg = (() => {
  const idx = args.indexOf('--tool');
  return idx !== -1 ? args[idx + 1] : 'claude-code';
})();

switch (command) {
  case 'setup':
    if (nonInteractive) {
      await runSetupNonInteractive(dbPathArg ?? DEFAULT_DB_PATH, toolArg ?? 'claude-code');
    } else {
      await runSetup();
    }
    break;
  case 'doctor':
    await runDoctor();
    break;
  default:
    process.stderr.write('Usage: structured-telemetry-mcp <setup|doctor> [--non-interactive] [--db-path <path>] [--tool <claude-code|cursor|other>]\n');
    process.exit(1);
}
