import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMagnaGreciaGameState } from '../model/gameState.js'
import { marketValue } from '../model/marketRules.js'

export type SellMarketMetadata = Type.Static<typeof SellMarketMetadata>
export const SellMarketMetadata = Type.Object({
    value: Type.Number()
})

export type SellMarket = Type.Static<typeof SellMarket>
export const SellMarket = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SellMarket),
            playerId: Type.String(),
            metadata: Type.Optional(SellMarketMetadata),
            placeId: Type.String()
        })
    ])
)

export const SellMarketValidator = Compile(SellMarket)

export function isSellMarket(action?: GameAction): action is SellMarket {
    return action?.type === ActionType.SellMarket
}

export class HydratedSellMarket extends HydratableAction<typeof SellMarket> implements SellMarket {
    declare type: ActionType.SellMarket
    declare playerId: string
    declare metadata?: SellMarketMetadata
    declare placeId: string

    constructor(data: SellMarket) {
        super(data, SellMarketValidator)
    }

    apply(state: HydratedMagnaGreciaGameState, _context?: MachineContext) {
        const market = state
            .sellableMarkets(this.playerId)
            .find((candidate) => candidate.placeId === this.placeId)
        assertExists(market, 'Invalid SellMarket action')
        const value = marketValue(state.board, state.board.network(), market)
        state.getPlayerState(this.playerId).points += value
        market.sold = true
        state.activeTurn(this.playerId).marketDone = true
        this.metadata = { value }
    }

    static canSellMarket(state: HydratedMagnaGreciaGameState, playerId: string): boolean {
        return state.sellableMarkets(playerId).length > 0
    }
}
