#!/usr/bin/env node
// Rendered by avvamcp scripts/render-advisor-repo.mjs from shared/studio-plugin.ts. Do not edit by hand.
// Renders the approval sheet from the decisions json: what you read here is what would be sent.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const FIELDS = {"title":{"max":200},"date":{"max":40},"sourceType":{"values":["chat-history","code-and-reviews","issues-and-roadmaps","documents","customer-systems","guided-recall","other"]},"origin":{"max":80},"context":{"max":4000},"decision":{"required":true,"max":8000},"driver":{"max":2000},"otherSide":{"max":2000},"condition":{"max":1000},"kind":{"values":["reject","choose","require","accept"]}}
const FLAGS = [{"kind":"email address","source":"(?<![A-Z0-9._%+-])[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]+\\.[A-Z]{2,}\\b","flags":"i"},{"kind":"private or identifying URL","source":"\\bhttps?:\\/\\/\\S+","flags":"i"},{"kind":"credential or secret","source":"\\b(?:api[_ -]?key|secret|password)\\b\\s*[:=]|(?<![\\p{L}\\p{N}_])(?:секретн\\p{L}*\\s+ключ\\p{L}*|ключ\\s+доступа|парол\\p{L}*)\\s*[:=]|\\btoken\\b\\s*[:=]\\s*[\"'\\u0060]?[A-Za-z0-9_\\-./+]{12,}|(?<![\\p{L}\\p{N}_])токен\\p{L}*\\s*[:=]\\s*[\"'\\u0060]?[A-Za-z0-9_\\-./+]{12,}|\\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|\\bavk_[A-Za-z0-9_-]{16,}","flags":"iu"},{"kind":"ticket or repository identifier","source":"\\b(?:JIRA|ticket|issue|PR|repo(?:sitory)?)\\b\\s*(?:#|:)\\s*[A-Z0-9_-]{2,}\\b","flags":"i"},{"kind":"NDA or confidential marker","source":"\\b(?:strictly private|internal only|internal use only)\\b|\\bCONFIDENTIAL\\b|(?<![\\p{L}\\p{N}_])КОНФИДЕНЦИАЛЬНО(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])СЕКРЕТНО(?![\\p{L}\\p{N}_])|\\b(?:this|that|our|their|the client'?s|the customer'?s)\\s+(?:\\w+\\s+){0,2}(?:NDA|confidentiality agreement)\\b|\\bunder (?:an )?NDA with\\b","flags":"u"},{"kind":"phone number","source":"(?!\\d{1,3}(?:[ \\u00A0\\u202F.]\\d{3}){2,}(?![\\s().-]*\\d))(?<!\\d)(?!(?:\\d{1,2}[./]\\d{1,2}[./](?:\\d{4}|\\d{2})|\\d{4}[-./]\\d{1,2}[-./]\\d{1,2})(?![./]?\\d)|(?<=(?<!\\d)\\d{1,2}[./])\\d{1,2}[./](?:\\d{4}|\\d{2})(?![./]?\\d)|(?<=(?<!\\d)\\d{1,2}[./]\\d{1,2}[./])(?:\\d{4}|\\d{2})(?![./]?\\d)|(?<=(?<!\\d)\\d{4}[-./])\\d{1,2}[-./]\\d{1,2}(?![./]?\\d)|(?<=(?<!\\d)\\d{4}[-./]\\d{1,2}[-./])\\d{1,2}(?![./]?\\d))(?:\\+\\d{1,3}[\\s().-]*)?(?:\\d[\\s().-]*){9,}","flags":""},{"kind":"passport or national-id marker","source":"(?<![\\p{L}\\p{N}_])(?:паспорт\\p{L}*|passport|ssn)(?![\\p{L}\\p{N}_])","flags":"iu"},{"kind":"secret or confidential (RU)","source":"(?<![\\p{L}\\p{N}_])(?:эт(?:от|а|у|ой|ом)|наш\\p{L}*|их|клиентск\\p{L}*)\\s+(?:\\p{L}+\\s+){0,2}(?:НДА|соглашени\\p{L}*\\s+о\\s+неразглашении)(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(?:строго\\s+конфиденциальн\\p{L}*|только\\s+для\\s+внутреннего\\s+использования)(?![\\p{L}\\p{N}_])","flags":"iu"},{"kind":"sensitive structure (card number, contact or credential shape)","source":"(\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}|(?<![\\w.+-])[\\w.+-]{1,64}@[\\w-]+\\.[\\w.]{2,}|(?!\\d{1,3}(?:[ \\u00A0\\u202F.]\\d{3}){2,}(?![\\s().-]*\\d))(?<!\\d)(?!(?:\\d{1,2}[./]\\d{1,2}[./](?:\\d{4}|\\d{2})|\\d{4}[-./]\\d{1,2}[-./]\\d{1,2})(?![./]?\\d)|(?<=(?<!\\d)\\d{1,2}[./])\\d{1,2}[./](?:\\d{4}|\\d{2})(?![./]?\\d)|(?<=(?<!\\d)\\d{1,2}[./]\\d{1,2}[./])(?:\\d{4}|\\d{2})(?![./]?\\d)|(?<=(?<!\\d)\\d{4}[-./])\\d{1,2}[-./]\\d{1,2}(?![./]?\\d)|(?<=(?<!\\d)\\d{4}[-./]\\d{1,2}[-./])\\d{1,2}(?![./]?\\d))\\+?\\d[\\d\\s()-]{9,}\\d|password\\s*[:=]|api[_-]?key\\s*[:=])","flags":"i"},{"kind":"passport or secret marker","source":"(?<![\\p{L}\\p{N}_])(?:паспорт\\p{L}*|passport|ssn|секретн\\p{L}*)(?![\\p{L}\\p{N}_])","flags":"iu"},{"kind":"names avva: keep it if it is a decision about your own product, strike it if it is about running this extraction","source":"(?<![\\p{L}\\p{N}_])avva(?![\\p{L}\\p{N}_])|\\b(?:mcp[- ]studio|begin_extraction|submit_decisions|submit_model)\\b|\\bdecision[- ]model platform\\b|платформ\\p{L}*\\s+(?:для\\s+)?модел\\p{L}*\\s+решений","flags":"iu"}].map((f) => ({ kind: f.kind, re: new RegExp(f.source, f.flags) }))
const STRINGS = {"en":{"title":"Approval sheet","nothingSent":"Nothing has been sent to avva yet.","exactly":"These records are what would be sent if you approve — their text, never a file, and never a document they came from.","nothingElse":"Nothing else goes with them: no struck items and none of the rest of your history.","placeholders":"Names, clients, repositories, ticket ids, private URLs and deal amounts are replaced with bracketed placeholders; policy thresholds stay, because they are rules, not identifiers — but a client’s own targets or a pilot’s acceptance criteria agreed with one client are that engagement’s, and are among the least-sure records below.","notStored":"The approved text builds the draft and is not stored by avva. This file is the record; the flags below are hints.","whatIsRecord":"What a record is","definition":"One decision you made, as a stranger could recognize it: the situation (the setting, and what this one call was about), what you ruled, the reason you stated, the other side (what pulled the other way, and what it had going for it), the condition that limited it, and what kind of call it was. In your own words, from a source the assistant read.","firstRecord":"The first record, in full","groups":"Groups by origin","group":"group","records":"records","noOrigin":"no origin label","outsideRange":"outside your range","instructions":"instructions, not calls","instructionsFrame":"No alternative and no reason on record for these. They stay unless you strike the group; keep or strike single ones by number.","statements":"statements, not decisions","statementsFrame":"Nothing in these shows you choosing: a declaration or plan with no alternative and no reason, product or marketing copy, an answer to a hypothetical question, someone else’s text, or something an AI assistant wrote. They are LEFT OUT unless you keep one: name its number, say it was your call, and say why.","needsEye":"Needs your eye","needsEyeFrame":"One line each; every one is in full in the file, under its number.","authorship":"authorship unclear","clientMaterial":"from a client’s or an employer’s material","fileLine":"Every record, in full: {path} — read it before you answer.","statementsOut":"{k} statements are left out unless you keep one.","rangeRead":"Range read as {from} to {to}; dated records outside it are in their own group.","rangeUnread":"The range \"{range}\" could not be read as dates, so no outside-range group was built.","exceptions":"Least-sure records, in full","exceptionsFrame":"The records the assistant is least sure are clean after redaction. They are the least-sure ones, not the only risky ones; the full list below is the record.","exceptionsCap":"Capped at {cap}: {n} more were named and are not shown here.","noExceptions":"The assistant named none.","against":"Against the default — {k} of {n}","againstFrame":"The records where your call went against what the assistant, or a competent stranger in your field, would have advised from the situation alone. They are the part a buyer’s own AI cannot give them; the ordinary records beside them stay in full, as the other half of how you decide. The mark is the assistant’s reading, not a field: it is not sent.","offDomain":"outside the domain you named","offDomainFrame":"The assistant’s reading: these may sit outside the domain this model is for. They stay unless you strike the group; keep or strike single ones by number.","noReason":"No reason in the source — {k} of {n}","noReasonAsk":"If you remember why for any of these, say it in a few words: the assistant adds it to that record in your words and shows it to you again. Skip any you don’t; a call with no recorded reason still goes in, and the model says the reason was not recorded.","moreRecords":"Showing records {from} to {to} of {n} in full. Ask for any other number, or the next block.","elsewhere":"{k} more listed in other groups","changed":"Changed since you approved them — {k}","changedFrame":"Each changed field, as you approved it and as it would be sent now. Nothing here is sent before you say yes; a change you strike keeps the version you approved.","added":"New since you approved — {k}","removedSince":"In the approved file and not in this one — {k}","before":"before","after":"after","noChanges":"Nothing changed since you approved it.","noAgainst":"The assistant marked none.","againstMark":"against the default","flags":"Mechanical flags","flagsFrame":"Pattern matches, the same ones avva runs at publish, plus a check for records about avva itself. A match is a reason to look, not a verdict; what a shape still gives away is the assistant’s call.","noFlags":"No pattern matched.","question":"Every record is in full in the file — read it, or tell me you trust my selection and I will check it for you first; then: send these {n} to avva? Their text builds the draft and is not stored. Strike by group or by number.","rebuildQuestion":"Send these {n} to avva — their text builds the draft and is not stored — and is any call in your saved set one you would no longer make? Strike by group or by number; name a call you would no longer make and it is removed.","unknownFields":"Fields this script does not know — shown in full above as they are, not checked against the wire shape: {list}. A newer avva-studio plugin knows them; avva drops any field it does not know.","allRecords":"All records, in full","number":"No.","date":"date","sourceKind":"source","origin":"origin","recordTitle":"title","context":"situation","decision":"decision","driver":"reason","otherSide":"the other side","condition":"condition","kind":"kind","empty":"—"},"ru":{"title":"Лист согласования","nothingSent":"В avva пока ничего не отправлено.","exactly":"Если вы одобрите, будут отправлены эти записи — их текст, а не файл и не документы, из которых они взяты.","nothingElse":"Ничего больше с ними не уходит: ни вычеркнутое, ни остальная история.","placeholders":"Имена, клиенты, репозитории, номера задач, приватные ссылки и суммы сделок заменены на заполнители в скобках; пороги и правила остаются, потому что это правила, а не идентификаторы, — но цели клиента или критерии приёмки пилота, согласованные с одним клиентом, принадлежат этой работе и стоят среди записей, в которых ассистент уверен меньше всего.","notStored":"Одобренный текст строит черновик и не хранится в avva. Этот файл и есть запись; флаги ниже лишь подсказки.","whatIsRecord":"Что такое запись","definition":"Одно ваше решение, которое узнал бы посторонний: ситуация (обстановка и о чём именно было это решение), что вы решили, названная причина, другая сторона (что тянуло в другую сторону и чем это было хорошо), условие, которое ограничивало решение, и какого рода это было решение. Вашими словами, из источника, который прочитал ассистент.","firstRecord":"Первая запись целиком","groups":"Группы по источнику","group":"группа","records":"записей","noOrigin":"без метки источника","outsideRange":"вне вашего диапазона","instructions":"инструкции, не решения","instructionsFrame":"В источнике у них нет ни альтернативы, ни причины. Они остаются, если вы не вычеркнете группу; отдельные можно оставить или вычеркнуть по номеру.","statements":"утверждения, не решения","statementsFrame":"Ни в одной из них не видно, что вы выбирали: декларация или план без альтернативы и причины, продуктовый или маркетинговый текст, ответ на гипотетический вопрос, чужой текст или то, что написал ИИ-ассистент. Они НЕ уходят, если вы не оставите какую-то: назовите номер, скажите, что это было ваше решение, и почему.","needsEye":"Требует вашего взгляда","needsEyeFrame":"По строке на запись; каждая целиком есть в файле под своим номером.","authorship":"авторство неясно","clientMaterial":"из материалов клиента или работодателя","fileLine":"Все записи целиком: {path} — прочитайте до ответа.","statementsOut":"{k} утверждений не уходят, если вы не оставите какое-то.","rangeRead":"Диапазон прочитан как {from} — {to}; датированные записи вне его вынесены в отдельную группу.","rangeUnread":"Диапазон «{range}» не удалось прочитать как даты, поэтому группа вне диапазона не построена.","exceptions":"Записи, в которых ассистент уверен меньше всего, целиком","exceptionsFrame":"Записи, в чистоте которых после редактирования ассистент уверен меньше всего. Это наименее надёжные, а не единственные рискованные; полный список ниже и есть запись.","exceptionsCap":"Ограничено {cap}: ещё {n} названы, но здесь не показаны.","noExceptions":"Ассистент не назвал ни одной.","against":"Против очевидного — {k} из {n}","againstFrame":"Записи, где вы решили не так, как посоветовал бы ассистент или грамотный посторонний из вашей области, видя одну ситуацию. Это та часть, которую ИИ покупателя сам не даст; обычные записи рядом с ними остаются целиком — это вторая половина того, как вы решаете. Пометка — прочтение ассистента, а не поле: она не отправляется.","offDomain":"вне названного вами домена","offDomainFrame":"Прочтение ассистента: эти записи, возможно, не относятся к домену модели. Они остаются, если вы не вычеркнете группу; отдельные можно оставить или вычеркнуть по номеру.","noReason":"Причины нет в источнике — {k} из {n}","noReasonAsk":"Если помните, почему решили так в каких-то из них, скажите в двух словах: ассистент допишет это в запись вашими словами и покажет её снова. Остальные пропустите; решение без записанной причины всё равно войдёт, и модель скажет, что причина не записана.","moreRecords":"Целиком показаны записи с {from} по {to} из {n}. Попросите любой другой номер или следующий блок.","elsewhere":"ещё {k} в других группах","changed":"Изменено после вашего одобрения — {k}","changedFrame":"Каждое изменённое поле: как вы его одобрили и как оно ушло бы сейчас. Ничего отсюда не отправляется до вашего «да»; вычеркнутое изменение оставляет одобренную версию.","added":"Новое после вашего одобрения — {k}","removedSince":"Есть в одобренном файле, нет в этом — {k}","before":"было","after":"стало","noChanges":"После вашего одобрения ничего не изменилось.","noAgainst":"Ассистент не пометил ни одной.","againstMark":"против очевидного","flags":"Механические флаги","flagsFrame":"Совпадения с шаблонами — теми же, что avva проверяет при публикации, — и проверка на записи о самой avva. Совпадение — повод посмотреть, а не вердикт; что ещё выдаёт форма записи, решает ассистент.","noFlags":"Ни один шаблон не сработал.","question":"Все записи целиком лежат в файле — прочитайте его или скажите, что доверяете моему отбору, и я сначала проверю его за вас; затем: отправить эти {n} в avva? Их текст строит черновик и не хранится. Вычёркивайте группами или по номерам.","rebuildQuestion":"Отправить эти {n} в avva — их текст строит черновик и не хранится, — и есть ли в сохранённом наборе решение, которое вы сейчас уже не приняли бы? Вычёркивайте группами или по номерам; назовите решение, которое уже не приняли бы, — и оно будет удалено.","unknownFields":"Поля, которых этот скрипт не знает, — показаны выше целиком, как есть, и не проверены по форме записи: {list}. Их знает более новый плагин avva-studio; поле, которого avva не знает, она отбрасывает.","allRecords":"Все записи целиком","number":"№","date":"дата","sourceKind":"источник","origin":"откуда","recordTitle":"название","context":"ситуация","decision":"решение","driver":"причина","otherSide":"другая сторона","condition":"условие","kind":"род","empty":"—"}}
const EXCEPTIONS_CAP = 15
const CLIENT_ORIGIN = new RegExp("\\[(?:the\\s+)?(?:[Cc]lient|CLIENT|[Cc]ustomer|CUSTOMER|[Кк]лиент\\p{L}*|КЛИЕНТ\\p{L}*|[Зз]аказчик\\p{L}*|ЗАКАЗЧИК\\p{L}*)(?:[\\s_]*(?:\\p{Lu}|\\d+)(?![\\p{L}\\p{N}])[^\\]]*|'s[^\\]]*)?\\]", "u")
const CALL_WORDS = 15
const TEXT_FIELDS = ['title', 'origin', 'context', 'decision', 'driver', 'otherSide', 'condition']

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
const opts = { range: '', lang: '', exceptions: '', against: '', instructions: '', statements: '', authorship: '', client: '', 'off-domain': '', records: '', before: '' }
// Two outputs, one render. The FILE beside the json holds every record in
// full: it is what the expert reads before they approve. STDOUT is what the
// assistant puts in the chat: the header, the first record, the group table,
// what needs the expert's eye, the least-sure records, the flags and the one
// question — never every record, which on the founder's run of 2026-10-02 was
// one 25,451-character message. Both are this script's render of the json,
// never retyped by a model. --sheet is accepted from older skills and changes
// nothing: the file is always written.
let rebuild = false
let jsonPath = ''
for (let i = 0; i < args.length; i += 1) {
  const a = args[i]
  if (['--range', '--lang', '--exceptions', '--against', '--instructions', '--statements', '--authorship', '--client', '--off-domain', '--records', '--before'].includes(a)) {
    opts[a.slice(2)] = String(args[i + 1] ?? '')
    i += 1
  } else if (a === '--sheet') continue
  else if (a === '--rebuild') rebuild = true
  else if (a.startsWith('--')) fail(['unknown option ' + a])
  else jsonPath = a
}
if (!jsonPath) fail(['usage: node render-sheet.mjs <avva-decisions-*.json> [--range "<words>"] [--exceptions 3,7] [--against 2,5] [--instructions 4,9] [--statements 8,12] [--authorship 5] [--client 2,6] [--off-domain 6] [--records 11-20] [--before <the approved json> [--rebuild]] [--lang ru|en]'])
// A rebuild's sheet shows only what changed against the approved file, so its
// one question carries the way out for an unchanged call the expert no longer
// makes; without the approved file there is no "saved set" to ask about.
if (rebuild && !opts.before) fail(['--rebuild goes with --before <the approved json>: the question it asks is about the saved set'])

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
// A field this copy of the script does not know is a WARNING, not a failure.
// The script is installed on the expert's machine and updated when they
// update the plugin, the record's wire shape on avva's side, so refusing an
// unknown key meant any field avva ever adds to a record broke every install
// that had not updated yet — at the approval sheet, the one step that needs
// the expert's time. It is shown in full, scanned like the text fields, and
// named; what it cannot be is checked, and avva drops a field it does not know.
const unknown = new Map()
records.forEach((record, index) => {
  const n = index + 1
  if (!record || typeof record !== 'object' || Array.isArray(record)) return errors.push('record ' + n + ': not an object')
  for (const key of Object.keys(record)) {
    if (key in FIELDS) continue
    if (!unknown.has(key)) unknown.set(key, [])
    unknown.get(key).push(n)
  }
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
const unknownList = [...unknown].map(([key, ns]) => '"' + key + '" (#' + ns.join(', #') + ')')
if (unknownList.length) {
  console.error('WARNING: field(s) this script does not know: ' + unknownList.join('; ') + '. They are shown on the sheet as they are and not checked. If one is a typo of a known field (' + Object.keys(FIELDS).join(', ') + '), fix the json and run this again; otherwise the plugin is older than avva: update it.')
}
const unknownKeys = (record) => Object.keys(record).filter((key) => !(key in FIELDS))
const asText = (value) => (typeof value === 'string' ? value : JSON.stringify(value))

const cyrillic = (text) => (text.match(/\p{Script=Cyrillic}/gu) || []).length
const latin = (text) => (text.match(/\p{Script=Latin}/gu) || []).length
const sample = records.map((r) => (r.decision || '') + ' ' + (r.context || '')).join(' ')
const lang = opts.lang === 'ru' || opts.lang === 'en' ? opts.lang : cyrillic(sample) > latin(sample) ? 'ru' : 'en'
if (opts.lang && opts.lang !== lang) fail(['--lang must be ru or en'])
const S = STRINGS[lang]
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key]))

