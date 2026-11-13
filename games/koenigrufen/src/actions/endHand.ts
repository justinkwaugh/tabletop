import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HandResult, type HydratedKoenigrufenGameState } from '../model/gameState.js'

// The cards are counted and the hand scored; the talon and declarer's discards are shown.
export type EndHand = Type.Static<typeof EndHand>
export const EndHand = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndHand),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(HandResult)
        })
    ])
)

export const EndHandValidator = Compile(EndHand)

export function isEndHand(action?: GameAction): action is EndHand {
    return action?.type === ActionType.EndHand
}

export class HydratedEndHand extends HydratableAction<typeof EndHand> implements EndHand {
    declare type: ActionType.EndHand
    declare revealsInfo: true
    declare metadata?: HandResult

    constructor(data: EndHand) {
        super(data, EndHandValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        this.metadata = state.endHand()
    }
}
