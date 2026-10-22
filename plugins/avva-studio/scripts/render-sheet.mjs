#!/usr/bin/env node
// Rendered by avvamcp scripts/render-advisor-repo.mjs from shared/studio-plugin.ts. Do not edit by hand.
// Renders the approval sheet from the decisions json: what you read here is what would be sent.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const FIELDS = {"title":{"max":200},"date":{"max":40},"sourceType":{"values":["chat-history","code-and-reviews","issues-and-roadmaps","documents","customer-systems","guided-recall","other"]},"origin":{"max":80},"context":{"max":4000},"decision":{"required":true,"max":8000},"driver":{"max":2000},"otherSide":{"max":2000},"condition":{"max":1000},"outcome":{"max":2000},"revisited":{"max":2000},"kind":{"values":["reject","choose","require","accept"]},"id":{"max":40}}
const FLAGS = [{"kind":"email address","source":"(?<![A-Z0-9._%+-])[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]+\\.[A-Z]{2,}\\b","flags":"i"},{"kind":"private or identifying URL","source":"\\bhttps?:\\/\\/\\S+","flags":"i"},{"kind":"credential or secret","source":"\\b(?:api[_ -]?key|secret|password)\\b\\s*[:=]|(?<![\\p{L}\\p{N}_])(?:секретн\\p{L}*\\s+ключ\\p{L}*|ключ\\s+доступа|парол\\p{L}*)\\s*[:=]|\\btoken\\b\\s*[:=]\\s*[\"'\\u0060]?[A-Za-z0-9_\\-./+]{12,}|(?<![\\p{L}\\p{N}_])токен\\p{L}*\\s*[:=]\\s*[\"'\\u0060]?[A-Za-z0-9_\\-./+]{12,}|\\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|\\bavk_[A-Za-z0-9_-]{16,}","flags":"iu"},{"kind":"ticket or repository identifier","source":"\\b(?:JIRA|ticket|issue|PR|repo(?:sitory)?)\\b\\s*(?:#|:)\\s*[A-Z0-9_-]{2,}\\b","flags":"i"},{"kind":"NDA or confidential marker","source":"\\b(?:strictly private|internal only|internal use only)\\b|\\bCONFIDENTIAL\\b|(?<![\\p{L}\\p{N}_])КОНФИДЕНЦИАЛЬНО(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])СЕКРЕТНО(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(?:CONFIDENCIAL|RESERVADO|SECRETO|DIFUSIÓN LIMITADA)(?![\\p{L}\\p{N}_])|\\b(?:[Tt]his|[Tt]hat|[Oo]ur|[Tt]he client['’]?s|[Tt]he customer['’]?s)\\s+(?:\\w+\\s+){0,2}(?:NDA|confidentiality agreement)\\b|\\bunder (?:an )?NDA with\\b","flags":"u"},{"kind":"phone number","source":"(?!\\d{1,3}(?:[ \\u00A0\\u202F.]\\d{3}){2,12}(?![\\s().-]*\\d))(?<!\\d)(?!(?:\\d{1,2}[./]\\d{1,2}[./](?:\\d{4}|\\d{2})|\\d{4}[-./]\\d{1,2}[-./]\\d{1,2})(?![./]?\\d)|(?<=(?<!\\d)\\d{1,2}[./])\\d{1,2}[./](?:\\d{4}|\\d{2})(?![./]?\\d)|(?<=(?<!\\d)\\d{1,2}[./]\\d{1,2}[./])(?:\\d{4}|\\d{2})(?![./]?\\d)|(?<=(?<!\\d)\\d{4}[-./])\\d{1,2}[-./]\\d{1,2}(?![./]?\\d)|(?<=(?<!\\d)\\d{4}[-./]\\d{1,2}[-./])\\d{1,2}(?![./]?\\d))(?:\\+\\d{1,3}[\\s().-]*)?(?:\\d[\\s().-]*){9,}","flags":""},{"kind":"passport or national-id number","source":"(?<![\\p{L}\\p{N}_])\\d{3}-\\d{2}-\\d{4}(?![\\p{L}\\p{N}_]|-\\d)|(?<![\\p{L}\\p{N}_])(?!(?:19|20)\\d\\d(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01]))\\d{8}[TRWAGMYFPDXBNJZSQVHLCKE](?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])[XYZ]-?\\d{7}-?[TRWAGMYFPDXBNJZSQVHLCKE](?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])[A-Z]{4}\\d{6}[HMX][A-Z]{5}[A-Z0-9]\\d(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(?:id(?=\\s{0,3}(?:n\\.?\\s?[º°o]\\.?|number))|passport(?:\\s+card)?|pasaporte|national\\s+id(?:entity)?(?:\\s+card)?|id(?:entity)?\\s+card|identity\\s+(?:document|number)|documento\\s+(?:nacional\\s+)?de\\s+identidad|c[ée]dula(?:\\s+de\\s+(?:identidad|ciudadan[íi]a))?|dni|nie|ssn|social\\s+security\\s+number)\\s{0,3}(?:(?:n\\.?\\s?[º°o]\\.?|n[uú]m(?:ero|\\.)?|number|#|№)\\s{0,3})?(?::\\s{0,3})?(?:[A-Z]{1,3}-?\\d{6,10}[A-Z]?|\\d{7,10}[A-Z]?|\\d{1,2}\\.\\d{3}\\.\\d{3}-?[TRWAGMYFPDXBNJZSQVHLCKE])(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(?:загран)?паспорт\\p{L}*(?:\\s(?:данн\\p{L}*|РФ|гражданина\\sРФ))?\\s{0,3}(?::\\s{0,3})?(?:(?:сери[ияй]|(?:№|N|номер|ном\\.))\\s{0,3})?(?:\\d{2}\\s?\\d{2},?\\s{0,3}(?:(?:№|N|номер|ном\\.)\\s{0,3})?\\d{6}|\\d{2}\\s{0,3}(?:(?:№|N|номер|ном\\.)\\s{0,3})?\\d{7})(?![\\p{L}\\p{N}_])","flags":"iu"},{"kind":"secret or confidential (RU)","source":"(?<![\\p{L}\\p{N}_])(?:эт(?:от|а|у|ой|ом)|наш\\p{L}*|клиентск\\p{L}*)\\s+(?:\\p{L}+\\s+){0,2}(?:НДА|соглашени\\p{L}*\\s+о\\s+неразглашении)(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(?:строго\\s+конфиденциальн\\p{L}*|только\\s+для\\s+внутреннего\\s+использования)(?![\\p{L}\\p{N}_])","flags":"iu"},{"kind":"secret or confidential (ES)","source":"(?<![\\p{L}\\p{N}_])(?:estrictamente\\s+confidencial\\p{L}*|s[oó]lo\\s+para\\s+uso\\s+interno|de\\s+uso\\s+interno\\s+exclusivo|prohibida\\s+su\\s+(?:difusión|distribución)|no\\s+distribuir)(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(?:este|ese|aquel|nuestro)\\s+(?:\\p{L}+\\s+){0,2}(?:NDA|acuerdo\\s+de\\s+confidencialidad)(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])bajo\\s+(?:un\\s+)?(?:NDA|acuerdo\\s+de\\s+confidencialidad)\\s+con(?![\\p{L}\\p{N}_])","flags":"iu"},{"kind":"sensitive structure (card number, contact or credential shape)","source":"(\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}|(?<![\\w.+-])[\\w.+-]{1,64}@[\\w-]+\\.[\\w.]{2,}|(?!\\d{1,3}(?:[ \\u00A0\\u202F.]\\d{3}){2,12}(?![\\s().-]*\\d))(?<!\\d)(?!(?:\\d{1,2}[./]\\d{1,2}[./](?:\\d{4}|\\d{2})|\\d{4}[-./]\\d{1,2}[-./]\\d{1,2})(?![./]?\\d)|(?<=(?<!\\d)\\d{1,2}[./])\\d{1,2}[./](?:\\d{4}|\\d{2})(?![./]?\\d)|(?<=(?<!\\d)\\d{1,2}[./]\\d{1,2}[./])(?:\\d{4}|\\d{2})(?![./]?\\d)|(?<=(?<!\\d)\\d{4}[-./])\\d{1,2}[-./]\\d{1,2}(?![./]?\\d)|(?<=(?<!\\d)\\d{4}[-./]\\d{1,2}[-./])\\d{1,2}(?![./]?\\d))\\+?\\d[\\d\\s()-]{9,}\\d|password\\s*[:=]|api[_-]?key\\s*[:=])","flags":"i"},{"kind":"names avva: keep it if it is a decision about your own product, cross it out if it is about building this model","source":"(?<![\\p{L}\\p{N}_])avva(?![\\p{L}\\p{N}_])|\\b(?:mcp[- ]studio|begin_extraction|submit_decisions|submit_model)\\b|\\bdecision[- ]model platform\\b|платформ\\p{L}*\\s+(?:для\\s+)?модел\\p{L}*\\s+решений","flags":"iu"}].map((f) => ({ kind: f.kind, re: new RegExp(f.source, f.flags) }))
const STRINGS = {"en":{"title":"Records to approve","nothingSent":"Nothing has been sent to avva yet.","exactly":"These records are what would be sent if you approve — their text, never a file, and never a document they came from.","nothingElse":"Nothing else goes with them: nothing you crossed out and none of the rest of your history.","placeholders":"Names, clients, repositories, ticket ids, private URLs and deal amounts are replaced with bracketed placeholders; policy thresholds stay, because they are rules, not identifiers — but a client’s own targets or a pilot’s acceptance criteria agreed with one client are that engagement’s, and are among the least-sure records below.","notStored":"The approved text builds the draft; avva keeps no copy of these records — it stores the model built from them, your cases included. This file is the record; the flags below are hints.","whatIsRecord":"What a record is","definition":"One decision you made, as a stranger could recognize it: the situation (the setting, and what this one call was about), what you ruled, the reason you stated, the other side (what pulled the other way, and what it had going for it), the condition that limited it, and what kind of call it was. In your own words, from a source the assistant read.","firstRecord":"The first record, in full","groups":"Groups by where they came from","group":"group","records":"records","noOrigin":"no source named","outsideRange":"outside your range","instructions":"instructions, not calls","instructionsFrame":"No alternative and no reason on record for these. They stay unless you cross out the group; keep or cross out single ones by number.","statements":"statements, not decisions","statementsFrame":"Nothing in these shows you choosing: a declaration or plan with no alternative and no reason, product or marketing copy, an answer to a hypothetical question, someone else’s text, or something an AI assistant wrote. They are LEFT OUT unless you keep one: name its number, say it was your call, and say why.","needsEye":"Needs your eye","needsEyeFrame":"One line each; every one is in full in the file, under its number.","authorship":"authorship unclear","clientMaterial":"from a client’s or an employer’s material","protected":"turned on a characteristic the law protects","protectedFrame":"Age, sex, race, religion, disability, pregnancy, national origin and the like. Published as your practice, a call that turned on one can be unlawful and can teach a buyer’s AI a bias, so it never becomes a general rule unless you say why it is lawful. Where the call protects someone, as the law asks, saying so is enough.","shortCall":"too short to count","shortCallFrame":"A call under {min} characters is not counted. Say each of these in a few more words, the way you would put it: the assistant writes it into the record and shows it to you again.","fileLine":"Every record, in full: {path} — read it before you answer.","statementsOut":["{k} statement is left out unless you keep it.","{k} statements are left out unless you keep one."],"thin":"thin: says nothing a stranger could use","thinFrame":"Read as a stranger in your field: no particular in the situation, no reason or only the circumstance, and the call anyone would make. They are LEFT OUT unless you keep one by number.","thinOut":["{k} thin record is left out unless you keep it.","{k} thin records are left out unless you keep one."],"rangeRead":"Range read as {from} to {to}; dated records outside it are in their own group.","rangeReadNew":"Range read as {from} to {to}; new records dated outside it are in their own group. Records you approved before are not checked against it.","rangeReadNoIds":"Range read as {from} to {to}; new records dated outside it are in their own group. Records you approved before are not checked against it, and a new record with the same date, call, title or situation as one of them that changed or is gone is listed only under “New since you approved”, not in that group.","rangeUnread":"The range \"{range}\" could not be read as dates, so no outside-range group was built.","exceptions":"Least-sure records, in full","exceptionsFrame":"The records the assistant is least sure are clean after redaction. They are the least-sure ones, not the only risky ones; the full list below is the record.","exceptionsCap":"Capped at {cap}: {n} more were named and are not shown here.","noExceptions":"The assistant named none.","against":"Against the default — {k} of {n}","againstFrame":"The records where your call went against what the assistant, or a competent stranger in your field, would have advised from the situation alone. They are the part a buyer’s own AI cannot give them; the ordinary records beside them stay in full, as the other half of how you decide. The mark is the assistant’s reading, not a field: it is not sent.","againstChat":"Against the default: {k} of {n} — calls where you decided otherwise than a competent stranger in your field would have advised. The file lists them.","againstChatNone":"Against the default: none of the {n} — the assistant marked no call where you decided otherwise than a competent stranger in your field would have advised.","offDomain":"outside the domain you named","offDomainFrame":"The assistant’s reading: these may sit outside the domain this model is for. They stay unless you cross out the group; keep or cross out single ones by number.","askHead":"What only you can add — {k} of the {n} that go","askFrame":"An AI that consults your model reads each case’s reason to tell whether your call fits its situation, and learns which of your concerns wins from what lost. Your assistant looked in your sources first, and they do not say. Answer by number for the ones you remember; “I don’t remember” for the rest is a full answer. Nothing has been sent to avva: your answers go into the records you approve next.","askProgress":"For {label}, among other things, {need} published cases need a reason; two decisions merged into one case count as one. Records that go with a reason now: {have} of {n}.","solidLabel":"Solid","broadLabel":"Broad","askNone":"Every record that goes says why and what pulled the other way: nothing to ask.","askDone":"Nothing more to ask: every record that goes without a reason or the other side has been put to you.","askOutside":"Nothing more to ask before the records: the rest without a reason or the other side are outside your range or the domain you named, and you decide about those next. Any of them you keep goes in as it is.","askFileHead":"Still without a reason or the other side — {k} of the {n} that go","askFileFrame":"These go in as they are, and where a reason is missing the model says it was not recorded. If you remember one later, or what pulled the other way, tell your assistant the record’s number and it goes in.","askMore":["{m} more record lacks one: once you have answered these, you can ask your assistant for it.","{m} more records lack one: once you have answered these, you can ask your assistant for them."],"askMoreNext":["{m} more record lacks one: once you have answered these, you can ask your assistant for the next {cap}.","{m} more records lack one: once you have answered these, you can ask your assistant for the next {cap}."],"noReasonAsk":"Why? Where a record is marked “reason”, say in a few words why you decided it: the assistant writes it into that record’s reason, in your words, and shows it to you again. A call with no recorded reason still goes in, and the model says the reason was not recorded.","noOtherSideAsk":"What pulled the other way? Where a record is marked “the other side”, say what did — the option you turned down, the pressure you ruled against, what it had going for it: the assistant writes it into that record’s other side, in your words, and shows it to you again. Where nothing did, that is an answer too. Each one is a comparison the model learns from; a call with none still goes in.","moreRecords":"Showing records {from} to {to} of {n} in full. Ask for any other number, or the next block.","elsewhere":"{k} more listed in other groups","changed":"Changed since you approved them — {k}","changedFrame":"Each changed field, as you approved it and as it would be sent now. Nothing here is sent before you say yes; a change you cross out keeps the version you approved.","added":"New since you approved — {k}","removedSince":"In the approved file and not in this one — {k}","before":"before","after":"after","noChanges":"Nothing changed since you approved it.","noAgainst":"The assistant marked none.","againstMark":"against the default","flags":"Mechanical flags","flagsFrame":"Pattern matches, the same ones avva runs at publish, plus a check for records about avva itself. A match is a reason to look, not a verdict; what a shape still gives away is the assistant’s call.","noFlags":"No pattern matched.","question":"Every record is in full in the file — read it, or tell me you trust my selection and I will check it for you first; then: send these {n} to avva? Their text builds the draft and is not stored. Cross out any by group or by number.","rebuildQuestion":"Send these {n} to avva — their text builds the draft and is not stored — and is any call in your saved set one you would no longer make? Cross out any by group or by number; name a call you would no longer make and it is removed.","unknownFields":"Fields this script does not know — shown in full above as they are, not checked: {list}. A newer avva-studio plugin knows them; avva drops any field it does not know.","allRecords":"All records, in full","number":"No.","date":"date","sourceKind":"source","origin":"from","recordTitle":"title","context":"situation","decision":"decision","driver":"reason","otherSide":"the other side","condition":"condition","outcome":"what followed","revisited":"what you say today","kind":"kind","empty":"—","values":{},"flagKinds":{},"glosses":{}},"ru":{"title":"Записи на одобрение","nothingSent":"В avva пока ничего не отправлено.","exactly":"Если вы одобрите, будут отправлены эти записи — их текст, а не файл и не документы, из которых они взяты.","nothingElse":"Ничего больше с ними не уходит: ни вычеркнутое, ни остальная история.","placeholders":"Имена, клиенты, репозитории, номера задач, приватные ссылки и суммы сделок заменены на заполнители в скобках; пороги и правила остаются, потому что это правила, а не идентификаторы, — но цели клиента или критерии приёмки пилота, согласованные с одним клиентом, принадлежат этой работе и стоят среди записей, в которых ассистент уверен меньше всего.","notStored":"Одобренный текст строит черновик; копий этих записей avva не хранит — хранит модель, построенную из них, с вашими кейсами. Этот файл и есть запись; флаги ниже лишь подсказки.","whatIsRecord":"Что такое запись","definition":"Одно ваше решение, которое узнал бы посторонний: ситуация (обстановка и о чём именно было это решение), что вы решили, названная причина, другая сторона (что тянуло в другую сторону и чем это было хорошо), условие, которое ограничивало решение, и какого рода это было решение. Вашими словами, из источника, который прочитал ассистент.","firstRecord":"Первая запись целиком","groups":"Группы по источнику","group":"группа","records":"записей","noOrigin":"без метки источника","outsideRange":"вне вашего диапазона","instructions":"инструкции, не решения","instructionsFrame":"В источнике у них нет ни альтернативы, ни причины. Они остаются, если вы не вычеркнете группу; отдельные можно оставить или вычеркнуть по номеру.","statements":"утверждения, не решения","statementsFrame":"Ни в одной из них не видно, что вы выбирали: декларация или план без альтернативы и причины, продуктовый или маркетинговый текст, ответ на гипотетический вопрос, чужой текст или то, что написал ИИ-ассистент. Они НЕ уходят, если вы не оставите какую-то: назовите номер, скажите, что это было ваше решение, и почему.","needsEye":"Требует вашего взгляда","needsEyeFrame":"По строке на запись; каждая целиком есть в файле под своим номером.","authorship":"авторство неясно","clientMaterial":"из материалов клиента или работодателя","protected":"решение зависело от признака, который защищает закон","protectedFrame":"Возраст, пол, раса, религия, инвалидность, беременность, национальное происхождение и тому подобное. Опубликованное как ваша практика, такое решение может быть незаконным и может научить ИИ покупателя предвзятости, поэтому оно не становится общим правилом, пока вы не скажете, почему оно законно. Если решение защищает человека, как того требует закон, достаточно так и сказать.","shortCall":"слишком коротко, чтобы засчитать","shortCallFrame":"Решение короче {min} символов не засчитывается. Скажите каждое из них чуть подробнее, своими словами: ассистент впишет это в запись и покажет её снова.","fileLine":"Все записи целиком: {path} — прочитайте до ответа.","statementsOut":["{k} утверждение не уходит, если вы его не оставите.","{k} утверждения не уходят, если вы не оставите какое-то.","{k} утверждений не уходят, если вы не оставите какое-то."],"thin":"тонкие: ничего не дают постороннему","thinFrame":"Прочитаны глазами коллеги по профессии, который вас не знает: в ситуации нет конкретики, причины нет или названо только обстоятельство, и так решил бы любой. Они НЕ уходят, если вы не оставите какую-то по номеру.","thinOut":["{k} тонкая запись не уходит, если вы её не оставите.","{k} тонкие записи не уходят, если вы не оставите какую-то.","{k} тонких записей не уходят, если вы не оставите какую-то."],"rangeRead":"Диапазон прочитан как {from} — {to}; датированные записи вне его вынесены в отдельную группу.","rangeReadNew":"Диапазон прочитан как {from} — {to}; новые датированные записи вне его вынесены в отдельную группу. Записи, которые вы одобрили раньше, с ним не сверяются.","rangeReadNoIds":"Диапазон прочитан как {from} — {to}; новые датированные записи вне его вынесены в отдельную группу. Записи, которые вы одобрили раньше, с ним не сверяются, а новая запись с той же датой, решением, названием или ситуацией, что у одной из них — изменённой или исчезнувшей, — показана только в разделе «Новое после вашего одобрения», не в этой группе.","rangeUnread":"Диапазон «{range}» не удалось прочитать как даты, поэтому группа вне диапазона не построена.","exceptions":"Записи, в которых ассистент уверен меньше всего, целиком","exceptionsFrame":"Записи, в чистоте которых после редактирования ассистент уверен меньше всего. Это наименее надёжные, а не единственные рискованные; полный список ниже и есть запись.","exceptionsCap":"Ограничено {cap}: ещё {n} названы, но здесь не показаны.","noExceptions":"Ассистент не назвал ни одной.","against":"Против очевидного — {k} из {n}","againstFrame":"Записи, где вы решили не так, как посоветовал бы ассистент или грамотный посторонний из вашей области, видя одну ситуацию. Это та часть, которую ИИ покупателя сам не даст; обычные записи рядом с ними остаются целиком — это вторая половина того, как вы решаете. Пометка — прочтение ассистента, а не поле: она не отправляется.","againstChat":"Против очевидного: {k} из {n} — решения, где вы поступили не так, как посоветовал бы грамотный посторонний из вашей области. Список — в файле.","againstChatNone":"Против очевидного: ни одной из {n} — ассистент не пометил решений, где вы поступили не так, как посоветовал бы грамотный посторонний из вашей области.","offDomain":"вне названного вами домена","offDomainFrame":"Прочтение ассистента: эти записи, возможно, не относятся к домену модели. Они остаются, если вы не вычеркнете группу; отдельные можно оставить или вычеркнуть по номеру.","askHead":"Что можете добавить только вы — {k} из {n}, которые уходят","askFrame":"ИИ, который обращается к вашей модели, по причине кейса понимает, подходит ли ваше решение к его ситуации, а по тому, что проиграло, — какой из ваших доводов для вас важнее. Ассистент сначала поискал в ваших источниках — там этого нет. Ответьте по номерам на те, что помните; «не помню» про остальные — полный ответ. В avva ещё ничего не отправлено: ответы войдут в записи, которые вы одобрите следующим шагом.","askProgress":"Для метки {label}, среди прочего, нужно {need} опубликованных кейсов с причиной; два решения, объединённые в один кейс, считаются за один. Уходящих записей с причиной сейчас: {have} из {n}.","solidLabel":"Solid","broadLabel":"Broad","askNone":"У каждой уходящей записи есть причина и другая сторона: спрашивать нечего.","askDone":"Больше спрашивать нечего: обо всех уходящих записях без причины или другой стороны вас уже спросили.","askOutside":"Больше до записей спрашивать нечего: остальные записи без причины или другой стороны — вне вашего диапазона или названного вами домена, и о них вы решите следующим шагом. Те из них, что вы оставите, войдут как есть.","askFileHead":"Пока без причины или другой стороны — {k} из {n}, которые уходят","askFileFrame":"Они войдут как есть; где причины нет, модель скажет, что она не записана. Если позже вспомните причину или что тянуло в другую сторону, назовите ассистенту номер записи — и это войдёт.","askMore":["Ещё в {m} записи этого нет: когда ответите на эти, можете попросить ассистента показать и её.","Ещё в {m} записях этого нет: когда ответите на эти, можете попросить ассистента показать и их.","Ещё в {m} записях этого нет: когда ответите на эти, можете попросить ассистента показать и их."],"askMoreNext":["Ещё в {m} записи этого нет: когда ответите на эти, можете попросить ассистента показать следующие {cap}.","Ещё в {m} записях этого нет: когда ответите на эти, можете попросить ассистента показать следующие {cap}.","Ещё в {m} записях этого нет: когда ответите на эти, можете попросить ассистента показать следующие {cap}."],"noReasonAsk":"Почему? Где у записи пометка «причина», скажите в двух словах, почему решили так: ассистент впишет это в её поле «причина» вашими словами и покажет запись снова. Решение без записанной причины всё равно войдёт, и модель скажет, что причина не записана.","noOtherSideAsk":"Что тянуло в другую сторону? Где у записи пометка «другая сторона», скажите, что именно — вариант, который вы отвергли, давление, против которого решили, и чем он был хорош: ассистент впишет это в её поле «другая сторона» вашими словами и покажет запись снова. Где ничего не тянуло, это тоже ответ. Каждый такой ответ — сравнение, на котором модель учится; решение без него всё равно войдёт.","moreRecords":"Целиком показаны записи с {from} по {to} из {n}. Попросите любой другой номер или следующий блок.","elsewhere":"ещё {k} в других группах","changed":"Изменено после вашего одобрения — {k}","changedFrame":"Каждое изменённое поле: как вы его одобрили и как оно ушло бы сейчас. Ничего отсюда не отправляется до вашего «да»; вычеркнутое изменение оставляет одобренную версию.","added":"Новое после вашего одобрения — {k}","removedSince":"Есть в одобренном файле, нет в этом — {k}","before":"было","after":"стало","noChanges":"После вашего одобрения ничего не изменилось.","noAgainst":"Ассистент не пометил ни одной.","againstMark":"против очевидного","flags":"Механические флаги","flagsFrame":"Совпадения с шаблонами — теми же, что avva проверяет при публикации, — и проверка на записи о самой avva. Совпадение — повод посмотреть, а не вердикт; что ещё выдаёт форма записи, решает ассистент.","noFlags":"Ни один шаблон не сработал.","question":"Все записи целиком лежат в файле — прочитайте его или скажите, что доверяете моему отбору, и я сначала проверю его за вас; затем: отправить эти {n} в avva? Их текст строит черновик и не хранится. Вычёркивайте группами или по номерам.","rebuildQuestion":"Отправить эти {n} в avva — их текст строит черновик и не хранится, — и есть ли в сохранённом наборе решение, которое вы сейчас уже не приняли бы? Вычёркивайте группами или по номерам; назовите решение, которое уже не приняли бы, — и оно будет удалено.","unknownFields":"Поля, которых этот скрипт не знает, — показаны выше целиком, как есть, и не проверены по форме записи: {list}. Их знает более новый плагин avva-studio; поле, которого avva не знает, она отбрасывает.","allRecords":"Все записи целиком","number":"№","date":"дата","sourceKind":"источник","origin":"откуда","recordTitle":"название","context":"ситуация","decision":"решение","driver":"причина","otherSide":"другая сторона","condition":"условие","outcome":"что было потом","revisited":"как вы решили бы сегодня","kind":"вид решения","empty":"—","values":{"chat-history":"история чатов с ИИ","code-and-reviews":"код и ревью","issues-and-roadmaps":"задачи и планы","documents":"документы","customer-systems":"поддержка и CRM","guided-recall":"вспомнено в разговоре","other":"другие подключённые инструменты","reject":"отказ","choose":"выбор","require":"требование","accept":"согласие"},"flagKinds":{"email address":"адрес электронной почты","private or identifying URL":"приватная или опознающая ссылка","credential or secret":"учётные данные или секрет","ticket or repository identifier":"номер задачи или репозитория","NDA or confidential marker":"пометка NDA или «конфиденциально»","phone number":"номер телефона","passport or national-id number":"номер паспорта или удостоверения личности","secret or confidential (RU)":"пометка «секретно» или «конфиденциально»","secret or confidential (ES)":"испанская пометка «конфиденциально» или «только для внутреннего пользования»","sensitive structure (card number, contact or credential shape)":"чувствительная структура (номер карты, контакт или вид учётных данных)","names avva: keep it if it is a decision about your own product, cross it out if it is about building this model":"называет avva: оставьте, если это решение о вашем собственном продукте; вычеркните, если оно о том, как строится эта модель"},"glosses":{"согласие (accept)":"согласие (accept — принял то, от чего мог отказаться)"}},"es":{"title":"Registros para aprobar","nothingSent":"Todavía no se ha enviado nada a avva.","exactly":"Si das el visto bueno, se enviarán estos registros: su texto, nunca un archivo, y nunca los documentos de los que salieron.","nothingElse":"Con ellos no va nada más: ni lo que tachaste ni el resto de tu historial.","placeholders":"Los nombres, los clientes, los repositorios, los números de ticket, los enlaces privados y los importes de operaciones se sustituyen por marcadores entre corchetes; los umbrales de tus políticas se quedan, porque son reglas, no datos que identifiquen a nadie. Pero los objetivos de un cliente, o los criterios de aceptación de un piloto acordados con un cliente, son de ese encargo, y están entre los registros de los que el asistente está menos seguro.","notStored":"El texto aprobado sirve para construir el borrador; avva no guarda ninguna copia de estos registros: guarda el modelo construido con ellos, tus casos incluidos. Lo que cuenta es este archivo; los avisos de abajo son solo pistas.","whatIsRecord":"Qué es un registro","definition":"Una decisión que tomaste, tal como la reconocería un desconocido: la situación (el contexto, y de qué trataba esta decisión en concreto), lo que decidiste, el motivo que diste, lo que empujaba en contra (la opción o la presión contraria, y qué tenía a su favor), la condición que la limitaba y qué tipo de decisión fue. Con tus propias palabras, sacado de una fuente que leyó el asistente.","firstRecord":"El primer registro, completo","groups":"Grupos por origen","group":"grupo","records":"registros","noOrigin":"sin fuente indicada","outsideRange":"fuera de tu periodo","instructions":"instrucciones, no decisiones","instructionsFrame":"En la fuente no consta ninguna alternativa ni ningún motivo. Se quedan salvo que taches el grupo; puedes conservar o tachar cada una por su número.","statements":"afirmaciones, no decisiones","statementsFrame":"En ninguna se te ve eligiendo: una declaración o un plan sin alternativa ni motivo, un texto de producto o de marketing, la respuesta a una pregunta hipotética, un texto de otra persona o algo que escribió un asistente de IA. NO SE ENVÍAN salvo que conserves alguna: di su número, que fue decisión tuya y por qué.","needsEye":"Necesita que lo mires tú","needsEyeFrame":"Una línea por registro; cada uno está completo en el archivo, con su número.","authorship":"autoría poco clara","clientMaterial":"del material de un cliente o de tu empleador","protected":"dependió de una característica que protege la ley","protectedFrame":"Edad, sexo, raza, religión, discapacidad, embarazo, origen nacional y similares. Publicada como tu práctica, una decisión así puede ser ilegal y puede enseñarle un sesgo a la IA de un comprador, así que nunca se convierte en una regla general salvo que digas por qué es legal. Si la decisión protege a alguien, como pide la ley, basta con decirlo.","shortCall":"demasiado corta para contar","shortCallFrame":"Una decisión de menos de {min} caracteres no cuenta. Di cada una con algunas palabras más, como tú lo dirías: el asistente lo escribe en el registro y te lo vuelve a enseñar.","fileLine":"Todos los registros, completos: {path}. Léelo antes de responder.","statementsOut":["{k} afirmación no se envía salvo que la conserves.","{k} afirmaciones no se envían salvo que conserves alguna."],"thin":"demasiado escuetos: no le dicen nada útil a un desconocido","thinFrame":"Leídos como los leería un colega de tu campo que no te conoce: la situación no da ningún detalle concreto, no hay motivo o solo la circunstancia, y la decisión es la que tomaría cualquiera. NO SE ENVÍAN salvo que conserves alguno por su número.","thinOut":["{k} registro demasiado escueto no se envía salvo que lo conserves.","{k} registros demasiado escuetos no se envían salvo que conserves alguno."],"rangeRead":"Periodo leído como del {from} al {to}; los registros con fecha fuera de él van en un grupo aparte.","rangeReadNew":"Periodo leído como del {from} al {to}; los registros nuevos con fecha fuera de él van en un grupo aparte. Los que ya aprobaste no se comparan con él.","rangeReadNoIds":"Periodo leído como del {from} al {to}; los registros nuevos con fecha fuera de él van en un grupo aparte. Los que ya aprobaste no se comparan con él, y un registro nuevo con la misma fecha, decisión, título o situación que uno de ellos que cambió o ya no está aparece solo en “Nuevo desde tu aprobación”, no en ese grupo.","rangeUnread":"El periodo “{range}” no se pudo leer como fechas, así que no se creó el grupo de fuera del periodo.","exceptions":"Registros de los que el asistente está menos seguro, completos","exceptionsFrame":"Los registros de los que el asistente está menos seguro de que hayan quedado limpios tras quitar los datos identificativos. Son los menos seguros, no los únicos con riesgo; lo que cuenta es la lista completa de abajo.","exceptionsCap":"Limitado a {cap}: se señalaron {n} más que no se muestran aquí.","noExceptions":"El asistente no señaló ninguno.","against":"Contra lo obvio — {k} de {n}","againstFrame":"Los registros en los que decidiste en contra de lo que te habría aconsejado el asistente, o un profesional competente de tu campo que no te conoce, viendo solo la situación. Son la parte que la IA de un comprador no puede darle por sí sola; los registros habituales que los acompañan se quedan completos, como la otra mitad de tu forma de decidir. La marca es una lectura del asistente, no un campo: no se envía.","againstChat":"Contra lo obvio: {k} de {n}, decisiones en las que hiciste algo distinto de lo que te habría aconsejado un profesional competente de tu campo. El archivo las enumera.","againstChatNone":"Contra lo obvio: ninguno de los {n}. El asistente no marcó ninguna decisión en la que hicieras algo distinto de lo que te habría aconsejado un profesional competente de tu campo.","offDomain":"fuera del área que indicaste","offDomainFrame":"Lectura del asistente: estos registros podrían quedar fuera del área de este modelo. Se quedan salvo que taches el grupo; puedes conservar o tachar cada uno por su número.","askHead":"Lo que solo tú puedes añadir — {k} de los {n} que se envían","askFrame":"Una IA que consulta tu modelo lee el motivo de cada caso para saber si tu decisión encaja con su situación, y aprende cuál de tus prioridades pesa más por lo que perdió. Tu asistente buscó primero en tus fuentes, y ahí no consta. Responde por número a los que recuerdes; “no me acuerdo” es una respuesta completa para el resto. Todavía no se ha enviado nada a avva: tus respuestas van a los registros que apruebas después.","askProgress":"Para la etiqueta {label}, entre otras cosas, hacen falta {need} casos publicados con motivo; dos decisiones fusionadas en un caso cuentan como uno. Registros que se envían con motivo ahora: {have} de {n}.","solidLabel":"Sólida","broadLabel":"Amplia","askNone":"Todos los registros que se envían dicen por qué y qué empujaba en contra: no hay nada que preguntar.","askDone":"No queda nada que preguntar: ya se te ha preguntado por todos los registros que se envían sin motivo o sin lo que empujaba en contra.","askOutside":"No queda nada que preguntar antes de los registros: los demás sin motivo o sin lo que empujaba en contra están fuera de tu periodo o del área que indicaste, y sobre ellos decides después. Los que conserves se envían tal como están.","askFileHead":"Todavía sin motivo o sin lo que empujaba en contra — {k} de los {n} que se envían","askFileFrame":"Se envían tal como están, y donde falta el motivo, el modelo dice que no se registró. Si más adelante recuerdas uno, o qué empujaba en contra, dile a tu asistente el número del registro y se añade.","askMore":["Falta lo mismo en {m} registro más: cuando respondas a estos, puedes pedirle a tu asistente que te lo muestre.","Falta lo mismo en {m} registros más: cuando respondas a estos, puedes pedirle a tu asistente que te los muestre."],"askMoreNext":["Falta lo mismo en {m} registro más: cuando respondas a estos, puedes pedirle a tu asistente los {cap} siguientes.","Falta lo mismo en {m} registros más: cuando respondas a estos, puedes pedirle a tu asistente los {cap} siguientes."],"noReasonAsk":"¿Por qué? Donde un registro está marcado con “motivo”, di en pocas palabras por qué lo decidiste: el asistente lo escribe en el motivo de ese registro, con tus palabras, y te lo vuelve a enseñar. Una decisión sin motivo registrado también se envía, y el modelo dice que el motivo no se registró.","noOtherSideAsk":"¿Qué empujaba en contra? Donde un registro está marcado con “lo que empujaba en contra”, di qué era: la opción que descartaste, la presión contra la que decidiste, qué tenía a su favor. El asistente lo escribe en ese campo del registro, con tus palabras, y te lo vuelve a enseñar. Si no había nada, eso también es una respuesta. Cada respuesta es una comparación de la que aprende el modelo; una decisión sin ella también se envía.","moreRecords":"Se muestran completos los registros del {from} al {to} de {n}. Pide cualquier otro número, o el bloque siguiente.","elsewhere":"{k} más en otros grupos","changed":"Cambiado desde tu aprobación — {k}","changedFrame":"Cada campo cambiado, tal como lo aprobaste y tal como se enviaría ahora. Nada de esto se envía antes de que digas que sí; si tachas un cambio, se queda la versión que aprobaste.","added":"Nuevo desde tu aprobación — {k}","removedSince":"En el archivo aprobado y no en este — {k}","before":"antes","after":"después","noChanges":"Nada ha cambiado desde tu aprobación.","noAgainst":"El asistente no marcó ninguno.","againstMark":"contra lo obvio","flags":"Avisos automáticos","flagsFrame":"Coincidencias con patrones, los mismos que avva aplica al publicar, más una comprobación de los registros que hablan de la propia avva. Una coincidencia es un motivo para mirar, no un veredicto; lo que una forma todavía pueda delatar lo decide el asistente.","noFlags":"Ningún patrón coincidió.","question":"Todos los registros están completos en el archivo: léelo, o dime que te fías de mi selección y antes los reviso por ti; después: ¿envío estos {n} a avva? Su texto sirve para construir el borrador y no se guarda. Tacha los que quieras, por grupo o por número.","rebuildQuestion":"¿Envío estos {n} a avva (su texto sirve para construir el borrador y no se guarda) y hay en tu conjunto guardado alguna decisión que hoy ya no tomarías? Tacha los que quieras, por grupo o por número; nombra una decisión que ya no tomarías y se quita.","unknownFields":"Campos que este script no conoce, mostrados arriba completos y tal como están, sin comprobar: {list}. Un plugin avva-studio más reciente los conoce; avva descarta cualquier campo que no conozca.","allRecords":"Todos los registros, completos","number":"N.º","date":"fecha","sourceKind":"fuente","origin":"origen","recordTitle":"título","context":"situación","decision":"decisión","driver":"motivo","otherSide":"lo que empujaba en contra","condition":"condición","outcome":"qué pasó después","revisited":"lo que dices hoy","kind":"tipo de decisión","empty":"—","values":{"chat-history":"historial de chats con IA","code-and-reviews":"código y revisiones","issues-and-roadmaps":"tareas y planes","documents":"documentos","customer-systems":"soporte y CRM","guided-recall":"recordado en conversación","other":"otras herramientas conectadas","reject":"rechazo","choose":"elección","require":"exigencia","accept":"aceptación"},"flagKinds":{"email address":"dirección de correo","private or identifying URL":"enlace privado o que identifica","credential or secret":"credencial o secreto","ticket or repository identifier":"número de ticket o de repositorio","NDA or confidential marker":"marca de NDA o de “confidencial”","phone number":"número de teléfono","passport or national-id number":"número de pasaporte o documento de identidad","passport or national-id marker":"mención de pasaporte o documento de identidad","secret or confidential (RU)":"marca rusa de “secreto” o “confidencial”","secret or confidential (ES)":"marca de “confidencial”, “reservado” o “difusión limitada”","sensitive structure (card number, contact or credential shape)":"estructura sensible (número de tarjeta, contacto o forma de credencial)","passport or secret marker":"mención de pasaporte o de “secreto”","names avva: keep it if it is a decision about your own product, cross it out if it is about building this model":"menciona avva: consérvalo si es una decisión sobre tu propio producto; táchalo si trata de cómo se construye este modelo"},"glosses":{"aceptación (accept)":"aceptación (accept — aceptaste algo que podías haber rechazado)"}}}
const EXCEPTIONS_CAP = 15
const CLIENT_ORIGIN = new RegExp("\\[(?:the\\s+)?(?:[Cc]lient|CLIENT|[Cc]ustomer|CUSTOMER|[Кк]лиент\\p{L}*|КЛИЕНТ\\p{L}*|[Зз]аказчик\\p{L}*|ЗАКАЗЧИК\\p{L}*)(?:[\\s_]*(?:\\p{Lu}|\\d+)(?![\\p{L}\\p{N}])[^\\]]*|'s[^\\]]*)?\\]", "u")
const CALL_WORDS = 15
const MIN_DECISION = 8
const FENCED_CODE = new RegExp("```[\\s\\S]*?```", "g")
const TEXT_FIELDS = ['title', 'origin', 'context', 'decision', 'driver', 'otherSide', 'condition', 'outcome', 'revisited']

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
	пяти: 5,
	un: 1,
	una: 1,
	dos: 2,
	tres: 3,
	cuatro: 4,
	cinco: 5,
	seis: 6,
	siete: 7,
	ocho: 8,
	nueve: 9,
	diez: 10,
	once: 11,
	doce: 12,
	dieciocho: 18,
	veinticuatro: 24
};
/** A date as the span rules take it: a year, or a year and month, or a whole ISO day. */
const RANGE_DATE = String.raw`\d{4}(?:-\d{2})?(?:-\d{2})?`;
/** Spanish puts an article, or "el año", between a preposition and its year: "desde el 2021", "hasta el año 2022". */
const RANGE_ARTICLE = String.raw`(?:el\s+)?(?:año\s+)?`;
/** The unit of a relative span, in the three languages the field is typed in. */
const RANGE_UNIT = String.raw`years?|months?|weeks?|год\p{L}*|лет|месяц\p{L}*|недел\p{L}*|años?|mes(?:es)?|semanas?`;
/** A rule's opening word starts a word: "бизнес 2022" holds no "с 2022". (A "last" inside a word, "penúltimo año", leaves its head beside the match, which `onlyFiller` refuses.) */
const WORD_START = String.raw`(?<![\p{L}\p{N}_])`;
/**
* The words that take a span or a start back out, or loosen it, as stems and
* phrases in the three languages: "except 2019-2022", "everything other than
* 2019-2022", "since 2020 but not the last year", "за исключением 2019–2022",
* «не считая», "fuera de 2019-2022", "2018 to 2024 or so", "2018-2024-ish",
* "desde 2019 o así", and a tilde, an approximately-equals or a plus-minus
* sign. With one beside it a span or a start is unread: read anyway, an
* exclusion counts the very years it excludes, and a loose bound counts a
* record just past it as outside.
*/
const RANGE_QUALIFIERS = [
	String.raw`excep\p{L}*`,
	String.raw`excl\p{L}*`,
	"not",
	"no",
	"but",
	"without",
	"aside",
	"apart",
	"besides",
	String.raw`other\s+than`,
	"outside",
	"minus",
	"кроме",
	"без",
	String.raw`исключ\p{L}*`,
	"помимо",
	"вне",
	"не",
	"но",
	"sin",
	"salvo",
	"menos",
	"fuera",
	"aparte",
	"pero",
	"about",
	"around",
	"roughly",
	String.raw`approx\p{L}*`,
	"circa",
	String.raw`or\s+so`,
	String.raw`give\s+or\s+take`,
	String.raw`more\s+or\s+less`,
	"примерно",
	"около",
	"приблизительно",
	String.raw`где-?то`,
	String.raw`плюс-?минус`,
	String.raw`aprox\p{L}*`,
	"alrededor",
	"cerca",
	String.raw`o\s+así`
];
const RANGE_QUALIFIER = new RegExp(String.raw`${WORD_START}(?:${RANGE_QUALIFIERS.join("|")})(?![\p{L}\p{N}_])|(?<![\p{L}_])-?ish(?![\p{L}\p{N}_])|[~≈±]`, "u");
/**
* The words a reading may stand beside and still mean what it read: "2023
* only", "in the last year", "solo 2023", "en los últimos 12 meses", "в 2023
* году", "весь 2023", "all of 2023". One list for the lone-year rule and the
* relative rules. Any other word bounds or qualifies the reading — "until
* 2022", "hasta 2022", "antes de 2022", "my last two years at Acme", "el
* último año de la carrera" — and read anyway, each counts records outside
* a range the expert never set.
*/
const RANGE_FILLER = new Set([
	"only",
	"just",
	"in",
	"the",
	"year",
	"during",
	"within",
	"over",
	"all",
	"of",
	"whole",
	"this",
	"everything",
	"anything",
	"from",
	"solo",
	"sólo",
	"solamente",
	"únicamente",
	"unicamente",
	"en",
	"el",
	"la",
	"los",
	"las",
	"del",
	"año",
	"durante",
	"todo",
	"только",
	"лишь",
	"в",
	"во",
	"течение",
	"год",
	"году",
	"года",
	"г",
	"гг",
	"весь"
]);
/**
* What is left of the words once a rule's match is taken out holds nothing
* that changes it: no other number ("los últimos 12 meses y 2019", "2019-22"),
* no bound written as a symbol (">= 2020", "2018+", "<2022", "2020 ->", "~2020"),
* and no word outside `RANGE_FILLER`. No word of `RANGE_QUALIFIER` is filler:
* "roughly the last 2 years" or "about 2020" is as loose here as it is beside
* a span.
*/
function onlyFiller(text, matched) {
	const rest = text.replace(matched, " ");
	if (/[\d+<>≤≥→\-–—/~≈±]/u.test(rest)) return false;
	return rest.split(/[^\p{L}]+/u).filter(Boolean).every((word) => RANGE_FILLER.has(word));
}
/** A count word or a numeral, or `undefined` when it is neither. */
function rangeCount(raw) {
	return /^\d+$/.test(raw) ? Number(raw) : WORD_NUMBERS[raw];
}
/**
* "Recent years", how many unsaid: a plural unit with no count ("the last
* years", "los últimos meses", "последние годы"), or a plural "last" with no
* count ("последние года", "последних месяцев", where the unit's own form
* is also the singular's). Read as one, each counts a record from two years
* ago as outside.
*/
const COUNTLESS_PLURAL = /^(?:years|months|weeks|años|meses|semanas|годы|месяцы|недели|лет)$/u;
const PLURAL_LAST = /^(?:последние|последних|прошлые|прошлых|[uú]ltim[oa]s)$/u;
/** `raw` units back from today (one when no count is said), or null when the count is unread or past fifty. */
function rangeBack(raw, unit, now, last = "") {
	if (raw === undefined && (COUNTLESS_PLURAL.test(unit) || PLURAL_LAST.test(last))) return null;
	const n = raw === undefined ? 1 : rangeCount(raw);
	if (!n || n > 50) return null;
	const ms = /^week|^недел|^semana/u.test(unit) ? 7 * 24 * 60 * 60 * 1e3 : /^month|^месяц|^mes/u.test(unit) ? MONTHS : YEARS;
	return {
		from: day(now.getTime() - n * ms),
		to: day(now.getTime())
	};
}
/**
* Reads the range, or returns null when the words do not state one the code
* can defend — and never one that starts after today ("2027", "since 2030"),
* which no dated record could fall inside. `now` is injectable for tests.
*/
function parseDateRange(words, now = new Date()) {
	const range = readRange(words, now);
	return range && range.from <= day(now.getTime()) ? range : null;
}
function readRange(words, now) {
	/*
	* A Russian range is usually said with "за" in front — "за год", "за два
	* года", "за последний год" — and "полгода" / "полтора года" are one word
	* each. The second real expert set "за год" (2026-10-14); unread, the
	* receipt counted nothing outside it and the expert was never told. The
	* preposition is dropped before the relative rule so "последний" is not
	* read as a number word, and the halves become months: "полгода",
	* "полтора года", "medio año", "año y medio", "a year and a half". A half
	* left after that ("dos años y medio", "два с половиной года") is words
	* beside the reading that `onlyFiller` refuses, so it is unread rather
	* than read as the whole years before it.
	*/
	const text = words.trim().toLowerCase().replace(/\s+/g, " ").replace(/(^|\s)за\s+/gu, "$1").replace(/полтора\s+года/gu, "18 месяцев").replace(/полгода/gu, "6 месяцев").replace(/(?:un\s+)?año\s+y\s+medio/gu, "18 meses").replace(/medio\s+año/gu, "6 meses").replace(/(?:(?:a|one)\s+)?year\s+and\s+a\s+half/gu, "18 months").replace(/half\s+(?:a\s+)?year/gu, "6 months");
	if (!text) return null;
	const today = day(now.getTime());
	/* The span and since rules keep words beside them ("2019 to 2022 at
	Northwind", "desde 2021 hasta hoy") but no other number and no word that
	takes the range back out or loosens it: "2021 a 2023 y 2025", "12 meses
	a partir de 2020" and "except 2019-2022" read as their first part are
	wrong. */
	const stands = (matched) => {
		const rest = text.replace(matched, " ");
		return !/\d/.test(rest) && !RANGE_QUALIFIER.test(rest);
	};
	// "2024-01 to 2025-06", "2021..2023", "2022 – 2024", "с 2020 по 2023", "2019 a 2022", "del 2019 al 2022", "desde 2019 hasta 2022"
	const span = new RegExp(String.raw`(${RANGE_DATE})\s*(?:to|until|through|–|—|-|\.\.|по|до|al|a|hasta)\s*${RANGE_ARTICLE}(${RANGE_DATE})`, "u").exec(text) ?? new RegExp(String.raw`(?:between|entre|между)\s+${RANGE_ARTICLE}(${RANGE_DATE})\s+(?:and|y|и)\s+${RANGE_ARTICLE}(${RANGE_DATE})`, "u").exec(text);
	if (span) {
		if (!stands(span[0])) return null;
		const from = clampDay(span[1], false);
		const to = clampDay(span[2], true);
		return from && to && from <= to ? {
			from,
			to
		} : null;
	}
	// "since 2021", "from 2021", "с 2021", "desde 2021", "desde el 2021", "a partir de 2021", "начиная с 2020"
	const since = new RegExp(String.raw`${WORD_START}(?:since|from|starting|с|desde|a partir del?)\s+${RANGE_ARTICLE}(${RANGE_DATE})`, "u").exec(text);
	if (since) {
		if (!stands(since[0])) return null;
		const from = clampDay(since[1], false);
		return from ? {
			from,
			to: today
		} : null;
	}
	// "los dos últimos años", "два последних года" — the count before "last", which the next rule would read as one.
	const countFirst = new RegExp(String.raw`(\d+|\p{L}+)\s+([uú]ltim\p{L}*|последн\p{L}*)\s+(${RANGE_UNIT})`, "u").exec(text);
	if (countFirst && rangeCount(countFirst[1]) !== undefined) {
		return onlyFiller(text, countFirst[0]) ? rangeBack(countFirst[1], countFirst[3], now, countFirst[2]) : null;
	}
	// "the last year", "the past 18 months", "last two years", "последний год", "последние 2 года", "los últimos 12 meses", "el último año"
	const relative = new RegExp(String.raw`(last|past|previous|последн\p{L}*|прошл\p{L}*|[uú]ltim\p{L}*)\s+(?:(\d+|\p{L}+)\s+)?(${RANGE_UNIT})`, "u").exec(text);
	if (relative) {
		if (!onlyFiller(text, relative[0])) return null;
		/* "last year", "previous year", "за прошлый год" and "el año pasado"
		name the calendar year as often as the twelve months before today,
		and the two count different records. "The last year" and "the past
		year" are the twelve months; with a count ("last 2 years") it is too. */
		if (relative[2] === undefined && (/^(?:previous|прошл\p{L}*)$/u.test(relative[1]) || relative[1] === "last" && !/(?:^|\s)the\s+last\s/u.test(text))) {
			return null;
		}
		return rangeBack(relative[2], relative[3], now, relative[1]);
	}
	// "год", "2 года", "18 months", "12 meses" — a bare span with no "last" in front, which is
	// how "за год" and "за 18 месяцев" arrive once the preposition is dropped. Four digits
	// are a year, not a count: "за 2023 год" is the year 2023, read by the rule below.
	const bare = new RegExp(String.raw`^(?:(\d+|\p{L}+)\s+)?(${RANGE_UNIT})$`, "u").exec(text);
	if (bare && !/^\d{4}$/.test(bare[1] ?? "")) return rangeBack(bare[1], bare[2], now);
	// "2023", "2023 only", "in 2019", "solo 2023", "el año 2023", "2023 г.", "весь 2023", "2023 год" — and nothing else beside it.
	const year = /(?:^|\D)((?:19|20)\d{2})(?:\D|$)/.exec(text);
	if (year && onlyFiller(text, year[1])) {
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
const opts = { range: '', lang: '', exceptions: '', against: '', instructions: '', statements: '', thin: '', authorship: '', client: '', protected: '', 'off-domain': '', records: '', before: '', asked: '' }
// Two outputs, one render. The FILE beside the json holds every record in
// full: it is what the expert reads before they approve. STDOUT is what the
// assistant puts in the chat: the header, the first record, the group table,
// what needs the expert's eye, the least-sure records, the flags and the one
// question — never every record, which on the founder's run of 2026-10-02 was
// one 25,451-character message. Both are this script's render of the json,
// never retyped by a model. --sheet is accepted from older skills and changes
// nothing: the file is always written.
let rebuild = false
// --ask prints only what only the expert can add — its own message, before
// the records to approve, so the ask is not buried under the sheet.
let askOnly = false
let jsonPath = ''
// The options this script knows, one list for the parser and the typo check.
const VALUE_OPTIONS = ['--range', '--lang', '--exceptions', '--against', '--instructions', '--statements', '--thin', '--authorship', '--client', '--protected', '--off-domain', '--records', '--before', '--asked']
const KNOWN_OPTIONS = [...VALUE_OPTIONS, '--sheet', '--rebuild', '--ask']
// Letters to change, add or drop to turn one word into another (Levenshtein).
const editDistance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length]
}
for (let i = 0; i < args.length; i += 1) {
  const a = args[i]
  if (VALUE_OPTIONS.includes(a)) {
    opts[a.slice(2)] = String(args[i + 1] ?? '')
    i += 1
  } else if (a === '--sheet') continue
  else if (a === '--rebuild') rebuild = true
  else if (a === '--ask') askOnly = true
  else if (a.startsWith('-') && a.length > 1) {
    // An option this script does not know belongs to a newer avva: a warning,
    // never an exit, the way a field it does not know is shown and not
    // refused. A value after it goes with it, unless it is the json. One a
    // letter or two off a known option is a typo, and a typo exits: a
    // mistyped --asked that warned re-listed every record already asked.
    const near = KNOWN_OPTIONS.map((known) => [known, editDistance(a.split('=')[0], known)])
      .filter(([, d]) => d <= 2)
      .sort((x, y) => x[1] - y[1])
      .map(([known]) => known)
    if (near.length) fail(['unknown option ' + a + ': did you mean ' + near.join(' or ') + '?'])
    const next = args[i + 1]
    const value = next !== undefined && !String(next).startsWith('-') && !/\.json$/i.test(String(next))
    console.error('WARNING: option ' + a + (value ? ' ' + next : '') + ' is one this script does not know, so it changes nothing here. If it is a typo, fix it and run this again; otherwise the plugin is older than avva: update it.')
    if (value) i += 1
  } else if (jsonPath) fail(['two files named, ' + jsonPath + ' and ' + a + ': this script renders one json. If ' + a + ' is the value of an option, that option is one this script does not know: the plugin is older than avva, update it.'])
  else jsonPath = a
}
if (!jsonPath) fail(['usage: node render-sheet.mjs <avva-decisions-*.json> [--range "<words>"] [--exceptions 3,7] [--against 2,5] [--instructions 4,9] [--statements 8,12] [--thin 3,9] [--authorship 5] [--client 2,6] [--protected 7] [--off-domain 6] [--records 11-20] [--before <the approved json> [--rebuild]] [--ask [--asked 3,5,9]] [--lang ru|en|es]'])
// A rebuild's sheet shows only what changed against the approved file, so its
// one question carries the way out for an unchanged call the expert no longer
// makes; without the approved file there is no "saved set" to ask about.
if (rebuild && !opts.before) fail(['--rebuild goes with --before <the approved json>: the question it asks is about the saved set'])

