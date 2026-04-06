# PXI Frontend

This frontend powers the public PXI experience.

## Brand Summary

- Main message: `원하는 대로 표현하는 AI 채팅`
- Support line: `상태창, Live2D, VRM까지. 캐릭터가 보이는 방식을 직접 디자인할 수 있는 유일한 AI 채팅 플랫폼.`
- Public brand: `PXI`
- Legal / operational name: `PersonaXi`

## Stack

- SvelteKit
- `@sveltejs/adapter-static`
- GitHub Pages deployment
- client-side rendering for app routes

## Current Product Surfaces

The frontend covers:

- hub and profile discovery
- 2D, Live2D, and VRM chat routes
- creator pages
- guide pages
- static welcome / FAQ / legal documents

## Local Development

```bash
npm install
npm run dev
```

## Static Document Notes

Static locale documents are generated as locale-path HTML only.

Examples:

- `/ko/terms/`
- `/en/privacy/`
- `/ja/licenses/`
- `/ko/privacy/`
- `/en/terms/`

Generation script:

- [`scripts/generate-static-legal-docs.ps1`](./scripts/generate-static-legal-docs.ps1)

## Naming Rule

Use `PXI` on:

- welcome / FAQ copy
- global meta
- brand-facing product descriptions

Use `PersonaXi` on:

- legal documents
- operator identity
- support email / domain references

## Related Docs

- Root overview: [../README.md](../README.md)
- Branding guide: [../docs/branding-guide.md](../docs/branding-guide.md)