// A rebuild, or any change to records the user already approved: the
// approved file stays as it is, the changes live in a working copy, and the
// sheet shows each changed field before and after. Matched on what does not
// change when a record is enriched (date, title, source, origin), then on
// position; a record matched wrongly shows as changed, never as unchanged.
let before = null
if (opts.before) {
  let raw
  try {
    raw = JSON.parse(readFileSync(opts.before, 'utf8'))
  } catch (error) {
    fail(['cannot read ' + opts.before + ': ' + (error && error.message)])
  }
  before = Array.isArray(raw) ? raw : Array.isArray(raw?.decisions) ? raw.decisions : Array.isArray(raw?.episodes) ? raw.episodes : null
  if (!before || before.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) fail(['--before must be the approved json: an array of records'])
}
const LABELS = { title: S.recordTitle, date: S.date, sourceType: S.sourceKind, origin: S.origin, context: S.context, decision: S.decision, driver: S.driver, otherSide: S.otherSide, condition: S.condition, kind: S.kind }
const keyOf = (r) => JSON.stringify([r.date || '', r.title || '', r.sourceType || '', r.origin || ''])
const changes = { changed: [], added: [], removed: [] }
if (before) {
  const used = new Set()
  records.forEach((record, index) => {
    let j = before.findIndex((b, bi) => !used.has(bi) && keyOf(b) === keyOf(record))
    if (j < 0 && index < before.length && !used.has(index)) j = index
    if (j < 0) return changes.added.push(index)
    used.add(j)
    const keys = [...new Set([...Object.keys(FIELDS), ...unknownKeys(record), ...unknownKeys(before[j])])]
    const fields = keys.filter((key) => asText(before[j][key] ?? '') !== asText(record[key] ?? ''))
    if (fields.length) changes.changed.push({ index, from: before[j], fields })
  })
  before.forEach((b, bi) => {
    if (!used.has(bi)) changes.removed.push(b)
  })
}

