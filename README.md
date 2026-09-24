# avva for your agent

Two plugins for [avva](https://avva.chat). avva publishes how one professional decides
(their past calls, what each one turned on, where they stop) as an MCP server
your agent consults before it answers.

- **avva-advisor**, for people who use a connected model. It makes your agent
  consult it without being asked: `expert_questions` before locking an
  approach, `red_flag_check` on a draft, `review` before anything
  significant ships.
- **avva-studio**, for professionals building one from decisions they already
  made.

The advisor does not connect a model by itself. Pick one on
[avva.chat](https://avva.chat), copy the connection from its page, then
install this so the connection gets used instead of forgotten. Some models
on the shelf are reference models: composites avva wrote, labelled as such on
their page, for trying a connection.

## Claude Code

```
/plugin marketplace add kdobrinov/avva_advisor
/plugin install avva-advisor@avva-advisor
```

Installs two things: the standing cadence (your agent consults the expert on
its own) and `/avva-review`, for when you want the expert on something right
now.

It also installs a hook: before `git push`, your agent asks the connected
expert to `review` the outgoing diff, reads the packet, and reports the
verdict before the push goes out. The hook allows the push, with a note, when
no expert is connected in the project or the server does not answer.

The hook runs on **every** `git push`, mechanical or not: it sends the
outgoing diff (its first 8,000 characters) to the expert's `review` and
blocks the push until your agent has applied the packet. On a connection
without a key, each of those reviews spends the trial allowance
(40 consults a day, per model). With more than one expert connected, it uses the
project's over your user-wide one and names the expert it chose.

## Gemini CLI

```
gemini extensions install https://github.com/kdobrinov/avva_advisor
```

The extension ships the same cadence as a `GEMINI.md` context file. No
hook: Gemini CLI has a hook surface, but the way an extension ships one has
not been run here, and this repository prints only what was run.

## avva Studio (for experts building a model)

```
/plugin marketplace add kdobrinov/avva_advisor
/plugin install avva-studio@avva-advisor
```

Installs the Studio extractor as an MCP server, `/avva-build-model <domain> |
<name> | [range] | [only]`, and a script that renders the approval sheet
from the decisions file on your disk, so what you read is what is sent. The
brief itself comes from `begin_extraction`; the plugin adds tooling, not a
second brief.

## Other clients

Cursor and plain CLAUDE.md / AGENTS.md setups take the standing note printed
on every expert's page — same cadence, pasted rather than installed.

## The cadence it installs

- START of a task — call `expert_questions` before locking an approach.
- WHILE working — run `red_flag_check` on drafts, plans, and diffs as a cheap gate.
- BEFORE finalizing or shipping anything significant — call `review` with context + proposal; before finalizing significant decisions the review verdict comes first, then your delivery.
- A/B choices — `compare_options` (hard stops disqualify an option before the criteria are compared). Scope questions — `about_expert`.

## What it will and will not do

- Consults once per decision, not once per message.
- Stays quiet on mechanical work: renames, typo fixes, formatting, anything
  trivially reversible. The push hook is the exception: it reviews every push.
- Errs toward calling: a packet you did not need costs some context; a
  decision finalized without one is the failure this advisor exists to prevent.
- Does nothing when no avva expert MCP is connected.

## Maintenance

Every file in this repository is **generated** from avva's product
repository, which is private (`scripts/render-advisor-repo.mjs`; sources of truth
`shared/standing-advisor.ts`, `shared/advisor-hook.ts` and
`shared/studio-plugin.ts`). Do not edit files here by hand — the first
version of this plugin was a hand-kept copy and it drifted 19% from its
source before anyone noticed. Rerun the generator there and push.
