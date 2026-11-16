import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { closeBuildingTurn, isBuildingTurnOf } from '../rules/buildingTurn.js'

export type EndBuildingMetadata = Type.Static<typeof EndBuildingMetadata>
export const EndBuildingMetadata = Type.Object({
    placed: Type.Integer({ minimum: 0 })
})

export type EndBuilding = Type.Static<typeof EndBuilding>
export const EndBuilding = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndBuilding),
            playerId: Type.String(),
            metadata: Type.Optional(EndBuildingMetadata)
        })
    ])
)

export const EndBuildingValidator = Compile(EndBuilding)

export function isEndBuilding(action?: GameAction): action is EndBuilding {
    return action?.type === ActionType.EndBuilding
}

export class HydratedEndBuilding
    extends HydratableAction<typeof EndBuilding>
    implements EndBuilding
{
    declare type: ActionType.EndBuilding
    declare playerId: string
    declare metadata?: EndBuildingMetadata

    constructor(data: EndBuilding) {
        super(data, EndBuildingValidator)
    }

    // R-3.2.1: the player "may" place, so the turn ends after any number of placements, none included.
    apply(state: HydratedRideTheRailsGameState, _context?: MachineContext) {
        assert(HydratedEndBuilding.canEnd(state, this.playerId), 'It is not your building turn')
        this.metadata = { placed: closeBuildingTurn(state) }
    }

    static canEnd(state: HydratedRideTheRailsGameState, playerId: string): boolean {
        return isBuildingTurnOf(state, playerId)
    }
}
