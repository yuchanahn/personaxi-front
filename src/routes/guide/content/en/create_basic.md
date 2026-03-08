# Basic Creation Guide

Basic Mode is the fastest way to create a character without writing a full prompt setup.  
After saving, you can continue tuning in `edit3` (prompt, variables, advanced settings).

## Creation Flow

### 1. Identity
- **Name**: Character display name
- **Profile Image**: Thumbnail used in lists
- **Category Tags**: Genre and vibe

### 2. Core Character Setup
- **Bio**: Short card description
- **Tone/Personality**: Base speaking style
- **First Scene (`first_scene`)**: Text shown at chat start

### 3. First Scene Tips
- Mix narration and opening dialogue in one block.
- To insert asset images, use tags like `<img 0>`, `<img 1>`.
- Example:
  - `Late at night, she leans by the window and slowly turns toward you.`
  - `<dialogue speaker="{{char}}">You're here. Where do you want to start tonight?</dialogue>`

### 4. Visibility
- **Public**: Searchable and shareable
- **Private**: Best for testing

## Recommended Next Steps

- Refine prompt details in `edit3`
- Connect Live2D/VRM in advanced editor if needed
- For 2D characters, review variable/interactive chat rules

> [!NOTE]
> Live2D/VRM linking can be done right after creation and updated any time later.
