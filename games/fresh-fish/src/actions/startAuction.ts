import { Type, type Static } from 'typebox'
import {
    GameAction,
    HydratedSimultaneousAuction,
    AuctionType,
    HydratableAction,
    TieResolutionStrategy,
    range,
    MachineContext
} from '@tabletop/common'

import { HydratedFreshFishGameState } from '../model/gameState.js'
import { Compile } from 'typebox/compile'
import { isStallTile } from '../components/tiles.js'
import { ActionType } from '../definition/actions.js'
import { GoodsType } from '../definition/goodsType.js'
import { FreshFishGameConfig } from '../definition/gameConfig.js'

export type StartAuction = Static<typeof StartAuction>
export const StartAuction = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.StartAuction),
            metadata: Type.Optional(
                Type.Object({
                    goodsType: Type.Enum(GoodsType)
                })
            )
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
    declare metadata: { goodsType: GoodsType }

    constructor(data: StartAuction) {
        super(data, StartAuctionValidator)
    }

    apply(state: HydratedFreshFishGameState, context?: MachineContext) {
        const chosenTile = state.chosenTile
        if (!isStallTile(chosenTile)) {
            throw Error('Cannot start auction without a chosen stall tile')
        }

        const turnOrder = state.turnManager.turnOrder
        const doubledTurnOrder = turnOrder.concat(state.turnManager.turnOrder) // So we don't have to worry about wrap

        const auctioneerIndex = turnOrder.findIndex((playerId) => playerId === this.playerId)

        const config = context?.gameConfig as FreshFishGameConfig
        const firstInOrderIndex = config?.auctioneerWinsTie ? auctioneerIndex : auctioneerIndex + 1
        const biddingOrder = range(firstInOrderIndex, turnOrder.length).map(
            (index) => doubledTurnOrder[index]
        )
        const validBidders = biddingOrder.filter((playerId) =>
            state.getPlayerState(playerId).hasUnplacedStall(chosenTile.goodsType)
        )
        const participants = validBidders.map((playerId) => ({ playerId: playerId, passed: false }))

        state.currentAuction = new HydratedSimultaneousAuction({
            id: this.id,
            type: AuctionType.Simultaneous,
            participants: participants,
            auctioneerId: this.playerId,
            tie: false,
            tieResolution: TieResolutionStrategy.FirstInOrder
        })

        this.metadata = { goodsType: chosenTile.goodsType }
    }
}
