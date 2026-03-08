import * as Phaser from 'phaser'
import type { Character } from '../characters/Character'
import type { CharacterController } from '../characters/CharacterController'
import {
  destroyDeployableActors,
  drawDeployableActors,
  type DeployableActor,
  updateDeployableActors,
} from './DeployableActors'
import {
  createMonsterActors,
  destroyMonsterActors,
  drawMonsterActors,
  type MonsterActor,
} from './MonsterActors'
import {
  destroyProjectileActors,
  drawProjectileActors,
  type ProjectileActor,
  updateProjectileActors,
} from './ProjectileActors'
import {
  destroySummonActors,
  drawSummonActors,
  type SummonActor,
} from './SummonActors'
import type { MonsterSpawn } from './WorldObjects'
import type { ActionExecutionCollections } from '../interactions/ActionExecutionRuntime'
import type { ProjectileExpiration, ProjectileImpact, ProjectileTarget } from '../interactions/ProjectileRuntime'
import type { IsoPoint } from '../iso'

export class GameWorldRuntime {
  private monsters: MonsterActor[] = []
  private deployables: DeployableActor[] = []
  private summons: SummonActor[] = []
  private projectiles: ProjectileActor[] = []

  destroy(): void {
    destroyDeployableActors(this.deployables)
    destroySummonActors(this.summons)
    destroyProjectileActors(this.projectiles)
    destroyMonsterActors(this.monsters)
    this.deployables = []
    this.summons = []
    this.projectiles = []
    this.monsters = []
  }

  resetForFloor(scene: Phaser.Scene, monsterSpawns: MonsterSpawn[]): void {
    destroyDeployableActors(this.deployables)
    destroySummonActors(this.summons)
    destroyProjectileActors(this.projectiles)
    destroyMonsterActors(this.monsters)
    this.deployables = []
    this.summons = []
    this.projectiles = []
    this.monsters = createMonsterActors(scene, monsterSpawns)
  }

  updateDeployables(nowMs: number): void {
    this.deployables = updateDeployableActors(this.deployables, nowMs)
  }

  updateProjectiles(params: {
    deltaMs: number
    targets: ProjectileTarget[]
    canTraverse: (x: number, y: number, radius: number) => boolean
  }): { impacts: ProjectileImpact[]; expirations: ProjectileExpiration[] } {
    const result = updateProjectileActors({
      projectiles: this.projectiles,
      deltaMs: params.deltaMs,
      targets: params.targets,
      canTraverse: params.canTraverse,
    })
    this.projectiles = result.survivors
    return {
      impacts: result.impacts,
      expirations: result.expirations,
    }
  }

  draw(params: {
    playerScreen: IsoPoint
    width: number
    height: number
    deltaMs: number
    nowMs: number
  }): void {
    drawMonsterActors({
      monsters: this.monsters,
      playerScreen: params.playerScreen,
      width: params.width,
      height: params.height,
      deltaMs: params.deltaMs,
    })
    drawDeployableActors({
      deployables: this.deployables,
      playerScreen: params.playerScreen,
      width: params.width,
      height: params.height,
      nowMs: params.nowMs,
    })
    drawSummonActors({
      summons: this.summons,
      playerScreen: params.playerScreen,
      width: params.width,
      height: params.height,
      nowMs: params.nowMs,
    })
    drawProjectileActors({
      projectiles: this.projectiles,
      playerScreen: params.playerScreen,
      width: params.width,
      height: params.height,
    })
  }

  buildProjectileTargets(player: {
    id: string
    character: Character
    controller: CharacterController
  }): ProjectileTarget[] {
    return [
      player,
      ...this.monsters.map(monster => ({
        id: monster.id,
        character: monster.character,
        controller: monster.controller,
      })),
    ]
  }

  getMonsters(): MonsterActor[] {
    return this.monsters
  }

  getDeployables(): DeployableActor[] {
    return this.deployables
  }

  getSummons(): SummonActor[] {
    return this.summons
  }

  getProjectiles(): ProjectileActor[] {
    return this.projectiles
  }

  findMonsterById(id: string): MonsterActor | null {
    return this.monsters.find(monster => monster.id === id) ?? null
  }

  findNearestMonster(x: number, y: number, range: number): MonsterActor | null {
    let nearest: MonsterActor | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const monster of this.monsters) {
      const position = monster.controller.getMapPosition()
      const distance = Phaser.Math.Distance.Between(x, y, position.x, position.y)
      if (distance > range || distance >= nearestDistance) {
        continue
      }

      nearest = monster
      nearestDistance = distance
    }

    return nearest
  }

  removeDeadMonsters(): void {
    this.monsters = this.monsters.filter(monster => !monster.character.isDead())
  }

  applyActionExecutionCollections(collections: ActionExecutionCollections): void {
    this.deployables = collections.deployables
    this.summons = collections.summons
    this.projectiles = collections.projectiles
  }

  getActionExecutionCollections(): ActionExecutionCollections {
    return {
      deployables: this.deployables,
      summons: this.summons,
      projectiles: this.projectiles,
    }
  }
}
