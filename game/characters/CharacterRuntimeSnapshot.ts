import type { CharacterJobId } from './CharacterJobRules'

export interface CharacterRuntimeSnapshot {
  jobId: CharacterJobId
  health: number
  mana: number
  poisoned: boolean
  guardBuffRemainingMs: number
}
