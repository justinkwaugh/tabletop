import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../maps/types.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { Payout, payShareholders } from '../model/payouts.js'

export type BuildConnectionMetadata = Type.Static<typeof BuildConnectionMetadata>
export const BuildConnectionMetadata = Type.Object({
    cost: Type.Number(),
    perShare: Type.Number(),
    payouts: Type.Array(Payout)
})

export type BuildConnection = Type.Static<typeof BuildConnection>
export const BuildConnection = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildConnection),
            playerId: Type.String(),
            metadata: Type.Optional(BuildConnectionMetadata),
            railroadId: Type.Enum(RailroadId),
            connectionId: Type.String()
        })
    ])
)

export const BuildConnectionValidator = Compile(BuildConnection)

export function isBuildConnection(action?: GameAction): action is BuildConnection {
    return action?.type === ActionType.BuildConnection
}

export class HydratedBuildConnection
    extends HydratableAction<typeof BuildConnection>
    implements BuildConnection
{
    declare type: ActionType.BuildConnection
    declare playerId: string
    declare metadata?: BuildConnectionMetadata
    declare railroadId: RailroadId
    declare connectionId: string

    constructor(data: BuildConnection) {
        super(data, BuildConnectionValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        assert(
            state.builderRailroads(this.playerId).includes(this.railroadId),
            'You cannot build for this railroad'
        )
        const connection = state
            .connectionBuilds(this.railroadId)
            .find((candidate) => candidate.id === this.connectionId)
        assert(connection !== undefined, 'That external connection cannot be built')
        const cost = state.connectionPrice(this.railroadId, connection)
        state.railroad(this.railroadId).treasury -= cost
        state.connections.push({ connectionId: this.connectionId, railroadId: this.railroadId })
        state.delegation = undefined
        const perShare = state.specialDividendPerShare(this.railroadId)
        this.metadata = {
            cost,
            perShare,
            payouts: payShareholders(state, [{ railroadId: this.railroadId, perShare }])
        }
    }

    static canBuildConnection(state: HydratedSarGameState, playerId: string): boolean {
        return (
            state.freeBuild === undefined &&
            state
                .builderRailroads(playerId)
                .some((railroadId) => state.connectionBuilds(railroadId).length > 0)
        )
    }
}
