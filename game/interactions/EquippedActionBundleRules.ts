import {
  getEquippedWeaponAttackId,
  getEquippedWeaponAttackStyle,
  getSocketedSkillAttackIdsForAttackStyle,
  type CharacterEquipmentLoadout,
} from '../items/CharacterEquipmentLoadout'
import type { InventoryState } from '../items/Inventory'
import { composeActionBundle, type ActionBundle } from './ActionBundleRules'
import { buildSkillActionSpec } from './SkillActionBuilder'
import { buildWeaponProjectileAttackSpec } from './WeaponProjectileAttackBuilder'

export function buildEquippedActionBundle(
  inventory: InventoryState,
  loadout: CharacterEquipmentLoadout
): ActionBundle | null {
  const attackId = getEquippedWeaponAttackId(inventory, loadout)
  if (!attackId) {
    return null
  }

  const weaponSpec = buildWeaponProjectileAttackSpec(attackId)
  const weaponAttackStyle = getEquippedWeaponAttackStyle(inventory, loadout)
  if (!weaponAttackStyle) {
    return {
      projectile: weaponSpec,
      deploys: [],
      summons: [],
    }
  }

  const skillActions = getSocketedSkillAttackIdsForAttackStyle(
    inventory,
    loadout,
    weaponAttackStyle
  ).map(skillActionId => buildSkillActionSpec(skillActionId))

  return composeActionBundle(weaponSpec, skillActions)
}
