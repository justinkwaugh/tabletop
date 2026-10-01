import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedMarracashGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { ShopIds, type ShopId } from '../components/board.js'

export type StartAuction = Type.Static<typeof StartAuction>
export const StartAuction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.StartAuction),
            playerId: Type.String(),
            shopId: Type.Enum(ShopIds)
        })
    ])
)

export const StartAuctionValidator = Compile(StartAuction)

export function isStartAuction(action?: GameAction): action is StartAuction {
    return action?.type === ActionType.StartAuction
}

export class HydratedStartAuction
    extends HydratableAction<typeof StartAuction>
    implements StartAuction
{
    declare type: ActionType.StartAuction
    declare playerId: string
    declare shopId: ShopId

    constructor(data: StartAuction) {
        super(data, StartAuctionValidator)
    }

    apply(state: HydratedMarracashGameState) {
        if (!state.canStartAuction(this.playerId)) {
            throw Error(`Player ${this.playerId} cannot start an auction now`)
        }
        if (state.getShopState(this.shopId).ownerId !== undefined) {
            throw Error(`Shop ${this.shopId} is already owned`)
        }
        state.startAuction(this.id, this.playerId, this.shopId)
    }
}
