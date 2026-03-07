import { CharacterUnit } from './CharacterUnit'
import { getDefaultCharacterJobId, type CharacterJobId } from './CharacterJobRules'

interface PlayerCharacterConfig {
  jobId?: CharacterJobId
}

export class PlayerCharacter extends CharacterUnit {
  constructor(config: PlayerCharacterConfig = {}) {
    super({
      id: 'player',
      displayName: 'Player',
      jobId: config.jobId ?? getDefaultCharacterJobId(),
    })
  }

  getKind(): string {
    return 'player'
  }
}
