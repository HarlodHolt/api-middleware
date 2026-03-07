#!/bin/bash
set -euo pipefail

CONTEXT="$(cat || true)"

STRONG_PATTERNS="fixed|workaround|gotcha|that's wrong|check again|we already|should have|discovered|realized|turns out|root cause|drift"
WEAK_PATTERNS="error|bug|issue|problem|fail|mismatch"

if echo "$CONTEXT" | grep -qiE "$STRONG_PATTERNS"; then
  cat <<'EOF'
{
  "decision": "approve",
  "systemMessage": "This session included fixes or discoveries. Update .claude/rules/ files now if anything durable changed."
}
EOF
elif echo "$CONTEXT" | grep -qiE "$WEAK_PATTERNS"; then
  cat <<'EOF'
{
  "decision": "approve",
  "systemMessage": "If this session changed durable facts, decisions, or priorities, record that in .claude/rules/ before ending."
}
EOF
else
  echo '{"decision":"approve"}'
fi