const range = opts.range ? parseDateRange(opts.range) : null
const outside = (record) => {
  if (!range) return false
  const d = String(record.date || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && (d < range.from || d > range.to)
}

// The brief's review pass puts a record whose source shows no alternative and
// no reason into its own group instead of dropping it: the expert keeps or
// strikes it, never the assistant. The grouping is the assistant's reading,
// like --against; the json carries no field for it.
const numbers = (flag) => {
  const list = opts[flag] ? opts[flag].split(/[\s,]+/).filter(Boolean).map(Number) : []
  const bad = list.filter((n) => !Number.isInteger(n) || n < 1 || n > records.length)
  if (bad.length) fail(['--' + flag + ' names records that do not exist: ' + bad.join(', ')])
  return new Set(list)
}
const instructions = numbers('instructions')
// The review's off-domain mark, the same kind of reading: its own group, kept
// unless the expert strikes it, never a field in the json.
const offDomain = numbers('off-domain')
// The review's statements — nothing in the source shows the expert choosing
// (a declaration, product copy, an answer to a hypothetical, someone else's
// text, an assistant's report). Their own group, and the one group that is
// OUT by default: the question's count leaves them out, and the expert keeps
// one only by saying it was their call and why.
const statements = numbers('statements')
// Two more readings the sheet points the expert at, never fields: whose words
// a record really is, and whether it came from a client's or an employer's
// material. A client's origin placeholder is read by the product's own rule
// (mining.ts, fromClientContext), rendered in; --client adds the rest.
const authorship = numbers('authorship')
const clientNamed = numbers('client')
const fromClient = (index) => clientNamed.has(index + 1) || CLIENT_ORIGIN.test(String(records[index].origin || ''))

const groups = new Map()
records.forEach((record, index) => {
  const label = outside(record)
    ? S.outsideRange
    : offDomain.has(index + 1)
      ? S.offDomain
      : statements.has(index + 1)
        ? S.statements
        : instructions.has(index + 1)
          ? S.instructions
          : String(record.origin || '').trim() || S.noOrigin
  if (!groups.has(label)) groups.set(label, [])
  groups.get(label).push(index)
})
const statementCount = (groups.get(S.statements) || []).length
for (const last of [S.instructions, S.statements, S.offDomain, S.outsideRange]) {
  if (!groups.has(last)) continue
  const rest = groups.get(last)
  groups.delete(last)
  groups.set(last, rest)
}

const flags = []
records.forEach((record, index) => {
  for (const field of [...TEXT_FIELDS, ...unknownKeys(record)]) {
    const value = record[field] === undefined || record[field] === null ? '' : asText(record[field])
    if (!value) continue
    for (const flag of FLAGS) {
      if (flag.re.test(value) && !flags.some((f) => f.n === index + 1 && f.kind === flag.kind)) flags.push({ n: index + 1, kind: flag.kind, field })
    }
  }
})

const named = opts.exceptions ? opts.exceptions.split(/[\s,]+/).filter(Boolean).map(Number) : []
const badNumbers = named.filter((n) => !Number.isInteger(n) || n < 1 || n > records.length)
if (badNumbers.length) fail(['--exceptions names records that do not exist: ' + badNumbers.join(', ')])
const exceptions = [...new Set(named)].slice(0, EXCEPTIONS_CAP)

// The assistant's reading of which calls went against the obvious answer. The
// script renders it and counts it; it never asks the json for it, because the
// mark is a judgment about the record and not part of what is sent.
const markedList = opts.against ? opts.against.split(/[\s,]+/).filter(Boolean).map(Number) : []
const badMarked = markedList.filter((n) => !Number.isInteger(n) || n < 1 || n > records.length)
if (badMarked.length) fail(['--against names records that do not exist: ' + badMarked.join(', ')])
const against = new Set(markedList)

const call = (record) => {
  const words = String(record.decision).trim().split(/\s+/)
  return words.slice(0, CALL_WORDS).join(' ') + (words.length > CALL_WORDS ? '…' : '')
}
// Listed outside its origin's own group, a line names the origin: striking an
// origin strikes every record that carries it, and a client's record in the
// instructions or off-domain group must still read as that client's.
const line = (index, withOrigin = false) => {
  const record = records[index]
  const origin = withOrigin ? (String(record.origin || '').trim() || S.noOrigin) + ' — ' : ''
  return (index + 1) + '. ' + (record.date || S.empty) + ' — ' + origin + call(record) + (against.has(index + 1) ? ' · ' + S.againstMark : '')
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
    '- ' + S.otherSide + ': ' + show(r.otherSide),
    '- ' + S.condition + ': ' + show(r.condition),
    '- ' + S.kind + ': ' + show(r.kind),
    ...unknownKeys(r).map((key) => '- ' + key + ': ' + show(asText(r[key]))),
  ].join('\n')
}

