import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { addSettlements } from '../model/settling.js'
import { startingBaseSystemIds } from '../model/startingBases.js'

export type PlaceStartingBaseMetadata = Type.Static<typeof PlaceStartingBaseMetadata>
export const PlaceStartingBaseMetadata = Type.Object({
    settlements: Type.Number()
})

export type PlaceStartingBase = Type.Static<typeof PlaceStartingBase>
export const PlaceStartingBase = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceStartingBase),
            playerId: Type.String(),
            systemId: Type.String(),
            metadata: Type.Optional(PlaceStartingBaseMetadata)
        })
    ])
)

export const PlaceStartingBaseValidator = Compile(PlaceStartingBase)

export function isPlaceStartingBase(action?: GameAction): action is PlaceStartingBase {
    return action?.type === ActionType.PlaceStartingBase
}

export class HydratedPlaceStartingBase
    extends HydratableAction<typeof PlaceStartingBase>
    implements PlaceStartingBase
{
    declare type: ActionType.PlaceStartingBase
    declare playerId: string
    declare systemId: string
    declare metadata?: PlaceStartingBaseMetadata

    constructor(data: PlaceStartingBase) {
        super(data, PlaceStartingBaseValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!startingBaseSystemIds(state).includes(this.systemId)) {
            throw Error('Invalid PlaceStartingBase action')
        }
        const startingBase = state.scenarioDefinition().startingBase
        assertExists(startingBase, 'This scenario has no starting bases')
        addSettlements(state, this.playerId, this.systemId, startingBase.settlements)
        this.metadata = { settlements: startingBase.settlements }
    }
}
