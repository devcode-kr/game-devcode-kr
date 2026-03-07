# feat/movement-phase1

## 현재 작업 내역

### 프로젝트 재구성
- 기존 진행 중이던 복잡한 이동 실험 코드를 정리하고 Phaser 기반 최소 쿼터뷰 프로토타입으로 재구성
- 쿼터뷰 타일 렌더링, 플레이어 고정 카메라, 기본 충돌, WASD 이동, 좌클릭 직선 이동 구현

### 이동 시스템 1단계
- `MovementController`를 도입해 입력 처리와 이동 상태를 분리
- 이동 상태를 `idle`, `manual`, `click-move`로 구분
- 연속 좌표 기반 이동과 타일 충돌 판정을 분리
- 디버그 HUD에 현재 이동 상태, 타일 좌표, 월드 좌표, 목적지 표시
- 좌클릭 이동은 A* 경로 기반 waypoint 이동으로 동작
- 이동 중 경로가 막히면 최종 목표 기준으로 재탐색 시도
- 재탐색 실패, 도착, 수동 개입 상태를 HUD에 표시
- 경로 탐색은 시야 기반 타일 수를 기준으로 탐색 예산을 제한
- 탐색 예산은 `PATH_SEARCH_BUDGET_MULTIPLIER` 상수로 튜닝 가능

### 플레이어 표현 개선
- 단순 도형 플레이어에서 애니메이션 상태머신 추가
- `idle`, `run` 상태를 구분하고 bob/sway 기반 임시 애니메이션 적용
- 현재는 런타임 텍스처 생성 방식으로 간단한 sprite-like 표현을 실험 중

### 상호작용 시스템 1단계
- `E` 키 기반 근접 상호작용 추가
- 각 층에 일반 상자, 잠긴 상자, 계단, NPC를 배치하는 흐름 구현
- 일반 상자는 기본 보상을 제공하고, 잠긴 상자는 `key`가 있을 때만 열 수 있음
- `gold`, `potions`, `keys`를 플레이어 누적 상태로 관리하고 HUD에 표시
- 계단 상호작용으로 다음 층 BSP 던전을 재생성하는 최소 진행 루프 구현

### NPC 대화 시스템 1단계
- NPC를 상호작용 오브젝트 규칙에 포함
- 근접 후 `E`로 대화 시작, `E`로 다음 줄 진행, 마지막 줄에서 종료
- 대화 중에는 이동 입력과 클릭 이동을 일시 정지
- 화면 하단에 speaker + line + next 안내가 있는 간단한 대화 UI 추가

## 현재 브랜치 상태
- 브랜치 작업은 이동/상호작용 확장 기준으로 계속 진행 중
- 최근 구현에는 경로 재탐색, 탐색 예산 제한, 상호작용 오브젝트, NPC 대화가 포함됨
- `lint` 통과
- `build`는 Codex 샌드박스에서 Turbopack 포트 제약으로 직접 실패할 수 있으나, 권한 확장 환경에서는 성공 확인

## 다음 작업 후보
1. NPC 대화를 상태 기반 대사/분기 구조로 확장
2. 상호작용 결과를 HUD 텍스트 외 시각 피드백으로 보강
3. 플레이어 상태를 실제 소비 흐름과 연결
4. 층 진행 규칙과 상호작용 배치 규칙 정리

## 현재 구현 메모

### 경로 탐색
- A*는 `game/pathfinding/AStar.ts`에서 관리
- 반환값은 `path` 외에 `visitedNodes`, `exhaustedSearchBudget`를 포함
- 현재는 "플레이어가 볼 수 있는 규모만큼만 탐색할 수 있다"는 의도를 위해 탐색 노드 수 제한을 적용
- 시야 제한 자체로 클릭을 막지는 않음

### 상호작용 오브젝트
- 상호작용 타입은 현재 `chest`, `locked-chest`, `stairs`, `npc`
- 모두 `GameScene` 내부의 `Interactable` 구조로 통합 관리
- 보상 수치/확률은 아직 하드코딩이지만, 추후 외부 데이터로 분리 가능하도록 `reward` 필드를 유지

### NPC 규칙
- NPC는 현재 층마다 1명만 배치
- 대사는 고정 스크립트 배열을 순차 재생
- 향후 분기 대사, 상태 기반 대사, 퀘스트 훅을 붙일 수 있게 `dialogue` 필드를 둠

## ComfyUI 활용 조사 메모
- ComfyUI는 현재 사용자 계정이 아니라 `claw` 계정 환경에서 실행 중인 것으로 확인됨
- 확인된 프로세스 정보 기준 실행 명령:
  - `/home/claw/anaconda3/envs/comfyui/bin/python main.py --listen 0.0.0.0`
