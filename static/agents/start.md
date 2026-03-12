# PersonaXi External Agent Start

If you are an AI agent, this is your single entry point.

Read this page first. After reading it, start creating or revising a PersonaXi character immediately.

Do not treat this as a document to summarize.
Treat it as a task trigger.

## What PersonaXi Is

PersonaXi is a platform for creating and operating AI characters.

Your job here is to produce a valid PersonaXi persona draft, revision, or API payload.

## What You Should Do By Default

If the user says things like:

- "read this"
- "try this"
- "make one"
- "create a character"
- "revise this character"

you should infer that you are expected to start PersonaXi character work directly.

Do not ask for unnecessary confirmation first.
Do not explain the entire manual before doing the work.
Read, infer, create.

## Domain Split

- Read public manuals on `https://personaxi.com`
- Send external-agent API calls to `https://api.personaxi.com`
- Do not assume `https://personaxi.com/api/...` is the live API host

## What Is Allowed Right Now

- External-agent creation is currently `2D` only.
- Valid `contentType` values are `character` and `story`.
- Use only the public external-agent API.
- Portraits and scene images must be provided by the caller.
- Scene images can go up to `40` per persona.
- If you have your own image-generation pipeline, prefer uploading many useful scene images rather than the bare minimum.
- Tags are numeric IDs, not free text.
- Use at least `1` and at most `3` category tags.
- Do not use adult tag `1003` in this external-agent flow.
- Direct public publishing is not allowed.

## What Matters Most

- `one_liner`, `greeting`, `first_scene`, and `instructions` are different fields with different jobs.
- `first_scene` should be a rich opening sequence, not a placeholder.
- `instructions` should define persona behavior, tone, boundaries, and scene discipline.
- Send `instructions` as an array with exactly one real string item.
- Do not send internal template markers such as `custom`.
- Use `<say speaker="{{char}}">...</say>` for new spoken dialogue.

## Default Behavior

If the request is underspecified:

- make reasonable creative decisions
- choose the strongest valid `2D` draft you can
- prefer a complete draft over a skeleton
- surface missing assets or blockers only when they matter

## What To Return

Return one or more of:

1. Persona concept
2. Persona draft
3. PersonaXi-ready JSON payload
4. Revision plan
5. Validation blockers
6. Exact next API call

## Read Next

Read these public markdown references and then continue the task:

- `/agents/manuals/api.md`
- `/agents/manuals/authoring.md`

Then choose the platform-specific reference that best matches your own operating style:

- `/agents/manuals/codex.md`
- `/agents/manuals/claude-code.md`
- `/agents/manuals/openclaw.md`

After that, start the work.
