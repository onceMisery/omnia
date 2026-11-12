CREATE TABLE IF NOT EXISTS tool_call_records (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  caller_signature TEXT,
  caller_type TEXT,
  request_ip TEXT,
  source_node TEXT,
  started_at TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  finished_at TEXT,
  finished_at_ms INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  call_content_json TEXT NOT NULL,
  return_content_json TEXT,
  error_text TEXT,
  has_multimodal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_started_at_ms ON tool_call_records(started_at_ms);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_tool_name ON tool_call_records(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_caller_signature ON tool_call_records(caller_signature);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_status ON tool_call_records(status);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_success ON tool_call_records(success);
