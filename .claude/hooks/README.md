# Hooks

These are optional starter hooks for keeping project memory consistent.

## Stop Hook

Suggested file:

- `.claude/hooks/stop-memory-reminder.sh`

Purpose:

- Remind the agent to capture durable learnings when a session included fixes, discoveries, or corrections.

## Suggested wiring

Point your Claude Code `Stop` hook to:

- `/Users/yuri_baker/dev/.claude/hooks/stop-memory-reminder.sh`

This hook is intentionally lightweight and non-blocking.