- 현재 계정에서도 로컬 HTTP API 접근 가능 확인:
  - `GET http://127.0.0.1:8188/system_stats` 응답 성공
  - 확인된 버전: `ComfyUI 0.15.0`
  - GPU: `NVIDIA GeForce RTX 5090`
- 기본 API 흐름 실제 동작 확인:
  1. `POST /prompt` 로 workflow 제출 성공
  2. `GET /history/{prompt_id}` 로 출력 이미지 메타데이터 조회 성공
  3. `GET /view?filename=...&type=output` 로 PNG 직접 다운로드 가능 확인
- 최소 테스트 workflow:
  - `EmptyImage -> SaveImage`
  - 테스트 prompt 결과물: `codex_probe_00001_.png`
- 외부 계정에서 실행 중이므로, 현재 작업 계정에서 활용하려면 다음 중 하나가 필요
  1. 로컬 HTTP API 접근 허용
  2. 공유 입력/출력 디렉터리 사용
  3. 작업용 프롬프트/워크플로우 JSON을 전달하는 래퍼 스크립트 작성

## ComfyUI 연동 방향 초안
- 목표: 캐릭터 컨셉 이미지가 아니라 `게임용 스프라이트 시트` 생성 파이프라인으로 활용
- 가장 현실적인 방식:
  1. Codex가 프롬프트와 워크플로우 JSON 생성
  2. 로컬 ComfyUI API에 요청 전송
  3. 생성된 결과물을 프로젝트 `public/assets/...`로 복사 또는 후처리
  4. Phaser에서 로드
- 추가 확인 필요:
  - 출력 파일 저장 위치와 권한
  - 스프라이트 시트 생성에 사용할 워크플로우 보유 여부
  - 이미지 생성 후 스프라이트 시트 후처리를 ComfyUI 안에서 할지, 프로젝트 스크립트에서 할지

## 권장 연동 방식
1. Codex가 게임용 프롬프트와 ComfyUI workflow JSON을 생성
2. 로컬에서 `curl` 또는 작은 Node 스크립트로 `http://127.0.0.1:8188/prompt` 호출
3. ComfyUI 출력 이미지를 프로젝트 `public/assets/characters/`로 복사
4. 필요하면 프로젝트 안에서 후처리 스크립트로 스프라이트 시트 결합 및 프레임 정리

## 확인된 API 절차
1. workflow JSON 준비
2. `POST /prompt`
3. 응답에서 `prompt_id` 수집
4. `GET /history/{prompt_id}` 로 성공 여부와 `filename`, `subfolder`, `type` 확인
5. `GET /view?filename=...&subfolder=...&type=output` 으로 결과 이미지 다운로드

## 현재 판단
- 현재 계정에서 ComfyUI를 "도구처럼" 활용하는 것은 가능
- 가장 안전한 방식은 ComfyUI 내부 출력 폴더를 직접 건드리는 대신 HTTP API만 사용하는 것
- 게임용 스프라이트 시트는 한 번에 완성형으로 뽑기보다:
  1. 방향별/포즈별 소스 이미지 생성
  2. 프로젝트 스크립트에서 시트 결합
  3. 필요시 후처리
  순서가 더 안정적

## 다음 조사/구현 제안
1. 현재 ComfyUI에 로드된 워크플로우 또는 사용 가능한 모델 확인
2. `text-to-image` 또는 `image-to-image` 기준 최소 workflow JSON 확보
3. Phaser에서 읽기 쉬운 스프라이트 시트 규격 정의
4. `scripts/generate-character-sheet.mjs` 같은 래퍼 스크립트 추가

## 최소 Character Sheet Workflow 설계

### 목적
- 완성형 8방향 스프라이트 시트를 한 번에 생성하는 것이 아니라
- 우선 게임용 캐릭터 소스 이미지를 안정적으로 생성하기 위한 최소 `txt2img` workflow 확보
- 이후 프로젝트 스크립트에서 배경 제거, 크롭, 시트 결합으로 이어지게 설계

### 추천 모델
- 1순위: `waiIllustriousSDXL_v160.safetensors`
- 2순위: `hassakuXLIllustrious_v34.safetensors`
- 비추천:
  - `beautifulRealistic_v7.safetensors`
  - `majicmixRealistic_v7.safetensors`
  이유: 게임용 2D 캐릭터 시트보다 사실 계열로 치우칠 가능성이 큼

### 추천 샘플링 파라미터
- `steps`: `28`
- `cfg`: `6.5`
- `sampler_name`: `dpmpp_2m`
- `scheduler`: `karras`
- `width`: `1024`
- `height`: `1024`

