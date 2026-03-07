import * as Phaser from 'phaser'
import type { BSPDungeon } from '../map/BSPDungeon'
import type { IsoPoint } from '../iso'
import { cellCenter } from '../iso'
import { rollChestReward } from '../loot/ChestRewards'
import type { Interactable, InteractableKind, Trap } from './WorldObjects'

export function bakeWorldTextures(scene: Phaser.Scene): void {
  bakeInteractableTexture(scene, 'interactable-chest', 0x8b5a2b, 0xfacc15)
  bakeInteractableTexture(scene, 'interactable-locked-chest', 0x5b3a1e, 0x93c5fd)
  bakeInteractableTexture(scene, 'interactable-stairs', 0x94a3b8, 0xe2e8f0)
  bakeInteractableTexture(scene, 'interactable-npc', 0x0f766e, 0x99f6e4)
  bakeInteractableTexture(scene, 'trap-spike', 0x7f1d1d, 0xfca5a5)
}

export function destroyWorldObjects(interactables: Interactable[], traps: Trap[]): void {
  for (const interactable of interactables) {
    interactable.image.destroy()
  }

  for (const trap of traps) {
    trap.image.destroy()
  }
}

export function buildWorldObjects(
  scene: Phaser.Scene,
  dungeon: BSPDungeon,
  startX: number,
  startY: number,
  trapRearmMs: number
): { interactables: Interactable[]; traps: Trap[] } {
  const interactables: Interactable[] = []
  const rooms = dungeon.getRooms()
  const candidateRooms = rooms.filter(room => !(room.centerX === startX && room.centerY === startY))

  const stairRoom = candidateRooms[candidateRooms.length - 1]
  if (stairRoom) {
    interactables.push(createInteractable(scene, 'stairs', stairRoom.centerX, stairRoom.centerY))
  }

  for (let index = 0; index < Math.min(2, candidateRooms.length - 1); index++) {
    const room = candidateRooms[index]
    interactables.push(
      createInteractable(scene, index === 0 ? 'chest' : 'locked-chest', room.centerX, room.centerY)
    )
  }

  const firstChest = interactables.find(interactable => interactable.kind === 'chest')
  if (firstChest) {
    firstChest.reward = { kind: 'key', amount: 1 }
  }

  const npcRoom = candidateRooms.find(room =>
    !interactables.some(interactable => interactable.tileX === room.centerX && interactable.tileY === room.centerY)
  )
  if (npcRoom) {
    interactables.push(createInteractable(scene, 'npc', npcRoom.centerX, npcRoom.centerY))
  }

  return {
    interactables,
    traps: buildTraps(scene, dungeon, interactables, startX, startY, trapRearmMs),
  }
}

export function findNearbyInteractable(
  interactables: Interactable[],
  position: IsoPoint,
  interactionRange: number
): Interactable | null {
  let nearest: Interactable | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const interactable of interactables) {
    const center = cellCenter(interactable.tileX, interactable.tileY)
    const distance = Phaser.Math.Distance.Between(position.x, position.y, center.x, center.y)
    if (distance > interactionRange || distance >= nearestDistance) {
      continue
    }

    nearest = interactable
    nearestDistance = distance
  }

  return nearest
}

function bakeInteractableTexture(
  scene: Phaser.Scene,
  key: string,
  fill: number,
  stroke: number
): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key)
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
  graphics.fillStyle(fill, 1)
  graphics.lineStyle(2, stroke, 0.95)
  graphics.fillRoundedRect(8, 8, 32, 22, 6)
  graphics.strokeRoundedRect(8, 8, 32, 22, 6)
  graphics.generateTexture(key, 48, 40)
  graphics.destroy()
}

function createInteractable(
  scene: Phaser.Scene,
  kind: InteractableKind,
  tileX: number,
  tileY: number
): Interactable {
  const key = kind === 'chest'
    ? 'interactable-chest'
    : kind === 'locked-chest'
      ? 'interactable-locked-chest'
      : kind === 'stairs'
        ? 'interactable-stairs'
        : 'interactable-npc'

  return {
    id: `${kind}-${tileX}-${tileY}`,
    kind,
    tileX,
    tileY,
    image: scene.add.image(-9999, -9999, key),
    used: false,
    reward: kind === 'chest' || kind === 'locked-chest' ? rollChestReward() : undefined,
    dialogue: undefined,
    npcProfile: kind === 'npc'
      ? {
          speaker: 'Caretaker',
        }
      : undefined,
  }
}

function buildTraps(
  scene: Phaser.Scene,
  dungeon: BSPDungeon,
  interactables: Interactable[],
  startX: number,
  startY: number,
  trapRearmMs: number
): Trap[] {
  const occupiedTiles = new Set(interactables.map(interactable => `${interactable.tileX},${interactable.tileY}`))
  const candidates = dungeon.getRooms()
    .flatMap(room => [
      { x: room.centerX - 1, y: room.centerY },
      { x: room.centerX + 1, y: room.centerY },
    ])
    .filter(candidate => {
      if (!dungeon.isWalkable(candidate.x, candidate.y)) {
        return false
      }

      if ((candidate.x === startX && candidate.y === startY) || occupiedTiles.has(`${candidate.x},${candidate.y}`)) {
        return false
      }

      return true
    })

  return candidates.slice(0, 3).map(candidate => ({
    id: `trap-${candidate.x}-${candidate.y}`,
    tileX: candidate.x,
    tileY: candidate.y,
    image: scene.add.image(-9999, -9999, 'trap-spike'),
    lastTriggeredAt: -trapRearmMs,
  }))
}
