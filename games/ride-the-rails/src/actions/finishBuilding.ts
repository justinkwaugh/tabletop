import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    assert,
    assertExists
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import {
    buildingTurnEnd,
    closeBuildingTurn,
    FinishBuildingReason,
    isBuildingTurnOf
} from '../rules/buildingTurn.js'

export type FinishBuildingMetadata = Type.Static<typeof FinishBuildingMetadata>
export const FinishBuildingMetadata = Type.Object({
    reason: FinishBuildingReason,
    placed: Type.Integer({ minimum: 0 })
})

export type FinishBuilding = Type.Static<typeof FinishBuilding>
export const FinishBuilding = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FinishBuilding),
            playerId: Type.String(),
            metadata: Type.Optional(FinishBuildingMetadata)
        })
    ])
)

export const FinishBuildingValidator = Compile(FinishBuilding)

export function isFinishBuilding(action?: GameAction): action is FinishBuilding {
    return action?.type === ActionType.FinishBuilding
}

// R-3.2.1, R-3.2.3, R-3.2.4: once nothing more is legal for the builder, their turn ends by
// itself, after a placement or as the turn opens. The Building state's entry calls this.
export function scheduleFinishBuilding(
    context: MachineContext<HydratedRideTheRailsGameState>,
    playerId: string
): boolean {
    const state = context.gameState
    if (!isBuildingTurnOf(state, playerId) || buildingTurnEnd(state, playerId) === undefined) {
        return false
    }
    context.addSystemAction(FinishBuilding, { playerId })
    return true
}

export class HydratedFinishBuilding
    extends HydratableAction<typeof FinishBuilding>
    implements FinishBuilding
{
    declare type: ActionType.FinishBuilding
    declare playerId: string
    declare metadata?: FinishBuildingMetadata

    constructor(data: FinishBuilding) {
        super(data, FinishBuildingValidator)
    }

    apply(state: HydratedRideTheRailsGameState, _context?: MachineContext) {
        assert(isBuildingTurnOf(state, this.playerId), 'It is not this player’s building turn')
        const reason = buildingTurnEnd(state, this.playerId)
        assertExists(reason, 'A placement is still legal, so the building turn goes on')
        this.metadata = { reason, placed: closeBuildingTurn(state) }
    }
}
