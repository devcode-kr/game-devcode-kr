# WebGL 게임 엔진 / 라이브러리 비교

> 출처: LogRocket (May 2025), utsubo.com (Jan 2026), MDN Web Docs

---

## 3D 라이브러리 빅3 비교

| 항목 | Three.js | Babylon.js | PlayCanvas |
|------|----------|------------|------------|
| Weekly Downloads | 4,268,741 | 13,222 | 15,049 |
| GitHub Stars | 110,497 | 25,003 | 14,376 |
| 번들 크기 (gzip) | ~168 kB | ~1.4 MB | ~300 kB |
| WebGPU 지원 | ✅ r171+ (zero-config) | ✅ 8.0+ | ✅ |
| 비주얼 에디터 | ❌ (코드 전용) | Playground | ☁️ 클라우드 IDE |
| React 통합 | ✅ 탁월 (R3F) | 제한적 | 제한적 |
| 내장 물리 엔진 | ❌ (Rapier, Cannon 별도) | ✅ (Havok, Cannon, Oimo) | ✅ (Ammo.js) |
| 내장 오디오 | ❌ | ✅ | ✅ |
| XR (VR/AR) | WebXR API 직접 | ✅ 네이티브 지원 | ✅ |
| 라이선스 | MIT | Apache 2.0 | MIT (엔진) |
| 후원 | 커뮤니티 (mrdoob) | Microsoft | Snap Inc. |

---

## Three.js

- **성격:** 저수준 3D 렌더링 라이브러리. 렌더링만 담당하고 나머지는 직접 구성
- **강점:** 생태계 압도적 (4.2M 다운로드/주), 번들 경량, React Three Fiber(R3F)와 궁합
- **약점:** 물리/오디오/게임루프 없음 → 별도 라이브러리 필요
- **적합한 경우:** React 앱, 데이터 시각화, 크리에이티브 경험, 풀 컨트롤 필요 시
- **공식 사이트:** https://threejs.org
- **GitHub:** https://github.com/mrdoob/three.js (MIT)

### 관련 에코시스템
- **React Three Fiber (R3F):** React에서 Three.js 선언적으로 사용 → https://r3f.docs.pmnd.rs
- **Drei:** R3F용 유틸리티 컴포넌트 모음 → https://github.com/pmndrs/drei
- **Rapier:** Rust 기반 물리 엔진 (WebAssembly) → https://rapier.rs
- **Cannon.js:** JS 물리 엔진 → https://github.com/pmndrs/cannon-es

---

## Babylon.js

- **성격:** 완전한 브라우저 기반 게임 엔진. Microsoft 후원
- **강점:** 배터리 포함 (물리/오디오/XR/파티클/GUI/충돌 내장), Playground(온라인 IDE)
- **약점:** 번들 크기 크고 (1.4MB), React 통합 어색
- **적합한 경우:** 브라우저 게임, VR/AR 경험, 복잡한 시뮬레이션
- **공식 사이트:** https://www.babylonjs.com
- **GitHub:** https://github.com/BabylonJS/Babylon.js (Apache 2.0)
- **Playground:** https://playground.babylonjs.com

---

## PlayCanvas

- **성격:** 클라우드 기반 게임 엔진. 에디터 중심
- **강점:** 실시간 협업 에디터 (Figma처럼), 모바일 최적화 우수, 팀 워크플로우
- **약점:** 클라우드 에디터 의존, 오픈소스 엔진은 MIT지만 에디터는 독점
- **적합한 경우:** 게임 스튜디오, 비기술 팀원과 협업, 빠른 프로토타이핑
- **공식 사이트:** https://playcanvas.com
- **GitHub:** https://github.com/playcanvas/engine (MIT)

---

## 2D 특화 라이브러리

### Phaser
- HTML5 Canvas + WebGL 기반 2D 게임 프레임워크
- 가장 성숙한 2D 웹 게임 엔진, 방대한 커뮤니티
- **사이트:** https://phaser.io | **GitHub:** https://github.com/phaserjs/phaser (MIT)

### Pixi.js
- 빠른 2D 렌더링 라이브러리 (게임엔진보다는 렌더러에 가까움)
- UI 중심 앱, 인터랙티브 광고, 2D 애니메이션에 탁월
- **사이트:** https://pixijs.com | **GitHub:** https://github.com/pixijs/pixijs (MIT)

### Matter.js
- 2D 물리 엔진 (게임 엔진 아님, 물리 레이어만)
- **GitHub:** https://github.com/liabru/matter-js (MIT)

---

## 풀 게임 엔진 (WebGL Export 포함)

### Godot (Web Build)
- 오픈소스 풀 기능 게임 엔진, WebGL로 브라우저 export 가능
- GDScript/C# 지원, 2D/3D 모두 지원
- **사이트:** https://godotengine.org (MIT)

### GDevelop
- 노코드/로우코드 2D/3D 게임 엔진
- HTML5/WebGL export 지원, 초보자 친화적
- **사이트:** https://gdevelop.io (MIT 오픈소스 + 유료 클라우드)

### Defold
- 경량 2D/3D 엔진, HTML5 export 지원
- 로열티 없음, Defold Foundation 운영
- **사이트:** https://defold.com

### Construct
- 노코드 2D 게임 엔진, 브라우저 기반 에디터
- **사이트:** https://www.construct.net (프리미엄 모델)

---

## 엔진 선택 가이드

```
React 사용? → Three.js + R3F
게임 엔진 수준 필요? → Babylon.js
팀 + 에디터 필요? → PlayCanvas
2D 게임? → Phaser (복잡) / Pixi.js (렌더링만)
노코드? → GDevelop / Construct
완전한 게임 엔진? → Godot (WebGL export)
```
