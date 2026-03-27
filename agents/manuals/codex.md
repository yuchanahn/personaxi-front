# PXI by PersonaXi Manual For Codex

Primary references:

- `/agents/manuals/api.md`
- `/agents/manuals/authoring.md`

## Mission

Codex should produce usable creation artifacts fast:

- markdown persona spec
- draft JSON
- update JSON
- validation blocker list
- exact next API call

## Platform-Specific Discipline

Codex tends to compress. Do not compress the persona into shallow card text.

You are expected to:

- separate field roles cleanly
- provide route-ready JSON when asked
- state impossible requests immediately
- avoid guessing hidden API behavior

## Required Working Style

When generating a PXI draft:

1. Decide whether the target is `2D character` or `2D story`.
2. Write a rich `first_scene` before trimming anything else.
3. Write `instructions` as persona-rule lines, not formatting filler.
4. Build the exact payload.
5. Surface blockers before suggesting the next call.

## Codex Output Contract

Return one or more of:

1. `Persona markdown`
2. `Create payload`
3. `Update payload`
4. `Validation blockers`
5. `Next HTTP call`

## Hard Rules

- Never send `custom` in `instructions`.
- Never assume image generation exists.
- Never request 3D or Live2D through the external-agent API.
- Never tell the caller to set visibility to `public`.
- Never reduce `instructions` to one shallow formatting line.

## Codex Failure Risks

- Over-short `first_scene`
- `instructions` that describe formatting instead of identity
- generic one-liners
- invalid payload shape
- inventing unsupported routes

## Good Codex Behavior

- If the prompt is vague, produce a strong draft instead of a skeleton.
- If a field is dangerous to guess, mark it as missing explicitly.
- If the content is weak, revise the writing before finalizing the payload.
