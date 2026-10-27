import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import {
    MarketChange,
    beginDrawnStep3,
    emptyMarketChange,
    mergeRefill,
    withRemoved
} from './marketChange.js'

export type CloseAuctionsMetadata = Type.Static<typeof CloseAuctionsMetadata>
export const CloseAuctionsMetadata = Type.Object({
    market: MarketChange,
    unsoldDiscount: Type.Optional(Type.Integer()),
    step2Began: Type.Boolean(),
    step3Began: Type.Boolean(),
    playerOrder: Type.Optional(Type.Array(Type.String()))
})

export type CloseAuctions = Type.Static<typeof CloseAuctions>
export const CloseAuctions = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.CloseAuctions),
            metadata: Type.Optional(CloseAuctionsMetadata)
        })
    ])
)

export const CloseAuctionsValidator = Compile(CloseAuctions)

export function isCloseAuctions(action?: GameAction): action is CloseAuctions {
    return action?.type === ActionType.CloseAuctions
}

/**
 * The end of Phase 2 (Recharged pp. 4, 8): an unsold discounted plant leaves the game and is
 * replaced; a Step 3 card drawn this phase takes the lowest plant with it; after the first
 * round the player order is set again.
 */
export class HydratedCloseAuctions
    extends HydratableAction<typeof CloseAuctions>
    implements CloseAuctions
{
    declare type: ActionType.CloseAuctions
    declare metadata?: CloseAuctionsMetadata

    constructor(data: CloseAuctions) {
        super(data, CloseAuctionsValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        let market = emptyMarketChange()
        const discounted = state.discountPlant
        const unsoldDiscount =
            discounted !== undefined && state.market.includes(discounted) ? discounted : undefined
        state.discountPlant = undefined
        if (unsoldDiscount !== undefined) {
            state.retireFromMarket(unsoldDiscount)
            market = mergeRefill(withRemoved(market, unsoldDiscount), state.refillMarket())
        }

        const step3Began = state.step3Drawn
        const steps = step3Began ? beginDrawnStep3(state, market) : { market, step2Began: false }

        let playerOrder: string[] | undefined
        if (state.isFirstRound()) {
            playerOrder = state.rankPlayers()
            state.turnManager.turnOrder = playerOrder
        }
        this.metadata = { ...steps, unsoldDiscount, step3Began, playerOrder }
        this.revealsInfo = steps.market.drawn.length > 0
    }
}
