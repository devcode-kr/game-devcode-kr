export interface GameSceneHudTextParams {
  floorIndex: number
  movementMode: string
  animationState: string
  facingText: string
  tileX: number
  tileY: number
  worldX: number
  worldY: number
  pathLength: number
  destinationText: string
  goalText: string
  visibleTiles: number
  visionRadius: number
  searchBudget: number
  searchBudgetMultiplier: number
  pathStatus: string
  interactionStatus: string
  jobLabel: string
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  healthRegen: number
  manaRegen: number
  meleeAttack: number
  rangedAttack: number
  meleeMagicAttack: number
  rangedMagicAttack: number
  defense: number
  moveSpeed: number
  attackSpeed: number
  magicAttackSpeed: number
  fullDefenseChance: number
  cooldownSummary: string
  dead: boolean
  gold: number
  potionCount: number
  keyCount: number
  inventorySummary: string
  journeyChapter: string
  achievementsText: string
}

export function buildGameSceneHudText(params: GameSceneHudTextParams): string[] {
  return [
    'Movement Phase 1',
    'WASD / Arrows: manual move',
    'LMB: A* click move',
    'Shift + LMB: face and combined attack',
    'E: interact',
    'Q: use potion',
    'F: fire combined attack',
    'Tab: toggle debug hud',
    '',
    '[Debug]',
    'V: deploy debug totem',
    'H: apply debug damage',
    'R: respawn',
    'I: inventory',
    'T: add debug items',
    `floor: ${params.floorIndex}`,
    `mode: ${params.movementMode}`,
    `animation: ${params.animationState}`,
    `facing: ${params.facingText}`,
    `tile: ${params.tileX}, ${params.tileY}`,
    `world: ${params.worldX.toFixed(2)}, ${params.worldY.toFixed(2)}`,
    `path length: ${params.pathLength}`,
    `destination: ${params.destinationText}`,
    `goal: ${params.goalText}`,
    `vision: ${params.visionRadius.toFixed(1)}`,
    `visible tiles: ${params.visibleTiles}`,
    `search budget: ${params.searchBudget} (${params.searchBudgetMultiplier.toFixed(1)}x)`,
    `path status: ${params.pathStatus}`,
    `interaction: ${params.interactionStatus}`,
    `job: ${params.jobLabel}`,
    `health: ${params.health}/${params.maxHealth}`,
    `mana: ${params.mana}/${params.maxMana}`,
    `regen(hp/mp): ${params.healthRegen.toFixed(1)}/${params.manaRegen.toFixed(1)}`,
    `atk(melee/ranged): ${params.meleeAttack}/${params.rangedAttack}`,
    `matk(melee/ranged): ${params.meleeMagicAttack}/${params.rangedMagicAttack}`,
    `def/move: ${params.defense}/${params.moveSpeed.toFixed(2)}`,
    `atk spd/magic spd: ${params.attackSpeed.toFixed(2)}/${params.magicAttackSpeed.toFixed(2)}`,
    `full defense: ${(params.fullDefenseChance * 100).toFixed(1)}%`,
    `cooldowns: ${params.cooldownSummary}`,
    `life state: ${params.dead ? 'dead' : 'alive'}`,
    `gold: ${params.gold}  potions: ${params.potionCount}  keys: ${params.keyCount}`,
    `inventory: ${params.inventorySummary}`,
    `journey: ${params.journeyChapter}`,
    `achievements: ${params.achievementsText}`,
  ]
}
