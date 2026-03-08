import { CharacterUnit } from './CharacterUnit'
import { CHARACTER_FACTIONS, type CharacterFaction } from './CharacterFaction'
import { getDefaultCharacterJobId, type CharacterJobId } from './CharacterJobRules'

interface MonsterCharacterConfig {
  id: string
  displayName: string
  jobId?: CharacterJobId
}

export class MonsterCharacter extends CharacterUnit {
  constructor(config: MonsterCharacterConfig) {
    super({
      id: config.id,
      displayName: config.displayName,
      jobId: config.jobId ?? getDefaultCharacterJobId(),
      inventoryCols: 0,
      inventoryRows: 0,
      beltCols: 0,
      beltRows: 0,
    })
  }

  getKind(): string {
    return 'monster'
  }

  getFaction(): CharacterFaction {
    return CHARACTER_FACTIONS.monster
  }
}