let source = ''
let parsed
try {
  source = readFileSync(jsonPath, 'utf8')
  parsed = JSON.parse(source)
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

const cyrillic = (text) => (text.match(/\p{Script=Cyrillic}/gu) || []).length, latin = (text) => (text.match(/\p{Script=Latin}/gu) || []).length
const sample = records.map((r) => (r.decision || '') + ' ' + (r.context || '')).join(' ')
// Small words tell Spanish from English, and from its neighbors: a language the sheet does not speak gets English.
const hits = (words) => (sample.match(new RegExp('(?<![\\p{L}\\p{N}])(?:' + words + ')(?![\\p{L}\\p{N}])', 'giu')) || []).length
const spanish = hits('el|los|las|del|la|en|con|una|y|su|sus|al|es|lo|más|pero|porque|sin|ya|muy|también|cuando|está|hay')
const neighbors = Math.max(hits('não|uma|um|com|em|os|do|da|dos|das|no|na|é|e|mais|então|você|isso|sem|há|ao|pelo|pela'), hits('le|les|des|et|est|une|pour|avec|pas|dans|qui|sur|nous|vous|du|au|ce|cette'), hits('il|di|che|per|non|gli|della|è|ma|anche|sono|questo|molto|perché|nel|alla'))
const english = hits('the|of|and|to|in|is|that|for|it|with|as|was|on|are|be|by|this|not|or|we|our|at|from|but|have|has|they|you')
const lang = Object.prototype.hasOwnProperty.call(STRINGS, opts.lang) ? opts.lang : cyrillic(sample) > latin(sample) ? 'ru' : spanish > english && spanish > neighbors ? 'es' : 'en'
if (opts.lang && opts.lang !== lang) fail(['--lang must be ' + Object.keys(STRINGS).join(', ')])
const S = STRINGS[lang]
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key]))
// A count's own form: [1, other] in English; [1, 2–4, 5+] in Russian, where
// 21 is "одна" and 11–14 are "many". "1 тонких записей" was the default.
const plural = (forms, k) => {
  if (forms.length === 2) return forms[k === 1 ? 0 : 1]
  const ten = k % 10
  const hundred = k % 100
  return forms[ten === 1 && hundred !== 11 ? 0 : ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14) ? 1 : 2]
}
// Said once, where a short form first prints (the Russian «пропуск»): a
// string pattern replaces the first occurrence only.
const glossed = (text) => Object.entries(S.glosses).reduce((out, [short, long]) => out.replace(short, long), text)
// A source kind or a kind of call, with what it means in the sheet's language
// beside the json's own word; the word stays, because the json holds it.
const ENUM_FIELDS = ['sourceType', 'kind']
const valueOf = (key, v) => (ENUM_FIELDS.includes(key) && typeof v === 'string' && Object.prototype.hasOwnProperty.call(S.values, v) ? S.values[v] + ' (' + v + ')' : v)

