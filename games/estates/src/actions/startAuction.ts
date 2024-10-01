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

export type StartAuction = Static<typeof StartAuction>
export const StartAuction = Type.Composite([
    Type.Omit(GameAction, ['playerId', 'type']),
    Type.Object({
        type: Type.Literal(ActionType.StartAuction),
        playerId: Type.String()
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

    constructor(data: StartAuction) {
        super(data, StartAuctionValidator)
    }

    apply(state: HydratedEstatesGameState) {
        if (!state.chosenPiece) {
            throw Error('Cannot start auction without a chosen piece')
        }

        const bidOrder = HydratedOnceAroundAuction.generateBidOrder(
            state.turnManager.turnOrder,
            this.playerId
        )
        const validBidders = bidOrder.filter((playerId) => state.getPlayerState(playerId).money > 0)
        const participants = validBidders.map((playerId) => ({ playerId: playerId, passed: false }))

        state.auction = new HydratedOnceAroundAuction({
            id: this.id,
            type: AuctionType.OnceAround,
            participants: participants,
            auctioneerId: this.playerId
        })
    }
}
