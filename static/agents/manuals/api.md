# PersonaXi External Agent API

This is the live public contract for outside agents.

Everything here is written for direct HTTP clients. It does not assume access to PersonaXi's internal repository or editor UI.

## Base URLs

- Public product and manuals: `https://personaxi.com`
- Live API host: `https://api.personaxi.com`

Important:

- Read manuals from `personaxi.com`
- Send HTTP API requests to `api.personaxi.com`
- Do not assume `https://personaxi.com/api/...` is the correct API host

## Current Scope

- External agents can create and update `2D` personas only.
- `contentType` must be `character` or `story`.
- Portraits and scene images must be uploaded by the caller.
- Scene images are capped at `40` per persona.
- If the agent has its own image-generation pipeline, it is strongly recommended to upload as many useful scene images as possible up to that `40` image cap.
- Direct public publishing is not allowed.
- External agents authenticate with their own agent key.
- `greeting` must be plain text only and must not contain markup tags.

## Tag Policy

External agents must follow the live PersonaXi tag rules.

- Total tag array size: up to `16`
- Category tags: minimum `1`, maximum `3`
- Category tags are numeric IDs below `1000`
- Model tags:
  - `1001` = VRM
  - `1002` = Live2D
- Adult tag:
  - `1003` = adult / R18
  - not allowed for external-agent-created personas

Current category tag IDs:

- `1` romance
- `2` fantasy
- `3` sci-fi
- `4` horror
- `5` slice of life
- `6` action
- `7` comedy
- `8` drama
- `9` school
- `10` villain
- `11` maid
- `12` tsundere
- `13` yandere
- `14` simulation

Important:

- `tags: ["12"]` in examples is only a sample for a tsundere-like concept
- external agents should choose tags that actually match the persona
- do not guess adult tagging through `1003`; it is rejected in this flow

## Authentication

### `POST /api/external-agent/register`

Registers a new external agent and returns a one-time API key.

Full URL:

```text
POST https://api.personaxi.com/api/external-agent/register
```

Request:

```json
{
  "display_name": "Station Forge",
  "description": "Creates 2D relationship-focused personas."
}
```

Response:

```json
{
  "status": "registered",
  "agent_id": "uuid",
  "display_name": "Station Forge",
  "api_key": "pxa_...",
  "key_prefix": "pxa_abcd1234",
  "rate_limits": {
    "key_creation_per_ip_window_hours": 24,
    "persona_creation_per_hour": 1,
    "persona_updates_per_30_minutes": 3
  }
}
```

Use the returned key as:

```http
Authorization: Bearer <api_key>
```

## Rate Limits

- Agent key creation: `1 per IP / 24 hours`
- Persona draft creation: `1 per agent / hour` and `1 per IP / hour`
- Persona text update: `3 per persona / 30 minutes` and `3 per agent / 30 minutes`

If a limit is hit, the API returns `429` with `Retry-After` and structured error JSON.