// A rebuild, or any change to records the user already approved: the
// approved file stays as it is, the changes live in a working copy, and the
// sheet shows each changed field before and after. Which approved record a
// working one is, is its id: a label this script gives every record (r1, r2,
// …) on a full render and writes into the json, and the assistant keeps
// through every edit. The same id is the same record, shown with each field
// that changed; an id the approved file does not carry is a new record; an
// approved id no working record carries is removed. A record without an id
// takes one first: the id of the approved record it copies exactly, or —
// only in a copy of a saved file from before ids, edited before its first
// render — of the one it most likely is (below), or the next free number.
// With ids, then, a new record never takes an approved one's place, and a
// removed one never comes back as a change.
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
const LABELS = { title: S.recordTitle, date: S.date, sourceType: S.sourceKind, origin: S.origin, context: S.context, decision: S.decision, driver: S.driver, otherSide: S.otherSide, condition: S.condition, outcome: S.outcome, revisited: S.revisited, kind: S.kind }
// What a record says: every field but its id, and any field this script does not know.
const CONTENT = Object.keys(FIELDS).filter((key) => key !== 'id')
const differing = (a, b) => [...new Set([...CONTENT, ...unknownKeys(a), ...unknownKeys(b)])].filter((key) => asText(a[key] ?? '') !== asText(b[key] ?? ''))
const same = (key, a, b) => {
  const value = asText(a[key] ?? '').trim()
  return value !== '' && value === asText(b[key] ?? '').trim()
}
// Two records that may be one: they share two of four — the call, the
// title, the situation, and the date with the source and origin. One alone
// is not enough: a new record re-tells a removed one's call, or comes from
// its day.
const placeOf = (r) => JSON.stringify([String(r.date || '').trim(), r.sourceType || '', r.origin || ''])
const related = (a, b) => [same('decision', a, b), same('title', a, b), same('context', a, b), placeOf(a) === placeOf(b)].filter(Boolean).length >= 2
const idOf = (r) => (typeof r.id === 'string' && r.id.trim() ? r.id : '')
const idNumber = (id) => {
  const m = /^r(\d+)$/.exec(id)
  return m ? Number(m[1]) : 0
}
// The ids a list carries, in its order; a record repeating an earlier one's id carries none.
const carried = (list) => {
  const first = new Map()
  const repeats = []
  const ids = list.map((r, index) => {
    const id = idOf(r)
    if (!id) return ''
    if (first.has(id)) {
      repeats.push({ index, id, first: first.get(id) })
      return ''
    }
    first.set(id, index)
    return id
  })
  return { ids, repeats }
}
// A saved file from before ids reads its records as r1, r2, … in its order
// (the next numbers above its own ids, for a file that carries some), and is
// never written: the approved file stays as the user approved it.
const approvedCarried = carried(before || [])
const noId = approvedCarried.ids.map((id) => !id)
let approvedTop = Math.max(0, ...approvedCarried.ids.map(idNumber))
const approvedIds = approvedCarried.ids.map((id) => id || 'r' + (approvedTop += 1))
for (const { index, id, first } of approvedCarried.repeats) {
  console.error('WARNING: approved records #' + (first + 1) + ' and #' + (index + 1) + ' carry the same id, ' + id + '; the later one is read as ' + approvedIds[index] + '.')
}
const workingCarried = carried(records)
// A working copy made by copying the approved file carries its ids. One
// that carries none, beside an approved file that does, while some of its
// records say what approved ones say, was written again from scratch: every
// record in it would read as new, and an edited one would meet the range.
if (before && noId.some((none) => !none) && records.every((r) => !idOf(r))) {
  const alikeApproved = records.map((_, i) => i).filter((i) => before.some((b) => differing(b, records[i]).length === 0 || related(b, records[i])))
  if (alikeApproved.length) {
    fail([
      'The approved file\'s records carry ids, and none of the records in ' + basename(jsonPath) + ' does, though some say what approved records say (#' + alikeApproved.slice(0, 10).map((i) => i + 1).join(', #') + (alikeApproved.length > 10 ? ', …' : '') + '): a rebuild tells an edited record from a new one by them, and here every record would read as new.',
      'Give each record the id of the approved record it was made from, or make the working copy again as a copy of the approved file and redo the changes in it; a record you added takes none. If every record here is new, give one of them an id of its own, like new1. Then run this again.',
    ])
  }
}
const ids = workingCarried.ids.slice()
const claimed = new Set(ids.filter(Boolean))
const given = []
const how = { exact: 0, content: 0, fresh: 0 }
if (before) {
  // A working record with no id that is an approved record unchanged takes
  // that record's id: a copy rendered once before anything in it changed
  // carries exact ids from then on.
  records.forEach((record, index) => {
    if (ids[index]) return
    const k = before.findIndex((b, bk) => !claimed.has(approvedIds[bk]) && differing(b, record).length === 0)
    if (k < 0) return
    ids[index] = approvedIds[k]
    claimed.add(ids[index])
    given.push(index)
    how.exact += 1
  })
  // A working copy that carries no id yet is at its first render; against
  // a saved file without ids, the records it holds that copy none exactly
  // were edited before it, and are paired with the saved records by what
  // they say (related, above), in one pass, the closest pairs first — the
  // most fields alike, then the most words of title, situation and call in
  // common, then the earlier records. After this render the ids decide, so
  // a record added later is new, never a removed one's edit. The range
  // check below reads the saved file, not this pairing.
  const open = before.map((_, k) => k).filter((k) => noId[k] && !claimed.has(approvedIds[k]))
  const waiting = records.map((_, i) => i).filter((i) => !ids[i])
  if (open.length && waiting.length && workingCarried.ids.every((id) => !id)) {
    const wordsOf = new Map()
    const wordSet = (r) => {
      if (!wordsOf.has(r)) wordsOf.set(r, new Set([r.title, r.context, r.decision].map((v) => String(v ?? '')).join(' ').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)))
      return wordsOf.get(r)
    }
    const overlap = (b, r) => {
      const x = wordSet(b)
      const y = wordSet(r)
      let common = 0
      for (const word of x) if (y.has(word)) common += 1
      return common / (x.size + y.size - common || 1)
    }
    const alike = (b, r) => CONTENT.filter((key) => asText(b[key] ?? '') === asText(r[key] ?? '')).length + overlap(b, r)
    const candidates = []
    for (const i of waiting) for (const k of open) if (related(before[k], records[i])) candidates.push({ i, k, alike: alike(before[k], records[i]) })
    candidates.sort((x, y) => y.alike - x.alike || x.i - y.i || x.k - y.k)
    for (const { i, k } of candidates) {
      if (ids[i] || claimed.has(approvedIds[k])) continue
      ids[i] = approvedIds[k]
      claimed.add(ids[i])
      given.push(i)
      how.content += 1
    }
  }
}
// The rest take the next numbers above every id in both files, so a new
// record never takes the number of an approved record that was removed.
let top = Math.max(0, ...workingCarried.ids.map(idNumber), ...approvedIds.map(idNumber))
const fresh = []
records.forEach((_, index) => {
  if (ids[index]) return
  ids[index] = 'r' + (top += 1)
  given.push(index)
  fresh.push(index)
  how.fresh += 1
})

