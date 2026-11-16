import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { RailroadId } from '../data/railroads.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { mustSkipShare } from '../rules/shares.js'
import { availableRailroads } from '../rules/supply.js'

export const SkipShareReason = Type.Literal('every-supply-empty')
export type SkipShareReason = Type.Static<typeof SkipShareReason>

export type SkipShareMetadata = Type.Static<typeof SkipShareMetadata>
export const SkipShareMetadata = Type.Object({
    reason: SkipShareReason,
    // The available railroads, each with an empty supply, in R-1.4 order.
    railroadIds: Type.Array(RailroadId)
})

export type SkipShare = Type.Static<typeof SkipShare>
export const SkipShare = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SkipShare),
            // The player whose phase 1 turn takes nothing.
            playerId: Type.String(),
            metadata: Type.Optional(SkipShareMetadata)
        })
    ])
)

export const SkipShareValidator = Compile(SkipShare)

export function isSkipShare(action?: GameAction): action is SkipShare {
    return action?.type === ActionType.SkipShare
}

export class HydratedSkipShare extends HydratableAction<typeof SkipShare> implements SkipShare {
    declare type: ActionType.SkipShare
    declare playerId: string
    declare metadata?: SkipShareMetadata

    constructor(data: SkipShare) {
        super(data, SkipShareValidator)
    }

    // R-3.1: the turn takes nothing when every available railroad's supply is empty.
    apply(state: HydratedRideTheRailsGameState, _context?: MachineContext) {
        assert(state.machineState === MachineState.TakingShares, 'Shares are taken in phase 1')
        assert(state.isActivePlayer(this.playerId), 'It is not that player’s turn')
        assert(mustSkipShare(state), 'A share can still be taken')
        this.metadata = { reason: 'every-supply-empty', railroadIds: availableRailroads(state) }
    }
}
