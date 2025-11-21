import { Type, type Static } from 'typebox'
import {
    AuctionParticipant,
    GameAction,
    HydratableAction,
    OnceAroundAuction,
    remove
} from '@tabletop/common'

import { HydratedEstatesGameState } from '../model/gameState.js'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { isCube } from '../components/pieces.js'

export type EndAuction = Static<typeof EndAuction>
export const EndAuction = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndAuction),
            winnerId: Type.Optional(Type.String()),
            highBid: Type.Number(),
            metadata: Type.Optional(
                Type.Object({
                    auction: Type.Optional(OnceAroundAuction),
                    participants: Type.Array(AuctionParticipant)
                })
            )
        })
    ])
)

export const EndAuctionValidator = Compile(EndAuction)

export function isEndAuction(action?: GameAction): action is EndAuction {
    return action?.type === ActionType.EndAuction
}
export class HydratedEndAuction extends HydratableAction<typeof EndAuction> implements EndAuction {
    declare type: ActionType.EndAuction
    declare winnerId?: string
    declare highBid: number
    declare revealsInfo: true
    declare metadata?: { auction?: OnceAroundAuction; participants: AuctionParticipant[] }

    constructor(data: EndAuction) {
        super(data, EndAuctionValidator)
    }

    apply(state: HydratedEstatesGameState) {
        const currentAuction = state.auction
        if (!currentAuction) {
            throw Error('Cannot end auction without a currentAuction')
        }

        if (!this.winnerId && currentAuction.auctioneerId) {
            state.auction = undefined
            state.recipient = currentAuction.auctioneerId

            if (
                isCube(state.chosenPiece) &&
                state.certificates.includes(state.chosenPiece.company)
            ) {
                remove(state.certificates, state.chosenPiece.company)
                const winnerState = state.getPlayerState(currentAuction.auctioneerId)
                winnerState.certificates.push(state.chosenPiece.company)
            }
        }

        this.metadata = {
            auction: currentAuction,
            participants: currentAuction.participants
        }
    }
}
