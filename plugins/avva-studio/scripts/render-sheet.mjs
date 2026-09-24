#!/usr/bin/env node
// Rendered by avvamcp scripts/render-advisor-repo.mjs from shared/studio-plugin.ts. Do not edit by hand.
// Renders the approval sheet from the decisions json: what you read here is what would be sent.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const FIELDS = {"title":{"max":200},"date":{"max":40},"sourceType":{"values":["chat-history","code-and-reviews","issues-and-roadmaps","documents","customer-systems","guided-recall","other"]},"origin":{"max":80},"context":{"max":4000},"decision":{"required":true,"max":8000},"driver":{"max":2000},"condition":{"max":1000},"kind":{"values":["reject","choose","require","accept"]}}
const FLAGS = [{"kind":"email address","source":"\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b","flags":"i"},{"kind":"private or identifying URL","source":"\\bhttps?:\\/\\/\\S+","flags":"i"},{"kind":"credential or secret","source":"\\b(?:api[_ -]?key|secret|password)\\b\\s*[:=]|(?<![\\p{L}\\p{N}_])(?:секретн\\p{L}*\\s+ключ\\p{L}*|ключ\\s+доступа|парол\\p{L}*)\\s*[:=]|\\btoken\\b\\s*[:=]\\s*[\"'\\u0060]?[A-Za-z0-9_\\-./+]{12,}|(?<![\\p{L}\\p{N}_])токен\\p{L}*\\s*[:=]\\s*[\"'\\u0060]?[A-Za-z0-9_\\-./+]{12,}|\\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|\\bavk_[A-Za-z0-9_-]{16,}","flags":"iu"},{"kind":"ticket or repository identifier","source":"\\b(?:JIRA|ticket|issue|PR|repo(?:sitory)?)\\b\\s*(?:#|:)\\s*[A-Z0-9_-]{2,}\\b","flags":"i"},{"kind":"NDA or confidential marker","source":"\\b(?:strictly private|internal only|internal use only)\\b|\\bCONFIDENTIAL\\b|(?<![\\p{L}\\p{N}_])КОНФИДЕНЦИАЛЬНО(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])СЕКРЕТНО(?![\\p{L}\\p{N}_])|\\b(?:this|that|our|their|the client'?s|the customer'?s)\\s+(?:\\w+\\s+){0,2}(?:NDA|confidentiality agreement)\\b|\\bunder (?:an )?NDA with\\b","flags":"u"},{"kind":"phone number","source":"(?:\\+\\d{1,3}[\\s().-]*)?(?:\\d[\\s().-]*){9,}","flags":""},{"kind":"passport or national-id marker","source":"(?<![\\p{L}\\p{N}_])(?:паспорт\\p{L}*|passport|ssn)(?![\\p{L}\\p{N}_])","flags":"iu"},{"kind":"secret or confidential (RU)","source":"(?<![\\p{L}\\p{N}_])(?:эт(?:от|а|у|ой|ом)|наш\\p{L}*|их|клиентск\\p{L}*)\\s+(?:\\p{L}+\\s+){0,2}(?:НДА|соглашени\\p{L}*\\s+о\\s+неразглашении)(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(?:строго\\s+конфиденциальн\\p{L}*|только\\s+для\\s+внутреннего\\s+использования)(?![\\p{L}\\p{N}_])","flags":"iu"},{"kind":"sensitive structure (card number, contact or credential shape)","source":"(\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}|[\\w.+-]+@[\\w-]+\\.[\\w.]{2,}|\\+?\\d[\\d\\s()-]{9,}\\d|password\\s*[:=]|api[_-]?key\\s*[:=])","flags":"i"},{"kind":"passport or secret marker","source":"(?<![\\p{L}\\p{N}_])(?:паспорт\\p{L}*|passport|ssn|секретн\\p{L}*)(?![\\p{L}\\p{N}_])","flags":"iu"},{"kind":"self-reference: avva or its extraction tooling named in the record","source":"(?<![\\p{L}\\p{N}_])avva(?![\\p{L}\\p{N}_])|\\b(?:mcp[- ]studio|begin_extraction|submit_decisions|submit_model)\\b|\\bdecision[- ]model platform\\b|платформ\\p{L}*\\s+(?:для\\s+)?модел\\p{L}*\\s+решений","flags":"iu"}].map((f) => ({ kind: f.kind, re: new RegExp(f.source, f.flags) }))
const STRINGS = {"en":{"title":"Approval sheet","nothingSent":"Nothing has been sent to avva yet.","exactly":"These exact records are what would be sent if you approve, and nothing else: no struck items, no documents, none of the rest of your history.","placeholders":"Names, clients, repositories, ticket ids, private URLs and deal amounts are replaced with bracketed placeholders; policy thresholds stay, because they are rules, not identifiers.","notStored":"The approved text builds the draft and is not stored by avva. This file is the record; the flags below are hints.","whatIsRecord":"What a record is","definition":"One decision you made, as a stranger could recognize it: the situation (what was on the table and what pulled the other way), what you ruled, the reason you stated, the condition that limited it, and what kind of call it was. In your own words, from a source the assistant read.","firstRecord":"The first record, in full","groups":"Groups by origin","group":"group","records":"records","noOrigin":"no origin label","outsideRange":"outside your range","rangeRead":"Range read as {from} to {to}; dated records outside it are in their own group.","rangeUnread":"The range \"{range}\" could not be read as dates, so no outside-range group was built.","exceptions":"Least-sure records, in full","exceptionsFrame":"The records the assistant is least sure are clean after redaction. They are the least-sure ones, not the only risky ones; the full list below is the record.","exceptionsCap":"Capped at {cap}: {n} more were named and are not shown here.","noExceptions":"The assistant named none.","flags":"Mechanical flags","flagsFrame":"Pattern matches, the same ones avva runs at publish, plus a check for records about avva itself. A match is a reason to look, not a verdict; what a shape still gives away is the assistant’s call.","noFlags":"No pattern matched.","question":"Send these {n} to avva? Their text builds the draft and is not stored. Strike by group or by number.","allRecords":"All records, in full","number":"No.","date":"date","sourceKind":"source","origin":"origin","recordTitle":"title","context":"situation","decision":"decision","driver":"reason","condition":"condition","kind":"kind","empty":"—"},"ru":{"title":"Лист согласования","nothingSent":"В avva пока ничего не отправлено.","exactly":"Если вы одобрите, будут отправлены ровно эти записи и ничего больше: ни вычеркнутое, ни документы, ни остальная история.","placeholders":"Имена, клиенты, репозитории, номера задач, приватные ссылки и суммы сделок заменены на заполнители в скобках; пороги и правила остаются, потому что это правила, а не идентификаторы.","notStored":"Одобренный текст строит черновик и не хранится в avva. Этот файл и есть запись; флаги ниже лишь подсказки.","whatIsRecord":"Что такое запись","definition":"Одно ваше решение, которое узнал бы посторонний: ситуация (что предлагалось и что тянуло в другую сторону), что вы решили, названная причина, условие, которое ограничивало решение, и какого рода это было решение. Вашими словами, из источника, который прочитал ассистент.","firstRecord":"Первая запись целиком","groups":"Группы по источнику","group":"группа","records":"записей","noOrigin":"без метки источника","outsideRange":"вне вашего диапазона","rangeRead":"Диапазон прочитан как {from} — {to}; датированные записи вне его вынесены в отдельную группу.","rangeUnread":"Диапазон «{range}» не удалось прочитать как даты, поэтому группа вне диапазона не построена.","exceptions":"Записи, в которых ассистент уверен меньше всего, целиком","exceptionsFrame":"Записи, в чистоте которых после редактирования ассистент уверен меньше всего. Это наименее надёжные, а не единственные рискованные; полный список ниже и есть запись.","exceptionsCap":"Ограничено {cap}: ещё {n} названы, но здесь не показаны.","noExceptions":"Ассистент не назвал ни одной.","flags":"Механические флаги","flagsFrame":"Совпадения с шаблонами — теми же, что avva проверяет при публикации, — и проверка на записи о самой avva. Совпадение — повод посмотреть, а не вердикт; что ещё выдаёт форма записи, решает ассистент.","noFlags":"Ни один шаблон не сработал.","question":"Отправить эти {n} в avva? Их текст строит черновик и не хранится. Вычёркивайте группами или по номерам.","allRecords":"Все записи целиком","number":"№","date":"дата","sourceKind":"источник","origin":"откуда","recordTitle":"название","context":"ситуация","decision":"решение","driver":"причина","condition":"условие","kind":"род","empty":"—"}}
const EXCEPTIONS_CAP = 15
const CALL_WORDS = 15
const TEXT_FIELDS = ['title', 'origin', 'context', 'decision', 'driver', 'condition']