### 용도
- 1장 이미지 안에 `idle 8방향`용 참조가 들어간 character sheet source 생성
- 또는 방향별 캐릭터 참조 시트를 만든 뒤 후처리로 분리

### 프롬프트 원칙
- 배경 최소화
- 단일 캐릭터
- 정렬된 turnaround / sprite sheet / character sheet 명시
- 정면, 측면, 후면 등 방향 일관성 강조
- 복잡한 조명/배경/원근 왜곡 억제

### positive prompt 초안
```text
full body fantasy action RPG character sheet, 8 directional turnaround, front side back views, idle pose variations, clean silhouette, game sprite reference sheet, centered character, consistent proportions, simple costume shapes, readable boots gloves belt cape, plain background, high contrast outline, 2d game art, orthographic feeling, sheet layout, multiple poses in one canvas
```

### negative prompt 초안
```text
photorealistic, cinematic lighting, dynamic perspective, foreshortening, busy background, extra limbs, extra heads, duplicated body parts, cropped character, cut off feet, cut off head, blurry, noisy, text, watermark, logo, weapons clipping, deformed anatomy, asymmetrical turnaround, inconsistent costume
```

### 최소 workflow JSON 초안
```json
{
  "prompt": {
    "1": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": {
        "ckpt_name": "waiIllustriousSDXL_v160.safetensors"
      }
    },
    "2": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": "full body fantasy action RPG character sheet, 8 directional turnaround, front side back views, idle pose variations, clean silhouette, game sprite reference sheet, centered character, consistent proportions, simple costume shapes, readable boots gloves belt cape, plain background, high contrast outline, 2d game art, orthographic feeling, sheet layout, multiple poses in one canvas",
        "clip": ["1", 1]
      }
    },
    "3": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": "photorealistic, cinematic lighting, dynamic perspective, foreshortening, busy background, extra limbs, extra heads, duplicated body parts, cropped character, cut off feet, cut off head, blurry, noisy, text, watermark, logo, weapons clipping, deformed anatomy, asymmetrical turnaround, inconsistent costume",
        "clip": ["1", 1]
      }
    },
    "4": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "width": 1024,
        "height": 1024,
        "batch_size": 1
      }
    },
    "5": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["1", 0],
        "seed": 0,
        "steps": 28,
        "cfg": 6.5,
        "sampler_name": "dpmpp_2m",
        "scheduler": "karras",
        "positive": ["2", 0],
        "negative": ["3", 0],
        "latent_image": ["4", 0],
        "denoise": 1
      }
    },
    "6": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["5", 0],
        "vae": ["1", 2]
      }
    },
    "7": {
      "class_type": "SaveImage",
      "inputs": {
        "images": ["6", 0],
        "filename_prefix": "character_sheet_source"
      }
    }
  },
  "client_id": "codex-character-sheet"
}
```

### 실무적 해석
- 이 workflow는 `바로 게임에 넣는 스프라이트 시트`가 아니라 `후처리용 소스 이미지 생성`에 가깝다
- 실제 게임용 시트는 아래 후처리가 필요할 가능성이 높다
  1. 배경 제거
  2. 방향별 영역 분리
  3. 프레임 크기 정규화
  4. 단색/외곽선 보정
  5. 최종 스프라이트 시트 합성

### 다음 추천
1. 위 workflow로 실제 한 장 생성 테스트
2. 결과가 괜찮으면 `img2img` 또는 Control 계열로 방향 일관성 강화
3. 프로젝트 안에 후처리 스크립트 추가

## Qwen Image Edit 조사 결과

### 실제 class_type
- `QwenImageEdit` 자체는 실제 workflow 노드명이 아니었음
- 실제 사용 가능한 관련 노드:
  - `TextEncodeQwenImageEdit`
  - `TextEncodeQwenImageEditPlus`
  - `EmptyQwenImageLayeredLatentImage`
  - `QwenImageDiffsynthControlnet`

### 실제로 동작 확인한 Qwen 후처리 조합
1. `UNETLoader`
  - `qwen_image_edit_2511_fp8mixed.safetensors`
2. `CLIPLoader`
  - `qwen_2.5_vl_7b_fp8_scaled.safetensors`
  - `type: qwen_image`
3. `VAELoader`
  - `qwen_image_vae.safetensors`
4. `LoadImage`
  - ComfyUI `input` 폴더에 업로드한 이미지 사용
5. `TextEncodeQwenImageEdit`
  - `clip + prompt`
  - 선택 입력으로 `vae + image`
6. `CLIPTextEncode`
  - 빈 negative conditioning
7. `EmptyQwenImageLayeredLatentImage`
8. `KSampler`
9. `VAEDecode`
10. `SaveImage`

