import { Type, type Static } from '@sinclair/typebox'
import {
    GameAction,
    AuctionType,
    HydratableAction,
    HydratedOnceAroundAuction
} from '@tabletop/common'

import { HydratedEstatesGameState } from '../model/gameState.js'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ActionType } from '../definition/actions.js'
import { isCube, Piece } from '../components/pieces.js'

export type StartAuction = Static<typeof StartAuction>
export const StartAuction = Type.Composite([
    Type.Omit(GameAction, ['playerId', 'type']),
    Type.Object({
        type: Type.Literal(ActionType.StartAuction),
        playerId: Type.String(),
        piece: Piece
    })
])

export const StartAuctionValidator = TypeCompiler.Compile(StartAuction)

export function isStartAuction(action: GameAction): action is StartAuction {
    return action.type === ActionType.StartAuction
}

export class HydratedStartAuction
    extends HydratableAction<typeof StartAuction>
    implements StartAuction
{
    declare type: ActionType.StartAuction
    declare playerId: string
    declare piece: Piece

    constructor(data: StartAuction) {
        super(data, StartAuctionValidator)
    }

    apply(state: HydratedEstatesGameState) {
        state.chosenPiece = this.piece
        const bidOrder = HydratedOnceAroundAuction.generateBidOrder(
            state.turnManager.turnOrder,
            this.playerId
        )
        console.log('bidOrder', bidOrder)
        const validBidders = bidOrder.filter((playerId) => state.getPlayerState(playerId).money > 0)
        const participants = validBidders.map((playerId) => ({ playerId: playerId, passed: false }))

        state.auction = new HydratedOnceAroundAuction({
            id: this.id,
            type: AuctionType.OnceAround,
            participants: participants,
            auctioneerId: this.playerId
        })

        if (isCube(state.chosenPiece)) {
            state.removeCubeFromOffer(state.chosenPiece)
        }
    }
}
