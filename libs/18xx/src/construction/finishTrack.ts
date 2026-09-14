import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import type { StationPlacementState } from '../stations/stationPlacement.js'
import type { ConstructionState } from './trackConstruction.js'

export const FinishTrack = Type.Object(
    { ...PlayerAction.properties, type: Type.Literal('FinishTrack'), companyId: Type.String() },
    { additionalProperties: false }
)
export type FinishTrack = Type.Static<typeof FinishTrack>
const Validator = Compile(FinishTrack)
export function isFinishTrack(action: GameAction): action is FinishTrack {
    return (
        action instanceof HydratedFinishTrack ||
        (action.type === 'FinishTrack' && Validator.Check(action))
    )
}
export class HydratedFinishTrack
    extends HydratableAction<typeof FinishTrack>
    implements FinishTrack
{
    declare type: 'FinishTrack'
    declare playerId: string
    declare companyId: string
    constructor(data: FinishTrack) {
        super(data instanceof HydratedFinishTrack ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & ConstructionState & StationPlacementState): void {
        const turn = state.trackStep
        assert(
            (this.source === ActionSource.User || this.source === ActionSource.System) &&
                state.activePlayerIds.includes(this.playerId) &&
                turn?.companyId === this.companyId &&
                !turn.completed &&
                controllingOwner(state, this.companyId)?.playerId === this.playerId,
            'Only the operating company’s controlling owner may finish track'
        )
        turn.completed = true
        state.stationStep = { companyId: this.companyId, placedStationIds: [], completed: false }
    }
}
