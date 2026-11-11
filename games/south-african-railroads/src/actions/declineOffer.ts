import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedSarGameState } from '../model/gameState.js'

export type DeclineOffer = Type.Static<typeof DeclineOffer>
export const DeclineOffer = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclineOffer),
            playerId: Type.String()
        })
    ])
)

export const DeclineOfferValidator = Compile(DeclineOffer)

export function isDeclineOffer(action?: GameAction): action is DeclineOffer {
    return action?.type === ActionType.DeclineOffer
}

export class HydratedDeclineOffer
    extends HydratableAction<typeof DeclineOffer>
    implements DeclineOffer
{
    declare type: ActionType.DeclineOffer
    declare playerId: string

    constructor(data: DeclineOffer) {
        super(data, DeclineOfferValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        assert(HydratedDeclineOffer.canDecline(state), 'An unsold share must be offered')
    }

    // Only one's own shares remain, and offering them is optional.
    static canDecline(state: HydratedSarGameState): boolean {
        return state.unsoldOffers().length === 0
    }
}