// The date-range parser, verbatim from the product (shared/date-range.ts), types stripped.
const MONTHS = 30.4375 * 24 * 60 * 60 * 1e3;
const YEARS = 365.25 * 24 * 60 * 60 * 1e3;
function day(ms) {
	return new Date(ms).toISOString().slice(0, 10);
}
function clampDay(value, end) {
	const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
	if (!m) return null;
	const year = Number(m[1]);
	if (year < 1970 || year > 2100) return null;
	const month = m[2] ? Number(m[2]) : end ? 12 : 1;
	if (month < 1 || month > 12) return null;
	if (m[3]) {
		const d = Number(m[3]);
		if (d < 1 || d > 31) return null;
		return `${m[1]}-${m[2]}-${m[3]}`;
	}
	const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return `${m[1]}-${String(month).padStart(2, "0")}-${end ? String(last).padStart(2, "0") : "01"}`;
}
const WORD_NUMBERS = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	a: 1,
	an: 1,
	один: 1,
	одного: 1,
	два: 2,
	двух: 2,
	три: 3,
	трёх: 3,
	трех: 3,
	четыре: 4,
	пять: 5,
	пяти: 5
};
/**
* Reads the range, or returns null when the words do not state one the code
* can defend. `now` is injectable for tests.
*/
function parseDateRange(words, now = new Date()) {
	const text = words.trim().toLowerCase().replace(/\s+/g, " ");
	if (!text) return null;
	const today = day(now.getTime());
	// "2024-01 to 2025-06", "2021..2023", "2022 – 2024"
	const span = /(\d{4}(?:-\d{2})?(?:-\d{2})?)\s*(?:to|until|through|–|—|-|\.\.|по|до)\s*(\d{4}(?:-\d{2})?(?:-\d{2})?)/.exec(text);
	if (span) {
		const from = clampDay(span[1], false);
		const to = clampDay(span[2], true);
		return from && to && from <= to ? {
			from,
			to
		} : null;
	}
	// "since 2021", "from 2021", "с 2021"
	const since = /(?:since|from|starting|с)\s+(\d{4}(?:-\d{2})?(?:-\d{2})?)/.exec(text);
	if (since) {
		const from = clampDay(since[1], false);
		return from ? {
			from,
			to: today
		} : null;
	}
	// "last year", "the past 18 months", "last two years", "последний год", "последние 2 года"
	const relative = /(?:last|past|previous|последн\p{L}*|прошл\p{L}*)\s+(?:(\d+|\p{L}+)\s+)?(years?|months?|weeks?|год\p{L}*|лет|месяц\p{L}*|недел\p{L}*)/u.exec(text);
	if (relative) {
		const raw = relative[1];
		const n = raw === undefined ? 1 : /^\d+$/.test(raw) ? Number(raw) : WORD_NUMBERS[raw];
		if (!n || n > 50) return null;
		const unit = relative[2];
		const ms = /^week|^недел/u.test(unit) ? 7 * 24 * 60 * 60 * 1e3 : /^month|^месяц/u.test(unit) ? MONTHS : YEARS;
		return {
			from: day(now.getTime() - n * ms),
			to: today
		};
	}
	// "2023", "2023 only", "in 2019"
	const year = /(?:^|\D)((?:19|20)\d{2})(?:\D|$)/.exec(text);
	if (year && !/\d{4}.*\d{4}/.test(text)) {
		const from = clampDay(year[1], false);
		const to = clampDay(year[1], true);
		return from && to ? {
			from,
			to
		} : null;
	}
	return null;
}
/** Dated items outside the range; `null` when the range could not be read. Undated items never count. */
function countOutsideRange(dates, range) {
	if (!range) return null;
	let outside = 0;
	for (const value of dates) {
		const d = (value ?? "").slice(0, 10);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
		if (d < range.from || d > range.to) outside += 1;
	}
	return outside;
}

