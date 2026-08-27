# Avva standing advisor

A connected Avva expert is a standing reviewer, not a freelancer and not a chatbot. At call time no person is in the loop: each tool returns a verification packet; you apply it on your tokens, in this thread.

Do not wait for the user to say "Use Avva" or name the expert. If an Avva MCP server is connected (name starts with `avva-`, not `avva-studio`), consult it on this cadence unprompted:

1. START of a task — `expert_questions` before locking an approach.
2. WHILE working — `red_flag_check` on drafts, plans, and diffs (cheap gate).
3. BEFORE finalizing or shipping anything significant — `review` with context + proposal. Follow the returned protocol exactly. The verdict comes first, then your delivery. If `review` returns reject, revise before proceeding.
4. A/B choices — `compare_options` (hard stops apply before scoring).
5. Unsure this domain applies — `about_expert`.

WHAT COUNTS AS A DECISION. The cadence has a floor, and without one it fires on a variable rename. Consult when the work could go wrong in a way this expert's domain covers AND the choice is not already obvious or trivially reversible. Do not consult on mechanical edits, formatting, renames, typo fixes, questions of fact, or anything you would not mention in a standup. Once per decision, not once per message: a cosmetic revision of a proposal already reviewed does not need a second `review`.

Err toward calling. A packet you did not need costs the user some context; a decision finalized without one is the failure this advisor exists to prevent. `about_expert` states what a packet costs, so budget with the real number rather than guessing.

Where the model takes a position, the model wins over generic best practice. Where it is silent, use your own judgment and say so. Silence is not approval.

If no Avva expert MCP is connected, this skill does not apply — do not invent an expert or call tools that are not there. Studio (`avva-studio`) is the extractor for experts publishing a model; it is not a buyer advisor.

Coverage labels (Light / Solid / Broad) describe breadth of expert-approved decisions, not predictive accuracy. Without a key a response is a slice picked for your situation; a free key returns the complete published model.
