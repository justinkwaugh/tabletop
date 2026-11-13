import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export type DealResult = Type.Static<typeof DealResult>
export const DealResult = Type.Object({
    dealerId: Type.String(),
    deal: Type.Integer({ minimum: 1 })
})

// The deal passes to the next player, who deals a new hand from a fresh shuffle.
export type DealHand = Type.Static<typeof DealHand>
export const DealHand = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DealHand),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(DealResult)
        })
    ])
)

export const DealHandValidator = Compile(DealHand)

export function isDealHand(action?: GameAction): action is DealHand {
    return action?.type === ActionType.DealHand
}

export class HydratedDealHand extends HydratableAction<typeof DealHand> implements DealHand {
    declare type: ActionType.DealHand
    declare revealsInfo: true
    declare metadata?: DealResult

    constructor(data: DealHand) {
        super(data, DealHandValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        state.nextDealer()
        state.dealHand(state.getProtectedPrng().random)
        this.metadata = { dealerId: state.dealerId, deal: state.dealNumber() }
    }
}
