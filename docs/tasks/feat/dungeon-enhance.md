# Dungeon Enhancements Task

## Goals
1. Minimap UI - show explored dungeon map ✅
2. Portal to next floor - spawn in last room ✅
3. Basic Enemy spawning - random positions in rooms ✅
4. Room variety improvements (deferred)

## Implementation Plan

### Phase 1: Minimap UI (`components/Minimap.tsx`)
- [x] Mini canvas overlay (top-right corner, 150x150px)
- [x] Render dungeon grid (WALL/FLOOR/CORRIDOR)
- [x] Player position indicator
- [ ] Explored fog of war (optional v2)

### Phase 2: Portal (`game/entities/Portal.ts`)
- [x] Portal sprite/visual
- [x] Spawn in last room of dungeon
- [x] Collision detection with player
- [x] Event: generate new dungeon level

### Phase 3: Basic Enemy (`game/entities/Enemy.ts`)
- [x] Enemy class with basic movement
- [x] Random spawn in rooms (avoid player start)
- [x] Simple chase AI (move toward player when close)
- [x] Collision with walls

### Phase 4: Room Variety (미룸)
- [ ] Vary room sizes more
- [ ] Room types (small/medium/large)

## Design Decisions
- Minimap: simple 2D top-down view (not isometric)
- Portal: purple glow effect, obvious visual
- Enemy: red squares for now, basic follow AI

## PR
- https://github.com/devcode-kr/game-devcode-kr/pull/3
