import { runBackendFixture } from './backend-source-runners.mjs';
import { runFrontendFixture } from './frontend-source-runners.mjs';
import { runBoundaryFixture } from './boundary-source-runners.mjs';

const backendRunners = new Set(['visible', 'format-result', 'format-error', 'process-result', 'execute-order',
  'batch', 'normal-round', 'archery-round', 'stdio-bridge', 'stdin', 'stdout', 'environment', 'instructions',
  'placeholders', 'parsed-args', 'handoff', 'interrupt', 'approval-decision', 'approval-rejection', 'approval-timeout']);
const frontendRunners = new Set(['topics', 'replacement-topic', 'agent-directory', 'history-file',
  'history-persistence', 'frontend-request', 'frontend-assistant-origin', 'frontend-url', 'frontend-chunk', 'frontend-sse', 'frontend-interrupt']);
const boundaryRunners = new Set(['sse-timers', 'sse-forward', 'sse-length', 'bearer', 'admin-auth',
  'static-order', 'static-occurrences', 'frontend-settle', 'm1-mapping']);

export function runSourceFixture(runner, input) {
  if (backendRunners.has(runner)) return runBackendFixture(runner, input);
  if (frontendRunners.has(runner)) return runFrontendFixture(runner, input);
  if (boundaryRunners.has(runner)) return runBoundaryFixture(runner, input);
  throw new Error(`Unknown source fixture runner: ${runner}`);
}

export function evidenceOrigin(runner) {
  return ['static-order', 'static-occurrences', 'm1-mapping'].includes(runner)
    ? 'source-derived-static' : 'frozen-source-execution';
}
