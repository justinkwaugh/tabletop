import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { RailroadId } from '../data/railroads.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { shareRefusal, shareableRailroads } from '../rules/shares.js'
import { supplyOf } from '../rules/supply.js'

export type TakeShareMetadata = Type.Static<typeof TakeShareMetadata>
export const TakeShareMetadata = Type.Object({
    // The player's shares of the railroad after this one (R-3.1: no cap).
    shares: Type.Integer({ minimum: 1 }),
    // The railroad's supply after this share (R-1.1).
    supplyLeft: Type.Integer({ minimum: 0 })
})

export type TakeShare = Type.Static<typeof TakeShare>
export const TakeShare = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TakeShare),
            playerId: Type.String(),
            railroadId: RailroadId,
            metadata: Type.Optional(TakeShareMetadata)
        })
    ])
)

export const TakeShareValidator = Compile(TakeShare)

export function isTakeShare(action?: GameAction): action is TakeShare {
    return action?.type === ActionType.TakeShare
}

export class HydratedTakeShare extends HydratableAction<typeof TakeShare> implements TakeShare {
    declare type: ActionType.TakeShare
    declare playerId: string
    declare railroadId: RailroadId
    declare metadata?: TakeShareMetadata

    constructor(data: TakeShare) {
        super(data, TakeShareValidator)
    }

    // R-3.1: one locomotive of an available railroad (R-1.4) from its supply (R-1.1)
    // goes on the player's board as one share, with no cap (R-3.1).
    apply(state: HydratedRideTheRailsGameState, _context?: MachineContext) {
        assert(state.machineState === MachineState.TakingShares, 'Shares are taken in phase 1')
        assert(state.isActivePlayer(this.playerId), 'It is not your turn')
        const refusal = shareRefusal(state, this.railroadId)
        assert(refusal === undefined, `No share of ${this.railroadId} can be taken: ${refusal}`)

        const player = state.getPlayerState(this.playerId)
        const shares = player.sharesOf(this.railroadId) + 1
        player.shares[this.railroadId] = shares
        this.metadata = { shares, supplyLeft: supplyOf(state, this.railroadId) }
    }

    // R-3.1, R-1.1
    static canTakeShare(state: HydratedRideTheRailsGameState, playerId: string): boolean {
        return (
            state.machineState === MachineState.TakingShares &&
            state.isActivePlayer(playerId) &&
            shareableRailroads(state).length > 0
        )
    }
}
