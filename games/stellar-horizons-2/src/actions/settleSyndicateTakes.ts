import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { SyndicateTake, settleSyndicateTakes } from '../model/operations.js'

export type SettleSyndicateTakesMetadata = Type.Static<typeof SettleSyndicateTakesMetadata>
export const SettleSyndicateTakesMetadata = Type.Object({
    takes: Type.Array(SyndicateTake)
})

export type SettleSyndicateTakes = Type.Static<typeof SettleSyndicateTakes>
export const SettleSyndicateTakes = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.SettleSyndicateTakes),
            metadata: Type.Optional(SettleSyndicateTakesMetadata)
        })
    ])
)

export const SettleSyndicateTakesValidator = Compile(SettleSyndicateTakes)

export function isSettleSyndicateTakes(action?: GameAction): action is SettleSyndicateTakes {
    return action?.type === ActionType.SettleSyndicateTakes
}

export class HydratedSettleSyndicateTakes
    extends HydratableAction<typeof SettleSyndicateTakes>
    implements SettleSyndicateTakes
{
    declare type: ActionType.SettleSyndicateTakes
    declare metadata?: SettleSyndicateTakesMetadata

    constructor(data: SettleSyndicateTakes) {
        super(data, SettleSyndicateTakesValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = { takes: settleSyndicateTakes(state) }
    }
}