function fail(lines) {
  for (const line of lines) console.error(line)
  process.exit(1)
}

const args = process.argv.slice(2)
const opts = { range: '', lang: '', exceptions: '' }
// The sheet is a FILE only when asked for. By default this prints the records
// to stdout so the assistant can put them in the chat verbatim: what the user
// reads is then rendered from the json by this script, not retyped by a model,
// and there is no second document to wonder about.
let wantsFile = false
let jsonPath = ''
for (let i = 0; i < args.length; i += 1) {
  const a = args[i]
  if (a === '--range' || a === '--lang' || a === '--exceptions') {
    opts[a.slice(2)] = String(args[i + 1] ?? '')
    i += 1
  } else if (a === '--sheet') wantsFile = true
  else if (a.startsWith('--')) fail(['unknown option ' + a])
  else jsonPath = a
}
if (!jsonPath) fail(['usage: node render-sheet.mjs <avva-decisions-*.json> [--sheet] [--range "<words>"] [--exceptions 3,7] [--lang ru|en]'])

let parsed
try {
  parsed = JSON.parse(readFileSync(jsonPath, 'utf8'))
} catch (error) {
  fail(['cannot read ' + jsonPath + ': ' + (error && error.message)])
}
// The json is the user's RAW approved set and its only copy. For a Claude Code
// user the working directory is usually a git working tree, one git add -A
// from a remote, so say so before anything else. Warnings go to stderr; a
// machine without git, or a file outside any repository, prints nothing.
const git = (argv) => {
  try {
    execFileSync('git', argv, { cwd: dirname(jsonPath), stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
if (git(['rev-parse', '--is-inside-work-tree'])) {
  const file = basename(jsonPath)
  if (git(['ls-files', '--error-unmatch', '--', file])) {
    console.error('WARNING: ' + file + ' is TRACKED by git. It is the user\'s raw approved set and must never be committed or pushed: run git rm --cached -- ' + file + ', add it to .git/info/exclude, and tell the user. Or move it to ~/avva/.')
  } else if (!git(['check-ignore', '-q', '--', file])) {
    console.error('WARNING: ' + file + ' is inside a git working tree and not ignored, so one git add -A commits the user\'s raw approved set. Add it to .git/info/exclude (or move it to ~/avva/) and tell the user.')
  }
}

const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.decisions) ? parsed.decisions : Array.isArray(parsed?.episodes) ? parsed.episodes : null
if (!records) fail(['the json must be the array of records that submit_decisions will receive'])

const errors = []
records.forEach((record, index) => {
  const n = index + 1
  if (!record || typeof record !== 'object' || Array.isArray(record)) return errors.push('record ' + n + ': not an object')
  for (const key of Object.keys(record)) if (!(key in FIELDS)) errors.push('record ' + n + ': unknown field "' + key + '" (allowed: ' + Object.keys(FIELDS).join(', ') + ')')
  for (const [key, spec] of Object.entries(FIELDS)) {
    const value = record[key]
    if (value === undefined) {
      if (spec.required) errors.push('record ' + n + ': "' + key + '" is required')
      continue
    }
    if (typeof value !== 'string') errors.push('record ' + n + ': "' + key + '" must be a string')
    else if (spec.required && !value.trim()) errors.push('record ' + n + ': "' + key + '" is empty')
    else if (spec.max && value.length > spec.max) errors.push('record ' + n + ': "' + key + '" is ' + value.length + ' characters, max ' + spec.max)
    else if (spec.values && value !== '' && !spec.values.includes(value)) errors.push('record ' + n + ': "' + key + '" must be one of ' + spec.values.join(', '))
  }
})
if (errors.length) fail(['the json does not match the wire shape; fix it, then run this again:', ...errors.map((e) => '  ' + e)])
if (records.length === 0) fail(['the json holds no records'])

const cyrillic = (text) => (text.match(/\p{Script=Cyrillic}/gu) || []).length
const latin = (text) => (text.match(/\p{Script=Latin}/gu) || []).length
const sample = records.map((r) => (r.decision || '') + ' ' + (r.context || '')).join(' ')
const lang = opts.lang === 'ru' || opts.lang === 'en' ? opts.lang : cyrillic(sample) > latin(sample) ? 'ru' : 'en'
if (opts.lang && opts.lang !== lang) fail(['--lang must be ru or en'])
const S = STRINGS[lang]
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key]))

