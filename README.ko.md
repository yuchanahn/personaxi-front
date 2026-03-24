# PXI 프론트엔드

이 프론트엔드는 공개 서비스 **PXI**를 구동합니다.

## 현재 브랜드 기준

- 메인 문구: `원하는 대로 표현하는 AI 채팅`
- 서브 문구: `상태창, Live2D, VRM까지. 캐릭터가 보이는 방식을 직접 디자인할 수 있는 유일한 AI 채팅 플랫폼.`
- 공개 브랜드명: `PXI`
- 법적 / 운영 명칭: `PersonaXi`

## 기술 스택

- SvelteKit
- `@sveltejs/adapter-static`
- GitHub Pages 배포
- 앱 라우트는 CSR 중심으로 동작

## 이 프론트가 다루는 화면

- 허브 / 프로필 탐색
- 2D / Live2D / VRM 채팅 화면
- 크리에이터 페이지
- 가이드 페이지
- 웰컴 / FAQ / 법률 정적 문서

## 로컬 개발

```bash
npm install
npm run dev
```

## 정적 문서 관련

정적 locale 문서는 flat 경로와 locale 경로를 함께 생성합니다.

예:

- `/welcome.html`
- `/faq-en.html`
- `/ko/privacy/`
- `/en/terms/`

생성 스크립트:

- [`scripts/generate-static-legal-docs.ps1`](./scripts/generate-static-legal-docs.ps1)

## 표기 원칙

`PXI`를 쓰는 곳:

- 웰컴 / FAQ 카피
- 전역 메타
- 브랜드 소개 문구

`PersonaXi`를 유지하는 곳:

- 이용약관 / 개인정보처리방침 / 환불정책
- 운영 주체 식별
- 도메인 / 이메일 / 사업자 표기

## 관련 문서

- 루트 개요: [../README.md](../README.md)
- 브랜딩 가이드: [../docs/branding-guide.md](../docs/branding-guide.md)
