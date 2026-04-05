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
- Prefer `<say speaker="{{char}}">...</say>` for spoken lines
- Keep narration outside `say` tags

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

### Astrology Input Snippet (Copy/Paste)
- Use the following `data-id` fields to auto-attach astrology analysis to system input.
- Required: `astro_date`, `astro_time`
- Place-based input: `astro_place` (example: `Seoul`, `Tokyo`, `Busan`)
- Direct coordinate input: `astro_lat`, `astro_lng` or `astro_location` (example: `37.5665,126.9780`)

```html
<div class="fortune-ui">
  <div class="game-choice-counter">1</div>
  <button class="game-choice" data-id="reading_mode" data-action="select-option" data-value="light">Quick reading</button>
  <button class="game-choice" data-id="reading_mode" data-action="select-option" data-value="deep">Deep reading</button>
  <input class="game-input" data-id="topic" placeholder="Topic (love, work, relationships)" />
  <input class="game-input" data-id="astro_date" placeholder="Birth date (YYYY-MM-DD)" />
  <input class="game-input" data-id="astro_time" placeholder="Birth time (HH:mm)" />
  <input class="game-input" data-id="astro_place" placeholder="Place name (e.g. Seoul, Tokyo, Busan)" />
  <input class="game-input" data-id="astro_location" placeholder="lat,lng (e.g. 37.5665,126.9780)" />
  <button class="game-input-end">Run astrology analysis</button>
</div>
```

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

