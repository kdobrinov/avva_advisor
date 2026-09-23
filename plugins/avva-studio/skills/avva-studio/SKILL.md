---
name: avva-studio
description: Build or rebuild an avva Decision Model in avva Studio — the extraction procedure, the approval sheet and the bundled sheet renderer. Use whenever the user mentions avva, a decision model, avva Studio, extracting their decisions, or runs /avva-build-model.
---

# avva Studio: the procedure

1. Call `begin_extraction` on the `avva-studio` MCP server and follow the brief it returns, step by step. It is written in the user's voice and it is the whole method; this skill adds tooling, not a second brief.
2. Sweep. If you can run parallel workers, run one sweep per source and merge the results; if you cannot, take the sources in the order most likely to hold reasons: chat history, reviews and threads, then documents and boards. Never read this conversation, an earlier avva Studio session, or material about avva itself as a source.
3. Write the json first. Save the exact array you would submit as `avva-decisions-domain.json` (`<domain>` is the domain slugified: lowercase, hyphens), in the project directory or where the user says. Every record carries an `origin` placeholder label for where it came from.
4. Render the records with the bundled script, never by hand:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/render-sheet.mjs" avva-decisions-domain.json [--range "<the range the user set>"] [--exceptions 3,7,12] [--lang ru|en]
   ```

   It validates the records against the wire shape, prints them in full to stdout with the group table, and flags residual emails, phones, URLs, ticket ids, key-looking strings and records that name avva itself. `--exceptions` takes the numbers of the records you are least sure are clean after redaction; that judgment is yours, the script only renders it. Pass `--range` whenever the user set one, so records outside it land in their own group.
5. Put that output in the chat as it came out, and ask the brief's one question with the count. The user is reading the records that would be sent, rendered from the json by this script — never retyped, summarized or tidied by you, which is the whole reason the script exists. After removals, edit the json, run it again, and show the group table only. Only if the user would rather read a file, add `--sheet`: it writes `avva-decisions-domain.md` beside the json from the same render. That file is a convenience, never the thing they approve.
6. Only after explicit approval, call `submit_decisions` with the array in the json exactly as it stands, and follow what it returns.