// Written on a full render only: --ask and --records write no file.
if (given.length && !askOnly && !opts.records) {
  given.sort((a, b) => a - b)
  for (const index of given) {
    const record = records[index]
    records[index] = Object.prototype.hasOwnProperty.call(record, 'id') ? Object.assign(record, { id: ids[index] }) : { id: ids[index], ...record }
  }
  for (const { index, id, first } of workingCarried.repeats) {
    console.error('WARNING: record ' + (index + 1) + ' carried the id ' + id + ', which record ' + (first + 1) + ' carries too; it now carries ' + ids[index] + '.')
  }
  try {
    const indent = (/\n([ \t]+)\S/.exec(source) || [])[1] ?? (source.includes('\n') ? '  ' : '')
    writeFileSync(jsonPath, JSON.stringify(parsed, null, indent) + (source.endsWith('\n') ? '\n' : ''))
    const parts = before
      ? [
          ...(how.exact ? [how.exact + ' copy an approved record exactly and took its id'] : []),
          ...(how.content ? [how.content + ' took the id of the approved record they most likely came from, read off what they say because the saved file carries no ids — check each in the changes'] : []),
          ...(how.fresh ? [how.fresh + ' are new'] : []),
        ]
      : []
    console.error(
      'Gave ' + given.length + (given.length === 1 ? ' record an id' : ' records an id') + ' and wrote ' + (given.length === 1 ? 'it' : 'them') + ' into ' + basename(jsonPath) + (parts.length ? ' (against ' + basename(opts.before) + ': ' + parts.join('; ') + ')' : '') +
        '. Keep every id as it is when you edit a record, and give a record you add none: a rebuild tells an edited record from a new one by them.',
    )
  } catch (error) {
    console.error('WARNING: could not write the ids into ' + basename(jsonPath) + ' (' + (error && error.message) + '): a rebuild tells an edited record from a new one by them. Check the file can be written, and run this again.')
  }
}
// A record that came without an id and says what an approved record that
// no record here carries says: if it is that record edited, its id was lost.
if (before) {
  const missing = before.map((_, k) => k).filter((k) => !claimed.has(approvedIds[k]))
  for (const index of fresh) {
    const k = missing.find((m) => ['decision', 'title', 'context'].some((key) => same(key, before[m], records[index])))
    if (k === undefined) continue
    const what = ['decision', 'title', 'context'].filter((key) => same(key, before[k], records[index])).map((key) => ({ decision: 'call', title: 'title', context: 'situation' })[key])
    console.error('WARNING: record ' + (index + 1) + ' came without an id and has the same ' + what.join(' and ') + ' as approved ' + approvedIds[k] + ', which no record here carries. If it is that record edited, give it the id ' + approvedIds[k] + ' and run this again; if that record was removed on purpose, this one is new.')
  }
}

