import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { MARKET_ORDER } from '../model/locomotives.js'
import { MarketStep, adjustDemand } from '../model/market.js'

export type AdjustMarketMetadata = Type.Static<typeof AdjustMarketMetadata>
export const AdjustMarketMetadata = Type.Object({
    steps: Type.Array(MarketStep)
})

export type AdjustMarket = Type.Static<typeof AdjustMarket>
export const AdjustMarket = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.AdjustMarket),
            metadata: Type.Optional(AdjustMarketMetadata)
        })
    ])
)

export const AdjustMarketValidator = Compile(AdjustMarket)

export function isAdjustMarket(action?: GameAction): action is AdjustMarket {
    return action?.type === ActionType.AdjustMarket
}

export class HydratedAdjustMarket
    extends HydratableAction<typeof AdjustMarket>
    implements AdjustMarket
{
    declare type: ActionType.AdjustMarket
    declare metadata?: AdjustMarketMetadata

    constructor(data: AdjustMarket) {
        super(data, AdjustMarketValidator)
    }

    apply(state: HydratedLwGameState, _context?: MachineContext) {
        const pool = state.dicePool()
        const steps = MARKET_ORDER.flatMap((kind) =>
            adjustDemand(kind, (locomotiveId) => state.space(locomotiveId), pool)
        )
        this.metadata = { steps }
        this.revealsInfo = steps.some((step) => step.rolls.length > 0)
    }
}
