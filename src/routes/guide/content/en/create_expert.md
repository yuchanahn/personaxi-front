# Expert Mode

Expert Mode is for prompt-level control, including output format and interaction behavior.

## Core Sections

### 1. System Prompt
- Define behavior rules, narration style, and hard constraints
- Supports variables like `{{user}}`, `{{char}}`

### 2. Few-shot Examples
- Split multiple examples with `<START>`
- Best tool for locking speech rhythm and character voice

### 3. KB / RAG
- Attach worldbuilding or rule docs
- Lets the model retrieve knowledge instead of bloating one huge prompt

### 4. Parameters
- Tune `temperature`, `top_p`, `top_k`, etc.

## Mandatory Format Notes for Custom Prompts

### Dialogue
- Prefer `<dialogue speaker="{{char}}">...</dialogue>` for spoken lines
- Keep narration outside dialogue tags

### Asset Image Output
- Use `<img 0>`, `<img 1>` tags for asset-linked scene images
- Place image tags on their own line between text blocks

### 2D Interactive UI Output
- Interactive buttons/inputs work only when HTML/class rules are respected
- Main classes:
  - `.game-choice-counter`
  - `.game-choice` (`data-id`, `data-action` required)
  - `.game-input` (`data-id` recommended)
  - `.game-input-end`
- User actions are aggregated and sent back as `<system-input>...</system-input>`

### Variable System (2D)
- To update runtime state, include a `<vars>...</vars>` block in the response.
- Inside the block, write one `key=value` pair per line.
- Example:
  - `<vars>`
  - `trust=12`
  - `danger=3`
  - `</vars>`
- `<vars>` is state data (not visible narrative text) and is used for status UI and later reasoning.

## Practical Tips

- Kintsugi template already includes interactive-engine guidance.
- Fully custom templates should explicitly include these rules.
- Test at least one full cycle: button clicks + text input + end button.
