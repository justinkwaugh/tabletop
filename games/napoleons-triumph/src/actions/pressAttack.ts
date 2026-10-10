import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { revealDefenseLeaders } from '../model/attackThreat.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type PressAttack = Type.Static<typeof PressAttack>
export const PressAttack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PressAttack),
            playerId: Type.String()
        })
    ])
)

export const PressAttackValidator = Compile(PressAttack)

export function isPressAttack(action?: GameAction): action is PressAttack {
    return action?.type === ActionType.PressAttack
}

export class HydratedPressAttack
    extends HydratableAction<typeof PressAttack>
    implements PressAttack
{
    declare type: ActionType.PressAttack
    declare playerId: string

    constructor(data: PressAttack) {
        super(data, PressAttackValidator)
    }

    /** The attacker now knows the defense leading units, so this cannot be taken back. */
    apply(state: HydratedNapoleonsTriumphGameState) {
        revealDefenseLeaders(state)
        this.revealsInfo = true
    }
}
