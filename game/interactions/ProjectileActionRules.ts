import type {
  ProjectileActionSpec,
  ProjectileLifecycleEvent,
} from './ActionSpecs'

export function composeProjectileActionSpec(
  weaponSpec: ProjectileActionSpec,
  skillSpecs: ProjectileActionSpec[]
): ProjectileActionSpec {
  return {
    deliveryType: 'projectile',
    definitionId: weaponSpec.definitionId,
    onHitEvents: [
      ...weaponSpec.onHitEvents,
      ...skillSpecs.flatMap(spec => spec.onHitEvents),
    ],
    onExpireEvents: [
      ...weaponSpec.onExpireEvents,
      ...skillSpecs.flatMap(spec => spec.onExpireEvents),
    ],
  }
}

export function scaleProjectileActionSpec(
  projectileSpec: ProjectileActionSpec,
  scale: number
): ProjectileActionSpec {
  const normalizedScale = Math.max(0, scale)
  return {
    ...projectileSpec,
    onHitEvents: projectileSpec.onHitEvents.map(event => scaleProjectileLifecycleEvent(event, normalizedScale)),
    onExpireEvents: projectileSpec.onExpireEvents.map(event =>
      scaleProjectileLifecycleEvent(event, normalizedScale)
    ),
  }
}

function scaleProjectileLifecycleEvent(
  event: ProjectileLifecycleEvent,
  scale: number
): ProjectileLifecycleEvent {
  if (event.type === 'direct_damage') {
    return {
      ...event,
      amount: Math.max(1, Math.round(event.amount * scale)),
    }
  }

  if (event.type === 'area_damage') {
    return {
      ...event,
      amount: Math.max(1, Math.round(event.amount * scale)),
    }
  }

  if (event.type === 'spawn_projectile') {
    return {
      ...event,
      projectile: scaleProjectileActionSpec(event.projectile, scale),
    }
  }

  return event
}
