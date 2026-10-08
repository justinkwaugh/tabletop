import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { compareBids } from '../model/bids.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { Delivery, deliverSupplies } from '../model/supplies.js'

export type ResolveAuction = Type.Static<typeof ResolveAuction>
export const ResolveAuction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source']),
        Type.Object({
            type: Type.Literal(ActionType.ResolveAuction),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(
                Type.Object({
                    deliveries: Type.Array(Delivery),
                    turnOrder: Type.Array(Type.String())
                })
            )
        })
    ])
)

export const ResolveAuctionValidator = Compile(ResolveAuction)

export function isResolveAuction(action?: GameAction): action is ResolveAuction {
    return action?.type === ActionType.ResolveAuction
}

export class HydratedResolveAuction
    extends HydratableAction<typeof ResolveAuction>
    implements ResolveAuction
{
    declare type: ActionType.ResolveAuction
    declare source: ActionSource.System
    declare metadata?: { deliveries: Delivery[]; turnOrder: string[] }

    constructor(data: ResolveAuction) {
        super(data, ResolveAuctionValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        const played = state.bids.flatMap((bid) => bid.markers)
        const deliveries = deliverSupplies(state.cities, state.supply, played)
        const previousOrder = state.turnManager.turnOrder
        const turnOrder = state.bids
            .toSorted(
                (a, b) =>
                    compareBids(b.markers, a.markers) ||
                    previousOrder.indexOf(a.playerId) - previousOrder.indexOf(b.playerId)
            )
            .map((bid) => bid.playerId)
        state.turnManager.turnOrder = turnOrder
        state.reserve.returnMarkers(played)
        this.metadata = { deliveries, turnOrder }
    }
}
