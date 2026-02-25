import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { BID_RESEARCH_MULTIPLIERS } from '../definition/bidResearchMultipliers.js'

export type PlaceTurnOrderBidMetadata = Type.Static<typeof PlaceTurnOrderBidMetadata>
export const PlaceTurnOrderBidMetadata = Type.Object({
    multipliedAmount: Type.Number()
})

export type PlaceTurnOrderBid = Type.Static<typeof PlaceTurnOrderBid>
export const PlaceTurnOrderBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceTurnOrderBid), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(PlaceTurnOrderBidMetadata), // Always optional, because it is an output
            amount: Type.Number() // The amount of the bid being placed
        })
    ])
)

export const PlaceTurnOrderBidValidator = Compile(PlaceTurnOrderBid)

export function isPlaceTurnOrderBid(action?: GameAction): action is PlaceTurnOrderBid {
    return action?.type === ActionType.PlaceTurnOrderBid
}

export class HydratedPlaceTurnOrderBid
    extends HydratableAction<typeof PlaceTurnOrderBid>
    implements PlaceTurnOrderBid
{
    declare type: ActionType.PlaceTurnOrderBid
    declare playerId: string
    declare metadata?: PlaceTurnOrderBidMetadata
    declare amount: number
    constructor(data: PlaceTurnOrderBid) {
        super(data, PlaceTurnOrderBidValidator)
    }

    apply(state: HydratedIndonesiaGameState, context?: MachineContext) {
        if (!this.isValidPlaceTurnOrderBid(state)) {
            throw Error('Invalid PlaceTurnOrderBid action')
        }

        const playerState = state.getPlayerState(this.playerId)
        const multiplier = BID_RESEARCH_MULTIPLIERS[playerState.research.bid] ?? 1
        const multipliedAmount = this.amount * multiplier

        assertExists(
            state.turnOrderBids,
            'turnOrderBids should be initialized when placing turn order bids'
        )
        state.turnOrderBids[this.playerId] = {
            bid: this.amount,
            multiplier,
            total: multipliedAmount
        }
        playerState.bank += this.amount
        playerState.cash -= this.amount

        this.metadata = {
            multipliedAmount
        }
    }

    isValidPlaceTurnOrderBid(state: HydratedIndonesiaGameState): boolean {
        const playerState = state.getPlayerState(this.playerId)
        return this.amount <= playerState.cash && this.amount >= 0
    }

    static canPlaceTurnOrderBid(state: HydratedIndonesiaGameState, playerId: string): boolean {
        return true
    }
}
