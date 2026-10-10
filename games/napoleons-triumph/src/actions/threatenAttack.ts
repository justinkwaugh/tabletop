import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { threatenAttack } from '../model/attackThreat.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type ThreatenAttack = Type.Static<typeof ThreatenAttack>
export const ThreatenAttack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ThreatenAttack),
            playerId: Type.String(),
            approach: Type.Integer(),
            guardUnitId: Type.Optional(Type.String())
        })
    ])
)

export const ThreatenAttackValidator = Compile(ThreatenAttack)

export function isThreatenAttack(action?: GameAction): action is ThreatenAttack {
    return action?.type === ActionType.ThreatenAttack
}

export class HydratedThreatenAttack
    extends HydratableAction<typeof ThreatenAttack>
    implements ThreatenAttack
{
    declare type: ActionType.ThreatenAttack
    declare playerId: string
    declare approach: number
    declare guardUnitId?: string

    constructor(data: ThreatenAttack) {
        super(data, ThreatenAttackValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        threatenAttack(state, this.playerId, this.approach, this.guardUnitId)
    }
}
