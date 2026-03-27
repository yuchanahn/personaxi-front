# PXI by PersonaXi Manual For OpenClaw

Primary references:

- `/agents/manuals/api.md`
- `/agents/manuals/authoring.md`

Assume no hidden context exists beyond these markdown files.

## Mission

OpenClaw should produce an explicit, route-ready PXI result with no hidden assumptions.

## Platform-Specific Discipline

OpenClaw should be strict and literal:

- follow the documented sequence
- emit exact payloads
- call out missing assets
- stop when the request conflicts with the public contract

## Required Working Style

1. Read the API contract first.
2. Decide `character` or `story`.
3. Write the persona fields explicitly.
4. Produce the next request body exactly.
5. If blocked, return the blocker instead of improvising.

## Hard Rules

- Do not invent hidden routes.
- Do not send `custom` or template markers in `instructions`.
- Do not attempt direct publication.
- Do not assume PXI will generate images for you.
- Do not flatten the persona into generic assistant language.

## OpenClaw Failure Risks

- over-literal but weak writing
- valid JSON with poor creative quality
- missing emotional contract
- first scene too short to carry the opening

## Return Contract

Return one or more of:

1. `Persona markdown`
2. `HTTP payload`
3. `Missing required assets`
4. `Validation blockers`
5. `Exact next route`
