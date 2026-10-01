import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, Visibility } from '@tabletop/common'
import { HydratedMarracashGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isWholeDirhamAmount, MinimumAuctionBid } from '../components/payments.js'

export type PlaceBid = Type.Static<typeof PlaceBid>
export const PlaceBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBid),
            playerId: Type.String(),
            amount: Visibility.protect(Type.Number(), { policy: Visibility.Policy.Actor })
        })
    ])
)

export const PlaceBidValidator = Compile(PlaceBid)

export function isPlaceBid(action?: GameAction): action is PlaceBid {
    return action?.type === ActionType.PlaceBid
}

export class HydratedPlaceBid extends HydratableAction<typeof PlaceBid> implements PlaceBid {
    declare type: ActionType.PlaceBid
    declare playerId: string
    declare amount: number

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    apply(state: HydratedMarracashGameState) {
        const { valid, reason } = HydratedPlaceBid.isValidBid(state, this.playerId, this.amount)
        if (!valid) {
            throw Error(reason)
        }
        assertExists(state.auction, 'There is no auction to bid in')
        state.auction.placeBid(this.playerId, this.amount)
    }

    static isValidBid(
        state: HydratedMarracashGameState,
        playerId: string,
        amount: number
    ): { valid: boolean; reason: string } {
        const auction = state.auction
        if (!auction) {
            return { valid: false, reason: 'There is no auction to bid in' }
        }
        if (!isWholeDirhamAmount(amount)) {
            return { valid: false, reason: 'A bid must be a whole number of 25 Dirham' }
        }
        if (playerId === auction.auctioneerId && amount < MinimumAuctionBid) {
            return { valid: false, reason: `The auctioneer must bid at least ${MinimumAuctionBid}` }
        }
        if (amount > state.getPlayerState(playerId).getMoney()) {
            return { valid: false, reason: 'A bid cannot be more than the player has' }
        }
        return { valid: true, reason: '' }
    }
}
