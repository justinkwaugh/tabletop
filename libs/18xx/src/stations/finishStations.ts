import * as Type from 'typebox'
import { actsFor } from '../finance/receivership.js'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import type { StationPlacementState } from './stationPlacement.js'
export const FinishStations = Type.Object(
    { ...PlayerAction.properties, type: Type.Literal('FinishStations'), companyId: Type.String() },
    { additionalProperties: false }
)
export type FinishStations = Type.Static<typeof FinishStations>
const Validator = Compile(FinishStations)
export function isFinishStations(action: GameAction): action is FinishStations {
    return (
        action instanceof HydratedFinishStations ||
        (action.type === 'FinishStations' && Validator.Check(action))
    )
}
export class HydratedFinishStations
    extends HydratableAction<typeof FinishStations>
    implements FinishStations
{
    declare type: 'FinishStations'
    declare playerId: string
    declare companyId: string
    constructor(data: FinishStations) {
        super(data instanceof HydratedFinishStations ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & StationPlacementState): void {
        const step = state.stationStep
        assert(
            (this.source === ActionSource.User || this.source === ActionSource.System) &&
                state.activePlayerIds.includes(this.playerId) &&
                step?.companyId === this.companyId &&
                !step.completed &&
                actsFor(state, this.playerId, this.companyId),
            'Only the controlling owner may finish station placement'
        )
        step.completed = true
    }
}
