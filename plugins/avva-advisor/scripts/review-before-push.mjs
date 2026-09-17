#!/usr/bin/env node
// Rendered by avvamcp scripts/render-advisor-repo.mjs from shared/advisor-hook.ts. Do not edit by hand.
// PreToolUse on Bash: before a git push, the connected avva expert reviews the outgoing diff.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
const command = String((input.tool_input && input.tool_input.command) || '')
if (input.tool_name !== 'Bash' || !/(^|[;&|(\s])git\s+(?:-C\s+\S+\s+)?push\b/.test(command)) process.exit(0)

const allow = (note) => {
  console.log(JSON.stringify({ systemMessage: 'avva: ' + note }))
  process.exit(0)
}
const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}
const servers = (file, pick) => {
  try {
    return pick(JSON.parse(readFileSync(file, 'utf8'))) || {}
  } catch {
    return {}
  }
}

// The connected expert: the first avva-* HTTP server that is not avva-studio (the extractor), from ~/.claude.json or the project's .mcp.json — the same rule the skill states.
const cwd = process.cwd()
const candidates = {
  ...servers(join(homedir(), '.claude.json'), (j) => j.mcpServers),
  ...servers(join(homedir(), '.claude.json'), (j) => j.projects && j.projects[cwd] && j.projects[cwd].mcpServers),
  ...servers(join(process.env.CLAUDE_PROJECT_DIR || cwd, '.mcp.json'), (j) => j.mcpServers),
  ...servers(join(cwd, '.mcp.json'), (j) => j.mcpServers),
}
const found = Object.entries(candidates).find(
  ([name, s]) => name.startsWith('avva-') && name !== 'avva-studio' && s && typeof s.url === 'string',
)
if (!found) allow('no avva expert MCP is connected in this project, so this push was not reviewed')
const [name, server] = found

const outgoing = git('diff', '@{upstream}...HEAD') ?? git('diff', 'origin/HEAD...HEAD')
const diff = (outgoing && outgoing.trim() ? outgoing : git('diff', '--cached')) || ''
if (!diff.trim()) allow('nothing outgoing to review')
const digest = createHash('sha256').update(diff).digest('hex').slice(0, 12)
if (command.includes('AVVA_REVIEWED=' + digest)) process.exit(0)

const branch = (git('rev-parse', '--abbrev-ref', 'HEAD') || '').trim()
const body = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'review',
    arguments: {
      context: 'A git push from branch ' + branch + '. The proposal is the outgoing diff, as it would land on the remote.',
      proposal: diff.slice(0, 8000),
    },
  },
}
let packet = null
try {
  const res = await fetch(server.url, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(server.headers || {}) },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  const json = JSON.parse(text.startsWith('{') ? text : (text.match(/data: (.*)/) || [])[1] || '{}')
  const content = json.result && !json.result.isError ? json.result.content || [] : []
  packet = (content.find((c) => c.type === 'text') || {}).text || null
} catch {
  packet = null
}
if (!packet) allow(name + ' did not answer, so this push was not reviewed')

console.error(
  [
    'avva: ' + name + ' reviewed the outgoing diff (' + digest + '). Apply the packet below and report the verdict first.',
    'If the verdict is reject, revise before pushing. Otherwise push the same diff again with the marker in front:',
    '  AVVA_REVIEWED=' + digest + ' ' + command,
    '',
    packet,
  ].join('\n'),
)
process.exit(2)
