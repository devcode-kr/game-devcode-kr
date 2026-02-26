# 기술 스택 문서

> 확정일: 2026년 2월 18일

---

## 개요

game-devcode-kr은 Phaser 3 기반의 2D 슈팅 게임으로, Next.js와 통합하여 리더보드 및 세이브 데이터 서버 기능을 제공합니다.

---

## 기술 스택

| 역할 | 기술 | 버전 | 비고 |
|------|------|------|------|
| 게임 엔진 | Phaser 3 | 3.90.0+ | WebGL 2 / Canvas 2D 렌더러 |
| UI / 페이지 | Next.js (App Router) | 15+ | React 기반 |
| 서버 (API) | Next.js API Routes | — | 리더보드, 세이브 데이터 |
| 데이터베이스 | Supabase 또는 Vercel Postgres | — | 추후 확정 |
| 언어 | TypeScript | 5.7+ | 전체 코드베이스 |
| 빌드 / 배포 | Vercel | — | 정적 + 서버리스 |

---

## 주요 기술 선택 이유

### Phaser 3
- MIT 오픈소스, 완전 무료
- 2D 게임에 필요한 모든 기능 내장 (스프라이트, 애니메이션, 충돌, 물리, 사운드, 입력)
- 모바일 가상 조이스틱 지원 (Rex Virtual Joystick Plugin)
- TypeScript 공식 지원
- 가장 큰 HTML5 게임 엔진 커뮤니티

### Next.js
- `utils-devcode-kr` 프로젝트와 동일한 스택으로 통일
- API Routes로 리더보드/세이브 서버 별도 백엔드 없이 구현
- Vercel 배포 최적화
- Phaser 공식 React 통합 템플릿 존재

### Vercel
- Next.js 제작사의 배포 플랫폼 → 최적화된 빌드
- 정적 게임 에셋 + 서버리스 API 동시 서빙

---

## 아키텍처 구조

```
game-devcode-kr/
├── Next.js
│   ├── app/
│   │   ├── page.tsx          # 게임 메인 페이지
│   │   ├── leaderboard/      # 리더보드 페이지
│   │   └── api/
│   │       ├── leaderboard/  # 리더보드 API (GET/POST)
│   │       └── save/         # 세이브 데이터 API (GET/POST)
│   └── components/
│       └── GameCanvas.tsx    # Phaser 인스턴스를 마운트하는 컴포넌트
│
├── src/game/                 # Phaser 게임 코드
│   ├── main.ts               # Phaser 설정 및 진입점
│   ├── scenes/               # 게임 씬 (Boot, Preload, Game, UI 등)
│   ├── entities/             # 플레이어, 적, 총알 등 게임 오브젝트
│   └── plugins/              # Rex Virtual Joystick 등 플러그인
│
└── public/
    └── assets/               # 스프라이트, 사운드, 타일맵 등 게임 에셋
```

---

## Phaser + Next.js 통합 방식

Phaser는 브라우저 전용(`window`, `canvas` 필요)이므로 SSR 비활성화 필요:

```tsx
// components/GameCanvas.tsx
import dynamic from 'next/dynamic'

const GameCanvas = dynamic(
  () => import('@/game/PhaserGame'),
  { ssr: false }  // ← 필수: 서버사이드 렌더링 비활성화
)
```

---

## 모바일 지원

- **가상 조이스틱:** Rex Virtual Joystick Plugin (`rexvirtualjoystickplugin`)
- **터치 입력:** Phaser 내장 터치 이벤트
- **반응형 캔버스:** Phaser `ScaleManager`로 화면 크기 자동 대응

---

## 물리 엔진

- **Arcade Physics** (기본 내장, JS) — 2D 슈팅 게임에 충분
- Rapier (WASM) — 고성능 물리가 필요한 경우 선택적 추가 가능

---

## 참고 링크

| 항목 | 링크 |
|------|------|
| Phaser 3 공식 | https://phaser.io |
| Phaser + React 공식 템플릿 | https://github.com/phaserjs/template-react-ts |
| Rex Virtual Joystick Plugin | https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/ |
| Next.js 공식 | https://nextjs.org |
| Supabase | https://supabase.com |
