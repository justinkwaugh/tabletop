import * as Type from 'typebox'
import { PowerUse } from './powerUse.js'

/** R-5.5.3 */
export type BattlePlanUse = PowerUse
export const BattlePlanUse = PowerUse
export const BattlePlanUses = Type.Optional(Type.Array(BattlePlanUse, { maxItems: 8 }))