const changes = { changed: [], added: [], removed: [] }
const approvedAt = new Map(approvedIds.map((id, k) => [id, k]))
const partner = records.map((_, index) => (before && approvedAt.has(ids[index]) ? approvedAt.get(ids[index]) : -1))
if (before) {
  records.forEach((record, index) => {
    const k = partner[index]
    if (k < 0) return changes.added.push(index)
    const fields = differing(before[k], record)
    if (fields.length) changes.changed.push({ index, from: before[k], fields })
  })
  const present = new Set(partner)
  before.forEach((b, k) => {
    if (!present.has(k)) changes.removed.push(b)
  })
}

// A saved file without ids read against a working copy numbered by a render
// without --before: its ids are positions, and pair whatever stands there.
if (before) {
  const strangers = records.map((_, i) => i).filter((i) => partner[i] >= 0 && noId[partner[i]] && !['date', 'decision', 'title', 'context'].some((key) => same(key, before[partner[i]], records[i])))
  if (strangers.length) {
    console.error('WARNING: ' + strangers.length + (strangers.length === 1 ? ' record carries the id' : ' records carry the ids') + ' of a saved record ' + (strangers.length === 1 ? 'it shares' : 'they share') + ' no date, call, title or situation with (#' + strangers.map((i) => i + 1).join(', #') + '). If the working copy was numbered by a render without --before, put back the ids its saved records take (r1 for the first saved record, r2 for the second, …) and run this again.')
  }
}

