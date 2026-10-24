import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { dropTransferMarkers } from '../model/turnCycle.js'

export type ReduceTransferMarkersMetadata = Type.Static<typeof ReduceTransferMarkersMetadata>
export const ReduceTransferMarkersMetadata = Type.Object({
    arrivedShipIds: Type.Array(Type.String())
})

export type ReduceTransferMarkers = Type.Static<typeof ReduceTransferMarkers>
export const ReduceTransferMarkers = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ReduceTransferMarkers),
            metadata: Type.Optional(ReduceTransferMarkersMetadata)
        })
    ])
)

export const ReduceTransferMarkersValidator = Compile(ReduceTransferMarkers)

export function isReduceTransferMarkers(action?: GameAction): action is ReduceTransferMarkers {
    return action?.type === ActionType.ReduceTransferMarkers
}

// Turn step 2 of the campaign, after the economic phase (rulebook 1.0 and 1.1).
export class HydratedReduceTransferMarkers
    extends HydratableAction<typeof ReduceTransferMarkers>
    implements ReduceTransferMarkers
{
    declare type: ActionType.ReduceTransferMarkers
    declare metadata?: ReduceTransferMarkersMetadata

    constructor(data: ReduceTransferMarkers) {
        super(data, ReduceTransferMarkersValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = { arrivedShipIds: dropTransferMarkers(state) }
    }
}
