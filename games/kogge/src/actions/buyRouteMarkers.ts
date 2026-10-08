import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Good, goodCounts } from '../components/goods.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { TurnAction } from '../model/turn.js'

export type BuyRouteMarkers = Type.Static<typeof BuyRouteMarkers>
export const BuyRouteMarkers = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuyRouteMarkers),
            playerId: Type.String(),
            group: Type.Integer({ minimum: 0 }),
            good: Type.Enum(Good),
            metadata: Type.Optional(
                Type.Object({ markers: Type.Array(Type.Integer({ minimum: 0 })) })
            )
        })
    ])
)

export const BuyRouteMarkersValidator = Compile(BuyRouteMarkers)

export function isBuyRouteMarkers(action?: GameAction): action is BuyRouteMarkers {
    return action?.type === ActionType.BuyRouteMarkers
}

export class HydratedBuyRouteMarkers
    extends HydratableAction<typeof BuyRouteMarkers>
    implements BuyRouteMarkers
{
    declare type: ActionType.BuyRouteMarkers
    declare playerId: string
    declare group: number
    declare good: Good
    declare metadata?: { markers: number[] }

    constructor(data: BuyRouteMarkers) {
        super(data, BuyRouteMarkersValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        const group = state.offer[this.group]
        const player = state.getPlayerState(this.playerId)
        if (
            !state.canBuyRouteMarkers(this.playerId) ||
            group === undefined ||
            group.boughtBy !== undefined ||
            player.goods[this.good] === 0
        ) {
            throw Error('Invalid BuyRouteMarkers action')
        }
        state.pay(player, { goods: goodCounts({ [this.good]: 1 }), markers: [] })
        player.takeMarkers(group.markers)
        group.boughtBy = this.playerId
        state.recordTurnAction(this.playerId, TurnAction.BuyRouteMarkers)
        this.metadata = { markers: group.markers }
    }

    static canBuyRouteMarkers(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.canBuyRouteMarkers(playerId)
    }
}
