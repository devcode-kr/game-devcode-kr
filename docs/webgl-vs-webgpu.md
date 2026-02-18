# WebGL vs WebGPU

> 출처: threejsroadmap.com (Nov 2025), Reddit r/webgpu (Mar 2025), MDN

---

## 한줄 요약

**WebGL2 = 현재 표준 (안전한 선택)**
**WebGPU = 미래 표준 (주요 라이브러리 이미 지원 중)**

---

## 비교표

| 항목 | WebGL 2 | WebGPU |
|------|---------|--------|
| 기반 API | OpenGL ES 3.0 | Vulkan / Metal / D3D12 |
| 브라우저 지원 | ✅ 모든 최신 브라우저 | ✅ Chrome/Edge/Firefox (Safari 제한적) |
| CPU 오버헤드 | 높음 | 낮음 (멀티코어 활용) |
| Compute Shader | ❌ | ✅ |
| 성능 | 충분히 빠름 | 더 빠름 (특히 복잡한 장면) |
| 학습 난이도 | 높음 (저수준 OpenGL) | 더 높음 (현대적이지만 복잡) |
| 라이브러리 지원 | 전 라이브러리 | Three.js r171+, Babylon.js 8.0+ |

---

## 현실적 판단

### WebGL2를 선택해야 할 때
- 모바일 포함 최대 호환성이 필요할 때
- 기존 WebGL 코드베이스가 있을 때
- 라이브러리 (Three.js, Babylon.js) 위에서 개발할 때 → 라이브러리가 알아서 처리

### WebGPU를 선택해야 할 때
- Chrome/Edge 타겟으로 충분할 때
- Compute Shader가 필요한 경우 (AI/ML, 복잡한 파티클, GPU 연산)
- 최신 Three.js r171+, Babylon.js 8.0+ 사용 시 → 자동으로 WebGPU 활용 가능

### 결론
> **라이브러리 (Three.js, Babylon.js) 위에서 개발한다면 WebGL vs WebGPU를 직접 선택할 필요 없다.**
> 라이브러리가 환경에 따라 자동으로 최적 렌더러를 선택한다.
> 직접 저수준 WebGL/WebGPU 코딩이 목적이라면 **WebGL2 먼저 익히고 WebGPU로 이전**을 추천.

---

## 브라우저 지원 현황 (2026.02 기준)

| 브라우저 | WebGL 2 | WebGPU |
|---------|---------|--------|
| Chrome 113+ | ✅ | ✅ |
| Firefox 120+ | ✅ | ✅ (플래그 없이) |
| Safari 15+ | ✅ | 🟡 (일부 지원) |
| Edge | ✅ | ✅ |
| 모바일 Chrome | ✅ | 🟡 |
| 모바일 Safari | ✅ | 🟡 |

- WebGPU 지원 현황: https://caniuse.com/webgpu
