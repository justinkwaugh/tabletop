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
    apply(state: HydratedGameState & ConstructionState): void {
        const turn = state.trackStep
        assert(
            (this.source === ActionSource.User || this.source === ActionSource.System) &&
                state.activePlayerIds.includes(this.playerId) &&
                turn?.companyId === this.companyId &&
                !turn.completed &&
                actsFor(state, this.playerId, this.companyId),
            'Only the operating company’s controlling owner may finish track'
        )
        turn.completed = true
    }
}
