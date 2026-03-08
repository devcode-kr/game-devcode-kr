import type { CharacterStatModifier } from '../characters/CharacterStatModifier'

export type EffectDefinitionKind = 'buff' | 'debuff' | 'status'

export type EffectIconPattern =
  | 'cross'
  | 'drop'
  | 'shield'
  | 'spark'
  | 'wing'
  | 'skull'
  | 'snare'
  | 'hazard'

export interface EffectPresentationDefinition {
  shortLabel: string
  iconKey: string
  iconPattern: EffectIconPattern
  fillColor: number
  strokeColor: number
  textColor: string
}

export interface ResolvedEffectDescription {
  title: string
  durationMs?: number
  iconKey: string
  iconPattern: EffectIconPattern
  shortLabel: string
  tooltipLines: string[]
  statModifiers?: CharacterStatModifier
  damagePerSecond?: number
  blocksHealthRegen?: boolean
  guardMitigatesDamage?: boolean
}

export interface BuffEffectDefinition {
  kind: 'buff'
  id: string
  getPresentation(): EffectPresentationDefinition
  describe(params: {
    remainingMs: number
    statModifiers?: CharacterStatModifier
  }): ResolvedEffectDescription
}

export interface DebuffEffectDefinition {
  kind: 'debuff'
  id: string
  getPresentation(): EffectPresentationDefinition
  describe(params: {
    remainingMs: number
    statModifiers?: CharacterStatModifier
    damagePerSecond?: number
  }): ResolvedEffectDescription
}

export interface StatusEffectDefinition {
  kind: 'status'
  id: string
  getPresentation(): EffectPresentationDefinition
  describe(params: {
    remainingMs?: number
  }): ResolvedEffectDescription
}

export type EffectDefinition =
  | BuffEffectDefinition
  | DebuffEffectDefinition
  | StatusEffectDefinition

export const BUFF_EFFECT_IDS = {
  minorPotion: 'potion_minor',
  manaPotion: 'potion_mana',
  guardPotion: 'potion_guard',
  berserkPotion: 'potion_berserk',
  hastePotion: 'potion_haste',
} as const

export const DEBUFF_EFFECT_IDS = {
  poison: 'poison',
  trapSlow: 'trap_slow',
} as const

export const STATUS_EFFECT_IDS = {
  poisoned: 'poisoned',
  guard: 'guard',
  dead: 'dead',
} as const

const buffDefinitions: Record<string, BuffEffectDefinition> = {
  [BUFF_EFFECT_IDS.minorPotion]: createPotionBuffDefinition(BUFF_EFFECT_IDS.minorPotion, 'HP+'),
  [BUFF_EFFECT_IDS.manaPotion]: createPotionBuffDefinition(BUFF_EFFECT_IDS.manaPotion, 'MP+'),
  [BUFF_EFFECT_IDS.guardPotion]: createPotionBuffDefinition(BUFF_EFFECT_IDS.guardPotion, 'GRD'),
  [BUFF_EFFECT_IDS.berserkPotion]: createPotionBuffDefinition(BUFF_EFFECT_IDS.berserkPotion, 'ATK'),
  [BUFF_EFFECT_IDS.hastePotion]: createPotionBuffDefinition(BUFF_EFFECT_IDS.hastePotion, 'HST'),
}

const debuffDefinitions: Record<string, DebuffEffectDefinition> = {
  [DEBUFF_EFFECT_IDS.poison]: createDebuffDefinition({
    id: DEBUFF_EFFECT_IDS.poison,
    title: 'Poison',
    shortLabel: 'PSN',
    iconKey: 'effect-icon-poison',
    iconPattern: 'drop',
    blocksHealthRegen: true,
    guardMitigatesDamage: true,
  }),
  [DEBUFF_EFFECT_IDS.trapSlow]: createDebuffDefinition({
    id: DEBUFF_EFFECT_IDS.trapSlow,
    title: 'Trap Slow',
    shortLabel: 'SLW',
    iconKey: 'effect-icon-trap-slow',
    iconPattern: 'snare',
  }),
}

