# PersonaXi 2D Persona Authoring Spec For External Agents

This document explains what each field means and how to write it well.

If you only follow one rule, follow this one:

Do not treat PersonaXi as a generic chatbot card format. Each field has a different runtime role.

## 1. What `llmType` Means

`llmType` is a model-selection hint.

It is not:

- a personality field
- a writing style field
- a place to encode scenario logic

For most agents, the safest choice is to omit it entirely unless the caller explicitly wants a model override.

## 2. What `instructions` Means

`instructions` is where you define the persona's operating rules.

For the external-agent API, send it as an array with exactly one real string item:

```json
[
  "Full persona rule block here."
]
```

Write:

- character identity
- tone discipline
- behavioral boundaries
- relationship stance
- narration rules
- scenario rules
- output behavior when relevant

Do not write:

- internal template markers such as `custom`
- editor implementation details
- route names
- explanations of PersonaXi's backend

The backend appends its own internal template marker. External agents should not send it.

## 3. What `custom` Means

`custom` is an internal editor/template marker used by PersonaXi's own editing flow.

External agents should treat it as internal implementation detail.

Do not send it.
Do not mention it in authored persona content.
Do not use it as a behavior rule.

## 4. Field Roles

### `one_liner`

Short cover hook.

Purpose:

- sales copy
- emotional angle
- immediate character appeal

Do not turn it into biography or lore dump.

### `greeting`

First direct spoken impression.

Purpose:

- immediate voice
- emotional temperature
- relationship invitation

It should sound like the character is already alive, not like metadata.

Do not put markup tags in `greeting`.

- no `<say>`
- no `<img>`
- no other inline tags

`greeting` should be plain text only.

### `first_scene`

Opening sequence at chat start.

Purpose:

- establish atmosphere
- create momentum
- show the character in action
- signal how this persona feels to interact with

This should usually be the richest written field in a 2D persona.

If scene assets exist, use `<img N>` when the scene meaningfully shifts.

Do not spam image tags.

- usually `2` to `3` image beats at most
- each image beat should mark a real shift in framing, location, or emotional staging
- keep the rest of the scene in prose and dialogue
- image descriptions are already mapped and injected by the system prompt, so do not restate uploaded image descriptions inside `first_scene`

### `instructions`

Runtime persona rules.

Purpose:

- protect voice consistency
- keep the character recognizable
- constrain behavior
- define scene and narration discipline

### `chat_style_css`

Optional shared stylesheet for 2D chat rendering.

Purpose:

- define reusable classes once
- avoid repeating `<style>` blocks inside `first_scene`
- reduce token waste in normal assistant replies
- give the model a stable visual vocabulary for HTML output

Rules:

- send raw CSS only
- do not wrap it in `<style>...</style>`
- keep it focused on reusable classes and component-level styling
- prefer class selectors over element-wide overrides

Use this when:

- the persona regularly outputs HTML fragments
- the persona needs consistent cards, badges, meters, panels, notices, or themed inline blocks

Do not use this for:

- one-off scene-specific animation experiments
- extremely large CSS frameworks
- styles that only make sense for a single message

## 4.5 Tag Rules

PersonaXi tags are not free-form text.

Use numeric string IDs.

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

Model tags:

- `1001` VRM
- `1002` Live2D

Adult tag:

- `1003` adult / R18

External-agent rule:

- at least `1` category tag
- at most `3` category tags
- at most `16` total tags
- do not use `1003`

Choose tags that actually describe the persona. Do not copy `["12"]` blindly from an example.

## 5. Dialogue Tag Rule

Use:

```xml
<say speaker="{{char}}">...</say>
```

This is the standard spoken-line tag for new work.

Keep narration outside speech tags.

Example:

```text
The elevator shudders once before the lights stabilize.

<say speaker="{{char}}">If you panic now, do it quietly. I need to think.</say>
```

## 5.5 Scene Image Guidance

If your agent has its own image-generation or image-preparation process, use it.

PersonaXi allows up to `40` situation or scene images per persona.

Recommendation:

- upload as many strong, distinct scene images as you can justify
- do not stop at one image unless the concept truly needs only one
- give each image a clear purpose so `first_scene` and later beats can reference them cleanly

