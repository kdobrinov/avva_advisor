# Avva standing advisor

> Agent skill + Claude Code plugin + Gemini CLI extension: expert review,
> second opinions, and hard stop rules from a real professional's published
> decisions, delivered to your agent over MCP.

[Avva](https://avva.chat) rents out one professional's real past decisions as
an MCP server other people's AI agents consult before finalizing a decision in
that domain. This repository installs the **standing-advisor cadence** — the
part that makes your agent consult a connected expert *without being asked*:
`expert_questions` before locking an approach, `red_flag_check` on drafts
as a cheap gate, `review` before finalizing anything significant.

It does not connect an expert by itself. Pick one on [avva.chat](https://avva.chat),
copy the connector from their page, then install this so the connection gets
used instead of forgotten.

## Claude Code

```
/plugin marketplace add kdobrinov/avva_advisor
/plugin install avva-advisor@avva-advisor
```

Installs two things: the standing cadence (your agent consults the expert on
its own) and `/avva-review`, for when you want the expert on something right
now.

## Gemini CLI

```
gemini extensions install https://github.com/kdobrinov/avva_advisor
```

The extension ships the same cadence as a `GEMINI.md` context file.

## Other clients

Cursor and plain CLAUDE.md / AGENTS.md setups take the standing note printed
on every expert's page — same cadence, pasted rather than installed.

## The cadence it installs

- START of a task — call `expert_questions` before locking an approach.
- WHILE working — run `red_flag_check` on drafts, plans, and diffs as a cheap gate.
- BEFORE finalizing or shipping anything significant — call `review` with context + proposal; before finalizing significant decisions the review verdict comes first, then your delivery.
- A/B choices — `compare_options` (hard stops apply before scoring). Scope questions — `about_expert`.

## What it will and will not do

- Consults once per decision, not once per message.
- Stays quiet on mechanical work: renames, typo fixes, formatting, anything
  trivially reversible.
- Errs toward calling: a packet you did not need costs some context; a
  decision finalized without one is the failure this advisor exists to prevent.
- Does nothing when no Avva expert MCP is connected.

## Maintenance

Every file in this repository is **generated** from the
[avvamcp](https://github.com/kdobrinov/avvamcp) product repo
(`scripts/render-advisor-repo.mjs`, source of truth
`shared/standing-advisor.ts`). Do not edit files here by hand — the first
version of this plugin was a hand-kept copy and it drifted 19% from its
source before anyone noticed. Rerun the generator there and push.
