import { CharacterUnit } from './CharacterUnit'
import { CHARACTER_FACTIONS, type CharacterFaction } from './CharacterFaction'
import { getDefaultCharacterJobId, type CharacterJobId } from './CharacterJobRules'

interface PlayerCharacterConfig {
  jobId?: CharacterJobId
  inventoryCols?: number
  inventoryRows?: number
  beltCols?: number
  beltRows?: number
}

export class PlayerCharacter extends CharacterUnit {
  constructor(config: PlayerCharacterConfig = {}) {
    super({
      id: 'player',
      displayName: 'Player',
      jobId: config.jobId ?? getDefaultCharacterJobId(),
      inventoryCols: config.inventoryCols ?? 0,
      inventoryRows: config.inventoryRows ?? 0,
      beltCols: config.beltCols ?? 0,
      beltRows: config.beltRows ?? 0,
    })
  }

  getKind(): string {
    return 'player'
  }

  getFaction(): CharacterFaction {
    return CHARACTER_FACTIONS.player
  }
}
