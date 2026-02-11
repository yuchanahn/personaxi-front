<div align="center">
  <img src="static/logo.png" alt="PersonaXi" width="120" height="120" />
  
  # PersonaXi
  
  **AI Creator Competition Platform**

  [🇺🇸 English](README.md) | [🇰🇷 한국어](README.ko.md)
  
  [Visit Website](https://personaxi.com)
  
  ---

  ![Svelte](https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00)
  ![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
  ![Three.js](https://img.shields.io/badge/threejs-black?style=for-the-badge&logo=three.js&logoColor=white)
  ![Live2D](https://img.shields.io/badge/Live2D-FF5050?style=for-the-badge&logo=live2d&logoColor=white)

</div>

## Introduction

PersonaXi is a platform where you can create your own AI characters, chat with them, and compete with other creators.
It supports both 2D and 3D characters and offers real-time voice conversation capabilities.

## Key Features

- **3D VRM & Live2D Support** - Use either 3D or 2D models
- **Advanced AI Conversation** - Powered by Gemini 2.5 for natural dialogue
- **Creator Competition System** - Create great characters and earn rewards
- **Real-time Voice** - Characters speak directly via TTS
- **Multi-language Support** - Supports Korean and English

## Tech Stack

- **SvelteKit** - Framework
- **TypeScript** - Type Safety
- **Three.js** - 3D Rendering (VRM)
- **pixi-live2d-display** - Live2D Rendering
- **Supabase** - Auth & Storage

## Local Execution

```bash
# Clone
git clone https://github.com/your-username/personaxi-front.git
cd personaxi-front

# Install Dependencies
pnpm install

# Run Dev Server
pnpm run dev
```

Open `http://localhost:5173` in your browser.

## Environment Variables

Create `.env` file:
```env
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_anon_key
PUBLIC_API_URL=http://localhost:8080
```

## Project Structure

```
src/
├── routes/              # Pages (SvelteKit Routing)
│   ├── 2d/             # 2D Chat
│   ├── character/      # 3D VRM Chat
│   ├── live2d/         # Live2D Chat
│   ├── edit/           # Character Creation/Editing
│   └── profile/        # Character Profile
│
├── lib/
│   ├── components/     # Reusable Components
│   ├── stores/         # Svelte Stores
│   ├── api/            # API Client
│   └── vrm/            # VRM Utilities
│
└── static/             # Static Files
```

## Build

```bash
pnpm run build
pnpm run preview  # Preview build result
```

## License

MIT

---

<div align="center">
  Created by: YuChan
</div>