// The records whose driver is empty — computed from the json itself, so the
// sheet can ask for the reasons only the expert holds without the assistant
// having to judge anything (the brief's REASONS ONLY I CAN GIVE).
const reasonless = records.map((r, i) => (String(r.driver || '').trim() ? 0 : i + 1)).filter(Boolean)

// A page of records, in full, for the chat — only when the user asks to read
// some there. The file always carries every record; a tool output of 200 full
// records is truncated by the client, which is why the chat never gets them all.
let shownFrom = 1
let shownTo = records.length
if (opts.records) {
  const m = /^(\d+)(?:-(\d+))?$/.exec(opts.records.trim())
  if (!m) fail(['--records takes a number or a range, like 11-20'])
  shownFrom = Number(m[1])
  shownTo = m[2] ? Number(m[2]) : shownFrom
  if (shownFrom < 1 || shownTo > records.length || shownFrom > shownTo) fail(['--records names records that do not exist: ' + opts.records])
}
const shown = (index) => index + 1 >= shownFrom && index + 1 <= shownTo

const special = new Set([S.instructions, S.statements, S.offDomain, S.outsideRange])
const byOrigin = new Map()
for (const record of records) {
  const origin = String(record.origin || '').trim() || S.noOrigin
  byOrigin.set(origin, (byOrigin.get(origin) || 0) + 1)
}
const count = (label, members) => {
  const elsewhere = special.has(label) ? 0 : (byOrigin.get(label) || 0) - members.length
  return members.length + (elsewhere > 0 ? ' (' + fill(S.elsewhere, { k: elsewhere }) + ')' : '')
}
const orEmpty = (v) => (typeof v === 'string' && v.trim() ? v : S.empty)
const recordsIn = (keep) => [
  '## ' + S.allRecords,
  '',
  ...[...groups].flatMap(([label, members]) => {
    const inView = members.filter(keep)
    return inView.length ? ['### ' + label, '', ...inView.flatMap((index) => [full(index), ''])] : []
  }),
]
// Paging prints the requested records and nothing else: the questions were
// asked once, with the sheet, and a page of records is not a second sheet.
if (opts.records) {
  console.log([...recordsIn(shown), fill(S.moreRecords, { from: shownFrom, to: shownTo, n: records.length })].join('\n'))
  process.exit(0)
}
// Every record, in full: the file's body, never the chat's.
const allRecords = recordsIn(() => true)
const changeSection = before
  ? [
      '## ' + fill(S.changed, { k: changes.changed.length }),
      '',
      S.changedFrame,
      '',
      ...(changes.changed.length
        ? changes.changed.flatMap(({ index, from, fields }) => [
            '### ' + (index + 1) + '. ' + orEmpty(records[index].title),
            ...fields.flatMap((key) => ['- ' + (LABELS[key] ?? key) + ':', '  - ' + S.before + ': ' + orEmpty(from[key] === undefined ? '' : asText(from[key])), '  - ' + S.after + ': ' + orEmpty(records[index][key] === undefined ? '' : asText(records[index][key]))]),
            '',
          ])
        : [S.noChanges, '']),
      '## ' + fill(S.added, { k: changes.added.length }),
      '',
      ...changes.added.flatMap((index) => [full(index), '']),
      ...(changes.removed.length
        ? ['## ' + fill(S.removedSince, { k: changes.removed.length }), '', ...changes.removed.map((r) => '- ' + (r.date || S.empty) + ' — ' + (String(r.origin || '').trim() || S.noOrigin) + ' — ' + call(r)), '']
        : []),
    ]
  : null

