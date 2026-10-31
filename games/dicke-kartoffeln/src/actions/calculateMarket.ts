import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { MARKET_IDS } from '../components/potatoes.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { MarketMove, recalculateMarket } from '../model/market.js'

export type CalculateMarketMetadata = Type.Static<typeof CalculateMarketMetadata>
export const CalculateMarketMetadata = Type.Object({ moves: Type.Array(MarketMove) })

export type CalculateMarket = Type.Static<typeof CalculateMarket>
export const CalculateMarket = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.CalculateMarket),
            metadata: Type.Optional(CalculateMarketMetadata)
        })
    ])
)

export const CalculateMarketValidator = Compile(CalculateMarket)

export function isCalculateMarket(action?: GameAction): action is CalculateMarket {
    return action?.type === ActionType.CalculateMarket
}

// Even a market nobody offers to is recalculated: its demand falls to zero.
export class HydratedCalculateMarket
    extends HydratableAction<typeof CalculateMarket>
    implements CalculateMarket
{
    declare type: ActionType.CalculateMarket
    declare metadata?: CalculateMarketMetadata

    constructor(data: CalculateMarket) {
        super(data, CalculateMarketValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, _context?: MachineContext) {
        this.metadata = { moves: MARKET_IDS.map((id) => recalculateMarket(state, id)) }
    }
}
