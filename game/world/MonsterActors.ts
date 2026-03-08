import * as Phaser from 'phaser'
import { cellCenter, type IsoPoint, worldToScreen } from '../iso'
import { MonsterCharacter } from '../characters/MonsterCharacter'
import { CharacterController } from '../characters/CharacterController'
import { updateCharacterMovement } from '../characters/CharacterMovementRuntime'
import { Monster } from '../entities/Monster'
import type { BSPDungeon } from '../map/BSPDungeon'
import type { MonsterSpawn } from './WorldObjects'

export interface MonsterActor {
  id: string
  character: MonsterCharacter
  controller: CharacterController
  entity: Monster
  decisionCooldownMs: number
}

export function createMonsterActors(
  scene: Phaser.Scene,
  spawns: MonsterSpawn[]
): MonsterActor[] {
  return spawns.map((spawn, index) => {
    const character = new MonsterCharacter({
      id: spawn.id,
      displayName: `Monster ${index + 1}`,
    })
    const controller = new CharacterController(character, 0.24)
    const position = cellCenter(spawn.tileX, spawn.tileY)
    controller.setMapPosition(position.x, position.y)
    controller.commitMapPosition(position.x, position.y)

    return {
      id: spawn.id,
      character,
      controller,
      entity: new Monster(scene),
      decisionCooldownMs: randomDecisionCooldown(),
    }
  })
}

export function destroyMonsterActors(monsters: MonsterActor[]): void {
  for (const monster of monsters) {
    monster.entity.destroy()
  }
}

export function updateMonsterActors(params: {
  monsters: MonsterActor[]
  deltaMs: number
  dungeon: BSPDungeon
  canOccupy: (monster: MonsterActor, x: number, y: number) => boolean
}): void {
  for (const monster of params.monsters) {
    monster.decisionCooldownMs -= params.deltaMs

    if (!monster.controller.hasDestination() && monster.decisionCooldownMs <= 0) {
      assignRandomMonsterDestination(monster, params.dungeon, params.canOccupy)
      monster.decisionCooldownMs = randomDecisionCooldown()
    }

    const movement = updateCharacterMovement({
      character: monster.character,
      mover: monster.controller,
      deltaMs: params.deltaMs,
      inputDirection: new Phaser.Math.Vector2(),
      canOccupy: (x, y) => params.canOccupy(monster, x, y),
    })

    if (movement.blockedClickMove) {
      monster.controller.clearDestination()
    }
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

function assignRandomMonsterDestination(
  monster: MonsterActor,
  dungeon: BSPDungeon,
  canOccupy: (monster: MonsterActor, x: number, y: number) => boolean
): void {
  const current = monster.controller.getMapPosition()
  const tileX = Math.floor(current.x)
  const tileY = Math.floor(current.y)
  const candidates = [
    { x: tileX - 1, y: tileY },
    { x: tileX + 1, y: tileY },
    { x: tileX, y: tileY - 1 },
    { x: tileX, y: tileY + 1 },
  ].filter(candidate => {
    if (!dungeon.isWalkable(candidate.x, candidate.y)) {
      return false
    }

    const center = cellCenter(candidate.x, candidate.y)
    return canOccupy(monster, center.x, center.y)
  })

  if (candidates.length === 0) {
    return
  }

  const target = Phaser.Math.RND.pick(candidates)
  const center = cellCenter(target.x, target.y)
  monster.controller.setDestination(center.x, center.y)
}

function randomDecisionCooldown(): number {
  return Phaser.Math.Between(500, 1400)
}
