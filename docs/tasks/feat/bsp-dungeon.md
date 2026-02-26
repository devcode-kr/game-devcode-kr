# BSP Dungeon Generation Task

## Goals
1. Implement Binary Space Partitioning (BSP) dungeon generator
2. 80×80 tile grid with rooms and corridors
3. Always-connected guarantee (Diablo 1 style)
4. Isometric perspective rendering
5. Player-wall collision

## Implementation Plan

### Phase 1: BSP Generator (`game/map/BSPDungeon.ts`)
- [ ] Room class (x, y, width, height, center)
- [ ] BSP tree node structure
- [ ] Recursive space partitioning
- [ ] Room placement in leaf nodes
- [ ] Corridor generation between sibling rooms
- [ ] 80×80 grid output with tile types (WALL, FLOOR, CORRIDOR)

### Phase 2: Dungeon Rendering
- [ ] Replace infinite floor with dungeon grid
- [ ] Render only FLOOR/CORRIDOR tiles
- [ ] Wall tiles for dungeon boundaries

### Phase 3: Collision
- [ ] Add collider tiles for walls
- [ ] Player movement restriction
- [ ] Slide along walls

## Design Decisions
- BSP chosen for guaranteed connectivity
- Min room size: 6×6 tiles
- Max depth: 4 levels (up to 16 rooms)
- Corridor width: 1 tile
