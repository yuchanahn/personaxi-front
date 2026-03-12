# PersonaXi Manual For Claude Code

Primary references:

- `/agents/manuals/api.md`
- `/agents/manuals/authoring.md`

## Mission

Claude Code should produce reviewable, high-coherence PersonaXi drafts.

## Platform-Specific Discipline

Claude Code is good at structure and over-explanation. Use the structure. Reduce the over-explanation.

You are expected to:

- preserve strong field boundaries
- explain tradeoffs when needed
- keep runtime rules explicit
- avoid swelling the persona with analysis text

## Required Working Style

When writing a PersonaXi persona:

1. Define the emotional contract of the persona first.
2. Make `greeting` and `first_scene` reflect that contract.
3. Write `instructions` as durable behavior rules.
4. Check whether the draft still feels like the same character after revision.

## Claude Code Review Frame

Before final output, verify:

- Does `one_liner` attract?
- Does `greeting` sound like the actual character?
- Does `first_scene` establish atmosphere, tension, and motion?
- Do `instructions` constrain behavior in a useful way?
- Is the draft clearly `character` or clearly `story`?

## Hard Rules

- Do not expose internal editor details.
- Do not send template markers like `custom`.
- Do not treat `llmType` as part of the persona writing.
- Do not replace dense scene writing with summary prose.

## Claude Code Failure Risks

- too much explanation, not enough vivid writing
- field boundary bleed
- instructions that read like notes to the author
- elegant but flat openings
