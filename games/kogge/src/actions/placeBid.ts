import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { sortMarkers } from '../components/routeMarkers.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export type PlaceBid = Type.Static<typeof PlaceBid>
export const PlaceBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBid),
            playerId: Type.String(),
            markers: Type.Array(Type.Integer({ minimum: 0 }), { minItems: 1 })
        })
    ])
)

export const PlaceBidValidator = Compile(PlaceBid)

export function isPlaceBid(action?: GameAction): action is PlaceBid {
    return action?.type === ActionType.PlaceBid
}

export class HydratedPlaceBid extends HydratableAction<typeof PlaceBid> implements PlaceBid {
    declare type: ActionType.PlaceBid
    declare playerId: string
    declare markers: number[]

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!state.isValidBid(this.playerId, this.markers)) {
            throw Error('Invalid PlaceBid action')
        }
        state.getPlayerState(this.playerId).giveMarkers(this.markers)
        state.bids.push({ playerId: this.playerId, markers: sortMarkers(this.markers) })
    }

    static canPlaceBid(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.nextBidderId() === playerId && !state.mustPass(playerId)
    }
}
