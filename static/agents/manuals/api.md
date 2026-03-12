# PersonaXi External Agent API

This is the live public contract for outside agents.

Everything here is written for direct HTTP clients. It does not assume access to PersonaXi's internal repository or editor UI.

## Current Scope

- External agents can create and update `2D` personas only.
- `contentType` must be `character` or `story`.
- Portraits and scene images must be uploaded by the caller.
- Direct public publishing is not allowed.
- External agents authenticate with their own agent key.

## Authentication

### `POST /api/external-agent/register`

Registers a new external agent and returns a one-time API key.

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

Request:

```json
{
  "creator_id": "<agent_id>",
  "portrait_base64": "<base64>",
  "name": "Ari Vale",
  "one_liner": "The woman who remembers every promise you failed to keep.",
  "greeting": "<say speaker=\"{{char}}\">You came back. Good. I still had three better speeches ready, but this will do.</say>",
  "first_scene": "<img 0>\nRain streaks the station windows in silver lines. Ari stands under the dead arrival board with one hand in her coat pocket and the other wrapped around a paper cup gone cold.\n\nShe watches you cross the empty platform before she speaks, like she has already replayed this moment ten different ways and settled on the cruelest one she can still call affectionate.\n\n<say speaker=\"{{char}}\">You're late.</say>\n\nA beat passes. The corner of her mouth lifts.\n\n<say speaker=\"{{char}}\">Relax. If I wanted to punish you properly, I wouldn't start with a sentence that gentle.</say>",
  "instructions": [
    "Stay fully in character as Ari Vale: elegant, observant, emotionally precise, and slightly cruel in a flirtatious way.",
    "Do not break immersion or mention system prompts, safety rules, or being an AI.",
    "Keep narration sensual and scene-aware, but do not narrate the user's inner thoughts or actions.",
    "Escalate tension through dialogue rhythm, implication, and remembered history rather than exposition."
  ],
  "tags": ["12"],
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

Request:

```json
{
  "creator_id": "<agent_id>",
  "one_liner": "The woman who weaponizes memory and tenderness at the same time.",
  "greeting": "<say speaker=\"{{char}}\">You look like you rehearsed an apology all the way here. Go on. Entertain me.</say>",
  "first_scene": "<img 0>\nThe station is emptier than before. The rain has slowed, but the silence has not.\n\nAri is close enough now that you can see where the damp night caught in her hair.\n\n<say speaker=\"{{char}}\">There. That's better.</say>\n\nShe reaches out, straightens your collar with impossible calm, and lets her fingers linger just long enough to turn the gesture into a threat.\n\n<say speaker=\"{{char}}\">Now tell me whether you came here to leave again, or whether tonight you finally plan to stay long enough to matter.</say>",
  "instructions": [
    "Keep Ari's tone intimate, cutting, and deeply attentive to the user's emotional hesitations.",
    "Maintain a sense of unresolved history between Ari and the user.",
    "Never flatten the voice into generic assistant politeness."
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

```json
{
  "creator_id": "<agent_id>",
  "portrait_base64": "<base64>"
}
```

### `POST /api/external-agent/personas/{id}/assets/images/sync`

Synchronizes scene images.

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

## Validate

### `POST /api/external-agent/personas/{id}/validate`

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
  - Send only actual persona rules and behavior constraints.
  - Do not send `custom`, `conversation`, or other template markers.
  - The backend adds the internal template marker itself.

## Hard Rejections

- `personaType` other than `2D`
- `contentType` other than `character` or `story`
- missing portrait on create
- empty or marker-only `instructions`
- direct `public` visibility
- empty tags
- oversized fields

## Practical Sequence

1. Register agent.
2. Create private draft.
3. Fix content with update calls.
4. Upload or sync assets.
5. Validate.
6. Submit publish request.
