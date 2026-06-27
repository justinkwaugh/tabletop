import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { CanalSegment } from '../model/board.js'

export type ProposeCanal = Type.Static<typeof ProposeCanal>
export const ProposeCanal = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.ProposeCanal),
            segment: CanalSegment,
            amount: Type.Number({ minimum: 1, default: 1 })
        })
    ])
)

export const ProposeCanalValidator = Compile(ProposeCanal)

export function isProposeCanal(action: GameAction): action is ProposeCanal {
    return action.type === ActionType.ProposeCanal
}

export class HydratedProposeCanal
    extends HydratableAction<typeof ProposeCanal>
    implements ProposeCanal
{
    declare type: ActionType.ProposeCanal
    declare segment: CanalSegment
    declare amount: number

    constructor(data: ProposeCanal) {
        super(data, ProposeCanalValidator)
    }

    apply(state: HydratedSantiagoGameState) {
        if (!this.playerId) throw new Error('ProposeCanal requires a playerId')
        state.canalProposals.push({
            playerId: this.playerId,
            segment: this.segment,
            amount: this.amount
        })
    }
}
