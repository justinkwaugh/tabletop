import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'
import { CalledKingSchema, type CalledKing } from '../model/kingCall.js'

// Its holder becomes declarer's secret partner. "The fourth king" names no suit.
export type CallKing = Type.Static<typeof CallKing>
export const CallKing = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CallKing),
            playerId: Type.String(),
            king: CalledKingSchema
        })
    ])
)

export const CallKingValidator = Compile(CallKing)

export function isCallKing(action?: GameAction): action is CallKing {
    return action?.type === ActionType.CallKing
}

export class HydratedCallKing extends HydratableAction<typeof CallKing> implements CallKing {
    declare type: ActionType.CallKing
    declare playerId: string
    declare king: CalledKing

    constructor(data: CallKing) {
        super(data, CallKingValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        state.callKing(this.playerId, this.king)
    }
}