const range = opts.range ? parseDateRange(opts.range) : null
// Against an approved file the range bounds the NEW records only: the saved
// ones were approved under the last run's range, and a rebuild's period is
// the search for what that run did not read. A record whose id the approved
// file carries is never checked. Against a saved file without ids, whose
// records may have been paired by what they say, a new record is checked
// only when no saved record has its date, its call, its title or its
// situation — read off the saved file, not the pairing, except for a saved
// record a working record is an exact copy of, which can be no other: an
// approved record crossed out with the outside-range group is lost, a new
// record left out of the group is still on the sheet.
const copied = new Set(partner.filter((k, i) => k >= 0 && differing(before[k], records[i]).length === 0))
const MAY_BE = ['date', 'decision', 'title', 'context']
const savedValues = MAY_BE.map((key) => new Set((before || []).filter((_, k) => noId[k] && !copied.has(k)).map((b) => asText(b[key] ?? '').trim()).filter(Boolean)))
const mayBeSaved = (r) => MAY_BE.some((key, n) => savedValues[n].has(asText(r[key] ?? '').trim()))
const outside = (index) => {
  if (!range || partner[index] >= 0 || mayBeSaved(records[index])) return false
  const d = String(records[index].date || '').slice(0, 10)
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
// The review's thin records — a stranger in the field, holding only the
// record, learns nothing: no particular in the situation, no reason or only
// a circumstance, the call anyone would make. OUT by default like statements.
const thin = numbers('thin')
// What goes unless the expert keeps more: never the statements or the thin records.
const goes = (index) => !statements.has(index + 1) && !thin.has(index + 1)
// Three more readings the sheet points the expert at, never fields: whose
// words a record really is, whether it came from a client's or an employer's
// material, and whether the call turned on a characteristic the law protects.
// A client's origin placeholder is read by the product's own rule (mining.ts,
// fromClientContext), rendered in; --client adds the rest.
const authorship = numbers('authorship')
const clientNamed = numbers('client')
const fromClient = (index) => clientNamed.has(index + 1) || CLIENT_ORIGIN.test(String(records[index].origin || ''))
const protectedCalls = numbers('protected')
// A call the server would not count (shared/mining.ts callTooShort, rendered
// in): asked for written out before approval, never dropped after it.
const tooShort = (index) => String(records[index].decision).replace(FENCED_CODE, ' [code] ').replace(/\s+/g, ' ').trim().length < MIN_DECISION

const groups = new Map()
records.forEach((record, index) => {
  const label = outside(index)
    ? S.outsideRange
    : offDomain.has(index + 1)
      ? S.offDomain
      : statements.has(index + 1)
        ? S.statements
        : thin.has(index + 1)
          ? S.thin
          : instructions.has(index + 1)
            ? S.instructions
            : String(record.origin || '').trim() || S.noOrigin
  if (!groups.has(label)) groups.set(label, [])
  groups.get(label).push(index)
})
const statementCount = (groups.get(S.statements) || []).length
const thinCount = (groups.get(S.thin) || []).length
for (const last of [S.instructions, S.statements, S.thin, S.offDomain, S.outsideRange]) {
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
    '- ' + S.sourceKind + ': ' + valueOf('sourceType', show(r.sourceType)),
    '- ' + S.origin + ': ' + show(r.origin),
    '- ' + S.context + ': ' + show(r.context),
    '- ' + S.decision + ': ' + show(r.decision),
    '- ' + S.driver + ': ' + show(r.driver),
    '- ' + S.otherSide + ': ' + show(r.otherSide),
    '- ' + S.condition + ': ' + show(r.condition),
    '- ' + S.outcome + ': ' + show(r.outcome),
    ...(String(r.revisited || '').trim() ? ['- ' + S.revisited + ': ' + show(r.revisited)] : []),
    '- ' + S.kind + ': ' + valueOf('kind', show(r.kind)),
    ...unknownKeys(r).map((key) => '- ' + key + ': ' + show(asText(r[key]))),
  ].join('\n')
}


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