const statusDefinitions: Record<string, StatusEffectDefinition> = {
  [STATUS_EFFECT_IDS.poisoned]: createStatusDefinition({
    id: STATUS_EFFECT_IDS.poisoned,
    title: 'Poisoned',
    shortLabel: 'PSN',
    iconKey: 'effect-icon-status-poisoned',
    iconPattern: 'hazard',
    getTooltipLines: () => ['health regen disabled', 'poison damage over time active'],
  }),
  [STATUS_EFFECT_IDS.guard]: createStatusDefinition({
    id: STATUS_EFFECT_IDS.guard,
    title: 'Guard',
    shortLabel: 'GRD',
    iconKey: 'effect-icon-status-guard',
    iconPattern: 'shield',
    getTooltipLines: params => [
      ...(params.remainingMs ? [`time: ${formatRemainingMs(params.remainingMs)}`] : []),
      'reduces incoming trap and dot damage',
    ],
  }),
  [STATUS_EFFECT_IDS.dead]: createStatusDefinition({
    id: STATUS_EFFECT_IDS.dead,
    title: 'Dead',
    shortLabel: 'KO',
    iconKey: 'effect-icon-status-dead',
    iconPattern: 'skull',
    getTooltipLines: () => ['respawn required'],
  }),
}

const BUFF_EFFECT_TITLES: Record<string, string> = {
  [BUFF_EFFECT_IDS.minorPotion]: 'Minor Potion',
  [BUFF_EFFECT_IDS.manaPotion]: 'Mana Potion',
  [BUFF_EFFECT_IDS.guardPotion]: 'Guard Potion',
  [BUFF_EFFECT_IDS.berserkPotion]: 'Berserk Potion',
  [BUFF_EFFECT_IDS.hastePotion]: 'Haste Potion',
}

export function getBuffEffectDefinition(id: string): BuffEffectDefinition {
  return buffDefinitions[id] ?? createFallbackBuffDefinition(id)
}

export function getDebuffEffectDefinition(id: string): DebuffEffectDefinition {
  return debuffDefinitions[id] ?? createFallbackDebuffDefinition(id)
}

export function getStatusEffectDefinition(id: string): StatusEffectDefinition {
  return statusDefinitions[id] ?? createFallbackStatusDefinition(id)
}

export function getEffectDefinitionsByKind(kind: EffectDefinitionKind): EffectDefinition[] {
  if (kind === 'buff') {
    return Object.values(buffDefinitions)
  }
  if (kind === 'debuff') {
    return Object.values(debuffDefinitions)
  }
  return Object.values(statusDefinitions)
}

function createPotionBuffDefinition(id: string, shortLabel: string): BuffEffectDefinition {
  const presentation = createPresentation({
    shortLabel,
    iconKey: `effect-icon-${id}`,
    iconPattern: getPotionBuffIconPattern(id),
    fillColor: 0x14532d,
    strokeColor: 0x4ade80,
    textColor: '#dcfce7',
  })

  return {
    kind: 'buff',
    id,
    getPresentation: () => presentation,
    describe: params => ({
      title: BUFF_EFFECT_TITLES[id] ?? humanizeId(id),
      durationMs: params.remainingMs,
      iconKey: presentation.iconKey,
      iconPattern: presentation.iconPattern,
      shortLabel: presentation.shortLabel,
      tooltipLines: buildBuffLines(params.remainingMs, params.statModifiers),
      statModifiers: params.statModifiers,
    }),
  }
}

