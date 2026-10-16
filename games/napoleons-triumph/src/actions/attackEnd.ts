import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { GameAction } from '@tabletop/common'
import { Attack } from '../model/attack.js'
import type { NapoleonsTriumphProjectedState } from '../model/gameState.js'

/** The public record of an attack, kept by the action that ended it: the game state no longer has the attack once it is over. */
export type EndedAttack = Type.Static<typeof EndedAttack>
export const EndedAttack = Type.Omit(Attack, [
    'attackPlan',
    'defensePlan',
    'awaits',
    'orders',
    'pending',
    'lossesSettled'
])

export type AttackEndMetadata = Type.Static<typeof AttackEndMetadata>
export const AttackEndMetadata = Type.Object({
    endedAttack: Type.Optional(EndedAttack)
})

export function endedAttackOf(
    attack: Readonly<NonNullable<NapoleonsTriumphProjectedState['attack']>>
): EndedAttack {
    const { attackPlan, defensePlan, awaits, orders, pending, lossesSettled, ...ended } =
        structuredClone(attack)
    return ended
}

const AttackEndMetadataValidator = Compile(AttackEndMetadata)

export function attackEndedBy(action: GameAction | undefined): EndedAttack | undefined {
    const metadata: unknown = action && Reflect.get(action, 'metadata')
    return AttackEndMetadataValidator.Check(metadata) ? metadata.endedAttack : undefined
}
