# Dungeon Enhancements Task

## Goals
1. Minimap UI - show explored dungeon map
2. Portal to next floor - spawn in last room
3. Basic Enemy spawning - random positions in rooms
4. Room variety improvements

## Implementation Plan

### Phase 1: Minimap UI (`components/Minimap.tsx`)
- [ ] Mini canvas overlay (top-right corner, 150x150px)
- [ ] Render dungeon grid (WALL/FLOOR/CORRIDOR)
- [ ] Player position indicator
- [ ] Explored fog of war (optional v1)

### Phase 2: Portal (`game/entities/Portal.ts`)
- [ ] Portal sprite/visual
- [ ] Spawn in last room of dungeon
- [ ] Collision detection with player
- [ ] Event: generate new dungeon level

### Phase 3: Basic Enemy (`game/entities/Enemy.ts`)
- [ ] Enemy class with basic movement
- [ ] Random spawn in rooms (avoid player start)
- [ ] Simple chase AI (move toward player when close)
- [ ] Collision with walls

### Phase 4: Room Variety
- [ ] Vary room sizes more
- [ ] Room types (small/medium/large)

## Design Decisions
- Minimap: simple 2D top-down view (not isometric)
- Portal: purple glow effect, obvious visual
- Enemy: red squares for now, basic follow AI