function createDebuffDefinition(config: {
  id: string
  title: string
  shortLabel: string
  iconKey: string
  iconPattern: EffectIconPattern
  blocksHealthRegen?: boolean
  guardMitigatesDamage?: boolean
}): DebuffEffectDefinition {
  const presentation = createPresentation({
    shortLabel: config.shortLabel,
    iconKey: config.iconKey,
    iconPattern: config.iconPattern,
    fillColor: 0x7f1d1d,
    strokeColor: 0xf87171,
    textColor: '#fee2e2',
  })

  return {
    kind: 'debuff',
    id: config.id,
    getPresentation: () => presentation,
    describe: params => ({
      title: config.title,
      durationMs: params.remainingMs,
      iconKey: presentation.iconKey,
      iconPattern: presentation.iconPattern,
      shortLabel: presentation.shortLabel,
      tooltipLines: buildDebuffLines({
        remainingMs: params.remainingMs,
        statModifiers: params.statModifiers,
        damagePerSecond: params.damagePerSecond,
        blocksHealthRegen: config.blocksHealthRegen,
        guardMitigatesDamage: config.guardMitigatesDamage,
      }),
      statModifiers: params.statModifiers,
      damagePerSecond: params.damagePerSecond,
      blocksHealthRegen: config.blocksHealthRegen,
      guardMitigatesDamage: config.guardMitigatesDamage,
    }),
  }
}

function createStatusDefinition(config: {
  id: string
  title: string
  shortLabel: string
  iconKey: string
  iconPattern: EffectIconPattern
  getTooltipLines: (params: { remainingMs?: number }) => string[]
}): StatusEffectDefinition {
  const presentation = createPresentation({
    shortLabel: config.shortLabel,
    iconKey: config.iconKey,
    iconPattern: config.iconPattern,
    fillColor: config.id === STATUS_EFFECT_IDS.guard ? 0x1e3a8a : config.id === STATUS_EFFECT_IDS.poisoned ? 0x3f6212 : 0x3f3f46,
    strokeColor: config.id === STATUS_EFFECT_IDS.guard ? 0x60a5fa : config.id === STATUS_EFFECT_IDS.poisoned ? 0xa3e635 : 0xe4e4e7,
    textColor: config.id === STATUS_EFFECT_IDS.guard ? '#dbeafe' : config.id === STATUS_EFFECT_IDS.poisoned ? '#ecfccb' : '#fafafa',
  })

  return {
    kind: 'status',
    id: config.id,
    getPresentation: () => presentation,
    describe: params => ({
      title: config.title,
      durationMs: params.remainingMs,
      iconKey: presentation.iconKey,
      iconPattern: presentation.iconPattern,
      shortLabel: presentation.shortLabel,
      tooltipLines: config.getTooltipLines(params),
    }),
  }
}

function createFallbackBuffDefinition(id: string): BuffEffectDefinition {
  const title = BUFF_EFFECT_TITLES[id] ?? humanizeId(id)
  const presentation = createPresentation({
    shortLabel: abbreviate(title),
    iconKey: `effect-icon-${id}`,
    iconPattern: 'spark',
    fillColor: 0x14532d,
    strokeColor: 0x4ade80,
    textColor: '#dcfce7',
  })

  return {
    kind: 'buff',
    id,
    getPresentation: () => presentation,
    describe: params => ({
      title,
      durationMs: params.remainingMs,
      iconKey: presentation.iconKey,
      iconPattern: presentation.iconPattern,
      shortLabel: presentation.shortLabel,
      tooltipLines: buildBuffLines(params.remainingMs, params.statModifiers),
      statModifiers: params.statModifiers,
    }),
  }
}

function createFallbackDebuffDefinition(id: string): DebuffEffectDefinition {
  const title = humanizeId(id)
  const presentation = createPresentation({
    shortLabel: abbreviate(id),
    iconKey: `effect-icon-${id}`,
    iconPattern: 'hazard',
    fillColor: 0x7f1d1d,
    strokeColor: 0xf87171,
    textColor: '#fee2e2',
  })

  return {
    kind: 'debuff',
    id,
    getPresentation: () => presentation,
    describe: params => ({
      title,
      durationMs: params.remainingMs,
      iconKey: presentation.iconKey,
      iconPattern: presentation.iconPattern,
      shortLabel: presentation.shortLabel,
      tooltipLines: buildDebuffLines({
        remainingMs: params.remainingMs,
        statModifiers: params.statModifiers,
        damagePerSecond: params.damagePerSecond,
      }),
      statModifiers: params.statModifiers,
      damagePerSecond: params.damagePerSecond,
    }),
  }
}

