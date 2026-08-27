---
description: Ask the connected Avva expert to review what you are about to do.
---

Consult the connected Avva expert MCP (a server whose name starts with `avva-`, never `avva-studio`) about the work in front of you.

1. If the user named something to review, that is the proposal. Otherwise use what you are about to ship, recommend, or finalize in this conversation — say which it is in one line before you call, so they can redirect you.
2. Call `review` with the situation as context and that proposal. For an A/B choice call `compare_options` instead; if you have not settled an approach yet, call `expert_questions` first.
3. Follow the returned protocol exactly, in the order it gives. Where the model takes a position, it wins over generic best practice. Where it is silent, use your own judgment and say which parts were yours.
4. Report the verdict first, then your delivery. If `review` returns reject, revise before proceeding rather than presenting the rejected plan with a caveat.

If no Avva expert is connected, say so and stop — do not invent one. The user connects an expert from their page on avva.chat.