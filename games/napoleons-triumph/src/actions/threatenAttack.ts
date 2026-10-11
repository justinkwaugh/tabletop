import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, Visibility } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import { ThreatOrder } from '../model/attack.js'
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
            guardUnitId: Type.Optional(Type.String()),
            plan: Visibility.protect(Type.Optional(ThreatOrder), {
                policy: Visibility.Policy.Actor
            })
        })
    ])
)

export const ThreatenAttackValidator = Compile(ThreatenAttack)

export function isThreatenAttack(action?: GameAction): action is ThreatenAttack {
    return action?.type === ActionType.ThreatenAttack
}

export class HydratedThreatenAttack
    extends NapoleonsTriumphAction<typeof ThreatenAttack>
    implements ThreatenAttack
{
    declare type: ActionType.ThreatenAttack
    declare playerId: string
    declare approach: number
    declare guardUnitId?: string
    declare plan?: ThreatOrder

    constructor(data: ThreatenAttack) {
        super(data, ThreatenAttackValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        threatenAttack(state, this.playerId, this.approach, this.guardUnitId, this.plan)
    }
}
