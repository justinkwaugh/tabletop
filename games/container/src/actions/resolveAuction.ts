import { GameAction, HydratableAction, assert } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedContainerGameState } from '../model/gameState.js'

export type ResolveAuction = Static<typeof ResolveAuction>
export const ResolveAuction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ResolveAuction),
            playerId: Type.String(),
            accept: Type.Boolean(),
            winnerPlayerId: Type.Optional(Type.String())
        })
    ])
)

export const ResolveAuctionValidator = Compile(ResolveAuction)

export function isResolveAuction(action: GameAction): action is ResolveAuction {
    return action.type === ActionType.ResolveAuction
}

export class HydratedResolveAuction
    extends HydratableAction<typeof ResolveAuction>
    implements ResolveAuction
{
    declare type: ActionType.ResolveAuction
    declare playerId: string
    declare accept: boolean
    declare winnerPlayerId?: string

    constructor(data: ResolveAuction) {
        super(data, ResolveAuctionValidator)
    }

    apply(state: HydratedContainerGameState): void {
        const auction = state.auction
        assert(auction, 'No auction in progress')
        assert(auction.sellerId === this.playerId, 'Only the seller can resolve the auction')

        const seller = state.getPlayerState(auction.sellerId)
        const winningBid = auction.winningBid ?? auction.round.highBid ?? 0

        if (this.accept) {
            const winnerId = auction.winningBidderId ?? this.winnerPlayerId
            assert(winnerId, 'Winner must be selected to accept')
            const tied = auction.tiedPlayerIds ?? []
            if (tied.length > 1) {
                assert(tied.includes(winnerId), 'Winner must be a tied bidder')
            }

            const winner = state.getPlayerState(winnerId)
            assert(winner.money >= winningBid, 'Winner cannot afford bid')

            winner.money -= winningBid
            // Seller receives double the winning bid
            seller.money += winningBid * 2
            winner.island.push(...auction.containers)
        } else {
            state.ensureCash(seller, winningBid)
            assert(seller.money >= winningBid, 'Seller cannot afford decline')
            seller.money -= winningBid
            if (state.investmentBank) {
                state.depositToInvestmentBank(winningBid)
            }
            seller.island.push(...auction.containers)
        }

        seller.ship.cargo = []
        state.auction = undefined
        state.actionsRemaining = 0
        state.turnNeedsStart = true
    }

    static canResolve(state: HydratedContainerGameState, playerId: string): boolean {
        const auction = state.auction
        return auction !== undefined && auction.sellerId === playerId
    }
}
