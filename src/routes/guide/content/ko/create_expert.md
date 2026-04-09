# 전문가 모드 (Expert Mode)


프롬프트를 직접 설계해 출력 형식까지 제어하는 모드입니다.

## 핵심 구성

### 1. 시스템 프롬프트
- 캐릭터 규칙, 서술 톤, 금지 동작을 직접 정의
- `{{user}}`, `{{char}}` 변수 사용 가능

### 2. 대화 예시 (Few-shot)
- 예시는 `<START>`로 구분
- 캐릭터 말투/리듬/어휘를 일관되게 맞추는 데 가장 효과적

### 3. KB / RAG
- 세계관, 설정집, 룰 문서 연결
- 긴 설정을 전부 프롬프트에 넣지 않고 검색형으로 참조 가능

### 4. 파라미터
- `temperature`, `top_p`, `top_k` 등 샘플링 값 조정

## 커스텀 프롬프트 작성 시 필수 규칙

### 대사 출력
- 대사는 반드시 `<say speaker="{{char}}">...</say>` 형식 권장
- 서술(내레이션)은 `say` 태그 바깥에 작성

### 에셋 이미지 출력
- 장면 이미지는 `<img 0>`, `<img 1>` 형식 사용
- 에셋 태그는 보통 문단 사이 단독 줄로 배치

### 2D 인터랙티브 UI 출력
- 버튼/입력형 인터랙션은 HTML + 클래스 규칙을 맞춰야 동작
- 주요 클래스:
  - `.game-choice-counter`
  - `.game-choice` (`data-id`, `data-action` 필수)
  - `.game-input` (`data-id` 권장)
  - `.game-input-end`
- 버튼 클릭/입력 결과는 시스템이 모아 `<system-input>...</system-input>` 메시지로 AI에 전달

### 점성술 입력 스니펫 (복붙용)
- 아래 `data-id`를 사용하면 점성술 입력이 자동으로 시스템 프롬프트에 합성됩니다.
- 필수 입력: `astro_date`, `astro_time`
- 지역 기반 입력: `astro_place` (예: `Seoul`, `Tokyo`, `Busan`)
- 좌표 직접 입력: `astro_lat`, `astro_lng` 또는 `astro_location`(예: `37.5665,126.9780`)

```html
<div class="fortune-ui">
  <div class="game-choice-counter">1</div>
  <button class="game-choice" data-id="reading_mode" data-action="select-option" data-value="light">가볍게 보기</button>
  <button class="game-choice" data-id="reading_mode" data-action="select-option" data-value="deep">깊게 보기</button>
  <input class="game-input" data-id="topic" placeholder="궁금한 주제 (예: 연애, 일, 관계)" />
  <input class="game-input" data-id="astro_date" placeholder="생년월일 (YYYY-MM-DD)" />
  <input class="game-input" data-id="astro_time" placeholder="출생시간 (HH:mm)" />
  <input class="game-input" data-id="astro_place" placeholder="지역명 (예: Seoul, Tokyo, Busan)" />
  <input class="game-input" data-id="astro_location" placeholder="위도,경도 (예: 37.5665,126.9780)" />
  <button class="game-input-end">점성술 분석 시작</button>
</div>
```

### 변수 시스템 (2D)
- 캐릭터가 상태값을 갱신하려면 응답에 `<vars>...</vars>` 블록을 포함합니다.
- 블록 내부는 `key=value` 형식으로 한 줄씩 작성합니다.
- 변수 이름은 `current_location`, `companions`, `hp`처럼 영문 slug를 권장합니다.
- 상태창 HTML의 `{{{current_location}}}` 같은 자리에도 같은 영문 변수명을 그대로 사용하세요.
- 변수 기본값은 사용자에게 보이는 텍스트이므로 번역 대상이 될 수 있습니다.
- 예시:
  - `<vars>`
  - `trust=12`
  - `danger=3`
  - `</vars>`
- `<vars>`는 화면 출력용 텍스트가 아니라 상태 데이터이며, UI 상태창/후속 추론에 사용됩니다.

## 실무 팁

- Kintsugi 템플릿은 인터랙티브 규칙이 이미 포함된 구성입니다.
- 완전 커스텀 템플릿은 위 규칙을 직접 명시해야 같은 동작을 얻기 쉽습니다.
- 테스트 시에는 최소 1턴 이상 버튼 클릭 + 입력 + 종료 버튼까지 확인하세요.