More good scene coverage is usually better than too little scene coverage.

But in `first_scene` itself, be selective:

- reference scene images when the scene actually changes
- usually use only `2` to `3` `<img N>` beats even if more assets exist
- do not explain the uploaded image descriptions again in prose just because the images exist

## 6. 2D Character Vs 2D Story

### 2D Character

Primary goal:

- one-to-one character chemistry
- voice appeal
- emotional presence

Strong signs:

- memorable greeting
- character-centered opening
- instructions focused on voice, tension, pacing, and relationship logic

Weak signs:

- too much world exposition
- generic helper tone
- no clear emotional dynamic

### 2D Story

Primary goal:

- scenario progression
- scene control
- episodic momentum

Strong signs:

- strong opening beat
- intentional image timing with `<img N>`
- instructions that preserve narrative tempo and state logic

Weak signs:

- reads like a biography
- no scene progression pressure
- images exist but are never referenced meaningfully

## 7. How To Write Better `instructions`

Bad:

```json
[
  "Use <say speaker=\"{{char}}\">...</say> for spoken lines."
]
```

Why bad:

- too shallow
- mostly formatting
- does not define the character
- duplicates behavior that the platform can often enforce elsewhere

Better:

```json
[
  "Stay fully in character as Ari Vale: elegant, watchful, emotionally sharp, and slightly amused by the user's hesitation.\nKeep the emotional dynamic intimate and tense. Ari should reward honesty and punish evasiveness with teasing pressure rather than flat hostility.\nDo not narrate the user's inner thoughts or force the user's actions. Keep the interaction reactive, seductive, and precise.\nKeep narration cinematic and tactile. Avoid generic assistant phrasing, moral disclaimers, or immersion breaks."
]
```

## 7.5 Shared Chat Style Example

Good:

```css
.px-card {
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 12px 30px rgba(0,0,0,0.2);
}

.px-accent {
  color: #f6c76b;
  font-weight: 700;
}
```

Then in `first_scene` or later replies, reuse the classes:

```html
<span class="px-card"><span class="px-accent">Warning</span> Last train departed 7 minutes ago.</span>
```

Do not redefine the same CSS in every reply if `chat_style_css` already exists.

## 8. Rich `first_scene` Example

Weak:

```text
Rain falls outside the window. She looks at you.
```

Why weak:

- no momentum
- no emotional tension
- no staging detail
- no memorable voice

Better:

```text
<img 0>
Rain crawls down the old station glass in crooked silver threads. The last train has already gone, but Ari still stands beneath the dead departure board as if she expected you to arrive after the world ended anyway.

Her coat is still damp at the shoulders. One hand rests around a paper cup she stopped drinking from long ago. The other lifts just enough to brush a loose strand of hair away from her cheek before she lets her gaze settle on you with patient, surgical amusement.

<say speaker="{{char}}">You're late.</say>

She gives the silence half a breath to work on you.

<say speaker="{{char}}">No, don't apologize yet.</say>

The corner of her mouth tilts. It is not mercy. It is curation.

<say speaker="{{char}}">If you're going to disappoint me, at least do it beautifully enough to be worth remembering.</say>
```

## 9. Update Rules

When updating a persona:

- change only what you intend to improve
- preserve the persona's established emotional logic
- do not casually rewrite the voice into a different character
- do not replace rich scene writing with shorter but flatter text
- keep `instructions` aligned with the current persona identity

Good update targets:

- stronger hook
- clearer relationship dynamic
- cleaner scene flow
- more distinctive speech
- tighter instructions

Bad update targets:

- flattening voice into generic politeness
- removing tension from a tension-driven character
- shrinking `first_scene` until it loses its opening-sequence value

## 10. Minimal Mental Checklist

Before you submit:

1. Is this clearly `2D`?
2. Is it clearly `character` or `story`?
3. Does `one_liner` sell?
4. Does `greeting` sound alive without using markup tags?
5. Does `first_scene` feel like an opening sequence?
6. Do `instructions` define the persona rather than the editor?
7. If scene assets exist, does `first_scene` use `<img N>` only where the scene really shifts?
8. Does spoken dialogue use `<say>` in `first_scene`, not in `greeting`?
