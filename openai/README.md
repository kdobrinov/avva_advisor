# avva packages for OpenAI

These directories contain the complete upload packages. They are generated
from the product repository by scripts/render-advisor-repo.mjs, using the same
generators as the individual OpenAI ZIPs. Do not edit generated files here.

| Package | Version | MCP URL | Authentication |
| --- | --- | --- | --- |
| avva Advisor | 1.1.1 | https://avva.chat/mcp-advisor | OAuth with dynamic client registration (DCR) |
| avva Studio | 1.1.0 | https://avva.chat/mcp-studio | None |

Advisor discovers public Decision Models and consults the model the user
chooses. Its OAuth connection identifies trial usage; it does not grant full
account or workspace access. Studio builds a draft from user-selected sources;
publication and ownership are completed separately on avva.chat.

No preconfigured client ID, client secret, API key or reviewer password belongs
in either package. Reviewer access, domain verification and supporting videos
are completed separately in OpenAI Platform. Each manifest contains five
positive and three negative review scenarios. Scenarios are instructions for
reviewers, not evidence that those tests have passed.

## Create the two upload ZIPs

From the repository root, with the zip command installed, write to new output
filenames so an older archive cannot retain obsolete files:

```sh
(cd openai/avva-advisor && zip -r ../../avva-advisor-openai-1.1.1.zip .)
(cd openai/avva-studio && zip -r ../../avva-studio-openai-1.1.0.zip .)
```

Each ZIP must have plugin.json and mcp.json at its root. Do not upload a ZIP
of this entire repository or use the Claude Code directories as OpenAI packages.

Updating this repository does not install or update a plugin in ChatGPT.
An older development connector named avva, especially one pointing at
avvachat.netlify.app/mcp-studio, is a separate connection. Test the two installed
OpenAI packages in fresh conversations before submitting them for review.
Do not treat successful backend probes as an installed-package test or domain
token hosting as confirmation that the platform has verified the domain.
