import * as Phaser from 'phaser'
import { cellCenter } from '../iso'
import { BSPDungeon } from '../map/BSPDungeon'
import { buildWorldObjects, destroyWorldObjects } from './WorldBuilder'
import type { Interactable, MonsterSpawn, Trap } from './WorldObjects'

export interface GeneratedFloorState {
  dungeon: BSPDungeon
  spawnTile: { x: number; y: number }
  spawnPosition: { x: number; y: number }
  interactables: Interactable[]
  traps: Trap[]
  monsterSpawns: MonsterSpawn[]
}

export function generateFloorState(params: {
  scene: Phaser.Scene
  previousInteractables: Interactable[]
  previousTraps: Trap[]
  trapRearmMs: number
  width: number
  height: number
}): GeneratedFloorState {
  const dungeon = new BSPDungeon(params.width, params.height)
  dungeon.generate()

  const start = dungeon.getStartPosition()
  destroyWorldObjects(params.previousInteractables, params.previousTraps)
  const worldObjects = buildWorldObjects(params.scene, dungeon, start.x, start.y, params.trapRearmMs)

  return {
    dungeon,
    spawnTile: { x: start.x, y: start.y },
    spawnPosition: cellCenter(start.x, start.y),
    interactables: worldObjects.interactables,
    traps: worldObjects.traps,
    monsterSpawns: worldObjects.monsterSpawns,
  }
}