### 실무 결론
- ComfyUI output 이미지를 바로 `LoadImageOutput`으로 이어붙이는 방식은 현재 검증 실패
- 안전한 파이프라인:
  1. source 생성
  2. `/view`로 다운로드
  3. `/upload/image`로 ComfyUI input에 업로드
  4. `LoadImage`로 Qwen 후처리

## 추가된 파일
- source workflow JSON:
  - `scripts/workflows/character-sheet-source.json`
- Qwen edit workflow JSON:
  - `scripts/workflows/qwen-image-edit.json`
- 자동화 스크립트:
  - `scripts/generate-character-sheet.mjs`

## 스크립트 역할
1. source workflow 실행
2. 결과 이미지 다운로드
3. ComfyUI input으로 업로드
4. Qwen image edit workflow 실행
5. 편집 결과를 `public/assets/characters/generated/`에 저장
6. 실행 메타데이터 JSON 저장

## 실행 예시
```bash
node scripts/generate-character-sheet.mjs
```

## 실제 테스트 결과
- source workflow 실행 성공
  - output 예시: `character_sheet_source_test_00001_.png`
- Qwen image edit workflow 실행 성공
  - output 예시: `character_sheet_qwen_test_00001_.png` ... `00013_.png`
- Qwen edit는 단일 결과가 아니라 여러 변형 이미지를 배치로 반환함

## Sprite hookup
- Auto-selected `source.png` as the least-broken candidate; Qwen edits were not usable for in-game sprite hookup.
- Wired Phaser preload to `player-source-sheet` and cropped the left silhouette panel as a temporary player sprite.
- Kept idle/run feedback through bob, ring, shadow, and slight run swing while using the generated image as the visual base.

## Test sprite sheet
- Removed the temporary dependency on generated `source.png` for the player visual.
- Added a hand-made test sprite sheet at `public/assets/characters/test-player-sheet.svg`.
- The sheet is 4-direction (`south`, `west`, `east`, `north`) with `idle` on row 0 and `run` on row 1.
- Player rendering now crops the sheet by movement direction and animation state instead of using the generated image.

## Run frames
- Expanded the test sprite sheet to 4 rows: `idle`, `run-a`, `run-b`, `run-c`.
- Player now cycles 3 run frames at 90ms per frame while keeping idle on row 0.

## PNG sprite sheet
- Rendered `public/assets/characters/test-player-sheet.svg` to `public/assets/characters/test-player-sheet.png` using local `sharp`.
- Updated Phaser preload to use the PNG sheet for more stable runtime rendering.

## Idle frames
- Expanded the test sprite sheet to 5 rows: `idle-a`, `idle-b`, `run-a`, `run-b`, `run-c`.
- Player now cycles 2 idle frames at 420ms per frame, while run keeps 3 frames at 90ms.

## Eight directions
- Expanded the test sprite sheet to 8 columns in this order: `N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`.
- Updated player facing quantization from 4 directions to 8 directions using the movement vector angle.
- Idle keeps 2 frames and run keeps 3 frames across all 8 directions.

## Frame stability
- Replaced `setCrop`-based sprite selection with real spritesheet frame selection to keep the player anchor stable across direction/frame changes.
- Preload now uses `load.spritesheet(..., { frameWidth: 64, frameHeight: 128 })` and Player uses `setFrame(row * 8 + column)`.

## A* click move
- Added `game/pathfinding/AStar.ts` for 8-direction tile pathfinding.
- Diagonal movement is allowed, but corner cutting through blocked tiles is prevented.
- Click movement now computes a tile path and feeds waypoint centers into `MovementController` instead of moving in a straight line.
- HUD now shows remaining `path length`.

## Path visualization
- Added a debug path overlay using `Phaser.GameObjects.Graphics`.
- The path draws from the player position through each remaining waypoint.
- Intermediate nodes render as light markers, and the final destination renders as an orange marker.

## Responsive viewport
- Switched Phaser scale mode from fixed `FIT` to parent-driven `RESIZE`.
- Game creation now uses the parent element's current width and height instead of a fixed `800x600`.
- `GameCanvas` now uses `ResizeObserver` to forward container size changes to `game.scale.resize(...)`.
- The app root now uses `100dvh` and removes the old `minHeight: 600px` constraint.

## Browser zoom viewport fix
- Kept the internal render height fixed at `600` and derive render width from the container's current aspect ratio.
- Separated canvas render resolution (`canvas.width` / `canvas.height`) from display size (`canvas.style.width` / `canvas.style.height`).
- Phaser now runs with `Scale.NONE`, while the canvas display size is forced to fill the container with CSS.
- Browser zoom no longer changes the in-game world range because the internal render size only changes when the container aspect ratio changes.
