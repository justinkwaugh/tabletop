import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { GrowthResult, growSettlements } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type GrowSettlementsMetadata = Type.Static<typeof GrowSettlementsMetadata>
export const GrowSettlementsMetadata = Type.Object({
    results: Type.Array(GrowthResult)
})

export type GrowSettlements = Type.Static<typeof GrowSettlements>
export const GrowSettlements = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.GrowSettlements),
            metadata: Type.Optional(GrowSettlementsMetadata)
        })
    ])
)

export const GrowSettlementsValidator = Compile(GrowSettlements)

export function isGrowSettlements(action?: GameAction): action is GrowSettlements {
    return action?.type === ActionType.GrowSettlements
}

export class HydratedGrowSettlements
    extends HydratableAction<typeof GrowSettlements>
    implements GrowSettlements
{
    declare type: ActionType.GrowSettlements
    declare metadata?: GrowSettlementsMetadata

    constructor(data: GrowSettlements) {
        super(data, GrowSettlementsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = { results: growSettlements(state) }
    }
}
