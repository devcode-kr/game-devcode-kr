import {
  isDeployActionSpec,
  isProjectileActionSpec,
  isSummonActionSpec,
  type ActionSpec,
  type DeployActionSpec,
  type ProjectileActionSpec,
  type SummonActionSpec,
} from './ActionSpecs'
import { composeProjectileAttackSpec } from './ProjectileAttackSpecs'

export interface ActionBundle {
  projectile: ProjectileActionSpec | null
  deploys: DeployActionSpec[]
  summons: SummonActionSpec[]
}

export function composeActionBundle(
  weaponAction: ProjectileActionSpec,
  skillActions: ActionSpec[]
): ActionBundle {
  const projectileSkills = skillActions.filter(isProjectileActionSpec)
  const deploys = skillActions.filter(isDeployActionSpec)
  const summons = skillActions.filter(isSummonActionSpec)

  return {
    projectile: composeProjectileAttackSpec(weaponAction, projectileSkills),
    deploys,
    summons,
  }
}