const special = new Set([S.instructions, S.statements, S.thin, S.offDomain, S.outsideRange])
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
  console.log(glossed([...recordsIn(shown), fill(S.moreRecords, { from: shownFrom, to: shownTo, n: records.length })].join('\n')))
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
            ...fields.flatMap((key) => ['- ' + (LABELS[key] ?? key) + ':', '  - ' + S.before + ': ' + valueOf(key, orEmpty(from[key] === undefined ? '' : asText(from[key]))), '  - ' + S.after + ': ' + valueOf(key, orEmpty(records[index][key] === undefined ? '' : asText(records[index][key])))]),
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

// Every origin has a row, an emptied one too: a source whose every record
// went to the thin or statements group vanished from the table, and striking
// it had no count (expert audit, 2026-10-14). Origins first, then the
// readings' groups, as the lists below run.
const rows = [...groups].filter(([label]) => !special.has(label))
for (const origin of byOrigin.keys()) if (!groups.has(origin)) rows.push([origin, []])
rows.push(...[...groups].filter(([label]) => special.has(label)))
const table = ['| ' + S.group + ' | ' + S.records + ' |', '| --- | --- |', ...rows.map(([label, members]) => '| ' + label + ' | ' + count(label, members) + ' |')].join('\n')
const rangeLine = opts.range
  ? range
    ? fill(!before ? S.rangeRead : noId.some(Boolean) ? S.rangeReadNoIds : S.rangeReadNew, range)
    : fill(S.rangeUnread, { range: opts.range })
  : ''

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
const groupLists = [...groups].flatMap(([label, members]) => ['### ' + label + ' — ' + count(label, members), '', ...(label === S.instructions ? [S.instructionsFrame, ''] : label === S.statements ? [S.statementsFrame, ''] : label === S.thin ? [S.thinFrame, ''] : label === S.offDomain ? [S.offDomainFrame, ''] : []), ...members.map((index) => line(index, special.has(label))), ''])
const againstList = ['## ' + fill(S.against, { k: against.size, n: records.length }), '', S.againstFrame, '', ...(against.size ? [...against].sort((a, b) => a - b).map((n) => line(n - 1, true)) : [S.noAgainst]), '']
// The chat says the count in a line that says what it counts; the list is the file's.
const againstLine = fill(against.size ? S.againstChat : S.againstChatNone, { k: against.size, n: records.length })
// What the chat points the expert at instead of printing every record. The
// reasonless records are asked about in a message of their own, before (--ask).
const eye = (label, list, frame) => (list.length ? ['### ' + label + ' — ' + list.length, '', ...(frame ? [frame, ''] : []), ...list.map((index) => line(index, true)), ''] : [])
const indices = records.map((_, index) => index)
const needsEye = [
  ...eye(S.shortCall, indices.filter((index) => goes(index) && tooShort(index)), fill(S.shortCallFrame, { min: MIN_DECISION })),
  ...eye(S.protected, indices.filter((index) => protectedCalls.has(index + 1)), S.protectedFrame),
  ...eye(S.authorship, indices.filter((index) => authorship.has(index + 1))),
  ...eye(S.clientMaterial, indices.filter(fromClient)),
  ...eye(S.statements, groups.get(S.statements) || []),
  ...eye(S.thin, groups.get(S.thin) || []),
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
const flagBlock = ['## ' + S.flags, '', S.flagsFrame, '', ...(flags.length ? flags.map((f) => '- ' + f.n + ' — ' + (S.flagKinds[f.kind] || f.kind) + ' (' + (LABELS[f.field] || f.field) + ')') : [S.noFlags]), '']
// The question's count leaves out the statements and the thin records: they go only if kept.
const sendable = records.length - statementCount - thinCount

const ASK_CAP = 10
const ASK_WORDS = 8
const ASK_CONTEXT_WORDS = 10
const ASK_SHARED_WORDS = 3
const SOLID_REASONS = 12
const BROAD_REASONS = 60
const REASON_PATTERNS = {"reasoning":{"source":"(?<![\\p{L}\\p{N}_])(?:потому что|так как|иначе|проблема в том|дело в том|суть в том|риск в том|из-за того|поэтому|это сигнал|некому|не потянем|нет ресурса|обойдётся дороже|обойдется дороже|в итоге получим|porque|ya que|puesto que|de lo contrario|si no|el (verdadero )?(problema|riesgo) es|la razón es|por eso|por lo tanto|lo que significa|nadie quiere|no nos lo podemos permitir|acaba costando|sale más caro|because|since|otherwise|the (real )?(problem|issue|risk|point) is|reason is|that is why|that'?s why|which means|what (i|we) (actually |really )?want|nobody wants|no one (wants|to)|can'?t afford|cannot afford|ends up costing)(?![\\p{L}\\p{N}_])","flags":"iu"},"otherBranch":{"source":"(?<![\\p{L}\\p{N}_])(?:otherwise|or else|if not|(?:above|below|beyond|past) (?:that|this)|had it been|if it had been|in (?:every|all) other cases?|иначе|в противном случае|если бы|если нет|(?:выше|ниже|свыше|сверх|больше|меньше) (?:этого|того)|в (?:остальных|других) случаях)(?![\\p{L}\\p{N}_])","flags":"giu"},"noReason":{"source":"(?<![\\p{L}\\p{N}_])(?:(?:the )?(?:source|record|document|doc|ticket|thread|card|board|chat|message|notes?|minutes|spec|brief)s? (?:does not|doesn't|did not|didn't|never) (?:state|say|record|give|explain|mention)s? (?:a |the |any )?(?:reason|motive|rationale|why)|without (?:stating|giving|recording|explaining) (?:a |the |any )?(?:reason|motive|rationale|why)|(?:^|(?<=[.;:]\\s*))(?:the )?(?:reason|motive|rationale|why)(?: for (?:it|this|the call|the decision|the limit))?:? (?:is |was )?(?:not|never|isn't|wasn't) (?:stated|recorded|given|documented|explained|known)|(?:reason|motive|rationale|why)[^.;]{0,30} (?:not|never) (?:stated|recorded|given|documented|explained)[^.;]{0,20} in the (?:source|record|document|ticket|thread|card|notes)|(?:^|(?<=[.;:]\\s*))(?:the )?(?:reason|motive|rationale)s? (?:unknown|unstated)|(?:^|(?<=[.;:]\\s*))(?:not|never) (?:stated|recorded|given|documented)(?: in the source)?|no (?:stated|recorded|explicit|documented) (?:reason|motive|rationale)|no (?:reason|motive|rationale) (?:is |was )?(?:given|stated|recorded|documented)|(?:reason|motive|rationale|why|cause)[^.;]{0,60} (?:must|should) not be inferred|(?:do not|don't|must not|never) infer (?:a |the |any )?(?:reason|motive|rationale|why)|(?:причин\\p{L}*|мотив\\p{L}*|обоснован\\p{L}*)(?: в источнике)? (?:не (?:указан|зафиксирован|приведен|приведён|назван|объяснен|объяснён|известн)\\p{L}*|неизвестн\\p{L}*)|(?:источник|запис|документ|тикет|карточк|переписк)\\p{L}* не (?:указыва|называ|объясня|привод|фиксиру|говор)\\p{L}*|(?:причин|мотив|обоснован)\\p{L}* не (?:называ|указыва|объясня|привод)\\p{L}*|без (?:указания|объяснения) (?:причин\\p{L}*|мотив\\p{L}*|обоснован\\p{L}*)|(?:причин\\p{L}*|мотив\\p{L}*|усталост\\p{L}*)[^.;]{0,60} не (?:выводить|додумывать|домысливать))(?![\\p{L}\\p{N}_])","flags":"iu"},"noneReason":{"source":"^\\s*[\"'«“„(\\[¡¿]?\\s*(?:none(?: (?:given|recorded|stated|that i (?:remember|recall|know of)))?|nothing|no(?:pe)?|n\\/?a|[-–—]|(?:i )?(?:don['’]?t|do not|can['’]?t|cannot) (?:remember|recall|know)(?: why)?|not that i (?:remember|recall|know)|no idea|idk|nil|(?:i )?forgot|dunno|unknown|not (?:recorded|remembered|sure)|no reason(?: (?:given|recorded|stated))?|нет|ничего|(?:уже |точно )?не (?:помню|знаю)(?: уже| точно)?|понятия не имею|без понятия|без причины|nada|ningun[oa]|no (?:lo )?recuerdo(?: bien)?|no me acuerdo(?: bien)?|no (?:lo )?s[eé]|ni idea|sin (?:raz[oó]n|motivo))(?:,?\\s*(?:sorry|honestly|честно|lo siento))?\\s*[.!?…;,]*\\s*[\"'»”)\\]]?\\s*[.!?…;,]*\\s*$","flags":"iu"},"noneOtherSide":{"source":"^\\s*[\"'«“„(\\[¡¿]?\\s*(?:none(?: (?:given|recorded|stated|that i (?:remember|recall|know of)))?|nothing|no(?:pe)?|n\\/?a|[-–—]|(?:i )?(?:don['’]?t|do not|can['’]?t|cannot) (?:remember|recall|know)(?: why)?|not that i (?:remember|recall|know)|no idea|idk|nil|(?:i )?forgot|dunno|unknown|not (?:recorded|remembered|sure)|no reason(?: (?:given|recorded|stated))?|нет|ничего|(?:уже |точно )?не (?:помню|знаю)(?: уже| точно)?|понятия не имею|без понятия|без причины|nada|ningun[oa]|no (?:lo )?recuerdo(?: bien)?|no me acuerdo(?: bien)?|no (?:lo )?s[eé]|ni idea|sin (?:raz[oó]n|motivo)|nothing (?:did|really|else)|nothing(?: really| else)? (?:pulled|pushed|weighed) (?:the other way|against(?: it)?)|no ?one|nobody|(?:there (?:was|were) )?no (?:real )?(?:other side|other option|alternatives?)(?: (?:was|were) (?:considered|on the table|raised|proposed))?|никто|ничего не (?:тянуло|мешало)(?: в другую сторону)?|альтернатив[ы]? не было|не было альтернатив[ы]?|другой стороны не было|nadie|nada (?:tiraba )?en contra|no (?:hab[ií]a|hubo) (?:alternativas?|otra opci[oó]n)|sin (?:alternativas?|otra opci[oó]n))(?:,?\\s*(?:sorry|honestly|честно|lo siento))?\\s*[.!?…;,]*\\s*[\"'»”)\\]]?\\s*[.!?…;,]*\\s*$","flags":"iu"}}

// What only the expert holds, computed from the json itself so no judgment is
// needed (the brief's REASONS ONLY I CAN GIVE): an empty reason, and an empty
// other side — the founder's 68 records had 38 with none, and the weighting
// saw a tie; the losers were in his head and nobody asked. ONE list, of the
// records that go (never the statements or thin ones, out unless kept), each
// with the first words of its call and what is missing, then the questions.
const blank = (v) => !String(v || '').trim()
// The product's own predicates (shared/mining.ts recordsReason and
// statesNoOtherSide): a driver that only says none was given is empty, a call
// that states its own why has one, and a field that is only an answer of none
// states nothing — "I don't remember" in either field, "there was no other
// option" only in the other side, where it is no loser, never in the driver,
// where it is the reason of a forced choice. The same records
// submit_decisions refuses on until they are answered.
const REASONING = new RegExp(REASON_PATTERNS.reasoning.source, REASON_PATTERNS.reasoning.flags)
const OTHER_BRANCH = new RegExp(REASON_PATTERNS.otherBranch.source, REASON_PATTERNS.otherBranch.flags)
const NO_REASON = new RegExp(REASON_PATTERNS.noReason.source, REASON_PATTERNS.noReason.flags)
const NONE_REASON = new RegExp(REASON_PATTERNS.noneReason.source, REASON_PATTERNS.noneReason.flags)
const NONE_OTHER_SIDE = new RegExp(REASON_PATTERNS.noneOtherSide.source, REASON_PATTERNS.noneOtherSide.flags)
const statesReason = (r) =>
  (!blank(r.driver) && !NO_REASON.test(String(r.driver)) && !NONE_REASON.test(String(r.driver))) || REASONING.test(String(r.decision || '').replace(OTHER_BRANCH, ' '))
const statesOtherSide = (r) => !blank(r.otherSide) && !NONE_OTHER_SIDE.test(String(r.otherSide))
const lacking = records
  .map((r, index) => ({ index, missing: [...(statesReason(r) ? [] : [S.driver]), ...(statesOtherSide(r) ? [] : [S.otherSide])] }))
  .filter(({ index, missing }) => goes(index) && missing.length)
// Asked before the sheet only where the expert is not about to decide on the
// record with its whole group: one outside the range or the domain, which the
// sheet puts to them next, was asked for its reason and then crossed out.
// One they keep goes in as it is, and the file lists it with the rest.
const askable = ({ index }) => !offDomain.has(index + 1) && !outside(index)
// At most ASK_CAP in one message, in the order shared/reasons-ask.ts asks:
// a missing reason first, a call against the default next, the newest first;
// a set of a hundred is one short list, and the rest come after the answer.
// --asked names the positions an earlier --ask in this run listed, and they
// are left out, so the next ten are new ones and no record is asked twice in
// a run: the field cannot say it ("I don't remember" leaves it empty), and an
// update is a new run that asks again over every record still missing one.
const askedBefore = numbers('asked')
const toAsk = lacking.filter((gap) => askable(gap) && !askedBefore.has(gap.index + 1))
const when = (date) => {
  const time = date ? Date.parse(String(date)) : Number.NaN
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}
const lacksReason = ({ missing }) => missing.includes(S.driver)
const asked = [...toAsk]
  .sort(
    (a, b) =>
      Number(lacksReason(b)) - Number(lacksReason(a)) ||
      Number(against.has(b.index + 1)) - Number(against.has(a.index + 1)) ||
      when(records[b.index].date) - when(records[a.index].date) ||
      a.index - b.index,
  )
  .slice(0, ASK_CAP)
const words = (text, n) => {
  const all = String(text || '').trim().split(/\s+/).filter(Boolean)
  return all.slice(0, n).join(' ') + (all.length > n ? '…' : '')
}
// The cue a call is remembered by: when, the situation, what was ruled. Where
// most of the listed records open their situation with one run of words — the
// setting written into every record from one engagement — the cue starts
// after it, or every record listed opens on the same ten words.
const wordsOf = (text) => String(text || '').trim().split(/\s+/).filter(Boolean)
const opening = (list) => {
  const situations = list.map(({ index }) => wordsOf(records[index].context))
  const most = Math.floor(list.length / 2) + 1
  const run = []
  while (list.length > 1) {
    const next = new Map()
    for (const w of situations) if (w.length > run.length && run.every((word, i) => w[i] === word)) next.set(w[run.length], (next.get(w[run.length]) || 0) + 1)
    const top = [...next].sort((a, b) => b[1] - a[1])[0]
    if (!top || top[1] < most) break
    run.push(top[0])
  }
  return run.length >= ASK_SHARED_WORDS ? run : []
}
const askItems = (list) => {
  const run = opening(list)
  return list.map(({ index, missing }) => {
    const r = records[index]
    const date = String(r.date || '').trim()
    const situation = wordsOf(r.context)
    const skips = run.length > 0 && situation.length > run.length && run.every((word, i) => situation[i] === word)
    const cue = skips ? '…' + words(situation.slice(run.length).join(' '), ASK_CONTEXT_WORDS) : words(r.context, ASK_CONTEXT_WORDS)
    return '- #' + (index + 1) + (date ? ' · ' + date : '') + ' · ' + cue + ' → ' + words(r.decision, ASK_WORDS) + ' — ' + missing.join(', ')
  })
}
// How far the reasons are from the next label, counted on what goes, and said
// only where answers can still reach it: the records that say why now and
// every one still to be asked for its why come to the label's number. A bar
// no answer reaches explains nothing, and read as an upsell inside a question
// about one record. The rung counts published cases, one per case however
// many records it folds, so a record that says why is at most one of them:
// "among other things".
const reasonedGoing = records.filter((r, index) => goes(index) && statesReason(r)).length
const rung = reasonedGoing < SOLID_REASONS ? { label: S.solidLabel, need: SOLID_REASONS } : reasonedGoing < BROAD_REASONS ? { label: S.broadLabel, need: BROAD_REASONS } : null
const reachable = reasonedGoing + toAsk.filter(lacksReason).length
const progress = rung && reachable >= rung.need ? fill(S.askProgress, { label: rung.label, need: rung.need, have: reasonedGoing, n: sendable }) : ''
// The rest, offered after the answer: "the next ten" only while more than
// ten remain, the real count otherwise.
const more = toAsk.length - asked.length
// A question for each kind of gap the list holds, numbered only when both are asked.
const questions = [...(asked.some(lacksReason) ? [S.noReasonAsk] : []), ...(asked.some(({ missing }) => missing.includes(S.otherSide)) ? [S.noOtherSideAsk] : [])]
const askMessage = asked.length
  ? [
      '## ' + fill(S.askHead, { k: toAsk.length, n: sendable }),
      '',
      ...(progress ? [progress, ''] : []),
      S.askFrame,
      '',
      ...askItems(asked),
      '',
      ...(more > 0 ? [fill(plural(more > ASK_CAP ? S.askMoreNext : S.askMore, more), { m: more, cap: ASK_CAP }), ''] : []),
      ...questions.flatMap((question, i) => [(questions.length > 1 ? String(i + 1) + '. ' : '') + question, '']),
    ]
  : [!lacking.length ? S.askNone : lacking.every(askable) ? S.askDone : S.askOutside]
if (askOnly) {
  console.log(glossed(askMessage.join('\n')))
  // For the assistant, not the chat, while records remain: every position
  // listed so far in this run, which the next --ask takes so it lists only
  // new ones.
  if (more > 0) console.error('next: --ask --asked ' + [...new Set([...askedBefore, ...asked.map(({ index }) => index + 1)])].sort((a, b) => a - b).join(','))
  process.exit(0)
}
// In the file only, after the answers: what is still empty, every one of it.
const stillBlock = lacking.length
  ? ['## ' + fill(S.askFileHead, { k: lacking.length, n: sendable }), '', S.askFileFrame, '', ...askItems(lacking), '']
  : []


const closing = [
  // The approval question closes the sheet, after the records it is about:
  // it used to print above "All records", asking before the reading it
  // depends on. The ask for reasons is its own message, before (--ask).
  ...(unknownList.length ? [fill(S.unknownFields, { list: unknownList.join('; ') }), ''] : []),
  ...(statementCount ? [fill(plural(S.statementsOut, statementCount), { k: statementCount }), ''] : []),
  ...(thinCount ? [fill(plural(S.thinOut, thinCount), { k: thinCount }), ''] : []),
  '## ' + fill(rebuild ? S.rebuildQuestion : S.question, { n: sendable }),
]

// The file: every record in full, and everything the chat shows.
const md = [...headerBlock, ...groupLists, ...againstList, ...eyeBlock, ...exceptionBlock, ...flagBlock, ...(changeSection ?? allRecords), ...stillBlock, ...closing].join('\n')
writeFileSync(mdPath, glossed(md))
// The chat: never every record. On a rebuild the changes ARE what needs the eye.
const screen = [...headerBlock, againstLine, '', ...eyeBlock, ...exceptionBlock, ...flagBlock, ...(changeSection ?? []), fill(S.fileLine, { path: mdPath }), '', ...closing].join('\n')
console.log(glossed(screen))