const range = opts.range ? parseDateRange(opts.range) : null
const outside = (record) => {
  if (!range) return false
  const d = String(record.date || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && (d < range.from || d > range.to)
}

const groups = new Map()
records.forEach((record, index) => {
  const label = outside(record) ? S.outsideRange : String(record.origin || '').trim() || S.noOrigin
  if (!groups.has(label)) groups.set(label, [])
  groups.get(label).push(index)
})
if (range && groups.has(S.outsideRange)) {
  const rest = groups.get(S.outsideRange)
  groups.delete(S.outsideRange)
  groups.set(S.outsideRange, rest)
}

const flags = []
records.forEach((record, index) => {
  for (const field of TEXT_FIELDS) {
    const value = record[field]
    if (typeof value !== 'string' || !value) continue
    for (const flag of FLAGS) {
      if (flag.re.test(value) && !flags.some((f) => f.n === index + 1 && f.kind === flag.kind)) flags.push({ n: index + 1, kind: flag.kind, field })
    }
  }
})

const named = opts.exceptions ? opts.exceptions.split(/[\s,]+/).filter(Boolean).map(Number) : []
const badNumbers = named.filter((n) => !Number.isInteger(n) || n < 1 || n > records.length)
if (badNumbers.length) fail(['--exceptions names records that do not exist: ' + badNumbers.join(', ')])
const exceptions = [...new Set(named)].slice(0, EXCEPTIONS_CAP)

const call = (record) => {
  const words = String(record.decision).trim().split(/\s+/)
  return words.slice(0, CALL_WORDS).join(' ') + (words.length > CALL_WORDS ? '…' : '')
}
const line = (index) => {
  const record = records[index]
  return (index + 1) + '. ' + (record.date || S.empty) + ' — ' + call(record)
}
const full = (index) => {
  const r = records[index]
  const show = (v) => (typeof v === 'string' && v.trim() ? v : S.empty)
  return [
    '### ' + (index + 1) + '. ' + show(r.title),
    '- ' + S.date + ': ' + show(r.date),
    '- ' + S.sourceKind + ': ' + show(r.sourceType),
    '- ' + S.origin + ': ' + show(r.origin),
    '- ' + S.context + ': ' + show(r.context),
    '- ' + S.decision + ': ' + show(r.decision),
    '- ' + S.driver + ': ' + show(r.driver),
    '- ' + S.condition + ': ' + show(r.condition),
    '- ' + S.kind + ': ' + show(r.kind),
  ].join('\n')
}

const table = ['| ' + S.group + ' | ' + S.records + ' |', '| --- | --- |', ...[...groups].map(([label, members]) => '| ' + label + ' | ' + members.length + ' |')].join('\n')
const rangeLine = opts.range ? (range ? fill(S.rangeRead, range) : fill(S.rangeUnread, { range: opts.range })) : ''

const md = [
  '# ' + S.title + ' — ' + basename(jsonPath),
  '',
  '1. ' + S.nothingSent,
  '2. ' + S.exactly,
  '3. ' + S.placeholders,
  '',
  S.notStored,
  '',
  '## ' + S.whatIsRecord,
  '',
  S.definition,
  '',
  '### ' + S.firstRecord,
  '',
  full(0),
  '',
  '## ' + S.groups,
  '',
  ...(rangeLine ? [rangeLine, ''] : []),
  table,
  '',
  ...[...groups].flatMap(([label, members]) => ['### ' + label + ' — ' + members.length, '', ...members.map(line), '']),
  '## ' + S.exceptions,
  '',
  S.exceptionsFrame,
  '',
  ...(exceptions.length ? exceptions.flatMap((n) => [full(n - 1), '']) : [S.noExceptions, '']),
  ...(named.length > EXCEPTIONS_CAP ? [fill(S.exceptionsCap, { cap: EXCEPTIONS_CAP, n: new Set(named).size - EXCEPTIONS_CAP }), ''] : []),
  '## ' + S.flags,
  '',
  S.flagsFrame,
  '',
  ...(flags.length ? flags.map((f) => '- ' + f.n + ' — ' + f.kind + ' (' + f.field + ')') : [S.noFlags]),
  '',
  '## ' + fill(S.question, { n: records.length }),
  '',
  '## ' + S.allRecords,
  '',
  ...[...groups].flatMap(([label, members]) => ['### ' + label, '', ...members.flatMap((index) => [full(index), ''])]),
].join('\n')

console.log(md)
console.log('\n' + table)
if (rangeLine) console.log('\n' + rangeLine)
console.log('\n' + (flags.length ? flags.map((f) => f.n + ' — ' + f.kind + ' (' + f.field + ')').join('\n') : S.noFlags))
if (wantsFile) {
  const mdPath = join(dirname(jsonPath), basename(jsonPath).replace(/\.json$/i, '') + '.md')
  writeFileSync(mdPath, md)
  console.log('\n' + mdPath)
}