function createFallbackStatusDefinition(id: string): StatusEffectDefinition {
  const title = humanizeId(id)
  const presentation = createPresentation({
    shortLabel: abbreviate(id),
    iconKey: `effect-icon-${id}`,
    iconPattern: 'hazard',
    fillColor: 0x3f3f46,
    strokeColor: 0xe4e4e7,
    textColor: '#fafafa',
  })

  return {
    kind: 'status',
    id,
    getPresentation: () => presentation,
    describe: params => ({
      title,
      durationMs: params.remainingMs,
      iconKey: presentation.iconKey,
      iconPattern: presentation.iconPattern,
      shortLabel: presentation.shortLabel,
      tooltipLines: params.remainingMs ? [`time: ${formatRemainingMs(params.remainingMs)}`] : [],
    }),
  }
}

function createPresentation(params: EffectPresentationDefinition): EffectPresentationDefinition {
  return params
}

function buildBuffLines(remainingMs: number, statModifiers?: CharacterStatModifier): string[] {
  return [`time: ${formatRemainingMs(remainingMs)}`, ...formatStatModifierLines(statModifiers)]
}

function buildDebuffLines(params: {
  remainingMs: number
  statModifiers?: CharacterStatModifier
  damagePerSecond?: number
  blocksHealthRegen?: boolean
  guardMitigatesDamage?: boolean
}): string[] {
  const lines = [`time: ${formatRemainingMs(params.remainingMs)}`]
  if (params.damagePerSecond) {
    lines.push(`damage: ${params.damagePerSecond.toFixed(1)}/s`)
  }
  if (params.blocksHealthRegen) {
    lines.push('health regen blocked')
  }
  if (params.guardMitigatesDamage) {
    lines.push('guard reduces dot')
  }
  lines.push(...formatStatModifierLines(params.statModifiers))
  return lines
}

function formatStatModifierLines(statModifiers?: CharacterStatModifier): string[] {
  if (!statModifiers) {
    return []
  }

  return Object.entries(statModifiers).map(([key, value]) => `${formatStatKey(key)} ${formatSignedValue(value)}`)
}

function formatStatKey(key: string): string {
  const labels: Record<string, string> = {
    maxHealth: 'max hp',
    maxMana: 'max mp',
    healthRegen: 'hp regen',
    manaRegen: 'mp regen',
    meleeAttack: 'melee atk',
    rangedAttack: 'ranged atk',
    meleeMagicAttack: 'melee matk',
    rangedMagicAttack: 'ranged matk',
    defense: 'def',
    moveSpeed: 'move',
    attackSpeed: 'atk spd',
    magicAttackSpeed: 'cast spd',
    fullDefenseChance: 'full def',
  }

  return labels[key] ?? key
}

function formatSignedValue(value: number): string {
  if (Math.abs(value) < 1) {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}

function formatRemainingMs(remainingMs: number): string {
  return `${(remainingMs / 1000).toFixed(1)}s`
}

function abbreviate(label: string): string {
  const compact = label.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return compact.slice(0, 3) || '...'
}

function humanizeId(id: string): string {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map(token => token[0].toUpperCase() + token.slice(1))
    .join(' ')
}

function getPotionBuffIconPattern(id: string): EffectIconPattern {
  if (id === BUFF_EFFECT_IDS.minorPotion) {
    return 'cross'
  }
  if (id === BUFF_EFFECT_IDS.manaPotion) {
    return 'drop'
  }
  if (id === BUFF_EFFECT_IDS.guardPotion) {
    return 'shield'
  }
  if (id === BUFF_EFFECT_IDS.berserkPotion) {
    return 'spark'
  }
  if (id === BUFF_EFFECT_IDS.hastePotion) {
    return 'wing'
  }

  return 'spark'
}
