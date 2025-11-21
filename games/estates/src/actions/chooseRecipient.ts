import { Type, type Static } from 'typebox'
import { GameAction, HydratableAction, remove } from '@tabletop/common'

import { HydratedEstatesGameState } from '../model/gameState.js'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { isCube } from '../components/pieces.js'

export enum AuctionRecipient {
    Auctioneer = 'auctioneer',
    HighestBidder = 'highestBidder'
}

export type ChooseRecipient = Static<typeof ChooseRecipient>
export const ChooseRecipient = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'type']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseRecipient),
            playerId: Type.String(),
            recipient: Type.Enum(AuctionRecipient)
        })
    ])
)

export const ChooseRecipientValidator = Compile(ChooseRecipient)

export function isChooseRecipient(action: GameAction): action is ChooseRecipient {
    return action.type === ActionType.ChooseRecipient
}

export class HydratedChooseRecipient
    extends HydratableAction<typeof ChooseRecipient>
    implements ChooseRecipient
{
    declare type: ActionType.ChooseRecipient
    declare playerId: string
    declare recipient: AuctionRecipient

    constructor(data: ChooseRecipient) {
        super(data, ChooseRecipientValidator)
    }

    apply(state: HydratedEstatesGameState) {
        const playerState = state.getPlayerState(this.playerId)
        if (!state.auction || !state.auction.isAuctionComplete()) {
            throw Error('Cannot choose recipient without a completed auction')
        }

        if (this.playerId !== state.auction.auctioneerId) {
            throw Error('Only the auctioneer can choose the recipient')
        }

        const winningPlayer = state.auction.winnerId
            ? state.getPlayerState(state.auction.winnerId)
            : undefined

        if (this.recipient === AuctionRecipient.Auctioneer) {
            if (playerState.money < (state.auction.highBid ?? 0)) {
                throw Error('Auctioneer must have enough money to pay the highest bid')
            }
            playerState.money -= state.auction.highBid ?? 0
            if (winningPlayer) {
                winningPlayer.money += state.auction.highBid ?? 0
            }
            state.recipient = this.playerId
        } else {
            if (!winningPlayer) {
                throw Error(
                    'There must be a high bidder for the recipient to be the highest bidder'
                )
            }

            if (winningPlayer.money < (state.auction.highBid ?? 0)) {
                throw Error('Highest bidder must have enough money to pay the highest bid')
            }
            winningPlayer.money -= state.auction.highBid ?? 0
            playerState.money += state.auction.highBid ?? 0
            state.recipient = state.auction.winnerId
        }

        // Check for certificate assignment
        if (isCube(state.chosenPiece) && state.certificates.includes(state.chosenPiece.company)) {
            remove(state.certificates, state.chosenPiece.company)
            const recipientState = state.getPlayerState(state.recipient!)
            recipientState.certificates.push(state.chosenPiece.company)
        }
        state.auction = undefined
    }
}
