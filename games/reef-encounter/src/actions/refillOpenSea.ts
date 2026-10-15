import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { OpenSeaRefill } from '../components/openSea.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

// Polyps drawn from the bag are a reveal, so Undo cannot step back past a refill.
export type RefillOpenSea = Type.Static<typeof RefillOpenSea>
export const RefillOpenSea = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.RefillOpenSea),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(OpenSeaRefill)
        })
    ])
)

export const RefillOpenSeaValidator = Compile(RefillOpenSea)

export function isRefillOpenSea(action?: GameAction): action is RefillOpenSea {
    return action?.type === ActionType.RefillOpenSea
}

export class HydratedRefillOpenSea
    extends HydratableAction<typeof RefillOpenSea>
    implements RefillOpenSea
{
    declare type: ActionType.RefillOpenSea
    declare revealsInfo: true
    declare metadata?: OpenSeaRefill

    constructor(data: RefillOpenSea) {
        super(data, RefillOpenSeaValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        this.metadata = state.refillOpenSea()
    }
}
