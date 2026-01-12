import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'

export type SubmitBid = Static<typeof SubmitBid>
export const SubmitBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SubmitBid),
            playerId: Type.String(),
            bidAmount: Type.Number()
        })
    ])
)

export const SubmitBidValidator = Compile(SubmitBid)

export function isSubmitBid(action: GameAction): action is SubmitBid {
    return action.type === ActionType.SubmitBid
}

export class HydratedSubmitBid extends HydratableAction<typeof SubmitBid> implements SubmitBid {
    declare type: ActionType.SubmitBid
    declare playerId: string
    declare bidAmount: number

    constructor(data: SubmitBid) {
        super(data, SubmitBidValidator)
    }

    apply(state: HydratedContainerGameState): void {
        const auction = state.auction
        assert(auction, 'No auction in progress')
        const participant = auction.round.participants.find(
            (entry) => entry.playerId === this.playerId
        )
        assert(participant, 'Not eligible to bid')
        assert(participant.bid === undefined, 'Bid already submitted')
        assert(this.bidAmount >= 0, 'Bid must be non-negative')

        const currentTotal = auction.totalBids[this.playerId] ?? 0
        const newTotal = auction.phase === 'tiebreak' ? currentTotal + this.bidAmount : this.bidAmount

        const player = state.getPlayerState(this.playerId)
        assert(player.money >= newTotal, 'Not enough money to bid')

        auction.placeBid(this.playerId, this.bidAmount)
    }

    static canBid(state: HydratedContainerGameState, playerId: string): boolean {
        const auction = state.auction
        if (!auction) {
            return false
        }
        const participant = auction.round.participants.find(
            (entry) => entry.playerId === playerId
        )
        return participant !== undefined && participant.bid === undefined
    }
}
