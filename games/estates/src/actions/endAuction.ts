import { Type, type Static } from '@sinclair/typebox'
import { AuctionParticipant, GameAction, HydratableAction, remove } from '@tabletop/common'

import { HydratedEstatesGameState } from '../model/gameState.js'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ActionType } from '../definition/actions.js'
import { isCube } from '../components/pieces.js'

export type EndAuction = Static<typeof EndAuction>
export const EndAuction = Type.Composite([
    GameAction,
    Type.Object({
        type: Type.Literal(ActionType.EndAuction),
        winnerId: Type.Optional(Type.String()),
        highBid: Type.Number(),
        metadata: Type.Optional(Type.Object({ participants: Type.Array(AuctionParticipant) }))
    })
])

export const EndAuctionValidator = TypeCompiler.Compile(EndAuction)

export function isEndAuction(action: GameAction): action is EndAuction {
    return action.type === ActionType.EndAuction
}
export class HydratedEndAuction extends HydratableAction<typeof EndAuction> implements EndAuction {
    declare type: ActionType.EndAuction
    declare winnerId?: string
    declare highBid: number
    declare revealsInfo: true
    declare metadata?: { participants: AuctionParticipant[] }

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

        this.metadata = { participants: currentAuction.participants }
    }
}