const table = ['| ' + S.group + ' | ' + S.records + ' |', '| --- | --- |', ...[...groups].map(([label, members]) => '| ' + label + ' | ' + count(label, members) + ' |')].join('\n')
const rangeLine = opts.range ? (range ? fill(S.rangeRead, range) : fill(S.rangeUnread, { range: opts.range })) : ''

const mdPath = join(dirname(jsonPath), basename(jsonPath).replace(/\.json$/i, '') + '.md')
const headerBlock = [
  '# ' + S.title + ' — ' + basename(jsonPath),
  '',
  '1. ' + S.nothingSent,
  '2. ' + S.exactly,
  '3. ' + S.nothingElse,
  '4. ' + S.placeholders,
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
]
const groupLists = [...groups].flatMap(([label, members]) => ['### ' + label + ' — ' + count(label, members), '', ...(label === S.instructions ? [S.instructionsFrame, ''] : label === S.statements ? [S.statementsFrame, ''] : label === S.offDomain ? [S.offDomainFrame, ''] : []), ...members.map((index) => line(index, special.has(label))), ''])
const againstHead = '## ' + fill(S.against, { k: against.size, n: records.length })
const againstList = [againstHead, '', S.againstFrame, '', ...(against.size ? [...against].sort((a, b) => a - b).map((n) => line(n - 1, true)) : [S.noAgainst]), '']
// What the chat points the expert at instead of printing every record. The
// reasonless records are named with the ask at the end, beside the question.
const eye = (label, list) => (list.length ? ['### ' + label + ' — ' + list.length, '', ...list.map((index) => line(index, true)), ''] : [])
const indices = records.map((_, index) => index)
const needsEye = [
  ...eye(S.authorship, indices.filter((index) => authorship.has(index + 1))),
  ...eye(S.clientMaterial, indices.filter(fromClient)),
  ...eye(S.statements, groups.get(S.statements) || []),
]
const eyeBlock = needsEye.length ? ['## ' + S.needsEye, '', S.needsEyeFrame, '', ...needsEye] : []
const exceptionBlock = [
  '## ' + S.exceptions,
  '',
  S.exceptionsFrame,
  '',
  ...(exceptions.length ? exceptions.flatMap((n) => [full(n - 1), '']) : [S.noExceptions, '']),
  ...(named.length > EXCEPTIONS_CAP ? [fill(S.exceptionsCap, { cap: EXCEPTIONS_CAP, n: new Set(named).size - EXCEPTIONS_CAP }), ''] : []),
]
const flagBlock = ['## ' + S.flags, '', S.flagsFrame, '', ...(flags.length ? flags.map((f) => '- ' + f.n + ' — ' + f.kind + ' (' + f.field + ')') : [S.noFlags]), '']
// The question's count leaves out the statements: they go only if kept.
const sendable = records.length - statementCount
const closing = [
  // The ask for missing reasons and the approval question close the sheet, in
  // one message, after the records they are about: the question used to print
  // above "All records", asking before the reading it depends on.
  ...(reasonless.length ? ['## ' + fill(S.noReason, { k: reasonless.length, n: records.length }), '', '#' + reasonless.join(', #'), '', S.noReasonAsk, ''] : []),
  ...(unknownList.length ? [fill(S.unknownFields, { list: unknownList.join('; ') }), ''] : []),
  ...(statementCount ? [fill(S.statementsOut, { k: statementCount }), ''] : []),
  '## ' + fill(rebuild ? S.rebuildQuestion : S.question, { n: sendable }),
]

// The file: every record in full, and everything the chat shows.
const md = [...headerBlock, ...groupLists, ...againstList, ...eyeBlock, ...exceptionBlock, ...flagBlock, ...(changeSection ?? allRecords), ...closing].join('\n')
writeFileSync(mdPath, md)
// The chat: never every record. On a rebuild the changes ARE what needs the eye.
const screen = [...headerBlock, againstHead, '', ...eyeBlock, ...exceptionBlock, ...flagBlock, ...(changeSection ?? []), fill(S.fileLine, { path: mdPath }), '', ...closing].join('\n')
console.log(screen)
