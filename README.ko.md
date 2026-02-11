<div align="center">
  <img src="static/logo.png" alt="PersonaXi" width="120" height="120" />
  
  # PersonaXi
  
  **AI 페르소나 생성 & 크리에이터 경쟁 플랫폼**

  [🇺🇸 English](README.md) | [🇰🇷 한국어](README.ko.md)
  
  [웹사이트 방문](https://personaxi.com)
  
  ---

  ![Svelte](https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00)
  ![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
  ![Three.js](https://img.shields.io/badge/threejs-black?style=for-the-badge&logo=three.js&logoColor=white)
  ![Live2D](https://img.shields.io/badge/Live2D-FF5050?style=for-the-badge&logo=live2d&logoColor=white)

</div>

## 뭐하는 곳?

나만의 AI 캐릭터를 만들고, 대화하고, 다른 크리에이터들과 경쟁하는 플랫폼입니다.
2D/3D 캐릭터 모두 지원하고, 실시간 음성 대화도 가능해요.

## 주요 기능

- **3D VRM & Live2D 지원** - 3D 모델이든 2D 모델이든 다 됨
- **고급 AI 대화** - Gemini 2.5 기반으로 자연스러운 대화
- **크리에이터 경쟁 시스템** - 좋은 캐릭터 만들면 보상 받음
- **실시간 음성** - TTS로 캐릭터가 직접 말함
- **다국어 지원** - 한국어/영어 지원

## 기술 스택

- **SvelteKit** - 프레임워크
- **TypeScript** - 타입 안전성
- **Three.js** - 3D 렌더링 (VRM)
- **pixi-live2d-display** - Live2D 렌더링
- **Supabase** - 인증 & 스토리지

## 로컬 실행

```bash
# 클론
git clone https://github.com/your-username/personaxi-front.git
cd personaxi-front

# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm run dev
```

브라우저에서 `http://localhost:5173` 열기

## 환경 변수

`.env` 파일 생성:
```env
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_anon_key
PUBLIC_API_URL=http://localhost:8080
```

## 프로젝트 구조

```
src/
├── routes/              # 페이지 (SvelteKit 라우팅)
│   ├── 2d/             # 2D 채팅
│   ├── character/      # 3D VRM 채팅
│   ├── live2d/         # Live2D 채팅
│   ├── edit/           # 캐릭터 생성/수정
│   └── profile/        # 캐릭터 프로필
│
├── lib/
│   ├── components/     # 재사용 컴포넌트
│   ├── stores/         # Svelte 스토어
│   ├── api/            # API 클라이언트
│   └── vrm/            # VRM 관련 유틸
│
└── static/             # 정적 파일
```

## 빌드

```bash
pnpm run build
pnpm run preview  # 빌드 결과 미리보기
```

## 라이선스

MIT

---

<div align="center">
  만든 사람: YuChan
</div>