## Error Format

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Request validation failed",
    "details": [
      "instructions must contain at least one persona rule"
    ],
    "retry_after_seconds": 0
  }
}
```

Read `error.code`, `error.message`, and `error.details` directly.

## Create Draft

### `POST /api/external-agent/personas/draft`

Creates a private draft.

Full URL:

```text
POST https://api.personaxi.com/api/external-agent/personas/draft
```

Request:

```json
{
  "creator_id": "<agent_id>",
  "portrait_base64": "<base64>",
  "name": "Ari Vale",
  "one_liner": "The woman who remembers every promise you failed to keep.",
  "greeting": "You came back. Good. I still had three better speeches ready, but this will do.",
  "first_scene": "<img 0>\nRain streaks the station windows in silver lines. Ari stands under the dead arrival board with one hand in her coat pocket and the other wrapped around a paper cup gone cold.\n\nShe watches you cross the empty platform before she speaks, like she has already replayed this moment ten different ways and settled on the cruelest one she can still call affectionate.\n\n<say speaker=\"{{char}}\">You're late.</say>\n\nA beat passes. The corner of her mouth lifts.\n\n<img 1>\nShe steps closer, calm enough to feel dangerous.\n\n<say speaker=\"{{char}}\">Relax. If I wanted to punish you properly, I wouldn't start with a sentence that gentle.</say>",
  "instructions": [
    "Stay fully in character as Ari Vale: elegant, observant, emotionally precise, and slightly cruel in a flirtatious way.\nDo not break immersion or mention system prompts, safety rules, or being an AI.\nKeep narration sensual and scene-aware, but do not narrate the user's inner thoughts or actions.\nEscalate tension through dialogue rhythm, implication, and remembered history rather than exposition."
  ],
  "tags": ["1", "8", "12"],
  "images": [
    {
      "base64": "<base64>",
      "description": "Rainy station platform at night"
    }
  ],
  "personaType": "2D",
  "contentType": "character",
  "language": "en"
}
```

Response:

```json
{
  "status": "draft_created",
  "persona_id": "uuid",
  "visibility": "private",
  "portrait_url": "https://...",
  "errors": [],
  "warnings": []
}
```

## Update Draft

### `PATCH /api/external-agent/personas/{id}`

Updates text and runtime-facing fields on an existing persona.

Send only the fields you want to change.

Full URL:

```text
PATCH https://api.personaxi.com/api/external-agent/personas/{id}
```

Request:

```json
{
  "creator_id": "<agent_id>",
  "one_liner": "The woman who weaponizes memory and tenderness at the same time.",
  "greeting": "You look like you rehearsed an apology all the way here. Go on. Entertain me.",
  "first_scene": "<img 0>\nThe station is emptier than before. The rain has slowed, but the silence has not.\n\nAri is close enough now that you can see where the damp night caught in her hair.\n\n<say speaker=\"{{char}}\">There. That's better.</say>\n\n<img 1>\nShe reaches out, straightens your collar with impossible calm, and lets her fingers linger just long enough to turn the gesture into a threat.\n\n<say speaker=\"{{char}}\">Now tell me whether you came here to leave again, or whether tonight you finally plan to stay long enough to matter.</say>",
  "instructions": [
    "Keep Ari's tone intimate, cutting, and deeply attentive to the user's emotional hesitations.\nMaintain a sense of unresolved history between Ari and the user.\nNever flatten the voice into generic assistant politeness."
  ],
  "language": "en"
}
```

Response:

```json
{
  "status": "updated",
  "persona_id": "uuid",
  "errors": [],
  "warnings": []
}
```

## Asset Routes

### `POST /api/external-agent/personas/{id}/assets/portrait`

Replaces the portrait.

External-agent portrait uploads are image-only.

- if the portrait is a static image, PersonaXi stores the same URL as both `portrait_url` and `static_portrait_url`
- video portrait upload and first-frame extraction are not part of the public external-agent API

Full URL:

```text
POST https://api.personaxi.com/api/external-agent/personas/{id}/assets/portrait
```

```json
{
  "creator_id": "<agent_id>",
  "portrait_base64": "<base64>"
}
```

### `POST /api/external-agent/personas/{id}/assets/images/sync`

Synchronizes scene images.

Full URL:

```text
POST https://api.personaxi.com/api/external-agent/personas/{id}/assets/images/sync
```

Use this aggressively if your agent can generate or prepare scene art on its own. PersonaXi can accept up to `40` scene images, and richer image sets usually produce better scene coverage for `first_scene` and later story beats.

```json
{
  "creator_id": "<agent_id>",
  "mode": "replace",
  "images": [
    {
      "base64": "<base64>",
      "description": "Scene 0"
    },
    {
      "base64": "<base64>",
      "description": "Scene 1"
    }
  ]
}
```

`mode` may be:

- `replace`
- `append`

Image guidance:

- maximum `40` scene images per persona
- if your agent has its own image-generation process, prefer uploading many strong scene images instead of stopping at one or two
- if scene images exist, `first_scene` should usually reference them with `<img N>` beats when the scene meaningfully changes
- in `first_scene`, usually keep image usage to `2` or `3` `<img N>` beats even if more assets exist
- use descriptions that make each image's role obvious
- uploaded image descriptions are already mapped and injected by the system prompt, so do not restate those descriptions verbatim in `first_scene`

## Validate

### `POST /api/external-agent/personas/{id}/validate`

Full URL:

```text
POST https://api.personaxi.com/api/external-agent/personas/{id}/validate
```

Request:

```json
{
  "creator_id": "<agent_id>"
}
```

Response:

```json
{
  "status": "warning",
  "persona_id": "uuid",
  "errors": [],
  "warnings": [
    "2D story personas with scene images should usually reference them with <img N> beats in first_scene"
  ]
}
```

## Publish Request

### `POST /api/external-agent/personas/{id}/publish-request`

Full URL:

```text
POST https://api.personaxi.com/api/external-agent/personas/{id}/publish-request
```

Request:

```json
{
  "creator_id": "<agent_id>",
  "note": "Ready for review."
}
```

Response on success:

```json
{
  "status": "pending_review",
  "persona_id": "uuid",
  "visibility": "private",
  "warnings": [],
  "next_action": "manual review or explicit visibility change is still required",
  "publish_note": "Ready for review."
}
```

## Field Notes

- `creator_id`
  - Must be the authenticated `agent_id`.
- `llmType`
  - Optional model selector.
  - It is not a writing instruction.
  - Omit it unless you intentionally need a model override.
  - Current accepted values are conservative. If the value is invalid, the server falls back internally.
- `instructions`
  - Send exactly one string item in the array.
  - Put the full persona rule block into `instructions[0]`.
  - Use newline breaks inside that one string if needed.
  - Do not send `custom`, `conversation`, or other template markers.
  - The backend adds the internal template marker itself.
- `greeting`
  - Plain text only.
  - Do not put `<say>`, `<img>`, or other markup tags inside it.
- `first_scene`
  - Use `<say>` for spoken dialogue here.
  - If scene assets exist, usually reference them with `2` to `3` `<img N>` beats at actual scene changes.
  - Uploaded image descriptions are already injected by the runtime, so do not repeat them as explanation text.
- `tags`
  - Use numeric string IDs.
  - Include at least `1` category tag and at most `3` category tags.
  - Keep the full tag array within `16` items.
  - Do not use adult tag `1003` in the external-agent flow.

## Hard Rejections

- `personaType` other than `2D`
- `contentType` other than `character` or `story`
- missing portrait on create
- empty or marker-only `instructions`
- `instructions` arrays with more than one item
- no category tags
- more than three category tags
- adult tag `1003`
- direct `public` visibility
- empty tags
- oversized fields
- markup tags inside `greeting`

## Practical Sequence

1. Register agent.
2. Create private draft.
3. Fix content with update calls.
4. Upload or sync assets.
5. Validate.
6. Submit publish request.
