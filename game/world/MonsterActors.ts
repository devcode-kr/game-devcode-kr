import * as Phaser from 'phaser'
import { cellCenter, type IsoPoint, worldToScreen } from '../iso'
import { MonsterCharacter } from '../characters/MonsterCharacter'
import { CharacterController } from '../characters/CharacterController'
import { Monster } from '../entities/Monster'
import { getMonsterCombatDefinition, type MonsterArchetypeId } from '../interactions/MonsterCombatDefinitions'
import type { MonsterSpawn } from './WorldObjects'

export const MONSTER_COMBAT_STATES = {
  idle: 'idle',
  chase: 'chase',
  attack: 'attack',
  return: 'return',
} as const

export type MonsterCombatState =
  (typeof MONSTER_COMBAT_STATES)[keyof typeof MONSTER_COMBAT_STATES]

export interface MonsterActor {
  id: string
  archetypeId: MonsterArchetypeId
  character: MonsterCharacter
  controller: CharacterController
  entity: Monster
  homePosition: Phaser.Math.Vector2
  combatState: MonsterCombatState
  decisionCooldownMs: number
}

export function createMonsterActors(
  scene: Phaser.Scene,
  spawns: MonsterSpawn[]
): MonsterActor[] {
  return spawns.map((spawn, index) => {
    const definition = getMonsterCombatDefinition(spawn.archetypeId)
    const character = new MonsterCharacter({
      id: spawn.id,
      displayName: `${definition.label} ${index + 1}`,
    })
    const controller = new CharacterController(character, 0.24)
    const position = cellCenter(spawn.tileX, spawn.tileY)
    controller.setMapPosition(position.x, position.y)
    controller.commitMapPosition(position.x, position.y)

    return {
      id: spawn.id,
      archetypeId: spawn.archetypeId,
      character,
      controller,
      entity: new Monster(scene, {
        fillColor: definition.bodyFillColor,
        strokeColor: definition.bodyStrokeColor,
      }),
      homePosition: new Phaser.Math.Vector2(position.x, position.y),
      combatState: MONSTER_COMBAT_STATES.idle,
      decisionCooldownMs: randomDecisionCooldown(),
    }
  })
}

export function destroyMonsterActors(monsters: MonsterActor[]): void {
  for (const monster of monsters) {
    monster.entity.destroy()
  }
}

export function drawMonsterActors(params: {
  monsters: MonsterActor[]
  playerScreen: IsoPoint
  width: number
  height: number
  deltaMs: number
}): void {
  for (const monster of params.monsters) {
    const world = monster.controller.getMapPosition()
    const screen = worldToScreen(world)
    monster.entity.setDepth(700 + Math.floor(world.x) + Math.floor(world.y))
    monster.entity.syncScreenPosition(
      screen.x - params.playerScreen.x + params.width / 2,
      screen.y - params.playerScreen.y + params.height / 2 - 12,
      monster.controller.hasDestination(),
      params.deltaMs
    )
  }
}

function randomDecisionCooldown(): number {
  return Phaser.Math.Between(500, 1400)
}
