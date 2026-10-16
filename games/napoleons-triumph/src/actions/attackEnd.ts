import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { GameAction } from '@tabletop/common'
import { Attack } from '../model/attack.js'
import type {
    HydratedNapoleonsTriumphGameState,
    NapoleonsTriumphProjectedState
} from '../model/gameState.js'

/** The public record of an attack, kept by the action that ended it: the game state no longer has the attack once it is over. */
export type EndedAttack = Type.Static<typeof EndedAttack>
export const EndedAttack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Attack, [
            'attackPlan',
            'defensePlan',
            'awaits',
            'orders',
            'pending',
            'lossesSettled'
        ]),
        Type.Object({ demoralizedId: Type.Optional(Type.String()) })
    ])
)

export type AttackEndMetadata = Type.Static<typeof AttackEndMetadata>
export const AttackEndMetadata = Type.Object({
    endedAttack: Type.Optional(EndedAttack)
})

export function endedAttackOf(
    attack: Readonly<NonNullable<NapoleonsTriumphProjectedState['attack']>>,
    state: HydratedNapoleonsTriumphGameState
): EndedAttack {
    const { attackPlan, defensePlan, awaits, orders, pending, lossesSettled, ...ended } =
        structuredClone(attack)
    const demoralizedId = [attack.attackerId, attack.defenderId].find((playerId) =>
        state.isDemoralized(playerId)
    )
    return demoralizedId === undefined ? ended : { ...ended, demoralizedId }
}

const AttackEndMetadataValidator = Compile(AttackEndMetadata)

export function attackEndedBy(action: GameAction | undefined): EndedAttack | undefined {
    const metadata: unknown = action && Reflect.get(action, 'metadata')
    return AttackEndMetadataValidator.Check(metadata) ? metadata.endedAttack : undefined
}
