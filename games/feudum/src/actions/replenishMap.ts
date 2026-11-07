import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MapGood, replenishMap } from '../model/dawn.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

export type ReplenishMapMetadata = Type.Static<typeof ReplenishMapMetadata>
export const ReplenishMapMetadata = Type.Object({
    /** R-4.12.4 In region order. */
    goods: Type.Array(MapGood)
})

export type ReplenishMap = Type.Static<typeof ReplenishMap>
export const ReplenishMap = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.ReplenishMap),
            source: Type.Literal(ActionSource.System),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(ReplenishMapMetadata)
        })
    ])
)

export const ReplenishMapValidator = Compile(ReplenishMap)

export function isReplenishMap(action?: GameAction): action is ReplenishMap {
    return action?.type === ActionType.ReplenishMap
}

export class HydratedReplenishMap
    extends HydratableAction<typeof ReplenishMap>
    implements ReplenishMap
{
    declare type: ActionType.ReplenishMap
    declare source: ActionSource.System
    declare revealsInfo: true
    declare metadata?: ReplenishMapMetadata

    constructor(data: ReplenishMap) {
        super(data, ReplenishMapValidator)
    }

    /** R-4.12.4, R-X.2 The draws are on the protected stream: always a barrier. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        this.metadata = { goods: replenishMap(state) }
    }
}
