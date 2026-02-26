# BSP Dungeon Generation Task

## Goals
1. Implement Binary Space Partitioning (BSP) dungeon generator ✅
2. 80×80 tile grid with rooms and corridors ✅
3. Always-connected guarantee (Diablo 1 style) ✅
4. Isometric perspective rendering ✅
5. Player-wall collision ✅

## Implementation Plan

### Phase 1: BSP Generator (`game/map/BSPDungeon.ts`)
- [x] Room class (x, y, width, height, center)
- [x] BSP tree node structure
- [x] Recursive space partitioning
- [x] Room placement in leaf nodes
- [x] Corridor generation between sibling rooms
- [x] 80×80 grid output with tile types (WALL, FLOOR, CORRIDOR)

### Phase 2: Dungeon Rendering
- [x] Replace infinite floor with dungeon grid
- [x] Render only FLOOR/CORRIDOR tiles
- [x] Wall tiles for dungeon boundaries

### Phase 3: Collision
- [x] Add collider tiles for walls
- [x] Player movement restriction
- [x] Slide along walls (X/Y separated movement)

## Design Decisions
- BSP chosen for guaranteed connectivity
- Min room size: 6×6 tiles
- Max depth: 4 levels (up to 16 rooms)
- Corridor width: 1 tile

## PR
- https://github.com/devcode-kr/game-devcode-kr/pull/2
