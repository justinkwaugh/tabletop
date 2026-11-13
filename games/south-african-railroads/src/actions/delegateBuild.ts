import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../maps/types.js'
import type { HydratedSarGameState } from '../model/gameState.js'

export type DelegateBuild = Type.Static<typeof DelegateBuild>
export const DelegateBuild = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DelegateBuild),
            playerId: Type.String(),
            railroadId: Type.Enum(RailroadId),
            builderId: Type.String()
        })
    ])
)

export const DelegateBuildValidator = Compile(DelegateBuild)

export function isDelegateBuild(action?: GameAction): action is DelegateBuild {
    return action?.type === ActionType.DelegateBuild
}

export class HydratedDelegateBuild
    extends HydratableAction<typeof DelegateBuild>
    implements DelegateBuild
{
    declare type: ActionType.DelegateBuild
    declare playerId: string
    declare railroadId: RailroadId
    declare builderId: string

    constructor(data: DelegateBuild) {
        super(data, DelegateBuildValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        assert(HydratedDelegateBuild.canDelegate(state, this.playerId), 'You must build yourself')
        assert(state.canBuild(this.railroadId), `${this.railroadId} cannot build`)
        assert(
            state.controls(this.railroadId, this.builderId),
            'Only a controlling shareholder can build'
        )
        state.delegation = { railroadId: this.railroadId, builderId: this.builderId }
    }

    static canDelegate(state: HydratedSarGameState, playerId: string): boolean {
        return (
            state.delegation === undefined &&
            state.turnPlayerId() === playerId &&
            state.ownBuildableRailroads(playerId).length === 0 &&
            state.buildableRailroads().length > 0
        )
    }
}
