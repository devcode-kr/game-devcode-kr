import type { Character } from '../characters/Character'
import {
  CHARACTER_FACTIONS,
  type CharacterFaction,
} from '../characters/CharacterFaction'
import type { Interactable } from '../world/WorldObjects'

export type CombatTargetKind = CharacterFaction | 'neutral'

export function canAttackTargetKind(attackerKind: CombatTargetKind, targetKind: CombatTargetKind): boolean {
  if (attackerKind === 'player') {
    return targetKind === 'monster'
  }

  if (attackerKind === 'monster') {
    return targetKind === 'player'
  }

  return false
}

export function canCharacterAttackCharacter(attacker: Character, target: Character): boolean {
  return canAttackTargetKind(attacker.getFaction(), target.getFaction())
}

export function canCharacterAttackInteractable(attacker: Character, interactable: Interactable): boolean {
  return canAttackTargetKind(attacker.getFaction(), getInteractableTargetKind(interactable))
}

export function getInteractableTargetKind(interactable: Interactable): CombatTargetKind {
  if (interactable.kind === 'npc') {
    return CHARACTER_FACTIONS.npc
  }

  return 'neutral'
}
