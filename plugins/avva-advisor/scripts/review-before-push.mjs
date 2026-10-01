#!/usr/bin/env node
// Rendered by avvamcp scripts/render-advisor-repo.mjs from shared/advisor-hook.ts. Do not edit by hand.
// PreToolUse on Bash: before a git push, fetch the connected avva expert's review packet for exactly what the push sends.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, isAbsolute, join, resolve } from 'node:path'

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
const command = String((input.tool_input && input.tool_input.command) || '')
if (input.tool_name !== 'Bash' || !command.includes('git')) process.exit(0)
// Where the command runs: the hook input says, and the process may have been started elsewhere.
const startDir = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd()

const LIMIT = 8000
const CONTEXT_LIMIT = 4000
const MAX_BUFFER = 64 * 1024 * 1024
const TOO_BIG = Symbol('too big')
const BT = String.fromCharCode(96)
const MARKERS = ['AVVA_APPLIED', 'AVVA_REVIEWED']
const fmt = (n) => n.toLocaleString('en-US')

const allow = (note) => {
  if (note) console.log(JSON.stringify({ systemMessage: 'avva: ' + note }))
  process.exit(0)
}
const deny = (lines) => {
  console.error(lines.join('\n'))
  process.exit(2)
}
const gitIn = (ctx, args, input) => {
  try {
    return execFileSync('git', [...ctx.args, ...args], {
      cwd: ctx.cwd,
      env: { ...process.env, ...ctx.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
      input,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'],
    })
  } catch (error) {
    return error && error.code === 'ENOBUFS' ? TOO_BIG : null
  }
}
const line = (out) => (typeof out === 'string' ? out.trim().split('\n')[0] : '')

// ---------------------------------------------------------------------------
// 1. The command, read the way a shell reads it: quotes, $(...), here-documents
// (the commit message an agent writes), redirections, && ; || | and ( ).
// ---------------------------------------------------------------------------
function readDelimiter(src, j) {
  let strip = false
  if (src[j] === '-') {
    strip = true
    j++
  }
  while (src[j] === ' ' || src[j] === '\t') j++
  let delim = ''
  while (j < src.length && !/[\s;&|<>()]/.test(src[j])) {
    const c = src[j]
    if (c === "'" || c === '"') {
      const k = src.indexOf(c, j + 1)
      if (k < 0) throw new Error('unterminated quote')
      delim += src.slice(j + 1, k)
      j = k + 1
    } else if (c === '\\') {
      delim += src[j + 1] || ''
      j += 2
    } else {
      delim += c
      j++
    }
  }
  return { doc: { delim, strip }, end: j }
}
function skipDocs(src, j, docs) {
  while (docs.length) {
    const { delim, strip } = docs.shift()
    for (;;) {
      if (j >= src.length) throw new Error('unterminated here-document')
      let end = src.indexOf('\n', j)
      if (end < 0) end = src.length
      let text = src.slice(j, end)
      j = end + 1
      if (strip) text = text.replace(/^\t+/, '')
      if (text === delim) break
    }
  }
  return j
}
function skipDouble(src, j) {
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') j += 2
    else if (c === '"') return j + 1
    else if (c === '$' && src[j + 1] === '(') j = skipParen(src, j + 2)
    else if (c === BT) j = skipBacktick(src, j + 1)
    else j++
  }
  throw new Error('unterminated quote')
}
function skipBacktick(src, j) {
  while (j < src.length) {
    if (src[j] === '\\') j += 2
    else if (src[j] === BT) return j + 1
    else j++
  }
  throw new Error('unterminated backtick')
}
function skipParen(src, j) {
  let depth = 1
  const docs = []
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') j += 2
    else if (c === "'") {
      const k = src.indexOf("'", j + 1)
      if (k < 0) throw new Error('unterminated quote')
      j = k + 1
    } else if (c === '"') j = skipDouble(src, j + 1)
    else if (c === BT) j = skipBacktick(src, j + 1)
    else if (c === '(') {
      depth++
      j++
    } else if (c === ')') {
      depth--
      j++
      if (!depth) return j
    } else if (c === '<' && src[j + 1] === '<' && src[j + 2] !== '<') {
      const h = readDelimiter(src, j + 2)
      docs.push(h.doc)
      j = h.end
    } else if (c === '\n') j = skipDocs(src, j + 1, docs)
    else j++
  }
  throw new Error('unterminated $(')
}
function tokenize(src) {
  const out = []
  const docs = []
  let word = null
  let target = null
  let j = 0
  const open = (quoted) => {
    if (!word) word = { text: '', dynamic: false, firstQuoted: quoted, start: j }
    return word
  }
  const flush = () => {
    if (!word) return
    word.end = j
    if (target) {
      target.target = word.text
      target = null
    } else out.push(word)
    word = null
  }
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') {
      if (src[j + 1] !== '\n') open(false).text += src[j + 1] || ''
      j += 2
    } else if (c === "'") {
      const k = src.indexOf("'", j + 1)
      if (k < 0) throw new Error('unterminated quote')
      open(true).text += src.slice(j + 1, k)
      j = k + 1
    } else if (c === '"') {
      const k = skipDouble(src, j + 1)
      const inner = src.slice(j + 1, k - 1)
      const w = open(true)
      w.text += inner.replace(/\\([$"\\])/g, '$1')
      if (inner.includes('$') || inner.includes(BT)) w.dynamic = true
      j = k
    } else if (c === '$' && src[j + 1] === '(') {
      const k = skipParen(src, j + 2)
      const w = open(false)
      w.text += src.slice(j, k)
      w.dynamic = true
      j = k
    } else if (c === BT) {
      const k = skipBacktick(src, j + 1)
      const w = open(false)
      w.text += src.slice(j, k)
      w.dynamic = true
      j = k
    } else if (c === '$') {
      const w = open(false)
      w.text += c
      w.dynamic = true
      j++
    } else if (c === '#' && !word) {
      const k = src.indexOf('\n', j)
      j = k < 0 ? src.length : k
    } else if (c === ' ' || c === '\t') {
      flush()
      j++
    } else if (c === '\n') {
      flush()
      out.push({ op: '\n' })
      j = skipDocs(src, j + 1, docs)
    } else if (c === '<' && src[j + 1] === '<' && src[j + 2] !== '<') {
      flush()
      const h = readDelimiter(src, j + 2)
      docs.push(h.doc)
      j = h.end
    } else if (c === '>' || c === '<' || (c === '&' && src[j + 1] === '>')) {
      if (word && /^\d+$/.test(word.text) && !word.firstQuoted) word = null
      else flush()
      let op = c
      j++
      while (j < src.length && '<>&|'.includes(src[j]) && op.length < 3) op += src[j++]
      const r = { redir: op, target: '' }
      out.push(r)
      while (src[j] === ' ' || src[j] === '\t') j++
      target = r
    } else if (';|&()'.includes(c)) {
      flush()
      const two = src.slice(j, j + 2)
      if (two === '&&' || two === '||' || two === ';;') {
        out.push({ op: two })
        j += 2
      } else {
        out.push({ op: c })
        j++
      }
    } else {
      open(false).text += c
      j++
    }
  }
  flush()
  return out
}

// ---------------------------------------------------------------------------
// 2. What each step does to what a later push sends.
// ---------------------------------------------------------------------------
const LEVELS = ['index', 'tracked', 'all']
const higher = (a, b) => (!a ? b : !b ? a : LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b)
const KEYWORDS = new Set(['!', '{', '}', 'then', 'do', 'else', 'elif', 'if', 'while', 'until', 'time'])
const WRAPPERS = new Set(['command', 'exec', 'nohup', 'builtin', 'noglob'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh'])
// Programs that change no file: anything else may, and a commit after it is not predictable.
const QUIET = new Set(['echo', 'printf', 'true', 'false', ':', 'pwd', 'ls', 'test', '[', 'cat', 'head', 'tail', 'wc', 'grep', 'sleep', 'which', 'date'])
const READ_ONLY = new Set([
  'status', 'log', 'diff', 'show', 'fetch', 'remote', 'rev-parse', 'rev-list', 'describe', 'ls-files', 'ls-tree',
  'ls-remote', 'cat-file', 'blame', 'annotate', 'grep', 'shortlog', 'whatchanged', 'for-each-ref', 'show-ref',
  'show-branch', 'merge-base', 'name-rev', 'version', 'help', 'var', 'check-ignore', 'check-attr', 'count-objects',
  'verify-commit', 'verify-tag', 'range-diff', 'format-patch', 'archive', 'diff-tree', 'diff-index', 'diff-files',
  'cherry', 'reflog', 'gc', 'maintenance', 'fsck', 'difftool', 'request-pull',
])
// Steps that change the index or the work tree and no ref: they matter only to a commit after them.
const TREE_ONLY = new Set(['rm', 'mv', 'restore', 'apply', 'clean', 'stash'])
const KNOWN = new Set([...READ_ONLY, ...TREE_ONLY, 'push', 'commit', 'add', 'stage', 'checkout', 'switch', 'branch', 'tag', 'config', 'worktree'])

const pushes = []
const markers = new Set()
const notRun = []
let lostRepo = null
const dirOf = new Map()
const repos = new Map()

const expandHome = (p) => (p === '~' ? homedir() : p.startsWith('~/') ? join(homedir(), p.slice(2)) : p)
function repoOf(ctx) {
  if (ctx.cwd === null) return null
  const key = JSON.stringify([ctx.cwd, ctx.args, ctx.env])
  if (!dirOf.has(key)) dirOf.set(key, line(gitIn(ctx, ['rev-parse', '--absolute-git-dir'])) || null)
  const dir = dirOf.get(key)
  if (!dir) return null
  if (!repos.has(dir)) {
    const branch = line(gitIn(ctx, ['symbolic-ref', '-q', '--short', 'HEAD'])) || null
    const sha = line(gitIn(ctx, ['rev-parse', '-q', '--verify', 'HEAD'])) || null
    repos.set(dir, { dir, ctx, branch, tips: new Map([[branch || 'HEAD', { sha, pending: null }]]), index: null, treeLost: null, refsLost: null })
  }
  return repos.get(dir)
}
const current = (state) => state.tips.get(state.branch || 'HEAD')
const refsLost = (state, why) => {
  if (state) state.refsLost = state.refsLost || why
  else lostRepo = lostRepo || why
}

function parseCommit(rest) {
  let level = 'index'
  for (let k = 0; k < rest.length; k++) {
    const w = rest[k].text
    if (w === '--') return k + 1 < rest.length ? { bad: 'git commit with paths' } : { level }
    if (w.startsWith('--')) {
      const name = w.slice(2).split('=')[0]
      if (name === 'all') level = 'tracked'
      else if (name === 'dry-run') return { dry: true }
      else if (['amend', 'interactive', 'patch', 'include', 'only', 'pathspec-from-file'].includes(name)) return { bad: 'git commit --' + name }
      else if (!w.includes('=') && ['message', 'file', 'reuse-message', 'reedit-message', 'fixup', 'squash', 'author', 'date', 'template', 'cleanup', 'trailer'].includes(name)) k++
    } else if (w.startsWith('-') && w.length > 1) {
      for (let c = 1; c < w.length; c++) {
        const ch = w[c]
        if (ch === 'a') level = 'tracked'
        else if (ch === 'p' || ch === 'i' || ch === 'o') return { bad: 'git commit -' + ch }
        else if ('mFCct'.includes(ch)) {
          if (c === w.length - 1) k++
          break
        } else if (ch === 'S' || ch === 'u') break
      }
    } else return { bad: 'git commit with paths' }
  }
  return { level }
}
function parseAdd(rest, atTop) {
  let level = null
  const paths = []
  for (let k = 0; k < rest.length; k++) {
    const w = rest[k].text
    if (w === '--') {
      paths.push(...rest.slice(k + 1).map((x) => x.text))
      break
    }
    if (w === '-A' || w === '--all' || w === '--no-ignore-removal') level = 'all'
    else if (w === '-u' || w === '--update') level = higher(level, 'tracked')
    else if (w === '-n' || w === '--dry-run') return 'none'
    else if (['-v', '--verbose', '-q', '--quiet'].includes(w)) continue
    else if (w.startsWith('-')) return null
    else paths.push(w)
  }
  if (!paths.every((p) => p === ':/' || (p === '.' && atTop))) return null
  if (paths.length) level = level || 'all'
  return level || 'none'
}
function parsePush(rest) {
  const p = { all: false, mirror: false, tags: false, del: false, dry: false, repo: null, pos: [], dynamic: null }
  for (let k = 0; k < rest.length; k++) {
    const w = rest[k]
    if (w.text === '--') {
      p.pos.push(...rest.slice(k + 1))
      break
    }
    if (w.text.startsWith('--')) {
      const name = w.text.slice(2).split('=')[0]
      const value = w.text.includes('=') ? w.text.slice(w.text.indexOf('=') + 1) : null
      if (name === 'all' || name === 'branches') p.all = true
      else if (name === 'mirror') p.mirror = true
      else if (name === 'tags') p.tags = true
      else if (name === 'delete') p.del = true
      else if (name === 'dry-run') p.dry = true
      else if (name === 'repo') {
        const r = value === null ? rest[++k] : { text: value, dynamic: w.dynamic }
        if (r) p.repo = r
      } else if (value === null && ['push-option', 'receive-pack', 'exec'].includes(name)) k++
    } else if (w.text.startsWith('-') && w.text.length > 1) {
      for (let c = 1; c < w.text.length; c++) {
        const ch = w.text[c]
        if (ch === 'n') p.dry = true
        else if (ch === 'd') p.del = true
        else if (ch === 'o') {
          if (c === w.text.length - 1) k++
          break
        }
      }
    } else p.pos.push(w)
  }
  const named = [p.repo, ...p.pos].filter(Boolean)
  const dyn = named.find((x) => x.dynamic)
  if (dyn) p.dynamic = dyn.text
  return p
}

function gitStep(words, env, cwd, raw) {
  const ctx = { cwd, args: [], env: {} }
  for (const [k, v] of Object.entries(env)) if (k.startsWith('GIT_')) ctx.env[k] = v
  let k = 0
  while (k < words.length) {
    const w = words[k].text
    if (w === '-C') {
      const d = words[k + 1]
      if (!d || d.dynamic) ctx.cwd = null
      else if (isAbsolute(expandHome(d.text))) ctx.cwd = resolve(expandHome(d.text))
      else if (ctx.cwd !== null) ctx.cwd = resolve(ctx.cwd, d.text)
      k += 2
    } else if (w === '-c') {
      if (words[k + 1]) ctx.args.push('-c', words[k + 1].text)
      k += 2
    } else if (/^--(git-dir|work-tree|namespace)=/.test(w)) {
      ctx.args.push(w)
      k++
    } else if (/^--(git-dir|work-tree|namespace)$/.test(w)) {
      if (words[k + 1]) ctx.args.push(w + '=' + words[k + 1].text)
      k += 2
    } else if (w.startsWith('-')) k++
    else break
  }
  if (k >= words.length) return
  let sub = words[k].text
  let rest = words.slice(k + 1)
  // A git alias is expanded the way git expands it; a shell alias cannot be followed.
  for (let n = 0; n < 5 && !KNOWN.has(sub) && ctx.cwd !== null; n++) {
    const alias = gitIn(ctx, ['config', '--get', 'alias.' + sub])
    if (typeof alias !== 'string') break
    const text = alias.trim()
    if (text.startsWith('!')) {
      const why = 'git ' + sub + ' is a shell alias the hook cannot follow'
      if (/\bpush\b/.test(text)) pushes.push({ lost: why, raw })
      refsLost(repoOf(ctx), why)
      return
    }
    const expanded = tokenize(text).filter((t) => !t.op && !t.redir)
    if (!expanded.length) break
    sub = expanded[0].text
    rest = expanded.slice(1).concat(rest)
  }
  // The commands an agent runs most (status, log, diff) cost no git process here.
  if (READ_ONLY.has(sub)) return
  const state = repoOf(ctx)
  const has = (...flags) => rest.some((a) => flags.includes(a.text.split('=')[0]))
  if (sub === 'push') {
    const p = parsePush(rest)
    if (p.dry) return pushes.push({ dry: true, raw })
    if (ctx.cwd === null) return pushes.push({ lost: 'the hook cannot tell which directory this push runs in', raw })
    if (p.dynamic) return pushes.push({ lost: 'the push names ' + p.dynamic + ', which the hook cannot expand', raw })
    if (!state) return pushes.push(lostRepo ? { lost: lostRepo, raw } : { notRepo: ctx.cwd, raw })
    if (state.refsLost || lostRepo) return pushes.push({ lost: state.refsLost || lostRepo, raw })
    const tips = new Map([...state.tips].map(([name, tip]) => [name, { ...tip }]))
    return pushes.push({ p, ctx, state, branch: state.branch, tips, notRun: [...notRun], raw })
  }
  if (sub === 'commit') {
    const c = parseCommit(rest)
    if (c.dry) return
    if (!state) return refsLost(null, 'git commit runs where the hook cannot follow')
    if (c.bad) return refsLost(state, c.bad + ' changes what the push sends in a way the hook cannot predict')
    const before = state.treeLost || (notRun.length ? notRun[0] + ' runs before the commit, and the hook cannot see what it changes' : null)
    if (before) return refsLost(state, before)
    const tip = current(state)
    tip.pending = higher(tip.pending, higher(state.index || 'index', c.level))
    return
  }
  if (sub === 'add' || sub === 'stage') {
    if (!state) return refsLost(null, 'git add runs where the hook cannot follow')
    const prefix = gitIn(ctx, ['rev-parse', '--show-prefix'])
    const atTop = typeof prefix === 'string' && line(prefix) === ''
    const level = parseAdd(rest, atTop)
    if (level === null) state.treeLost = state.treeLost || 'git add with paths or options the hook cannot predict'
    else if (level !== 'none') state.index = higher(state.index, level)
    return
  }
  if (sub === 'checkout' || sub === 'switch') {
    const at = rest.findIndex((a) => ['-b', '-B', '-c', '-C'].includes(a.text))
    const others = rest.filter((a, i) => i !== at && i !== at + 1 && !['-q', '--quiet', '--no-track'].includes(a.text))
    if (state && at >= 0 && rest[at + 1] && !rest[at + 1].dynamic && !others.length) {
      state.tips.set(rest[at + 1].text, { ...current(state) })
      state.branch = rest[at + 1].text
      return
    }
    return refsLost(state, 'git ' + sub + ' changes what the push sends in a way the hook cannot predict')
  }
  if (sub === 'branch') {
    const positional = rest.filter((a) => !a.text.startsWith('-'))
    if (!positional.length || has('--list', '-l')) return
    if (state && positional.length === 1 && rest.length === 1 && !positional[0].dynamic) {
      state.tips.set(positional[0].text, { ...current(state) })
      return
    }
    return refsLost(state, 'git branch changes what the push sends in a way the hook cannot predict')
  }
  if (sub === 'tag' && (!rest.length || has('-l', '--list'))) return
  if (sub === 'config' && has('--get', '--get-all', '--get-regexp', '--list', '-l', 'get', 'list')) return
  if ((sub === 'stash' || sub === 'worktree') && rest[0] && ['list', 'show'].includes(rest[0].text)) return
  if (TREE_ONLY.has(sub)) {
    if (state) state.treeLost = state.treeLost || 'git ' + sub + ' runs before the commit'
    else refsLost(null, 'git ' + sub + ' runs where the hook cannot follow')
    return
  }
  refsLost(state, 'git ' + sub + ' changes what the push sends in a way the hook cannot predict')
}

function step(words, writes, cwd, raw) {
  const env = {}
  let k = 0
  for (;;) {
    const w = words[k]
    if (!w) return cwd
    const eq = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(w.text)
    if (eq && !w.firstQuoted) {
      env[eq[1]] = w.text.slice(eq[0].length)
      k++
    } else if (KEYWORDS.has(w.text) || WRAPPERS.has(w.text)) k++
    else if (w.text === 'env' || w.text === 'sudo' || w.text === 'nice' || w.text === 'timeout') {
      const wrapper = w.text
      k++
      while (words[k] && words[k].text.startsWith('-')) k += ['-u', '-g', '-n', '-s', '-k', '-C'].includes(words[k].text) ? 2 : 1
      if (wrapper === 'timeout') k++
    } else break
  }
  for (const m of MARKERS) if (env[m]) markers.add(env[m])
  const name = words[k].text
  const args = words.slice(k + 1)
  if (name === 'cd' || name === 'pushd') {
    const t = args.find((a) => a.text === '-' || !/^-[LPe@]*$/.test(a.text))
    if (!t) return homedir()
    if (t.dynamic || t.text === '-') return null
    const target = expandHome(t.text)
    if (isAbsolute(target)) return resolve(target)
    return cwd === null ? null : resolve(cwd, target)
  }
  if (name === 'popd') return null
  if (SHELLS.has(basename(name))) {
    const c = args.findIndex((a) => /^-[a-z]*c[a-z]*$/.test(a.text))
    if (c >= 0 && args[c + 1]) walk(args[c + 1].text, cwd)
    else notRun.push(name)
    return cwd
  }
  if (name === 'eval') {
    walk(args.map((a) => a.text).join(' '), cwd)
    return cwd
  }
  if (basename(name) === 'git' || basename(name) === 'git.exe') {
    gitStep(args, env, cwd, raw)
    return cwd
  }
  if (writes || !QUIET.has(basename(name))) notRun.push(basename(name))
  return cwd
}

function walk(src, start) {
  let cwd = start
  const stack = []
  let words = []
  let writes = false
  const run = () => {
    if (words.length) cwd = step(words, writes, cwd, src.slice(words[0].start, words[words.length - 1].end))
    words = []
    writes = false
  }
  for (const t of tokenize(src)) {
    if (t.op) {
      run()
      if (t.op === '(') stack.push(cwd)
      else if (t.op === ')' && stack.length) cwd = stack.pop()
    } else if (t.redir) {
      if (!/^(\/dev\/null|&?\d+|-|&-)$/.test(t.target) && t.redir !== '<' && t.redir !== '<<<') writes = true
    } else words.push(t)
  }
  run()
}

let unreadable = false
try {
  walk(command, startDir)
} catch {
  // A command the reader could not follow is said out loud when it may push, never let through silently.
  unreadable = /\bgit\b[\s\S]*\bpush\b/.test(command)
}
const live = pushes.filter((p) => !p.dry)
// Not a push, or only a --dry-run, which sends nothing: no decision, no request.
if (!live.length && !unreadable) process.exit(0)

// ---------------------------------------------------------------------------
// 3. The connected expert: an avva-* HTTP server that is not avva-studio (the
// extractor). Looked up in Claude Code's own precedence (local scope, then
// the project's .mcp.json, then user scope) and in every directory that can
// name this project: the cwd, CLAUDE_PROJECT_DIR and the repository root. A
// push from a subdirectory looked only under projects[cwd], found nothing and
// went out unreviewed; a user-scope expert was taken before the project's own.
// ---------------------------------------------------------------------------
const read = (file, pick) => {
  try {
    return pick(JSON.parse(readFileSync(file, 'utf8'))) || {}
  } catch {
    return {}
  }
}
const top = line(gitIn({ cwd: startDir, args: [], env: {} }, ['rev-parse', '--show-toplevel']))
const dirs = [...new Set([startDir, process.env.CLAUDE_PROJECT_DIR, top].filter(Boolean))]
const claudeJson = join(homedir(), '.claude.json')
const scopes = [
  ...dirs.map((dir) => ['this project (local scope)', read(claudeJson, (j) => j.projects && j.projects[dir] && j.projects[dir].mcpServers)]),
  ...dirs.map((dir) => ['this project (.mcp.json)', read(join(dir, '.mcp.json'), (j) => j.mcpServers)]),
  ['every project (user scope)', read(claudeJson, (j) => j.mcpServers)],
]
const experts = []
for (const [scope, entries] of scopes) {
  for (const [name, s] of Object.entries(entries)) {
    if (!name.startsWith('avva-') || name === 'avva-studio' || !s || typeof s.url !== 'string') continue
    if (!experts.some((e) => e.name === name)) experts.push({ name, server: s, scope })
  }
}
if (!experts.length) allow('no avva expert MCP is connected in this project, so no review packet was fetched for this push')
const { name, server, scope } = experts[0]
// Which expert, and why that one: two connected experts used to mean the
// first by key order, silently.
const others = experts.slice(1).map((e) => e.name)
const chosen =
  name + ', connected for ' + scope +
  (others.length ? '; also connected and not used for this push: ' + others.join(', ') + '. Remove or rename the one you do not want consulted on pushes' : '')

// A form the hook cannot predict is denied with the way to make it predictable.
const lost = unreadable ? { lost: 'the hook could not read this command', raw: command } : live.find((p) => p.lost)
if (lost) {
  deny([
    'avva: no review packet was fetched for this push: ' + lost.lost + '. This hook runs before any part of the command, so it cannot see what the push will send.',
    'Run the steps before the push as their own command first, then the push on its own (' + lost.raw.trim() + '); the hook then fetches the packet for exactly what the push sends.',
  ])
}

// ---------------------------------------------------------------------------
// 4. What each pushed ref sends: the commits it has that the destination
// remote's tracking refs lack, diffed from their merge base, plus the commit
// this command makes first when it makes one.
// ---------------------------------------------------------------------------
const FLAGS = ['--no-color', '--no-ext-diff', '--no-textconv']
const short = (ref) => String(ref).replace(/^refs\/(heads|tags)\//, '')
function remoteOf(push) {
  const { p, ctx, branch } = push
  const named = p.repo ? p.repo.text : p.pos.length ? p.pos[0].text : null
  const conf = (key) => line(gitIn(ctx, ['config', '--get', key])) || null
  const remote = named || (branch && (conf('branch.' + branch + '.pushRemote') || conf('remote.pushDefault') || conf('branch.' + branch + '.remote'))) || 'origin'
  if (conf('remote.' + remote + '.url')) return { remote }
  const urls = (gitIn(ctx, ['config', '--get-regexp', '^remote\\..*\\.url$']) || '').split('\n')
  for (const entry of urls) {
    const at = entry.indexOf(' ')
    if (at > 0 && entry.slice(at + 1) === remote) return { remote: entry.slice(7, at - 4) }
  }
  return { remote, unknown: remote + ' is not a configured remote, so the hook cannot tell what it already has' }
}
function resolveSrc(push, src) {
  const { ctx, branch, tips } = push
  if (src === 'HEAD' || src === '@') return branch ? { tip: tips.get(branch), dst: 'refs/heads/' + branch } : { tip: tips.get('HEAD'), dst: null }
  const bare = src.replace(/^refs\/heads\//, '')
  if (tips.has(bare)) return { tip: tips.get(bare), dst: 'refs/heads/' + bare }
  const sha = line(gitIn(ctx, ['rev-parse', '-q', '--verify', src + '^{commit}']))
  if (!sha) return null
  return { tip: { sha, pending: null }, dst: line(gitIn(ctx, ['rev-parse', '--symbolic-full-name', src])) || null }
}
function targetsOf(push, remote) {
  const { p, ctx, branch, tips } = push
  const items = []
  const unknown = []
  const deletes = []
  const add = (label, found, dst) => {
    if (!found || !found.tip) unknown.push(label + ' (it does not resolve to a commit)')
    else items.push({ label: label + ' -> ' + remote + '/' + short(dst || found.dst || label), tip: found.tip })
  }
  const specs = p.repo ? p.pos : p.pos.slice(1)
  for (let k = 0; k < specs.length; k++) {
    let spec = specs[k].text
    if (spec === 'tag' && specs[k + 1]) spec = 'refs/tags/' + specs[++k].text
    spec = spec.replace(/^\+/, '')
    if (spec.includes('*')) {
      unknown.push(spec + ' (a pattern)')
      continue
    }
    const colon = spec.indexOf(':')
    const src = colon < 0 ? spec : spec.slice(0, colon)
    const dst = colon < 0 ? null : spec.slice(colon + 1)
    if (p.del || !src) {
      deletes.push(short(dst || src))
      continue
    }
    add(short(src), resolveSrc(push, src), dst)
  }
  const each = (pattern) => (gitIn(ctx, ['for-each-ref', '--format=%(refname)', pattern]) || '').split('\n').filter(Boolean)
  if (p.all || p.mirror) {
    const heads = new Set([...each('refs/heads/').map(short), ...[...tips.keys()].filter((t) => t !== 'HEAD')])
    for (const head of heads) add(head, resolveSrc(push, head), 'refs/heads/' + head)
  }
  if (p.tags || p.mirror) for (const tag of each('refs/tags/')) add(short(tag), resolveSrc(push, tag), tag)
  if (!specs.length && !p.all && !p.mirror && !p.tags && !p.del) {
    const conf = (key) => line(gitIn(ctx, ['config', '--get', key])) || null
    const mode = conf('push.default') || 'simple'
    if (conf('remote.' + remote + '.push')) unknown.push('the refs remote.' + remote + '.push names (configured, not read by the hook)')
    else if (mode === 'matching') {
      for (const head of each('refs/heads/').map(short)) if (line(gitIn(ctx, ['rev-parse', '-q', '--verify', 'refs/remotes/' + remote + '/' + head]))) add(head, resolveSrc(push, head), 'refs/heads/' + head)
    } else if (mode !== 'nothing') {
      if (!branch) unknown.push('HEAD (detached, and the push names no branch)')
      else {
        const merge = conf('branch.' + branch + '.remote') === remote ? conf('branch.' + branch + '.merge') : null
        add(branch, resolveSrc(push, branch), merge || 'refs/heads/' + branch)
      }
    }
  }
  return { items, unknown, deletes }
}
function withUntracked(ctx, run) {
  const topDir = line(gitIn(ctx, ['rev-parse', '--show-toplevel']))
  const realIndex = line(gitIn(ctx, ['rev-parse', '--git-path', 'index']))
  const tmp = mkdtempSync(join(tmpdir(), 'avva-hook-'))
  try {
    const index = join(tmp, 'index')
    const real = realIndex ? resolve(ctx.cwd, realIndex) : ''
    if (real && existsSync(real)) copyFileSync(real, index)
    const temp = { cwd: topDir || ctx.cwd, args: [...ctx.args, '--literal-pathspecs'], env: { ...ctx.env, GIT_INDEX_FILE: index } }
    const untracked = gitIn(temp, ['ls-files', '-z', '--others', '--exclude-standard'])
    // Intent-to-add only: the user's own index is never written, and no file content is stored.
    if (untracked) gitIn(temp, ['add', '-N', '--pathspec-from-file=-', '--pathspec-file-nul'], untracked)
    return run(temp)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
function contentOf(ctx, remote, tip) {
  let base = line(gitIn(ctx, ['hash-object', '-t', 'tree', '--stdin'], ''))
  let commits = 0
  if (!tip.sha && !tip.pending) return { nothing: true }
  if (tip.sha) {
    const out = gitIn(ctx, ['rev-list', '--boundary', tip.sha, '--not', '--remotes=' + remote])
    if (typeof out !== 'string') return { why: 'git rev-list could not list its commits' }
    const lines = out.split('\n').filter(Boolean)
    const bounds = lines.filter((l) => l.startsWith('-')).map((l) => l.slice(1))
    commits = lines.length - bounds.length
    if (!commits && !tip.pending) return { nothing: true }
    if (!commits) base = tip.sha
    else if (bounds.length) base = line(gitIn(ctx, ['merge-base', tip.sha, ...bounds])) || base
  }
  const range = !tip.pending ? [base, tip.sha] : tip.pending === 'index' ? ['--cached', base] : [base]
  const run = (c) => ({ patch: gitIn(c, ['diff', ...FLAGS, ...range]), names: gitIn(c, ['diff', ...FLAGS, '--name-status', ...range]) })
  const { patch, names } = tip.pending === 'all' ? withUntracked(ctx, run) : run(ctx)
  if (patch === TOO_BIG || names === TOO_BIG) return { why: 'its diff is larger than the hook reads (' + MAX_BUFFER / 1024 / 1024 + ' MB)' }
  if (typeof patch !== 'string' || typeof names !== 'string') return { why: 'git diff failed' }
  if (!patch.trim()) return { nothing: true }
  return { patch, names: names.split('\n').filter(Boolean), commits, pending: tip.pending }
}

const reviewed = []
const nothing = []
const unknown = []
const deletes = []
const skipped = new Set()
const seen = new Set()
for (const push of live) {
  if (push.notRepo) {
    unknown.push('everything (' + push.notRepo + ' is not a git repository the hook can read)')
    continue
  }
  const r = remoteOf(push)
  if (r.unknown) {
    unknown.push('everything this push sends (' + r.unknown + ')')
    continue
  }
  const t = targetsOf(push, r.remote)
  unknown.push(...t.unknown)
  deletes.push(...t.deletes.map((d) => r.remote + '/' + d))
  for (const n of push.notRun) skipped.add(n)
  for (const item of t.items) {
    const key = r.remote + ' ' + item.tip.sha + ' ' + item.tip.pending
    if (seen.has(key)) continue
    seen.add(key)
    const c = contentOf(push.ctx, r.remote, item.tip)
    if (c.why) unknown.push(item.label + ' (' + c.why + ')')
    else if (c.nothing) nothing.push(item.label)
    else reviewed.push({ ...c, label: item.label })
  }
}
const notReviewed = unknown.length ? 'Not reviewed, because the hook cannot tell what it sends: ' + unknown.join('; ') + '.' : ''
const notSimulated = skipped.size ? ' Not simulated: ' + [...skipped].join(', ') + ' runs before the push, and anything it commits is not in this packet.' : ''
if (!reviewed.length) {
  const parts = [
    notReviewed && 'no review packet was fetched for this push. ' + notReviewed,
    nothing.length && 'nothing outgoing to review for ' + nothing.join(', ') + ': the remote already has it.',
    deletes.length && 'this push deletes ' + deletes.join(', ') + ', and a deletion has nothing to review.',
  ].filter(Boolean)
  allow((parts.join(' ') || 'nothing outgoing to review.') + notSimulated)
}

// ---------------------------------------------------------------------------
// 5. The packet: the diff cut at a file boundary, the file table in context,
// the digest bound to the refs and to exactly this content.
// ---------------------------------------------------------------------------
const describe = (r) =>
  (r.commits ? r.commits + (r.commits === 1 ? ' commit' : ' commits') : '') +
  (r.pending ? (r.commits ? ' plus ' : '') + 'the commit this command makes first' : '')
const digest = createHash('sha256')
  .update(reviewed.map((r) => r.label + '\n' + r.patch).join('\0'))
  .digest('hex')
  .slice(0, 12)
if ([...markers].includes(digest)) allow(notReviewed || null)

const files = []
for (const r of reviewed) {
  const starts = []
  const re = /^diff --git /gm
  let m
  while ((m = re.exec(r.patch))) starts.push(m.index)
  if (!starts.length || starts[0] > 0) starts.unshift(0)
  const chunks = starts.map((s, i) => r.patch.slice(s, starts[i + 1] === undefined ? r.patch.length : starts[i + 1]))
  chunks.forEach((chunk, i) => {
    const entry = chunks.length === r.names.length ? r.names[i].split('\t') : null
    const path = entry ? entry.slice(1).join(' -> ') : (/^diff --git a\/(\S+)/.exec(chunk) || [])[1] || 'a file'
    files.push({ chunk, path, head: i === 0 && reviewed.length > 1 ? '# ' + r.label + '\n' : '' })
  })
}
const total = files.reduce((n, f) => n + f.head.length + f.chunk.length, 0)
let proposal = ''
let sent = 0
let partly = ''
const unsent = []
for (const f of files) {
  const piece = f.head + f.chunk
  if (!unsent.length && !partly && proposal.length + piece.length <= LIMIT) {
    proposal += piece
    sent++
  } else if (!proposal) {
    // The first file alone is over the cap: send its start, cut at a line where one is near.
    const cut = piece.lastIndexOf('\n', LIMIT - 1)
    proposal = piece.slice(0, cut > LIMIT / 2 ? cut + 1 : LIMIT)
    partly = f.path
  } else unsent.push(f.path)
}
const portion =
  proposal.length === total
    ? 'the whole diff'
    : 'the first ' + fmt(proposal.length) + ' of ' + fmt(total) + ' characters of the diff (' +
      (partly ? 'part of ' + partly : sent + ' of ' + files.length + ' files') + ')'
const pushing = reviewed.map((r) => r.label + ' (' + describe(r) + ')').join('; ')
let context =
  'A git push: ' + pushing + '. The proposal is ' + portion + ', as the push would land it on the remote.' +
  (proposal.length < total ? ' The rest was not seen.' : '') +
  ' Files in this push (git diff --name-status):'
const table = reviewed.flatMap((r) => r.names.map((n) => n.replace(/\t/g, ' ')))
for (let i = 0; i < table.length; i++) {
  // Room is kept for the line that says how many did not fit.
  if (context.length + table[i].length + 1 > CONTEXT_LIMIT - 40) {
    context += '\n... and ' + (table.length - i) + ' more files'
    break
  }
  context += '\n' + table[i]
}
const body = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'review', arguments: { context: context.slice(0, CONTEXT_LIMIT), proposal } },
}
const ci = ['CI', 'GITHUB_ACTIONS'].some((k) => process.env[k] && process.env[k] !== 'false' && process.env[k] !== '0')
let packet = null
// Why there is no packet, when the server said. "Did not answer" was printed
// for a 401 dead key, a spent daily allowance and a -32002 outage alike, and
// each has a different fix the user can make only if told which.
let refusal = ''
try {
  const res = await fetch(server.url, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'x-avva-client': ci ? 'advisor-hook-ci/0.6.0' : 'advisor-hook/0.6.0',
      ...(server.headers || {}),
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) refusal = 'HTTP ' + res.status
  const json = JSON.parse(text.startsWith('{') ? text : (text.match(/data: (.*)/) || [])[1] || '{}')
  const said =
    (json.error && json.error.message) ||
    (json.result && json.result.isError && ((json.result.content || []).find((c) => c.type === 'text') || {}).text)
  if (said) refusal = String(said).slice(0, 500)
  const content = json.result && !json.result.isError ? json.result.content || [] : []
  packet = (content.find((c) => c.type === 'text') || {}).text || null
} catch {
  packet = null
}
if (!packet) {
  allow(
    (refusal
      ? name + ' refused the request, so no review packet was fetched for this push. It said: ' + refusal
      : name + ' did not answer, so no review packet was fetched for this push') + (notReviewed ? ' ' + notReviewed : ''),
  )
}

const shown = unsent.slice(0, 40).join(', ') + (unsent.length > 40 ? ' and ' + (unsent.length - 40) + ' more' : '')
const opener = /^\s*[({!]/.test(command) ? 'AVVA_APPLIED=' + digest + ' true && ' : 'AVVA_APPLIED=' + digest + ' '
deny([
  'avva: fetched ' + name + "'s review packet for " + portion + ' (' + digest + '). Nothing has judged this diff yet: apply the packet, put your verdict first, then revise, or push the same diff again with the marker below.',
  'Pushing: ' + pushing + '.' + notSimulated,
  'Packet from ' + chosen + '.',
  ...(partly ? ['Sent only in part: ' + partly + '. Apply the same packet to the rest of it yourself before pushing.'] : []),
  ...(unsent.length ? ['Not sent: ' + shown + '. Apply the same packet to these files yourself before pushing.'] : []),
  ...(notReviewed ? [notReviewed] : []),
  'If your verdict is reject, revise before pushing. Otherwise push the same diff again with the marker in front:',
  '  ' + opener + command,
  '',
  packet,
])
