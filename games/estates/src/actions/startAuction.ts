import * as Type from 'typebox'
import {
    GameAction,
    AuctionType,
    HydratableAction,
    HydratedOnceAroundAuction
} from '@tabletop/common'

import { HydratedEstatesGameState } from '../model/gameState.js'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { isBarrier, isCancelCube, isCube, isMayor, Piece } from '../components/pieces.js'

export type StartAuction = Type.Static<typeof StartAuction>
export const StartAuction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'type']),
        Type.Object({
            type: Type.Literal(ActionType.StartAuction),
            playerId: Type.String(),
            piece: Piece
        })
    ])
)

export const StartAuctionValidator = Compile(StartAuction)

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

        const validBidders = bidOrder.filter(
            (playerId) => state.getPlayerState(playerId).money > 0 && playerId !== this.playerId
        )
        const participants = validBidders.map((playerId) => ({ playerId: playerId, passed: false }))

        state.auction = new HydratedOnceAroundAuction({
            id: this.id,
            type: AuctionType.OnceAround,
            participants: participants,
            auctioneerId: this.playerId
        })

        if (isCube(state.chosenPiece)) {
            state.removeCubeFromOffer(state.chosenPiece)
        } else if (isMayor(state.chosenPiece)) {
            state.mayor = false
        } else if (isCancelCube(state.chosenPiece)) {
            state.cancelCube = false
        } else if (isBarrier(state.chosenPiece)) {
            if (state.chosenPiece.value === 1) {
                state.barrierOne = false
            } else if (state.chosenPiece.value === 2) {
                state.barrierTwo = false
            } else if (state.chosenPiece.value === 3) {
                state.barrierThree = false
            }
        }
    }
}
