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

It also installs a hook. Before a `git push`, it works out what that push
sends, fetches the connected expert's `review` packet for it, and holds the
push: your agent applies the packet, puts its verdict first, and pushes the
same diff again with the marker the hook prints. The hook judges nothing —
the verdict is your agent's. It lets the push through, with a note, when no
expert is connected in the project, when the server does not answer or
refuses, or when it cannot tell what a ref sends, and then it names that ref.

What leaves your machine: up to 8,000 characters of the diff plus the list of
changed files, sent to the expert's `review` and not stored. The diff is
what each pushed ref has that the remote's tracking refs lack, for the remote
and branches the command names. When the same command commits first
(`git commit … && git push`, `commit -a`, `git add -A`), the hook predicts
that commit from your index and work tree. It cannot see what another program
changes before a commit, or what `git add <paths>`, an amend or a pull will
do, so it holds such a command and asks for that step on its own first. A dry
run and a deletion send nothing and go through. On a connection without a
key, each packet spends the trial allowance (40 requests a day, per model). With more
than one expert connected, it uses the project's over your user-wide one and
names the expert it chose. In CI it says so in its request, so a pipeline's
pushes are counted apart from yours.

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

- START of a task — `expert_questions`, before locking an approach.
- WHILE working — `red_flag_check` on drafts, plans and diffs.
- BEFORE finalizing or shipping anything significant — `review` with context + proposal; your verdict comes first, then your delivery.
- A/B choices — `compare_options` (a stop rule of BLOCK severity disqualifies an option before the criteria are compared). Scope — `about_expert`.

## What it will and will not do

- Consults once per decision, not once per message.
- Stays quiet on mechanical work: renames, typo fixes, formatting, anything
  trivially reversible. The push hook is the exception: it fetches a packet
  for every push that sends something, mechanical or not.
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
