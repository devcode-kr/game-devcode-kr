import type { ProjectileActionSpec } from './ActionSpecs'

export const MONSTER_ARCHETYPE_IDS = {
  skirmisher: 'skirmisher',
  brute: 'brute',
  sentry: 'sentry',
} as const

export type MonsterArchetypeId =
  (typeof MONSTER_ARCHETYPE_IDS)[keyof typeof MONSTER_ARCHETYPE_IDS]

export interface MonsterCombatDefinition {
  id: MonsterArchetypeId
  label: string
  aggroRange: number
  disengageRange: number
  leashRange: number
  attackRange: number
  preferredDistance: number
  attackIntervalMs: number
  chaseRepathMs: number
  idleRepathMs: number
  returnRepathMs: number
  pathBudget: number
  requiresLineOfSight: boolean
  bodyFillColor: number
  bodyStrokeColor: number
  attackSpec: ProjectileActionSpec | null
  meleeDamage: number | null
}

const DEFINITIONS: Record<MonsterArchetypeId, MonsterCombatDefinition> = {
  [MONSTER_ARCHETYPE_IDS.skirmisher]: {
    id: MONSTER_ARCHETYPE_IDS.skirmisher,
    label: 'Skirmisher',
    aggroRange: 6.5,
    disengageRange: 8.5,
    leashRange: 7.5,
    attackRange: 4.75,
    preferredDistance: 3.5,
    attackIntervalMs: 1400,
    chaseRepathMs: 300,
    idleRepathMs: 900,
    returnRepathMs: 380,
    pathBudget: 48,
    requiresLineOfSight: true,
    bodyFillColor: 0x9f1239,
    bodyStrokeColor: 0xfda4af,
    attackSpec: {
      deliveryType: 'projectile',
      definitionId: 'debug_bolt',
      onHitEvents: [
        {
          type: 'direct_damage',
          amount: 8,
        },
      ],
      onExpireEvents: [],
    },
    meleeDamage: null,
  },
  [MONSTER_ARCHETYPE_IDS.brute]: {
    id: MONSTER_ARCHETYPE_IDS.brute,
    label: 'Brute',
    aggroRange: 5.25,
    disengageRange: 6.75,
    leashRange: 6,
    attackRange: 1.15,
    preferredDistance: 0.9,
    attackIntervalMs: 1200,
    chaseRepathMs: 220,
    idleRepathMs: 1100,
    returnRepathMs: 260,
    pathBudget: 56,
    requiresLineOfSight: false,
    bodyFillColor: 0x7c2d12,
    bodyStrokeColor: 0xfdba74,
    attackSpec: null,
    meleeDamage: 10,
  },
  [MONSTER_ARCHETYPE_IDS.sentry]: {
    id: MONSTER_ARCHETYPE_IDS.sentry,
    label: 'Sentry',
    aggroRange: 8,
    disengageRange: 10,
    leashRange: 7,
    attackRange: 6,
    preferredDistance: 5,
    attackIntervalMs: 1600,
    chaseRepathMs: 420,
    idleRepathMs: 1200,
    returnRepathMs: 460,
    pathBudget: 40,
    requiresLineOfSight: true,
    bodyFillColor: 0x1d4ed8,
    bodyStrokeColor: 0x93c5fd,
    attackSpec: {
      deliveryType: 'projectile',
      definitionId: 'debug_poison_bolt',
      onHitEvents: [
        {
          type: 'direct_damage',
          amount: 6,
        },
        {
          type: 'apply_debuff',
          debuff: {
            id: 'monster_sentry_poison',
            displayName: 'Venom',
            durationMs: 2200,
            damagePerSecond: 3,
            guardMitigatesDamage: true,
          },
        },
      ],
      onExpireEvents: [],
    },
    meleeDamage: null,
  },
}

export function getMonsterCombatDefinition(id: MonsterArchetypeId): MonsterCombatDefinition {
  return DEFINITIONS[id]
}
