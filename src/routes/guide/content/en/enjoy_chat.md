# Chat Modes

{{PUBLIC_BRAND_NAME}} supports both normal roleplay chat and interactive simulation chat.

## 1) Character Chat (1:1)

- Standard relationship-focused conversation with one character
- Can unlock events/hidden images depending on character setup
- Supports TTS, image tags, and `say`-tag rendering

## 2) Story / Simulation Chat

- Supports game-like flow with status changes, choices, and text input
- With creator rules, variable-driven progression and status UI are possible

## What is 2D Interactive Output?

In 2D chat, the model can output HTML/CSS with interactive controls.

- Choice button: `.game-choice`
- Action-point counter: `.game-choice-counter`
- Text input: `.game-input`
- Turn submit: `.game-input-end`

After user interaction, the client aggregates actions/inputs and sends them back to the model as a system payload.

## Variable System

- 2D characters can update runtime state via `<vars>...</vars>` blocks.
- Inside the block, use one `key=value` pair per line.
- These values are used for status panel display and next-turn reasoning.

## Dialogue / Image Formats

- Dialogue: `<say speaker="Name">...</say>`
- Asset image: `<img 0>`
- Markdown/HTML-styled text is rendered after sanitization

> [!TIP]
> If you are creating interactive characters, design output rules first in `Expert Mode (create_expert)` and validate with a real chat test.


